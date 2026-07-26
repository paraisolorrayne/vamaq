/**
 * Cria/atualiza um usuário do /admin (PR-B do ADR-002).
 *
 * Uso (na VPS ou local, com DATABASE_URL no .env.local):
 *
 *   node --env-file=.env.local scripts/seed-admin.mjs \
 *     --name "Lorrayne" --email lorrayne@vamaq.com --role admin --password "senhaForte123"
 *
 * Papéis: admin | financeiro | vendedor. Upsert por e-mail (rodar de novo troca
 * a senha/nome/papel). Aplica db/auth-schema.sql antes, então é idempotente.
 *
 * Senha: se omitida, gera uma aleatória e imprime uma vez (anote — não fica no
 * banco em claro).
 */
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { hashPassword } from "../src/lib/auth/password.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const name = arg("--name");
const email = (arg("--email") || "").trim().toLowerCase();
const role = arg("--role") || "admin";
let password = arg("--password");

if (!name || !email) {
  console.error("Faltou --name e/ou --email.");
  process.exit(1);
}
if (!["admin", "financeiro", "vendedor"].includes(role)) {
  console.error(`Papel inválido: ${role} (use admin|financeiro|vendedor).`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL ausente (rode com --env-file=.env.local).");
  process.exit(1);
}

let generated = false;
if (!password) {
  password = randomBytes(9).toString("base64url"); // ~12 chars
  generated = true;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  // 1) garante o schema de auth
  const schema = await readFile(path.join(ROOT, "db", "auth-schema.sql"), "utf8");
  await pool.query(schema);

  // 2) upsert do usuário
  const password_hash = await hashPassword(password);
  const { rows } = await pool.query(
    `insert into users (name, email, password_hash, role, active)
       values ($1, $2, $3, $4, true)
     on conflict (email) do update
       set name = excluded.name,
           password_hash = excluded.password_hash,
           role = excluded.role,
           active = true
     returning id, email, role`,
    [name, email, password_hash, role]
  );

  const u = rows[0];
  console.log(`✓ usuário ${u.email} (${u.role}) pronto.`);
  if (generated) {
    console.log(`  senha gerada: ${password}`);
    console.log("  ⚠️ anote agora — não dá pra recuperar depois.");
  }
} catch (err) {
  console.error("Falha no seed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
