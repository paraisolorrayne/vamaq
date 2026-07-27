"use client";

import { useActionState } from "react";
import { changePasswordAction } from "./actions";
import styles from "@/app/login/login.module.css";

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, {});

  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>Senha atual</span>
        <input
          type="password"
          name="current"
          autoComplete="current-password"
          required
          autoFocus
          className={styles.input}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Nova senha</span>
        <input
          type="password"
          name="next"
          autoComplete="new-password"
          minLength={8}
          required
          className={styles.input}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Confirmar nova senha</span>
        <input
          type="password"
          name="confirm"
          autoComplete="new-password"
          minLength={8}
          required
          className={styles.input}
        />
      </label>

      {state?.error ? <p className={styles.error}>{state.error}</p> : null}

      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
