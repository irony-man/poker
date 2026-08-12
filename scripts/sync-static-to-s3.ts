#!/usr/bin/env tsx
/**
 * Upload static web assets to S3 under the `static/` prefix.
 * Requires AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET.
 */
import 'dotenv/config';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'apps/web/public');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.webp': 'image/webp',
};

const STATIC_IMAGES = [
  'chips-stack.png',
  'currency.svg',
  'home-challenge.png',
  'home-host.png',
  'home-knockout.png',
  'home-offline.png',
  'host-table.png',
  'join-table.png',
  'poker-chip-shuffle.svg',
  'pokr-logo.png',
  'public-tables.png',
  'purple-logo.png',
  'SuitClubs.svg',
  'SuitDiamonds.svg',
  'SuitHearts.svg',
  'SuitSpades.svg',
];

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFiles(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const region = requireEnv('AWS_REGION');
  const bucket = requireEnv('S3_BUCKET');
  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
  });

  const uploads: { localPath: string; key: string }[] = [];

  for (const file of await listFiles(path.join(publicDir, 'avatars'))) {
    uploads.push({
      localPath: file,
      key: `static/avatars/${path.basename(file)}`,
    });
  }

  for (const file of await listFiles(path.join(publicDir, 'sounds'))) {
    if (path.extname(file).toLowerCase() !== '.mp3') continue;
    uploads.push({
      localPath: file,
      key: `static/sounds/${path.basename(file)}`,
    });
  }

  for (const name of STATIC_IMAGES) {
    const localPath = path.join(publicDir, name);
    try {
      const info = await stat(localPath);
      if (info.isFile()) {
        uploads.push({ localPath, key: `static/images/${name}` });
      }
    } catch {
      /* skip missing */
    }
  }

  if (uploads.length === 0) {
    console.log('No files to upload.');
    return;
  }

  console.log(`Uploading ${uploads.length} files to s3://${bucket}/static/ ...`);
  for (const { localPath, key } of uploads) {
    const ext = path.extname(localPath).toLowerCase();
    const contentType = MIME[ext] ?? 'application/octet-stream';
    const body = await readFile(localPath);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    console.log(`  ${key}`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
