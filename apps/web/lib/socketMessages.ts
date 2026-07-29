type SocketListener = (msg: unknown) => void;

const listeners = new Set<SocketListener>();

export function emitSocketMessage(msg: unknown): void {
  for (const listener of listeners) {
    listener(msg);
  }
}

export function subscribeSocketMessages(listener: SocketListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
