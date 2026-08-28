"use client";

import { useState, useTransition } from "react";
import styles from "../admin.module.css";
import {
  createUserAction,
  resetPasswordAction,
  toggleActiveAction,
  updateRoleAction,
  updateLimitAction,
  vincularFuncionarioAction,
} from "./actions";

export default function UsuariosClient({ users, roles, meId, funcionarios }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState(null);
  const [access, setAccess] = useState(null); // { email, accessText, kind }
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [role, setRole] = useState("estoque");

  const roleEntries = Object.entries(roles);

  function handleCreate(e) {
    e.preventDefault();
    setErr(null);
    setAccess(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("login", login);
    fd.set("role", role);
    startTransition(async () => {
      const r = await createUserAction(null, fd);
      if (r?.error) setErr(r.error);
      else {
        setAccess(r);
        setCopied(false);
        setName("");
        setLogin("");
      }
    });
  }

  function handleReset(u) {
    if (!confirm(`Gerar uma nova senha temporária para ${u.email}?`)) return;
    setErr(null);
    startTransition(async () => {
      const r = await resetPasswordAction(u.id);
      if (r?.error) setErr(r.error);
      else {
        setAccess(r);
        setCopied(false);
      }
    });
  }

  function handleToggle(u) {
    startTransition(async () => {
      await toggleActiveAction(u.id, !u.active);
    });
  }

  function handleRole(u, newRole) {
    startTransition(async () => {
      await updateRoleAction(u.id, newRole);
    });
  }

  function handleLimit(u, value) {
    startTransition(async () => {
      await updateLimitAction(u.id, value);
    });
  }

  function handleFuncionario(u, funcionarioId) {
    setErr(null);
    startTransition(async () => {
      const r = await vincularFuncionarioAction(u.id, funcionarioId || null);
      if (r?.error) setErr(r.error);
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(access.accessText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Usuários</h1>
        <p className={styles.pageSubtitle}>
          Crie acessos, defina o papel e gere senhas para a equipe
        </p>
      </div>

      {/* Caixa de instruções de acesso — aparece após criar/redefinir */}
      {access && (
        <div className={styles.card} style={{ marginBottom: 24, borderLeft: "4px solid #16a34a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ color: "#15803d" }}>
              Senha {access.kind} para {access.email}
            </strong>
            <button onClick={() => setAccess(null)} className={styles.btnSecondary} style={{ padding: "2px 10px" }}>
              Fechar
            </button>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 0 }}>
            Copie e envie para a pessoa (WhatsApp, e-mail…). A senha só aparece aqui, agora.
          </p>
          <textarea
            readOnly
            value={access.accessText}
            rows={7}
            className={styles.formTextarea}
            style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
          />
          <button onClick={copy} className={styles.btnPrimary} style={{ marginTop: 8 }}>
            {copied ? "✓ Copiado!" : "Copiar instruções"}
          </button>
        </div>
      )}

      {/* Criar novo usuário */}
      <div className={styles.card} style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>
          Novo usuário
        </h3>
        <form onSubmit={handleCreate} className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nome</label>
            <input
              className={styles.formInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Victor de Andrade"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Login (e-mail)</label>
            <input
              className={styles.formInput}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="victor  →  victor@vamaqmotors.com.br"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Papel</label>
            <select
              className={styles.formSelect}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roleEntries.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup} style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className={styles.btnPrimary} disabled={isPending}>
              {isPending ? "Criando…" : "Criar acesso"}
            </button>
          </div>
        </form>
        {err && <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginBottom: 0 }}>{err}</p>}
      </div>

      {/* Lista de usuários */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Funcionário</th>
                <th>Papel</th>
                <th title="Valor que aprova sozinho em Contas a Pagar">Alçada</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                  <td>
                    <strong>{u.name}</strong>
                    <div style={{ fontSize: "0.82rem", color: "#666" }}>{u.email}</div>
                  </td>
                  <td>
                    <select
                      value={u.funcionario_id || ""}
                      onChange={(e) => handleFuncionario(u, e.target.value)}
                      disabled={isPending}
                      className={styles.formSelect}
                      style={{ padding: "4px 8px", fontSize: "0.82rem", maxWidth: 180 }}
                      title="Ficha de funcionário ligada a este login"
                    >
                      <option value="">— sem ficha —</option>
                      {funcionarios.map((f) => (
                        <option key={f.id} value={f.id}>{f.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => handleRole(u, e.target.value)}
                      disabled={isPending || u.id === meId}
                      className={styles.formSelect}
                      style={{ padding: "4px 8px", fontSize: "0.82rem", maxWidth: 200 }}
                      title={u.id === meId ? "Você não pode mudar o próprio papel" : roles[u.role] || ""}
                    >
                      {Object.entries(roles).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.role === "admin" ? (
                      <span style={{ fontSize: "0.8rem", color: "#15803d" }}>ilimitado</span>
                    ) : (
                      <input
                        type="number"
                        defaultValue={u.approval_limit ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (String(u.approval_limit ?? "") !== v) handleLimit(u, v);
                        }}
                        disabled={isPending}
                        placeholder="R$ 0"
                        className={styles.formInput}
                        style={{ padding: "4px 8px", fontSize: "0.82rem", width: 110 }}
                        title="Valor que aprova sozinho; acima disso, precisa de aprovação"
                      />
                    )}
                  </td>
                  <td>
                    {!u.active ? (
                      <span className={styles.badgeWarning} style={{ background: "#f3f4f6", color: "#6b7280" }}>
                        Inativo
                      </span>
                    ) : u.reset_requested_at ? (
                      /* Vem antes do "aguardando 1º acesso": quem pediu senha
                         nova está parado do lado de fora esperando alguém agir. */
                      <span className={styles.badgeWarning} style={{ background: "#fee2e2", color: "#b42318" }}>
                        Pediu senha nova
                      </span>
                    ) : u.must_change_password ? (
                      <span className={styles.badgeWarning} style={{ background: "#fef9c3", color: "#a16207" }}>
                        Aguardando 1º acesso
                      </span>
                    ) : (
                      <span className={styles.badgeSuccess}>Ativo</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        onClick={() => handleReset(u)}
                        className={`${
                          u.reset_requested_at ? styles.btnPrimary : styles.btnSecondary
                        } ${styles.btnSmall}`}
                        disabled={isPending}
                        title={
                          u.reset_requested_at
                            ? "Esta pessoa pediu uma senha nova na tela de login"
                            : undefined
                        }
                      >
                        Redefinir senha
                      </button>
                      {u.id !== meId && (
                        <button
                          onClick={() => handleToggle(u)}
                          className={u.active ? styles.btnDanger : styles.btnSecondary}
                          disabled={isPending}
                        >
                          {u.active ? "Desativar" : "Reativar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
