#!/usr/bin/env node

/**
 * 图标生成：以 generated/icon-artwork.png（方角原画）为输入，
 * 按 fnOS 规范的圆角（248/1024，与 fnos-app-health-records 一致）裁出透明圆角，
 * 输出全部尺寸：
 *   packages/assets/icons/ICON.PNG            512×512（应用包主图标）
 *   packages/assets/icons/ICON_256.PNG        256×256
 *   packages/assets/icons/generated/icon_N.png  N ∈ 32,48,64,72,96,128,256,512
 *   packages/assets/icons/generated/icon-source.png 512×512（圆角后的参考图）
 *   packages/ui/src/assets/app-icon.png       256×256（应用内顶栏图标）
 * 纯 Node 实现（PNG 解码/预乘降采样/编码），无外部依赖。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const rootDir = new URL("..", import.meta.url).pathname;
const iconsDir = join(rootDir, "packages", "assets", "icons");
const generatedDir = join(iconsDir, "generated");
const uiIconPath = join(rootDir, "packages", "ui", "src", "assets", "app-icon.png");
const artworkPath = join(generatedDir, "icon-artwork.png");

/** fnOS 图标圆角：半径 248/1024（约 24.2%），与 health-records 项目一致 */
const CORNER_RADIUS_RATIO = 248 / 1024;
const UI_ICON_SIZES = [32, 48, 64, 72, 96, 128, 256, 512];

function decodePng(path) {
  const buffer = readFileSync(path);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat = [];
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error("Only 8-bit PNG is supported");
      colorType = data[9];
    }
    if (type === "IDAT") idat.push(data);
    pos += 12 + length;
  }
  const channels = { 2: 3, 6: 4 }[colorType];
  if (!channels) throw new Error(`Unsupported PNG color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * channels);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const current = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? current[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      let value = row[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      current[x] = value & 0xff;
    }
    current.copy(pixels, y * stride);
    previous = current;
  }
  return { width, height, channels, pixels };
}

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

/** 圆角矩形覆盖率（0..1，边缘 1px 平滑过渡） */
function roundedRectAlpha(px, py, size, radius) {
  const cx = clamp(px, radius, size - radius);
  const cy = clamp(py, radius, size - radius);
  const distance = Math.hypot(px - cx, py - cy);
  return Math.max(0, Math.min(1, radius + 0.5 - distance));
}

/** 原画（RGB/RGBA）→ 透明圆角 RGBA，超采样抗锯齿 */
function applyRoundedMask(source) {
  const { width, height, channels, pixels } = source;
  const radius = width * CORNER_RADIUS_RATIO;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcOffset = (y * width + x) * channels;
      const dstOffset = (y * width + x) * 4;
      out[dstOffset] = pixels[srcOffset];
      out[dstOffset + 1] = pixels[srcOffset + 1];
      out[dstOffset + 2] = pixels[srcOffset + 2];
      out[dstOffset + 3] = Math.round(roundedRectAlpha(x + 0.5, y + 0.5, width, radius) * 255);
    }
  }
  return { width, height, pixels: out };
}

/** 预乘 alpha 盒式降采样，避免边缘白边 */
function downsample(source, sourceWidth, targetWidth) {
  const scale = sourceWidth / targetWidth;
  const target = Buffer.alloc(targetWidth * targetWidth * 4);
  for (let y = 0; y < targetWidth; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const offset = ((y * scale + sy) * sourceWidth + (x * scale + sx)) * 4;
          const alpha = source[offset + 3];
          totals[0] += source[offset] * alpha;
          totals[1] += source[offset + 1] * alpha;
          totals[2] += source[offset + 2] * alpha;
          totals[3] += alpha;
        }
      }
      const count = scale * scale;
      const targetOffset = (y * targetWidth + x) * 4;
      const alphaSum = totals[3];
      target[targetOffset + 3] = Math.round(alphaSum / count);
      for (let channel = 0; channel < 3; channel += 1) {
        target[targetOffset + channel] = alphaSum > 0 ? Math.round(totals[channel] / alphaSum) : 0;
      }
    }
  }
  return target;
}

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      return value >>> 0;
    });
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

function encodePng(width, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(width, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * width);
  for (let y = 0; y < width; y += 1) {
    rows[y * (width * 4 + 1)] = 0;
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function writePng(path, size, rgba) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(size, rgba));
}

const artwork = decodePng(artworkPath);
if (artwork.width !== artwork.height) throw new Error("icon-artwork.png must be square");
const masked = applyRoundedMask(artwork);

for (const size of UI_ICON_SIZES) {
  writePng(join(generatedDir, `icon_${size}.png`), size, downsample(masked.pixels, masked.width, size));
}
writePng(join(generatedDir, "icon-source.png"), 512, downsample(masked.pixels, masked.width, 512));
writePng(join(iconsDir, "ICON.PNG"), 512, downsample(masked.pixels, masked.width, 512));
writePng(join(iconsDir, "ICON_256.PNG"), 256, downsample(masked.pixels, masked.width, 256));
writePng(uiIconPath, 256, downsample(masked.pixels, masked.width, 256));

console.log(`Generated schulte icons (${Math.round(CORNER_RADIUS_RATIO * 1000) / 10}% corner radius): ${UI_ICON_SIZES.join(", ")} px`);
