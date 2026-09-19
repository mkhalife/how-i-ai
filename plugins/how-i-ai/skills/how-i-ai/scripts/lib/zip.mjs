// Minimal ZIP reader (stored + deflate entries) so exports can be read without unzipping.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

function listZip(path) {
  const buf = readFileSync(path);
  const entries = [];
  // Find end of central directory record.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file: ' + path);
  let count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  // ZIP64 support for very large exports.
  if (count === 0xffff || offset === 0xffffffff) {
    for (let i = eocd - 20; i >= 0; i--) {
      if (buf.readUInt32LE(i) === 0x07064b50) {
        const z64 = Number(buf.readBigUInt64LE(i + 8));
        count = Number(buf.readBigUInt64LE(z64 + 32));
        offset = Number(buf.readBigUInt64LE(z64 + 48));
        break;
      }
    }
  }
  let p = offset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    let compSize = buf.readUInt32LE(p + 20);
    let size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    let localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    // zip64 extra field
    if (compSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) {
      let q = p + 46 + nameLen; const end = q + extraLen;
      while (q + 4 <= end) {
        const id = buf.readUInt16LE(q), len = buf.readUInt16LE(q + 2); let r = q + 4;
        if (id === 1) {
          if (size === 0xffffffff) { size = Number(buf.readBigUInt64LE(r)); r += 8; }
          if (compSize === 0xffffffff) { compSize = Number(buf.readBigUInt64LE(r)); r += 8; }
          if (localOffset === 0xffffffff) { localOffset = Number(buf.readBigUInt64LE(r)); r += 8; }
        }
        q += 4 + len;
      }
    }
    entries.push({ name, method, compSize, size, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { buf, entries };
}

function readZipEntry(zip, entry) {
  const { buf } = zip;
  const p = entry.localOffset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('bad local header for ' + entry.name);
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.compSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`unsupported zip method ${entry.method} for ${entry.name}`);
}

export function readZipText(path, predicate) {
  const zip = listZip(path);
  const entry = zip.entries.find((e) => predicate(e.name));
  if (!entry) return null;
  return readZipEntry(zip, entry).toString('utf8');
}
