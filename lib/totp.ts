// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — what Google Authenticator, 1Password, Authy etc. use.
import crypto from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

export const currentStep = (t = Date.now()) => Math.floor(t / 1000 / 30);

export function totpAt(secret: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/** Returns the matching time step (±1 step of clock drift), or null. Constant-time compare. */
export function verifyTotp(secret: string, code: string, t = Date.now()): number | null {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const now = currentStep(t);
  for (const step of [now - 1, now, now + 1]) {
    const want = Buffer.from(totpAt(secret, step));
    if (crypto.timingSafeEqual(want, Buffer.from(c))) return step;
  }
  return null;
}

export const otpauthUri = (secret: string, account: string) =>
  `otpauth://totp/${encodeURIComponent(`Corner Table:${account}`)}?secret=${secret}&issuer=${encodeURIComponent('Corner Table')}&algorithm=SHA1&digits=6&period=30`;
