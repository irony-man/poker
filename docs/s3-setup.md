# S3 bucket setup

Static assets (avatars, sounds, marketing images), user-uploaded profile photos, and admin-uploaded table sounds are stored in AWS S3.

## Bucket layout

| Prefix | Purpose | Access |
|--------|---------|--------|
| `static/avatars/` | Preset avatar PNGs | Public read |
| `static/sounds/` | Table SFX MP3s | Public read |
| `static/images/` | Marketing PNGs/SVGs | Public read |
| `uploads/avatars/{userId}/` | User-uploaded profile images | Public read |
| `uploads/sounds/{kind}/` | Admin-uploaded table sound overrides | Public read |

## 1. Create bucket

1. AWS Console → S3 → Create bucket (e.g. `felt-poker-assets`).
2. Pick a region and note it for `AWS_REGION`.
3. Block public access: **off** for this bucket (we serve public assets via bucket policy).

## 2. Bucket policy

Replace `pokr-static` and attach under **Permissions → Bucket policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadStaticAndAvatars",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::pokr-static/static/*",
        "arn:aws:s3:::pokr-static/uploads/avatars/*",
        "arn:aws:s3:::pokr-static/uploads/sounds/*"
      ]
    }
  ]
}
```

## 3. CORS

Under **Permissions → CORS**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://pokr.site",
      "https://felt-web.onrender.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add your `WEB_ORIGIN` if different.

## 4. IAM user for the server

Create an IAM user with programmatic access and attach this policy (replace bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::pokr-static/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::pokr-static"
    }
  ]
}
```

Use the access key and secret in server env vars.

## 5. Environment variables

**Server**

- `AWS_REGION` — e.g. `us-west-2`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET` — bucket name
- `S3_PUBLIC_BASE_URL` — optional; defaults to `https://{bucket}.s3.{region}.amazonaws.com`

**Web**

- `NEXT_PUBLIC_ASSETS_URL` — same base URL as `S3_PUBLIC_BASE_URL`

## 6. Upload static assets

After credentials are configured:

```bash
npm run sync:assets
```

This uploads `apps/web/public/avatars/`, `sounds/`, and marketing images to the `static/` prefix.
