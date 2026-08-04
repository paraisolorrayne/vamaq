"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import {
  updateFuncionarioAction,
  admitirAction,
  desligarAction,
  criarAcessoAction,
} from "../actions";

const fmtData = (d) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
const paraInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default function FichaClient({ funcionario: f, roles }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState(null);
  const [acesso, setAcesso] = useState(null); // { email, accessText }
  const [copiado, setCopiado] = useState(false);
  const aberto = f.vinculoAberto;

  // Três estados possíveis, alinhados com a lista (FuncionariosClient):
  // vínculo aberto → o cargo; sem vínculo aberto mas com histórico →
  // "Desligado"; nenhum vínculo → "Sem admissão" (ficha recém-criada).
  const situacao = aberto ? (
    <span className={styles.badgeSuccess}>{aberto.cargo}</span>
  ) : f.vinculos.length > 0 ? (
    <span className={styles.badgeWarning} style={{ background: "#f3f4f6", color: "#6b7280" }}>Desligado</span>
  ) : (
    <span className={styles.badgeWarning} style={{ background: "#fef9c3", color: "#a16207" }}>Sem admissão</span>
  );

  function run(fn) {
    setErr(null);
    startTransition(async () => {
      const r = await fn();
      if (r?.error) setErr(r.error);
      else if (r?.accessText) { setAcesso(r); setCopiado(false); }
    });
  }

  function salvarDados(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => updateFuncionarioAction(f.id, fd));
  }

  function admitirSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => admitirAction(f.id, {
      cargo: fd.get("cargo"),
      admissao: fd.get("admissao"),
      obs: fd.get("obs"),
    }));
  }

  function desligarSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!confirm(`Desligar ${f.nome}? O acesso ao sistema, se houver, é desativado junto.`)) return;
    run(() => desligarAction(f.id, { saida: fd.get("saida"), motivo: fd.get("motivo") }));
  }

  function criarAcessoSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => criarAcessoAction(f.id, {
      nome: f.nome,
      login: fd.get("login"),
      role: fd.get("role"),
    }));
  }

  async function copiarAcesso() {
    try {
      await navigator.clipboard.writeText(acesso.accessText);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <>
      <Link href="/admin/funcionarios" className={styles.backLinkContent}>← Funcionários</Link>
      <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>{f.nome}</h1>
        {situacao}
      </div>

      {err && (
        <div className={styles.card} style={{ marginBottom: 16, borderLeft: "4px solid #b91c1c" }}>
          <p style={{ color: "#b91c1c", margin: 0 }}>{err}</p>
        </div>
      )}

      {/* Dados pessoais */}
      <div className={styles.card} style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Dados pessoais</h3>
        <form onSubmit={salvarDados} className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nome *</label>
            <input name="nome" defaultValue={f.nome} className={styles.formInput} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>CPF</label>
            <input name="cpf" defaultValue={f.cpf || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>RG</label>
            <input name="rg" defaultValue={f.rg || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nascimento</label>
            <input name="nascimento" type="date" defaultValue={paraInput(f.nascimento)} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Telefone</label>
            <input name="telefone" defaultValue={f.telefone || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>E-mail pessoal</label>
            <input name="email_pessoal" type="email" defaultValue={f.email_pessoal || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>Endereço</label>
            <input name="endereco" defaultValue={f.endereco || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>Observações</label>
            <textarea name="obs" rows={2} defaultValue={f.obs || ""} className={styles.formTextarea} />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar dados"}
            </button>
          </div>
        </form>
      </div>

      {/* Passagens pela loja */}
      <div className={styles.card} style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Passagens pela loja</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Cargo</th><th>Admissão</th><th>Saída</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {f.vinculos.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.cargo}</strong></td>
                  <td>{fmtData(v.admissao)}</td>
                  <td>{v.saida ? fmtData(v.saida) : <span className={styles.badgeSuccess}>Em curso</span>}</td>
                  <td>{v.motivo_saida || "—"}</td>
                </tr>
              ))}
              {f.vinculos.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#6b7280", padding: 16 }}>
                    Nenhuma admissão registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {aberto ? (
          <form onSubmit={desligarSubmit} className={styles.formGrid} style={{ marginTop: 16 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data de saída *</label>
              <input name="saida" type="date" className={styles.formInput} required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Motivo</label>
              <input name="motivo" className={styles.formInput} placeholder="Pedido de demissão, fim de contrato…" />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnDanger} disabled={isPending}>Desligar</button>
            </div>
          </form>
        ) : (
          <form onSubmit={admitirSubmit} className={styles.formGrid} style={{ marginTop: 16 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cargo *</label>
              <input name="cargo" className={styles.formInput} placeholder="Vendedor, mecânico…" required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data de admissão *</label>
              <input name="admissao" type="date" className={styles.formInput} required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Observações</label>
              <input name="obs" className={styles.formInput} />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={isPending}>
                {f.vinculos.length ? "Readmitir" : "Registrar admissão"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Acesso ao sistema */}
      <div className={styles.card}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Acesso ao sistema</h3>

        {acesso && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 0 }}>
              Copie e envie para a pessoa. A senha só aparece aqui, agora.
            </p>
            <textarea readOnly value={acesso.accessText} rows={7} className={styles.formTextarea}
              style={{ fontFamily: "monospace", fontSize: "0.85rem" }} />
            <button
              className={styles.btnPrimary}
              style={{ marginTop: 8 }}
              onClick={copiarAcesso}
            >
              {copiado ? "✓ Copiado!" : "Copiar instruções"}
            </button>
          </div>
        )}

        {f.usuario ? (
          <p style={{ margin: 0 }}>
            <strong>{f.usuario.email}</strong> — {roles[f.usuario.role] || f.usuario.role}
            {!f.usuario.active && <span style={{ color: "#b91c1c" }}> · acesso desativado</span>}
            {" · "}
            <Link href="/admin/usuarios">gerenciar em Usuários</Link>
            {!f.usuario.active && aberto && (
              <span style={{ display: "block", fontSize: "0.85rem", color: "#a16207", marginTop: 8 }}>
                A pessoa foi readmitida, mas o acesso segue desativado. Reative e redefina a senha em Usuários.
              </span>
            )}
          </p>
        ) : !acesso ? (
          <form onSubmit={criarAcessoSubmit} className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Login</label>
              <input name="login" className={styles.formInput} placeholder="victor  →  victor@vamaqmotors.com.br" required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Papel</label>
              <select name="role" className={styles.formSelect} defaultValue="vendedor">
                {Object.entries(roles).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={isPending}>Criar acesso</button>
            </div>
          </form>
        ) : null}
      </div>
    </>
  );
}
