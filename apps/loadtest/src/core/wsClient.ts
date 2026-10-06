import type { ClientMessage } from '@poker/protocol';
import WebSocket from 'ws';
import type { Metrics } from './stats.js';

export type ServerMessage = { type: string; [key: string]: unknown };

export type AuthOk = {
  userId: string;
  name: string;
  chipBalance?: number;
};

type Waiter = {
  match: (msg: ServerMessage) => boolean;
  resolve: (msg: ServerMessage) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

/**
 * One load-test WebSocket. Records connect / auth / ping timings, message counts by type,
 * server `error` codes, and unexpected drops into the shared metrics.
 */
export class LtSocket {
  private ws: WebSocket | null = null;
  private readonly handlers = new Set<(msg: ServerMessage) => void>();
  private readonly waiters = new Set<Waiter>();
  private readonly seenTypes = new Set<string>();
  private pingSentAt: number[] = [];
  private pingTimer: NodeJS.Timeout | null = null;
  private closing = false;
  private opened = false;
  /** Called once when the socket closes without `close()` being called. */
  onDrop: ((code: number) => void) | null = null;

  constructor(
    private readonly url: string,
    private readonly metrics: Metrics,
    private readonly loadtestToken = '',
  ) {}

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(timeoutMs = 15_000): Promise<void> {
    const started = performance.now();
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (this.loadtestToken) headers['x-loadtest-token'] = this.loadtestToken;
      const ws = new WebSocket(this.url, { headers, handshakeTimeout: timeoutMs, perMessageDeflate: false });
      this.ws = ws;
      let settled = false;

      ws.on('open', () => {
        settled = true;
        this.opened = true;
        this.metrics.wsOpened();
        this.metrics.observe('ws.connect', performance.now() - started);
        resolve();
      });
      ws.on('message', (raw) => this.handleRaw(raw));
      ws.on('error', (err) => {
        if (!settled) {
          settled = true;
          this.metrics.fail(`ws connect: ${shortError(err)}`);
          reject(err);
        }
      });
      ws.on('close', (code) => {
        this.stopPing();
        if (this.opened) this.metrics.wsClosed();
        this.opened = false;
        for (const w of this.waiters) {
          clearTimeout(w.timer);
          w.reject(new Error(`socket closed (${code})`));
        }
        this.waiters.clear();
        if (!settled) {
          settled = true;
          this.metrics.fail(`ws connect: closed ${code}`);
          reject(new Error(`socket closed during connect (${code})`));
          return;
        }
        if (!this.closing) {
          this.metrics.count('ws.drops');
          this.metrics.fail(`ws dropped: ${code}`);
          this.onDrop?.(code);
        }
      });
    });
  }

  private handleRaw(raw: WebSocket.RawData): void {
    this.metrics.wsIn();
    let msg: ServerMessage;
    try {
      msg = JSON.parse(String(raw)) as ServerMessage;
    } catch {
      this.metrics.fail('ws bad json from server');
      return;
    }
    if (typeof msg?.type !== 'string') return;
    this.seenTypes.add(msg.type);
    this.metrics.count(`ws.in.${msg.type}`);

    if (msg.type === 'pong') {
      const sentAt = this.pingSentAt.shift();
      if (sentAt !== undefined) this.metrics.observe('ws.ping', performance.now() - sentAt);
    } else if (msg.type === 'error') {
      const code = typeof msg.code === 'string' ? msg.code : null;
      const message = typeof msg.message === 'string' ? msg.message : 'error';
      this.metrics.fail(`ws error: ${code ?? message}`);
    }

    for (const w of this.waiters) {
      if (w.match(msg)) {
        clearTimeout(w.timer);
        this.waiters.delete(w);
        w.resolve(msg);
      }
    }
    for (const h of this.handlers) h(msg);
  }

  onMessage(handler: (msg: ServerMessage) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  hasSeen(type: string): boolean {
    return this.seenTypes.has(type);
  }

  waitFor(match: (msg: ServerMessage) => boolean, timeoutMs = 15_000, label = 'message'): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        match,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters.delete(waiter);
          reject(new Error(`timeout waiting for ${label}`));
        }, timeoutMs),
      };
      this.waiters.add(waiter);
    });
  }

  send(msg: ClientMessage): boolean {
    if (!this.isOpen) return false;
    this.ws!.send(JSON.stringify(msg));
    this.metrics.wsOut();
    return true;
  }

  /** Send `auth` and resolve on `auth_ok`; rejects on `bad_auth`. Records `ws.auth`. */
  async auth(ticket: string, timeoutMs = 15_000): Promise<AuthOk> {
    const started = performance.now();
    const reply = this.waitFor(
      (m) => m.type === 'auth_ok' || (m.type === 'error' && m.code === 'bad_auth'),
      timeoutMs,
      'auth_ok',
    );
    this.send({ type: 'auth', ticket });
    const msg = await reply;
    if (msg.type !== 'auth_ok') throw new Error('bad_auth');
    this.metrics.observe('ws.auth', performance.now() - started);
    return msg as unknown as AuthOk;
  }

  /** Periodic `ping`; at most a few unanswered pings are tracked so RTTs stay paired. */
  startPing(intervalMs: number): void {
    this.stopPing();
    const jitter = Math.floor(Math.random() * intervalMs);
    const fire = () => {
      if (!this.isOpen) return;
      if (this.pingSentAt.length >= 3) {
        this.metrics.count('ws.ping_unanswered');
        this.pingSentAt.shift();
      }
      this.pingSentAt.push(performance.now());
      this.send({ type: 'ping' });
    };
    this.pingTimer = setTimeout(() => {
      fire();
      this.pingTimer = setInterval(fire, intervalMs);
    }, jitter);
  }

  stopPing(): void {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.pingSentAt = [];
  }

  /** Graceful close (not counted as a drop). Resolves once closed or after a short grace period. */
  close(): Promise<void> {
    this.closing = true;
    this.stopPing();
    const ws = this.ws;
    if (!ws || ws.readyState === WebSocket.CLOSED) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        ws.terminate();
        resolve();
      }, 2000);
      ws.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      if (ws.readyState === WebSocket.CONNECTING) ws.terminate();
      else ws.close(1000, 'loadtest done');
    });
  }
}

function shortError(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code;
    return code ?? err.message.slice(0, 80);
  }
  return String(err).slice(0, 80);
}
