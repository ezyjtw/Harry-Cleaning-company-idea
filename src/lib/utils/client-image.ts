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
