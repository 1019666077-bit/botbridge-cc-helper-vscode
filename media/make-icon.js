#!/usr/bin/env node
/*
 * Generates media/icon.png (256x256 RGBA) with no image dependencies.
 *
 * Run:  node media/make-icon.js
 *
 * The mark is "dispatch into an inbox": an arrow dropping into an open tray,
 * drawn in Bot Bridge sky blue on the dark navy used by the gallery banner.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 256;
const BG = [0x0b, 0x12, 0x20];
const ACCENT = [0x38, 0xbd, 0xf8];
const SS = 4; // supersampling factor per axis

/** Signed distance to a rounded rectangle (negative inside). */
function roundedRectSdf(px, py, x0, y0, x1, y1, r) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = (x1 - x0) / 2 - r;
  const hy = (y1 - y0) / 2 - r;
  const dx = Math.abs(px - cx) - hx;
  const dy = Math.abs(py - cy) - hy;
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
}

/** Triangle coverage test via half-plane signs, with a small outward bias. */
function inTriangle(px, py, ax, ay, bx, by, cx, cy, bias) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < -bias || d2 < -bias || d3 < -bias;
  const hasPos = d1 > bias || d2 > bias || d3 > bias;
  return !(hasNeg && hasPos);
}

// Shapes: [x0, y0, x1, y1, cornerRadius]
const STEM = [120, 48, 136, 116, 4];
const TRAY_LEFT = [46, 156, 62, 214, 5];
const TRAY_RIGHT = [194, 156, 210, 214, 5];
const TRAY_BOTTOM = [46, 198, 210, 214, 5];
// Arrow head: base across y=116, apex at y=152.
const HEAD = [96, 116, 160, 116, 128, 152];

function accentCoverage(x, y) {
  const bias = 0;
  let hit = 0;
  if (roundedRectSdf(x, y, ...STEM) <= 0) hit = 1;
  else if (roundedRectSdf(x, y, ...TRAY_LEFT) <= 0) hit = 1;
  else if (roundedRectSdf(x, y, ...TRAY_RIGHT) <= 0) hit = 1;
  else if (roundedRectSdf(x, y, ...TRAY_BOTTOM) <= 0) hit = 1;
  else if (inTriangle(x, y, HEAD[0], HEAD[1], HEAD[2], HEAD[3], HEAD[4], HEAD[5], bias)) hit = 1;
  return hit;
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));

for (let y = 0; y < SIZE; y += 1) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0; // PNG filter: none
  for (let x = 0; x < SIZE; x += 1) {
    let bgHits = 0;
    let accentHits = 0;
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const px = x + (sx + 0.5) / SS;
        const py = y + (sy + 0.5) / SS;
        if (roundedRectSdf(px, py, 0, 0, SIZE, SIZE, 56) <= 0) {
          bgHits += 1;
          accentHits += accentCoverage(px, py);
        }
      }
    }
    const total = SS * SS;
    const alpha = Math.round((bgHits / total) * 255);
    const accent = accentHits / total;
    const offset = rowStart + 1 + x * 4;
    for (let c = 0; c < 3; c += 1) {
      raw[offset + c] = Math.round(BG[c] * (1 - accent) + ACCENT[c] * accent);
    }
    raw[offset + 3] = alpha;
  }
}

/* --------------------------------------------------------------- PNG writer */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type: RGBA
ihdr[10] = 0; // deflate
ihdr[11] = 0; // adaptive filtering
ihdr[12] = 0; // no interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const target = path.join(__dirname, 'icon.png');
fs.writeFileSync(target, png);
process.stdout.write(`wrote ${target} (${png.length} bytes, ${SIZE}x${SIZE})\n`);
