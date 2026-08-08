import { Injectable, OnModuleInit } from '@nestjs/common';
import { createKv, MemoryKv, type KvStore } from './kv.store.js';

@Injectable()
export class KvService implements OnModuleInit {
  private store: KvStore = new MemoryKv();

  async onModuleInit(): Promise<void> {
    this.store = await createKv();
  }

  asStore(): KvStore {
    return this.store;
  }

  get(key: string): Promise<string | null> {
    return this.store.get(key);
  }

  set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    return this.store.set(key, value, ttlSeconds);
  }

  del(key: string): Promise<void> {
    return this.store.del(key);
  }

  publish(channel: string, message: string): Promise<void> {
    return this.store.publish(channel, message);
  }

  subscribe(channel: string, handler: (message: string) => void): Promise<() => void> {
    return this.store.subscribe(channel, handler);
  }
}
