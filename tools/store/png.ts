// из nardy: tools/store/png.ts @ 1d2bdff
// PNG без прозрачности: RuStore не принимает иконку с альфа-каналом, а браузер снимает RGBA.
// Разбор и сборка PNG вручную (zlib из Node) — без библиотек картинок. Картинка должна быть
// непрозрачной по смыслу: альфа просто отбрасывается.
import { deflateSync, inflateSync } from 'node:zlib';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Ширина, высота и тип цвета PNG (2 — RGB, 6 — RGBA). */
export function pngInfo(png: Uint8Array): { width: number; height: number; colorType: number } {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20), colorType: png[25] };
}

/** Точки PNG RGBA 8 бит без чересстрочности — построчно, по 4 байта на точку. */
export function rgbaOf(png: Uint8Array): Uint8Array {
  const { width, height } = pngInfo(png);
  const idat: Uint8Array[] = [];
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let off = 8; off < png.length;) {
    const len = v.getUint32(off);
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    if (type === 'IDAT') idat.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp;
  const rgba = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rgba[y * stride + x - bpp] : 0;
      const b = y > 0 ? rgba[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? rgba[(y - 1) * stride + x - bpp] : 0;
      let p = line[x];
      if (f === 1) p += a;
      else if (f === 2) p += b;
      else if (f === 3) p += (a + b) >> 1;
      else if (f === 4) {
        const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        p += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      rgba[y * stride + x] = p & 0xff;
    }
  }
  return rgba;
}

/** RGBA 8 бит → RGB 8 бит; остальное возвращается как есть. */
export function opaquePng(input: Uint8Array): Uint8Array {
  const png = new Uint8Array(input);
  const { width, height, colorType } = pngInfo(png);
  if (colorType !== 6 || png[24] !== 8 || png[28] !== 0) return png;
  const rgba = rgbaOf(png), stride = width * 4;
  const rgb = new Uint8Array(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    const o = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) rgb.set(rgba.subarray(y * stride + x * 4, y * stride + x * 4 + 3), o + 1 + x * 3);
  }
  const ihdr = new Uint8Array(13);
  const h = new DataView(ihdr.buffer);
  h.setUint32(0, width); h.setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([png.subarray(0, 8), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rgb, { level: 9 })), chunk('IEND', new Uint8Array(0))]);
}
