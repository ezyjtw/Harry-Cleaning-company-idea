/**
 * Generates placeholder app icons and splash screens as PNG files
 * using pure Node.js (no external dependencies).
 *
 * Run: node scripts/generate-icons.js
 *
 * These are simple branded placeholders — replace with real designs
 * before submitting to the app stores.
 */

const fs = require('fs');
const path = require('path');

// Minimal PNG encoder — creates a solid-colour PNG with centered text via SVG-in-PNG hack
// For real icons, replace these files with proper designs from a designer.

function createPlaceholderPNG(width, height, bgColor, text, textColor) {
  // Create a simple BMP-like buffer — we'll use the simplest valid PNG possible
  // Actually, let's generate an SVG and note that Expo can use SVG for dev,
  // but for builds we need PNG. We'll create a minimal valid PNG.

  // Create raw RGBA pixel data
  const pixels = Buffer.alloc(width * height * 4);
  const r = parseInt(bgColor.slice(1, 3), 16);
  const g = parseInt(bgColor.slice(3, 5), 16);
  const b = parseInt(bgColor.slice(5, 7), 16);

  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = 255;
  }

  // Encode as PNG
  return encodePNG(width, height, pixels);
}

function encodePNG(width, height, pixels) {
  const zlib = require('zlib');

  // Add filter byte (0 = None) to each row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: None
    pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  // Build PNG file
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons for both apps
const apps = [
  {
    name: 'customer-app',
    dir: path.join(__dirname, '..', 'apps', 'customer-app', 'assets'),
    bgColor: '#0D9488', // Teal (customer brand)
    label: 'RC',
  },
  {
    name: 'cleaner-app',
    dir: path.join(__dirname, '..', 'apps', 'cleaner-app', 'assets'),
    bgColor: '#0F766E', // Darker teal (cleaner brand)
    label: 'RP',
  },
];

for (const app of apps) {
  fs.mkdirSync(app.dir, { recursive: true });

  // App icon — 1024x1024
  const icon = createPlaceholderPNG(1024, 1024, app.bgColor, app.label, '#FFFFFF');
  fs.writeFileSync(path.join(app.dir, 'icon.png'), icon);
  console.log(`Created ${app.name}/assets/icon.png (1024x1024)`);

  // Adaptive icon foreground — 1024x1024
  fs.writeFileSync(path.join(app.dir, 'adaptive-icon.png'), icon);
  console.log(`Created ${app.name}/assets/adaptive-icon.png (1024x1024)`);

  // Splash icon — 200x200
  const splash = createPlaceholderPNG(200, 200, app.bgColor, app.label, '#FFFFFF');
  fs.writeFileSync(path.join(app.dir, 'splash-icon.png'), splash);
  console.log(`Created ${app.name}/assets/splash-icon.png (200x200)`);

  // Favicon — 48x48
  const favicon = createPlaceholderPNG(48, 48, app.bgColor, app.label, '#FFFFFF');
  fs.writeFileSync(path.join(app.dir, 'favicon.png'), favicon);
  console.log(`Created ${app.name}/assets/favicon.png (48x48)`);
}

console.log('\nDone! Replace these with real branded designs before store submission.');
