/**
 * Gestão de usuários do /admin (só admin usa). Server-only (usa pg).
 *
 * Senhas temporárias são geradas aqui e devolvidas EM CLARO uma única vez, para
 * o admin copiar as instruções de acesso e enviar à pessoa. No banco fica só o
 * hash, e must_change_password = true (troca obrigatória no 1º acesso).
 */
import { randomBytes } from "node:crypto";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { ROLES } from "@/lib/auth/permissions";

// Senha temporária legível: sem caracteres ambíguos (0/O, 1/l/I).
export function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function validRole(role) {
  return Object.prototype.hasOwnProperty.call(ROLES, role);
}

export async function listUsers() {
  const { rows } = await query(
    `select u.id, u.name, u.email, u.role, u.active, u.must_change_password,
            u.approval_limit, u.created_at, u.funcionario_id, u.reset_requested_at
       from users u
      order by u.created_at asc`
  );
  return rows;
}

export async function updateApprovalLimit(id, limit) {
  const value = limit === null || limit === "" ? null : Number(limit);
  const { rows } = await query(
    `update users set approval_limit = $2 where id = $1 returning id, approval_limit`,
    [id, Number.isFinite(value) ? value : null]
  );
  return rows.length ? rows[0] : null;
}

/** Cria usuário com senha temporária. Retorna { user, tempPassword } ou { error }. */
export async function createUser({ name, email, role, funcionario_id = null }) {
  name = String(name || "").trim();
  email = String(email || "").trim().toLowerCase();
  if (!name || !email) return { error: "Nome e e-mail são obrigatórios." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "E-mail inválido." };
  if (!validRole(role)) return { error: "Papel inválido." };

  const exists = await query(`select 1 from users where email = $1`, [email]);
  if (exists.rows.length) return { error: "Já existe um usuário com esse e-mail." };

  const tempPassword = generateTempPassword();
  const password_hash = await hashPassword(tempPassword);
  const { rows } = await query(
    `insert into users (name, email, password_hash, role, active, must_change_password, funcionario_id)
       values ($1, $2, $3, $4, true, true, $5)
     returning id, name, email, role, active, funcionario_id`,
    [name, email, password_hash, role, funcionario_id || null]
  );
  return { user: rows[0], tempPassword };
}

/** Gera nova senha temporária para um usuário. Retorna { user, tempPassword } ou { error }. */
export async function resetPassword(id) {
  const tempPassword = generateTempPassword();
  const password_hash = await hashPassword(tempPassword);
  const { rows } = await query(
    `update users set password_hash = $2, must_change_password = true, active = true,
            reset_requested_at = null
      where id = $1 returning id, name, email, role`,
    [id, password_hash]
  );
  if (!rows.length) return { error: "Usuário não encontrado." };
  return { user: rows[0], tempPassword };
}

/** Ativa/desativa um usuário (não apaga — preserva histórico). */
export async function setUserActive(id, active) {
  const { rows } = await query(
    `update users set active = $2 where id = $1 returning id, active`,
    [id, Boolean(active)]
  );
  return rows.length ? rows[0] : null;
}

export async function updateUserRole(id, role) {
  if (!validRole(role)) return { error: "Papel inválido." };
  const { rows } = await query(
    `update users set role = $2 where id = $1 returning id, role`,
    [id, role]
  );
  if (!rows.length) return { error: "Usuário não encontrado." };
  return { user: rows[0] };
}

/** Liga (ou desliga) o login de uma ficha de funcionário. */
export async function setUserFuncionario(userId, funcionarioId) {
  const { rows } = await query(
    `update users set funcionario_id = $2 where id = $1
     returning id, funcionario_id`,
    [userId, funcionarioId || null]
  );
  return rows.length ? rows[0] : null;
}
