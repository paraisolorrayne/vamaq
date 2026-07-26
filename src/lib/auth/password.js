/**
 * Hash de senha com scrypt do node:crypto — sem dependência nova.
 *
 * Formato guardado em users.password_hash:
 *   scrypt$<N>$<r>$<p>$<salt_base64>$<hash_base64>
 *
 * Verificação em tempo constante (timingSafeEqual) para não vazar por timing.
 */
import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

const N = 16384; // custo de CPU/memória (2^14)
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(plain) {
  if (typeof plain !== "string" || plain.length < 8) {
    throw new Error("Senha deve ter ao menos 8 caracteres.");
  }
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, KEYLEN, { N, r: R, p: P });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    Buffer.from(derived).toString("base64"),
  ].join("$");
}

export async function verifyPassword(plain, stored) {
  if (typeof stored !== "string" || !stored.startsWith("scrypt$")) return false;
  const [, n, r, p, saltB64, hashB64] = stored.split("$");
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const derived = await scrypt(plain, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  // timingSafeEqual exige buffers do mesmo tamanho.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
