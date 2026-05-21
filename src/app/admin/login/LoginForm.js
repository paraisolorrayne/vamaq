'use client';

import { useState, useTransition } from 'react';
import { signInAction } from './actions';
import styles from './login.module.css';

export default function LoginForm({ next }) {
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set('next', next);
    startTransition(async () => {
      const result = await signInAction(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
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

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
