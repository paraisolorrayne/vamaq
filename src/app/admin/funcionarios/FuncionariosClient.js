"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import styles from "../admin.module.css";
import { createFuncionarioAction } from "./actions";

const fmtData = (d) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

export default function FuncionariosClient({ funcionarios }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState(null);
  const [aberto, setAberto] = useState(false);

  function handleCreate(e) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      const r = await createFuncionarioAction(fd);
      if (r?.error) setErr(r.error);
      else {
        form.reset();
        setAberto(false);
      }
    });
  }

  return (
    <>
      <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className={styles.pageTitle}>Funcionários</h1>
          <p className={styles.pageSubtitle}>
            Quadro de pessoal e histórico de passagens pela loja
          </p>
        </div>
        <button onClick={() => setAberto((v) => !v)} className={styles.btnPrimary}>
          {aberto ? "Cancelar" : "+ Nova ficha"}
        </button>
      </div>

      {aberto && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate} className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome *</label>
              <input name="nome" className={styles.formInput} required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CPF</label>
              <input name="cpf" className={styles.formInput} placeholder="000.000.000-00" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Telefone</label>
              <input name="telefone" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nascimento</label>
              <input name="nascimento" type="date" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>RG</label>
              <input name="rg" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>E-mail pessoal</label>
              <input name="email_pessoal" type="email" className={styles.formInput} />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Endereço</label>
              <input name="endereco" className={styles.formInput} />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Observações</label>
              <textarea name="obs" rows={2} className={styles.formTextarea} />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar ficha"}
              </button>
            </div>
          </form>
          {err && <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginBottom: 0 }}>{err}</p>}
          <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: 0 }}>
            A admissão (cargo e data) é registrada na ficha, depois de salvar.
          </p>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo atual</th>
                <th>Admissão</th>
                <th>Situação</th>
                <th>Acesso ao sistema</th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => (
                <tr key={f.id} style={{ opacity: f.ativo ? 1 : 0.6 }}>
                  <td>
                    <Link href={`/admin/funcionarios/${f.id}`}><strong>{f.nome}</strong></Link>
                  </td>
                  <td>{f.cargo || "—"}</td>
                  <td>{fmtData(f.admissao)}</td>
                  <td>
                    {f.ativo ? (
                      <span className={styles.badgeSuccess}>Ativo</span>
                    ) : f.admissao ? (
                      <span className={styles.badgeWarning} style={{ background: "#f3f4f6", color: "#6b7280" }}>
                        Desligado em {fmtData(f.saida)}
                      </span>
                    ) : (
                      <span className={styles.badgeWarning} style={{ background: "#fef9c3", color: "#a16207" }}>
                        Sem admissão
                      </span>
                    )}
                  </td>
                  <td>
                    {f.user_email ? (
                      <>
                        {f.user_email}
                        {!f.user_active && <span style={{ color: "#6b7280" }}> (inativo)</span>}
                      </>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>sem acesso</span>
                    )}
                  </td>
                </tr>
              ))}
              {funcionarios.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
                    Nenhuma ficha cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
