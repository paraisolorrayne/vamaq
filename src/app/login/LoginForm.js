"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import styles from "./login.module.css";

export default function LoginForm({ next }) {
  const [state, formAction, pending] = useActionState(loginAction, {});

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="next" value={next} />

      <label className={styles.field}>
        <span className={styles.label}>E-mail</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          autoFocus
          className={styles.input}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Senha</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className={styles.input}
        />
      </label>

      {state?.error ? <p className={styles.error}>{state.error}</p> : null}

      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
