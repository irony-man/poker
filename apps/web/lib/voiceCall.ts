import type { VoicePeer, VoiceSignalPayload } from '@poker/protocol';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export type VoiceCallState = 'idle' | 'joining' | 'connected' | 'error';

export interface VoiceCallSnapshot {
  state: VoiceCallState;
  muted: boolean;
  peers: VoicePeer[];
  error: string | null;
}

type Listener = (snap: VoiceCallSnapshot) => void;

/** Mesh WebRTC voice — new joiners offer to everyone already in the roster. */
export class VoiceCallSession {
  private localStream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private remoteAudio = new Map<string, HTMLAudioElement>();
  private roster = new Map<string, VoicePeer>();
  private state: VoiceCallState = 'idle';
  private muted = true;
  private error: string | null = null;
  private listeners = new Set<Listener>();

  constructor(
    private userId: string,
    private sendSignal: (toUserId: string, signal: VoiceSignalPayload) => void,
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private snapshot(): VoiceCallSnapshot {
    return {
      state: this.state,
      muted: this.muted,
      peers: [...this.roster.values()].filter((p) => p.userId !== this.userId),
      error: this.error,
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }

  async join(): Promise<void> {
    if (this.state === 'joining' || this.state === 'connected') return;
    this.state = 'joining';
    this.error = null;
    this.emit();
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.setMuted(true);
      this.state = 'connected';
      this.emit();
    } catch (err) {
      this.state = 'error';
      this.error =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : 'Could not access microphone';
      this.emit();
      throw err;
    }
  }

  leave(): void {
    for (const pc of this.peers.values()) pc.close();
    this.peers.clear();
    for (const audio of this.remoteAudio.values()) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
    this.remoteAudio.clear();
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop();
      this.localStream = null;
    }
    this.roster.clear();
    this.state = 'idle';
    this.error = null;
    this.muted = true;
    this.emit();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
    this.emit();
  }

  toggleMuted(): void {
    this.setMuted(!this.muted);
  }

  async applyRoster(peers: VoicePeer[]): Promise<void> {
    this.roster = new Map(peers.map((p) => [p.userId, p]));
    if (this.state !== 'connected') return;
    for (const peer of peers) {
      if (peer.userId === this.userId) continue;
      if (!this.peers.has(peer.userId)) {
        await this.createOffer(peer.userId);
      }
    }
    this.emit();
  }

  onPeerJoined(peer: VoicePeer): void {
    this.roster.set(peer.userId, peer);
    this.emit();
  }

  onPeerLeft(peerId: string): void {
    this.roster.delete(peerId);
    this.peers.get(peerId)?.close();
    this.peers.delete(peerId);
    const audio = this.remoteAudio.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.remoteAudio.delete(peerId);
    }
    this.emit();
  }

  async handleSignal(fromUserId: string, signal: VoiceSignalPayload): Promise<void> {
    if (fromUserId === this.userId) return;
    const pc = await this.ensurePeer(fromUserId);
    if (signal.type === 'offer') {
      await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (answer.sdp) {
        this.sendSignal(fromUserId, { type: 'answer', sdp: answer.sdp });
      }
    } else if (signal.type === 'answer') {
      await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
    } else if (signal.type === 'ice') {
      if (signal.candidate) {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch {
          /* ignore stale candidates */
        }
      }
    }
  }

  private async createOffer(peerId: string): Promise<void> {
    const pc = await this.ensurePeer(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (offer.sdp) {
      this.sendSignal(peerId, { type: 'offer', sdp: offer.sdp });
    }
  }

  private async ensurePeer(peerId: string): Promise<RTCPeerConnection> {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(peerId, pc);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.sendSignal(peerId, {
          type: 'ice',
          candidate: {
            candidate: ev.candidate.candidate ?? undefined,
            sdpMid: ev.candidate.sdpMid,
            sdpMLineIndex: ev.candidate.sdpMLineIndex,
            usernameFragment: ev.candidate.usernameFragment ?? undefined,
          },
        });
      }
    };

    pc.ontrack = (ev) => {
      let audio = this.remoteAudio.get(peerId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.remoteAudio.set(peerId, audio);
      }
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      audio.srcObject = stream;
      void audio.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.onPeerLeft(peerId);
      }
    };

    return pc;
  }
}
