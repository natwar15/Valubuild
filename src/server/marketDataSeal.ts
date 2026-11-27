import crypto from 'crypto';
import zlib from 'zlib';

/** Encrypt {filename: content} with AES-256-GCM after gzip. Output: base64 of iv|tag|ciphertext. */
export function sealMarketFiles(files: Record<string, string>, keyB64: string): string {
  const key = keyFrom(keyB64);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plain = zlib.gzipSync(Buffer.from(JSON.stringify(files), 'utf8'));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function openMarketFiles(sealed: string, keyB64: string): Record<string, string> {
  const key = keyFrom(keyB64);
  const buf = Buffer.from(sealed, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const plain = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
  return JSON.parse(zlib.gunzipSync(plain).toString('utf8'));
}

function keyFrom(b64: string): Buffer {
  const key = Buffer.from(b64.trim(), 'base64');
  if (key.length !== 32) throw new Error('MARKET_DATA_KEY must be 32 bytes, base64-encoded.');
  return key;
}
