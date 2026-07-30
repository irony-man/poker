'use client';

import type { VoicePeer, VoiceSignalPayload } from '@poker/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeSocketMessages } from '@/lib/socketMessages';
import { VoiceCallSession, type VoiceCallSnapshot } from '@/lib/voiceCall';

const IDLE: VoiceCallSnapshot = {
  state: 'idle',
  muted: true,
  cameraOn: false,
  wantsVideo: false,
  peers: [],
  error: null,
  localStream: null,
  remoteStreams: [],
};

export function useVoiceCall(
  tableId: string,
  userId: string | null | undefined,
  send: (payload: unknown) => void,
) {
  const sessionRef = useRef<VoiceCallSession | null>(null);
  const inVoiceRef = useRef(false);
  const [snap, setSnap] = useState<VoiceCallSnapshot>(IDLE);

  const sendSignal = useCallback(
    (toUserId: string, signal: VoiceSignalPayload) => {
      send({ type: 'voice_signal', tableId, toUserId, signal });
    },
    [send, tableId],
  );

  useEffect(() => {
    if (!userId) return;
    const session = new VoiceCallSession(userId, sendSignal);
    sessionRef.current = session;
    return session.subscribe(setSnap);
  }, [userId, sendSignal]);

  useEffect(() => {
    return subscribeSocketMessages((raw: unknown) => {
      const msg = raw as { type?: string };
      const session = sessionRef.current;
      if (!session || !inVoiceRef.current) return;

      switch (msg.type) {
        case 'voice_roster':
          void session.applyRoster((msg as { peers: VoicePeer[] }).peers ?? []);
          break;
        case 'voice_peer_joined': {
          const m = msg as { userId: string; name: string };
          session.onPeerJoined({ userId: m.userId, name: m.name });
          break;
        }
        case 'voice_peer_left':
          session.onPeerLeft((msg as { userId: string }).userId);
          break;
        case 'voice_signal':
          void session.handleSignal(
            (msg as { fromUserId: string; signal: VoiceSignalPayload }).fromUserId,
            (msg as { fromUserId: string; signal: VoiceSignalPayload }).signal,
          );
          break;
        default:
          break;
      }
    });
  }, []);

  const joinCall = useCallback(
    async (opts: { video?: boolean } = {}) => {
      const session = sessionRef.current;
      if (!session || inVoiceRef.current) return;
      inVoiceRef.current = true;
      try {
        await session.join(opts);
        send({ type: 'voice_join', tableId });
      } catch {
        inVoiceRef.current = false;
        session.leave();
      }
    },
    [send, tableId],
  );

  const joinVoice = useCallback(async () => {
    await joinCall({ video: false });
  }, [joinCall]);

  const leaveVoice = useCallback(() => {
    if (!inVoiceRef.current) return;
    inVoiceRef.current = false;
    send({ type: 'voice_leave', tableId });
    sessionRef.current?.leave();
  }, [send, tableId]);

  const toggleMute = useCallback(() => {
    sessionRef.current?.toggleMuted();
  }, []);

  useEffect(() => {
    return () => {
      if (inVoiceRef.current) {
        send({ type: 'voice_leave', tableId });
        inVoiceRef.current = false;
      }
      sessionRef.current?.leave();
    };
  }, [send, tableId]);

  return {
    ...snap,
    inVoice: snap.state === 'connected' || snap.state === 'joining',
    joinVoice,
    leaveVoice,
    toggleMute,
  };
}
