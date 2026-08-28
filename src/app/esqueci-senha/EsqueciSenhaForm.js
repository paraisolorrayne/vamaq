"use client";

import { useActionState } from "react";
import Link from "next/link";
import { pedirResetAction } from "./actions";
import styles from "../login/login.module.css";

export default function EsqueciSenhaForm() {
  const [state, formAction, pending] = useActionState(pedirResetAction, {});

  // Depois de pedir, o formulário sai da tela: deixar o botão ali convida a
  // pessoa a clicar de novo achando que não funcionou.
  if (state?.ok) {
    return (
      <>
        <p className={styles.success}>
          Pedido enviado. A administração da loja vai gerar uma senha
          provisória e mandar para você pelo WhatsApp. Ao entrar com ela, o
          sistema já pede para você criar a sua senha nova.
        </p>
        <Link href="/login" className={styles.link}>
          ← Voltar para o login
        </Link>
      </>
    );
  }

  return (
    <>
      <form action={formAction} className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Seu e-mail de acesso</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            autoFocus
            placeholder="nome@vamaqmotors.com.br"
            className={styles.input}
          />
        </label>

        <button type="submit" disabled={pending} className={styles.button}>
          {pending ? "Enviando…" : "Pedir nova senha"}
        </button>
      </form>
      <Link href="/login" className={styles.link}>
        ← Voltar para o login
      </Link>
    </>
  );
}
