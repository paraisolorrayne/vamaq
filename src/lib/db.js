/**
 * Pool Postgres único da aplicação (site público).
 *
 * Lê a connection string de `DATABASE_URL`. Se ausente, `getPool()` retorna
 * null — as funções do repository tratam isso retornando listas vazias, então
 * o build não quebra em ambiente sem banco.
 *
 * Ex.: DATABASE_URL=postgres://vamaq:senha@localhost:5432/vamaq
 */
import { Pool } from 'pg';

let pool = null;
let warned = false;

export function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (!warned) {
      warned = true;
      console.warn(
        '[db] DATABASE_URL ausente — listagens vão retornar vazias.'
      );
    }
    return null;
  }

  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
  });
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  if (!p) return { rows: [] };
  return p.query(text, params);
}
