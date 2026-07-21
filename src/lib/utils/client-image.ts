// F11: the client-side profile-photo pipeline. One master spec for every
// upload path (wizard file pick, wizard webcam, profile-edit pick + webcam):
// center-cropped square, longest edge ≤ 800px (never upscaled), JPEG q0.85.
// ~800×800 q85 is sharp on every render surface including 3× retina (largest
// consumer today is the 72px profile hero → 216px needed) while staying
// ~60–150 KB on the wire — raw multi-MB camera uploads were the cause of the
// 9-second wizard submit (F3), and tiny captures the cause of pixelated
// renders; both die here.

export const PROFILE_PHOTO_MASTER_PX = 800;
export const PROFILE_PHOTO_QUALITY = 0.85;

// F12: when resizing fails, callers may fall back to the RAW file — but only
// if the browser can actually display it. A raw HEIC/TIFF data URL renders as
// a broken preview and then bounces off the server's JPG/PNG/WebP allowlist —
// the exact "preview dead, save doesn't persist" failure. Undisplayable
// formats must surface a clear message instead.
const DISPLAYABLE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
export function isBrowserDisplayableImage(mime: string): boolean {
  return DISPLAYABLE_IMAGE_MIMES.has(mime.toLowerCase());
}
export const UNSUPPORTED_PHOTO_MESSAGE =
  "That photo format isn't supported — please choose a JPG or PNG. (iPhone tip: HEIC photos need converting, or pick 'Most Compatible' in camera settings.)";

async function loadBitmap(source: Blob | string): Promise<ImageBitmap | HTMLImageElement> {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
  if (typeof createImageBitmap === 'function') {
    try {
      // from-image applies EXIF orientation, so phone portraits stay upright.
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> decode */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    img.src = url;
  });
}

/**
 * Resize a photo (File/Blob or data URL) to the square profile master.
 * Throws on undecodable input — callers fall back to the raw file so an
 * exotic format never blocks a signup.
 */
export async function resizeProfilePhoto(source: Blob | string): Promise<string> {
  const bmp = await loadBitmap(source);
  const w = 'width' in bmp ? bmp.width : 0;
  const h = 'height' in bmp ? bmp.height : 0;
  if (!w || !h) throw new Error('image has no dimensions');

  const side = Math.min(w, h);
  const target = Math.min(PROFILE_PHOTO_MASTER_PX, side); // never upscale
  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (w - side) / 2, (h - side) / 2, side, side, 0, 0, target, target);
  return canvas.toDataURL('image/jpeg', PROFILE_PHOTO_QUALITY);
}

// ── H101: intake resize for wizard captures/uploads ─────────────────────────
// Charlie's real-device OOM: full-resolution native camera photos held as raw
// base64 in wizard state (a 4MB JPEG ≈ 11MB of string RAM; its preview decode
// ≈ 46–183MB of bitmap). Every image intake now downscales at the door:
// selfies to 1280px long edge (webcam parity), document photos to 2000px
// (dense text stays admin-legible). Aspect preserved, never upscaled, EXIF
// orientation honoured via loadBitmap (createImageBitmap from-image — the
// same machinery the profile pipeline uses, so portraits stay upright).
export const SELFIE_MAX_PX = 1280;
export const DOC_IMAGE_MAX_PX = 2000;
export const CAPTURE_QUALITY = 0.85;

// H101 rider: hard ceiling on any single intake AFTER resize (PDFs and raw
// fallbacks included) — a friendly rejection, never a crash or silent drop.
export const MAX_INTAKE_BYTES = 10 * 1024 * 1024;
export const INTAKE_TOO_LARGE_MESSAGE =
  'That file is too large even after compression — please use a photo or PDF under 10MB.';

/** Approximate decoded byte size of a data URL's payload. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64len = comma >= 0 ? dataUrl.length - comma - 1 : dataUrl.length;
  return Math.floor(b64len * 0.75);
}

/**
 * Long-edge resize preserving aspect ratio. Throws on undecodable input —
 * callers fall back to the raw file (then the MAX_INTAKE_BYTES guard still
 * applies) so an exotic format never blocks a signup.
 */
export async function resizeCapture(source: Blob | string, maxLongEdge: number): Promise<string> {
  const bmp = await loadBitmap(source);
  const w = 'width' in bmp ? bmp.width : 0;
  const h = 'height' in bmp ? bmp.height : 0;
  if (!w || !h) throw new Error('image has no dimensions');

  const scale = Math.min(1, maxLongEdge / Math.max(w, h)); // never upscale
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, tw, th);
  return canvas.toDataURL('image/jpeg', CAPTURE_QUALITY);
}
