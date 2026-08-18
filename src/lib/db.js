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
import { usarDatasComoTexto, OPCOES_CONEXAO } from '@/lib/pgTypes';

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

  // Antes de abrir a conexão: colunas `date` chegam como texto 'YYYY-MM-DD',
  // não como Date em meia-noite local. Ver src/lib/pgTypes.js.
  usarDatasComoTexto();
  pool = new Pool({
    connectionString,
    ...OPCOES_CONEXAO,
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
