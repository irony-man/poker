import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createKv, MemoryKv, type KvStore } from './kv.store.js';

@Injectable()
export class KvService implements OnModuleInit, OnModuleDestroy {
  private store: KvStore = new MemoryKv();
  private connecting: Promise<void> | null = null;

  async onModuleInit(): Promise<void> {
    await this.ready();
  }

  /** Idempotent; lets consumers in other modules wait for the connection regardless of hook order. */
  ready(): Promise<void> {
    this.connecting ??= createKv().then((store) => {
      this.store = store;
    });
    return this.connecting;
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.close();
  }

  asStore(): KvStore {
    return this.store;
  }

  isRedis(): boolean {
    return this.store.kind === 'redis';
  }

  get(key: string): Promise<string | null> {
    return this.store.get(key);
  }

  set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    return this.store.set(key, value, ttlSeconds);
  }

  getDel(key: string): Promise<string | null> {
    return this.store.getDel(key);
  }

  del(...keys: string[]): Promise<void> {
    return this.store.del(...keys);
  }

  ttl(key: string): Promise<number> {
    return this.store.ttl(key);
  }

  expire(key: string, ttlSeconds: number): Promise<boolean> {
    return this.store.expire(key, ttlSeconds);
  }

  incr(key: string, ttlSeconds?: number): Promise<number> {
    return this.store.incr(key, ttlSeconds);
  }

  sAdd(key: string, member: string, ttlSeconds?: number): Promise<void> {
    return this.store.sAdd(key, member, ttlSeconds);
  }

  sMembers(key: string): Promise<string[]> {
    return this.store.sMembers(key);
  }

  sRem(key: string, member: string): Promise<void> {
    return this.store.sRem(key, member);
  }

  publish(channel: string, message: string): Promise<void> {
    return this.store.publish(channel, message);
  }

  subscribe(channel: string, handler: (message: string) => void): Promise<() => void> {
    return this.store.subscribe(channel, handler);
  }
}
