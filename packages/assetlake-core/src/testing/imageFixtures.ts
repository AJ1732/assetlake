import { crc32, deflateSync } from "node:zlib";

const PNG_SIGNATURE = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function chunk(type: string, data: Uint8Array): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.byteLength);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

/** A real, decodable RGB PNG of the given size. Seeded colour keeps bytes (and asset ids) distinct. */
export function createPngBytes(
  width: number,
  height: number,
  seed = 0,
): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(2, 9); // colour type RGB

  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    row.writeUInt8((x + seed) % 256, 1 + x * 3);
    row.writeUInt8((seed * 7) % 256, 2 + x * 3);
    row.writeUInt8((seed * 13) % 256, 3 + x * 3);
  }
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));

  return new Uint8Array(
    Buffer.concat([
      PNG_SIGNATURE,
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(pixels)),
      chunk("IEND", new Uint8Array()),
    ]),
  );
}

/** Reads width/height from a PNG IHDR chunk; null for anything else. */
export function readPngDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const isPng = PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  if (!isPng || bytes.byteLength < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

// Minimal headers file-type recognises; enough for signature checks, not decodable images.
const SIGNATURES: Record<string, number[]> = {
  "image/jpeg": [
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ],
  "image/webp": [
    ...Buffer.from("RIFF"),
    0x24,
    0,
    0,
    0,
    ...Buffer.from("WEBPVP8 "),
  ],
  "image/gif": [...Buffer.from("GIF89a"), 1, 0, 1, 0, 0, 0, 0],
};

export function signatureBytes(
  mime: keyof typeof SIGNATURES,
  totalLength = 64,
): Uint8Array {
  const bytes = new Uint8Array(totalLength);
  bytes.set(SIGNATURES[mime]);
  return bytes;
}
