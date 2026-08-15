import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { resolvePublicImage } from '@/lib/assets';

export function AdminImageField({
  image,
  imageAlt,
  disabled,
  uploading,
  uploadDisabled,
  onImage,
  onImageAlt,
  onUpload,
}: {
  image: string;
  imageAlt: string;
  disabled?: boolean;
  uploading?: boolean;
  uploadDisabled?: boolean;
  onImage: (value: string) => void;
  onImageAlt: (value: string) => void;
  onUpload: () => void;
}) {
  const preview = image.trim() ? resolvePublicImage(image.trim()) : '';
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <TextField
          label="Image path or URL"
          value={image}
          onChange={(e) => onImage(e.target.value)}
          placeholder="/host-table.png"
          maxLength={500}
        />
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || uploading || uploadDisabled}
          onClick={onUpload}
          className="min-h-11 px-4 text-xs"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
      <TextField
        label="Image alt"
        value={imageAlt}
        onChange={(e) => onImageAlt(e.target.value)}
        maxLength={200}
      />
      {preview ? (
        <div className="relative aspect-[5/4] max-w-xs overflow-hidden rounded-xl border border-sidebar/10 bg-mushroom/30">
          {/* Admin preview of arbitrary local/S3 URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-full w-full object-contain object-center" />
        </div>
      ) : null}
      {uploadDisabled ? (
        <p className="text-xs text-ink-strong-muted">
          File uploads require AWS env vars on the server (S3_BUCKET, AWS_ACCESS_KEY_ID, etc.).
        </p>
      ) : null}
    </div>
  );
}
