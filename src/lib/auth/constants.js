/**
 * Constantes de auth sem dependências pesadas — seguras para o bundle do proxy
 * (o proxy não pode arrastar `pg`/`next/headers`).
 */
export const COOKIE_NAME = "vamaq_session";
