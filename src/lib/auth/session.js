/**
 * Sessão do /admin — token aleatório em cookie httpOnly, hash no banco.
 *
 * O cookie guarda o token em claro (só o navegador do usuário o tem); a tabela
 * `sessions` guarda apenas sha256(token). Assim, vazamento do banco não expõe
 * sessões, e dá pra revogar (logout / expiração) do lado servidor — o que uma
 * sessão JWT stateless não permite.
 *
 * Só server (usa next/headers + pool pg). Não importar de client component.
 */
import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { query } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth/constants";

export { COOKIE_NAME };
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function sha256Hex(token) {
  return createHash("sha256").update(token).digest("hex");
}

/** Cria sessão para o usuário e grava o cookie. Retorna o token (uso interno). */
export async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);

  await query(
    `insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)`,
    [tokenHash, userId, expiresAt]
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/** Lê o token do cookie e resolve o usuário ativo da sessão válida, ou null. */
export async function readSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const { rows } = await query(
    `select u.id, u.name, u.email, u.role, u.must_change_password
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1
        and s.expires_at > now()
        and u.active = true
      limit 1`,
    [sha256Hex(token)]
  );
  return rows.length ? rows[0] : null;
}

/** Apaga a sessão atual (banco + cookie). Idempotente. */
export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await query(`delete from sessions where token_hash = $1`, [
      sha256Hex(token),
    ]);
    cookieStore.delete(COOKIE_NAME);
  }
}
