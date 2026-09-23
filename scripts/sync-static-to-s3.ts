#!/usr/bin/env tsx
/**
 * Upload static web assets to S3 under the `static/` prefix.
 *
 *   npm run sync:assets                         # upload .webp rasters + svg/mp3 as-is
 *   tsx scripts/sync-static-to-s3.ts --write-local-only   # PNG/JPEG → .webp in public/
 */
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'apps/web/public');

for (const envFile of [path.join(root, '.env'), path.join(root, 'apps/server/.env')]) {
  if (existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

const SOURCE_RASTER_EXT = new Set(['.png', '.jpg', '.jpeg']);

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.webp': 'image/webp',
};

/** PNG sources at public root; synced to static/images/*.webp (or svg unchanged). */
const STATIC_IMAGES = [
  'chips-stack.png',
  'currency.svg',
  'home-challenge.png',
  'home-host.png',
  'home-knockout.png',
  'home-ludo.png',
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
  const aliases: Record<string, string[]> = {
    AWS_REGION: ['AWS_DEFAULT_REGION'],
  };
  const keys = [name, ...(aliases[name] ?? [])];
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new Error(
    `Missing required env var: ${name} (set it in ${path.join(root, '.env')} or export before running)`,
  );
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

function webpBasename(sourcePath: string): string {
  const ext = path.extname(sourcePath);
  return `${path.basename(sourcePath, ext)}.webp`;
}

async function transcodeToWebp(localPath: string): Promise<Buffer> {
  const input = await readFile(localPath);
  const originalSize = input.length;
  const body = await sharp(input).webp({ quality: 82, effort: 4 }).toBuffer();
  console.log(
    `  ${path.basename(localPath)} → WebP ${Math.round(originalSize / 1024)}KB → ${Math.round(body.length / 1024)}KB`,
  );
  return body;
}

/** Build local WebP files from PNG/JPEG sources (does not touch S3). */
async function writeLocalWebp(): Promise<void> {
  const jobs: { source: string; outPath: string }[] = [];

  for (const file of await listFiles(path.join(publicDir, 'avatars'))) {
    const ext = path.extname(file).toLowerCase();
    if (!SOURCE_RASTER_EXT.has(ext)) continue;
    jobs.push({
      source: file,
      outPath: path.join(path.dirname(file), webpBasename(file)),
    });
  }

  for (const name of STATIC_IMAGES) {
    const ext = path.extname(name).toLowerCase();
    if (!SOURCE_RASTER_EXT.has(ext)) continue;
    jobs.push({
      source: path.join(publicDir, name),
      outPath: path.join(publicDir, webpBasename(name)),
    });
  }

  for (const file of await listFiles(path.join(publicDir, 'ludo'))) {
    const ext = path.extname(file).toLowerCase();
    if (!SOURCE_RASTER_EXT.has(ext)) continue;
    jobs.push({
      source: file,
      outPath: path.join(path.dirname(file), webpBasename(file)),
    });
  }

  if (jobs.length === 0) {
    console.log('No raster sources to transcode.');
    return;
  }

  console.log(`Transcoding ${jobs.length} files to WebP…`);
  for (const { source, outPath } of jobs) {
    try {
      await stat(source);
    } catch {
      continue;
    }
    const body = await transcodeToWebp(source);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, body);
    console.log(`  wrote ${path.relative(root, outPath)}`);
  }
  console.log('Done.');
}

/** Upload existing public assets; rasters are .webp only (no PNG on S3). */
async function uploadToS3(): Promise<void> {
  const uploads: { localPath: string; key: string; contentType: string }[] = [];

  for (const file of await listFiles(path.join(publicDir, 'avatars'))) {
    if (path.extname(file).toLowerCase() !== '.webp') continue;
    uploads.push({
      localPath: file,
      key: `static/avatars/${path.basename(file)}`,
      contentType: 'image/webp',
    });
  }

  for (const file of await listFiles(path.join(publicDir, 'sounds'))) {
    if (path.extname(file).toLowerCase() !== '.mp3') continue;
    uploads.push({
      localPath: file,
      key: `static/sounds/${path.basename(file)}`,
      contentType: 'audio/mpeg',
    });
  }

  for (const file of await listFiles(path.join(publicDir, 'ludo'))) {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.svg') {
      uploads.push({
        localPath: file,
        key: `static/ludo/${path.basename(file)}`,
        contentType: 'image/svg+xml',
      });
    } else if (ext === '.webp') {
      uploads.push({
        localPath: file,
        key: `static/ludo/${path.basename(file)}`,
        contentType: 'image/webp',
      });
    }
  }

  for (const name of STATIC_IMAGES) {
    const ext = path.extname(name).toLowerCase();
    if (ext === '.svg') {
      const localPath = path.join(publicDir, name);
      try {
        if (!(await stat(localPath)).isFile()) continue;
      } catch {
        continue;
      }
      uploads.push({
        localPath,
        key: `static/images/${name}`,
        contentType: 'image/svg+xml',
      });
      continue;
    }
    if (SOURCE_RASTER_EXT.has(ext)) {
      const webpName = webpBasename(name);
      const localPath = path.join(publicDir, webpName);
      try {
        if (!(await stat(localPath)).isFile()) {
          console.warn(`  skip ${webpName} (missing — run --write-local-only first)`);
          continue;
        }
      } catch {
        console.warn(`  skip ${webpName} (missing — run --write-local-only first)`);
        continue;
      }
      uploads.push({
        localPath,
        key: `static/images/${webpName}`,
        contentType: 'image/webp',
      });
    }
  }

  if (uploads.length === 0) {
    console.log('No files to upload.');
    return;
  }

  const region = requireEnv('AWS_REGION');
  const bucket = requireEnv('S3_BUCKET');
  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
  });

  console.log(`Uploading ${uploads.length} files to s3://${bucket}/static/ …`);
  for (const { localPath, key, contentType } of uploads) {
    const body = await readFile(localPath);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    console.log(`  s3://${bucket}/${key} (${Math.round(body.length / 1024)}KB)`);
  }
  console.log('Done.');
}

async function main(): Promise<void> {
  if (process.argv.includes('--write-local-only') || process.argv.includes('--write-local')) {
    await writeLocalWebp();
    return;
  }
  await uploadToS3();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
