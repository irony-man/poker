import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import { PRESIGNED_UPLOAD_EXPIRES_SEC } from './storage.constants.js';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION') ?? 'us-east-1';
    this.bucket = this.config.get<string>('S3_BUCKET') ?? '';
    this.publicBaseUrl = (
      this.config.get<string>('S3_PUBLIC_BASE_URL') ??
      (this.bucket ? `https://${this.bucket}.s3.${region}.amazonaws.com` : '')
    ).replace(/\/$/, '');

    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  isConfigured(): boolean {
    return Boolean(
      this.bucket &&
        this.config.get<string>('AWS_ACCESS_KEY_ID') &&
        this.config.get<string>('AWS_SECRET_ACCESS_KEY'),
    );
  }

  getPublicBaseUrl(): string {
    return this.publicBaseUrl;
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key.replace(/^\//, '')}`;
  }

  keyFromPublicUrl(url: string): string | null {
    const prefix = `${this.publicBaseUrl}/`;
    if (!url.startsWith(prefix)) return null;
    return url.slice(prefix.length);
  }

  isAllowedAvatarUrl(url: string): boolean {
    const key = this.keyFromPublicUrl(url);
    if (!key) return false;
    return key.startsWith('uploads/avatars/');
  }

  isAllowedSoundUrl(url: string): boolean {
    const key = this.keyFromPublicUrl(url);
    if (!key) return false;
    return key.startsWith('uploads/sounds/');
  }

  isAllowedSiteImageUrl(url: string): boolean {
    const key = this.keyFromPublicUrl(url);
    if (!key) return false;
    return key.startsWith('uploads/images/');
  }

  avatarUploadKey(userId: string, ext: string): string {
    return `uploads/avatars/${userId}/${nanoid()}.${ext}`;
  }

  soundUploadKey(kind: string, ext: string): string {
    return `uploads/sounds/${kind}/${nanoid()}.${ext}`;
  }

  siteImageUploadKey(purpose: string, ext: string): string {
    return `uploads/images/${purpose}/${nanoid()}.${ext}`;
  }

  async createPresignedUpload(params: {
    key: string;
    contentType: string;
    contentLength: number;
  }): Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
      ContentLength: params.contentLength,
    });
    const expiresIn = PRESIGNED_UPLOAD_EXPIRES_SEC;
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn });
    return {
      uploadUrl,
      publicUrl: this.publicUrl(params.key),
      expiresIn,
    };
  }

  async headObject(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      /* ignore missing objects */
    }
  }

  async putObject(params: {
    key: string;
    body: Buffer | Uint8Array;
    contentType: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
  }
}
