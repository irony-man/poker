/** WebRTC signaling payload relayed server-side between table voice participants. */
export type VoiceSignalPayload =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | {
      type: 'ice';
      candidate: {
        candidate?: string;
        sdpMid?: string | null;
        sdpMLineIndex?: number | null;
        usernameFragment?: string;
      } | null;
    };

export interface VoicePeer {
  userId: string;
  name: string;
}

export type VoiceServerMessage =
  | { type: 'voice_roster'; peers: VoicePeer[] }
  | { type: 'voice_peer_joined'; userId: string; name: string }
  | { type: 'voice_peer_left'; userId: string }
  | { type: 'voice_signal'; fromUserId: string; signal: VoiceSignalPayload };
