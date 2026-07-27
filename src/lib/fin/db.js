/**
 * Pool Postgres do módulo financeiro (PR-1 do ADR-002).
 *
 * Usa DATABASE_URL_FIN — a conexão da role `vamaq_fin`, que escreve em `fin.*`
 * mas SÓ LÊ `public.vehicles`. É a blindagem do estoque em ação: o código do
 * financeiro, por construção, não consegue alterar veículos.
 *
 * Sem DATABASE_URL_FIN, `getFinPool()` retorna null e as consultas devolvem
 * vazio — o build e o site não quebram em ambiente sem o financeiro.
 */
import { Pool } from "pg";

let pool = null;
let warned = false;

export function getFinPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL_FIN;
  if (!connectionString) {
    if (!warned) {
      warned = true;
      console.warn("[fin/db] DATABASE_URL_FIN ausente — financeiro desativado.");
    }
    return null;
  }
  pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30000 });
  return pool;
}

export async function finQuery(text, params) {
  const p = getFinPool();
  if (!p) return { rows: [] };
  return p.query(text, params);
}

/** true se o financeiro está configurado (tem conexão própria). */
export function finEnabled() {
  return Boolean(process.env.DATABASE_URL_FIN);
}
