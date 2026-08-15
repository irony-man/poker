import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { SoundUploadUrlBodySchema } from '@poker/protocol';
import { AdminController } from './admin/admin.controller.js';
import { StorageService } from './storage/storage.service.js';

function makeStorage(env: Record<string, string>): StorageService {
  const config = {
    get: (key: string) => env[key],
  } as ConfigService;
  return new StorageService(config);
}

describe('StorageService sound uploads', () => {
  it('generates keys under uploads/sounds/{kind}/', () => {
    const storage = makeStorage({
      S3_BUCKET: 'test-bucket',
      S3_PUBLIC_BASE_URL: 'https://test-bucket.s3.us-west-2.amazonaws.com',
      AWS_REGION: 'us-west-2',
    });
    expect(storage.soundUploadKey('fold', 'mp3')).toMatch(/^uploads\/sounds\/fold\/.+\.mp3$/);
  });

  it('recognizes allowed sound URLs on this bucket', () => {
    const storage = makeStorage({
      S3_PUBLIC_BASE_URL: 'https://test-bucket.s3.us-west-2.amazonaws.com',
    });
    expect(
      storage.isAllowedSoundUrl(
        'https://test-bucket.s3.us-west-2.amazonaws.com/uploads/sounds/fold/abc.mp3',
      ),
    ).toBe(true);
    expect(storage.isAllowedSoundUrl('https://other.example.com/file.mp3')).toBe(false);
  });

  it('reports unconfigured when bucket or credentials missing', () => {
    const storage = makeStorage({ S3_BUCKET: 'test-bucket' });
    expect(storage.isConfigured()).toBe(false);
  });
});

describe('SoundUploadUrlBodySchema', () => {
  it('accepts valid MP3 upload requests', () => {
    const parsed = SoundUploadUrlBodySchema.safeParse({
      kind: 'fold',
      contentType: 'audio/mpeg',
      contentLength: 120_000,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects oversized files', () => {
    const parsed = SoundUploadUrlBodySchema.safeParse({
      kind: 'win',
      contentType: 'audio/mp3',
      contentLength: 6 * 1024 * 1024,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('AdminController soundUploadUrl', () => {
  const site = {
    getSounds: () => ({ enabled: true, urls: {} }),
    setSounds: async (v: unknown) => v,
  };
  const auth = { listUsers: () => [] };
  const wallet = {};
  const rooms = {};
  const contests = {};

  it('returns 503 when storage is not configured', async () => {
    const storage = makeStorage({});
    const controller = new AdminController(
      site as never,
      auth as never,
      wallet as never,
      rooms as never,
      contests as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      storage,
    );
    await expect(
      controller.soundUploadUrl({
        kind: 'fold',
        contentType: 'audio/mpeg',
        contentLength: 1024,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
