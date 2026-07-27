/**
 * Cria/atualiza usuários do /admin (PR-B do ADR-002).
 *
 * Um usuário:
 *   node --env-file=.env.local scripts/seed-admin.mjs \
 *     --name "Lorrayne" --email lorrayne@vamaq.com --role admin --password "2RcgYvMq@L"
 *
 * Vários (arquivo JSON [{name,email,role}], senha compartilhada em --password):
 *   node --env-file=.env.local scripts/seed-admin.mjs --file equipe.json --password "2RcgYvMq@L"
 *
 * Papéis: admin | financeiro | vendedor. Upsert por e-mail.
 * Todo usuário semeado nasce com must_change_password = true (senha inicial
 * compartilhada → troca obrigatória no primeiro acesso). Aplica db/auth-schema.sql
 * antes, então é idempotente.
 *
 * Sem --password, gera uma aleatória por usuário e imprime uma vez.
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

const ROLES = ["admin", "financeiro", "vendedor"];
const sharedPassword = arg("--password");
const file = arg("--file");

// Monta a lista de usuários a semear.
let people = [];
if (file) {
  people = JSON.parse(await readFile(path.resolve(file), "utf8"));
} else {
  people = [{ name: arg("--name"), email: arg("--email"), role: arg("--role") || "admin" }];
}

// Validação antes de tocar no banco.
for (const p of people) {
  p.email = String(p.email || "").trim().toLowerCase();
  p.role = p.role || "admin";
  if (!p.name || !p.email) {
    console.error("Cada usuário precisa de name e email:", JSON.stringify(p));
    process.exit(1);
  }
  if (!ROLES.includes(p.role)) {
    console.error(`Papel inválido para ${p.email}: ${p.role} (use ${ROLES.join("|")}).`);
    process.exit(1);
  }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL ausente (rode com --env-file=.env.local).");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  // 1) garante o schema de auth
  const schema = await readFile(path.join(ROOT, "db", "auth-schema.sql"), "utf8");
  await pool.query(schema);

  // 2) upsert de cada usuário (senha inicial → troca obrigatória)
  for (const p of people) {
    let password = sharedPassword;
    let generated = false;
    if (!password) {
      password = randomBytes(9).toString("base64url");
      generated = true;
    }
    const password_hash = await hashPassword(password);
    const { rows } = await pool.query(
      `insert into users (name, email, password_hash, role, active, must_change_password)
         values ($1, $2, $3, $4, true, true)
       on conflict (email) do update
         set name = excluded.name,
             password_hash = excluded.password_hash,
             role = excluded.role,
             active = true,
             must_change_password = true
       returning email, role`,
      [p.name, p.email, password_hash, p.role]
    );
    const u = rows[0];
    console.log(
      `✓ ${u.email} (${u.role})` + (generated ? ` — senha: ${password}` : "")
    );
  }
  console.log(
    `\n${people.length} usuário(s) prontos. Senha inicial compartilhada; cada um troca no 1º acesso.`
  );
} catch (err) {
  console.error("Falha no seed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
