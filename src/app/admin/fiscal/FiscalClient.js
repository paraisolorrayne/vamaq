"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import styles from "../admin.module.css";
import { atualizarStatusAction, cancelarNotaAction } from "./actions";
import { formatValorBR } from "@/lib/money";

function money(n) {
  return "R$ " + formatValorBR(Number(n) || 0);
}

function fmtData(d) {
  return d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
}

const STATUS_LABEL = {
  autorizada: "Autorizada",
  processando: "Processando",
  erro: "Erro",
  cancelada: "Cancelada",
};

const STATUS_STYLE = {
  processando: { background: "#fef9c3", color: "#a16207" },
  erro: { background: "#fee2e2", color: "#b91c1c" },
  cancelada: { background: "#f3f4f6", color: "#6b7280" },
};

export default function FiscalClient({ notas, ativo, vendidos }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState(null);
  const [pendingRef, setPendingRef] = useState(null);
  const [veiculoSel, setVeiculoSel] = useState("");

  // Notas que este carregamento da tela já foi consultar. Sem isto, cada
  // revalidação devolve `notas` novo, o efeito roda de novo e a consulta vira
  // um laço batendo na Focus sem parar.
  const jaConsultadas = useRef(new Set());

  // A emissão é ASSÍNCRONA: a Focus responde "processando_autorizacao" e a
  // autorização chega depois, numa consulta. Existia o botão "Atualizar", mas
  // ele deixava o trabalho para a operadora — em 18/08/2026 a Mayra emitiu,
  // não viu nada acontecer e só descobriu que tinha dado certo porque foi na
  // lista e atualizou a página por conta própria.
  //
  // Aqui a tela consulta sozinha o que está em processamento. Poucas
  // tentativas, espaçadas, e só uma vez por nota a cada abertura: se a SEFAZ
  // demorar mais que isso, o botão manual continua ali.
  useEffect(() => {
    const pendentes = notas.filter(
      (n) => n.status === "processando" && !jaConsultadas.current.has(n.ref)
    );
    if (!pendentes.length) return;
    pendentes.forEach((n) => jaConsultadas.current.add(n.ref));

    let cancelado = false;
    (async () => {
      for (const n of pendentes) {
        for (let i = 0; i < 3 && !cancelado; i++) {
          const r = await atualizarStatusAction(n.ref).catch(() => null);
          // Saiu de "processando" (autorizada ou rejeitada) — nada mais a fazer.
          if (!r || r.error || r.status !== "processando") break;
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [notas]);

  function handleAtualizar(ref) {
    setErr(null);
    setPendingRef(ref);
    startTransition(async () => {
      const r = await atualizarStatusAction(ref);
      if (r?.error) setErr(r.error);
      setPendingRef(null);
    });
  }

  function handleCancelar(ref) {
    const justificativa = window.prompt(
      "Motivo do cancelamento (mínimo 15 caracteres):"
    );
    if (justificativa == null) return;
    if (justificativa.trim().length < 15) {
      setErr("A justificativa precisa ter pelo menos 15 caracteres.");
      return;
    }
    setErr(null);
    setPendingRef(ref);
    startTransition(async () => {
      const r = await cancelarNotaAction(ref, justificativa);
      if (r?.error) setErr(r.error);
      setPendingRef(null);
    });
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Notas Fiscais</h1>
        <p className={styles.pageSubtitle}>
          NF-e emitidas na venda dos veículos, com status, DANFE e XML
        </p>
      </div>

      {ativo && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>
            Emitir nota
          </h3>
          {vendidos.length === 0 ? (
            <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>
              Nenhum veículo vendido no momento — a nota nasce da venda. Marque o
              carro como vendido no Estoque para poder emitir.
            </p>
          ) : (
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Veículo vendido</label>
                <select
                  className={styles.formSelect}
                  value={veiculoSel}
                  onChange={(e) => setVeiculoSel(e.target.value)}
                >
                  <option value="">— escolha —</option>
                  {vendidos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} {v.year}
                      {v.placa ? ` — ${v.placa}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formActions}>
                <Link
                  href={veiculoSel ? `/admin/fiscal/emitir/${veiculoSel}` : "#"}
                  className={styles.btnPrimary}
                  aria-disabled={!veiculoSel}
                  style={!veiculoSel ? { opacity: 0.55, pointerEvents: "none" } : undefined}
                >
                  Emitir nota
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {!ativo && (
        <div
          className={styles.card}
          style={{ marginBottom: 24, borderLeft: "4px solid #e8b84b", background: "#fff7e8" }}
        >
          <strong style={{ color: "#a8752e" }}>Emissor fiscal ainda não ativado</strong>
          <p style={{ fontSize: "0.9rem", color: "#666", margin: "6px 0 0" }}>
            A tela está pronta. Para emitir notas fiscais, é preciso cadastrar na
            Focus NFe o token da conta e enviar o certificado digital A1 da Vamaq.
            São duas coisas diferentes: o token libera o acesso à Focus; o
            certificado é o que assina a nota perante a SEFAZ. Enquanto isso, não
            há notas para mostrar aqui.
          </p>
        </div>
      )}

      {err && (
        <div
          className={styles.card}
          style={{ marginBottom: 24, borderLeft: "4px solid #b91c1c" }}
        >
          <p style={{ color: "#b91c1c", fontSize: "0.9rem", margin: 0 }}>{err}</p>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Número/Série</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Data</th>
                <th>Documentos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ativo &&
                notas.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <strong>
                        {n.brand} {n.model} {n.year}
                      </strong>
                      <br />
                      <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                        {n.placa || "sem placa"}
                      </span>
                    </td>
                    <td>
                      {n.numero ? `${n.numero}/${n.serie || "—"}` : "—"}
                    </td>
                    <td>
                      {n.status === "autorizada" ? (
                        <span className={styles.badgeSuccess}>{STATUS_LABEL[n.status]}</span>
                      ) : (
                        <span
                          className={styles.badgeWarning}
                          style={STATUS_STYLE[n.status] || {}}
                        >
                          {STATUS_LABEL[n.status] || n.status}
                        </span>
                      )}
                      {n.status === "erro" && n.mensagem && (
                        <p style={{ fontSize: "0.78rem", color: "#b91c1c", margin: "4px 0 0" }}>
                          {n.mensagem}
                        </p>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {money(n.valor)}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtData(n.created_at)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        {n.danfe_url && (
                          <a
                            href={n.danfe_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.btnSecondary} ${styles.btnSmall}`}
                          >
                            DANFE
                          </a>
                        )}
                        {n.xml_url && (
                          <a
                            href={n.xml_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.btnSecondary} ${styles.btnSmall}`}
                          >
                            XML
                          </a>
                        )}
                        {!n.danfe_url && !n.xml_url && (
                          <span style={{ color: "#9ca3af" }}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {n.status === "processando" && (
                        <button
                          onClick={() => handleAtualizar(n.ref)}
                          className={`${styles.btnSecondary} ${styles.btnSmall}`}
                          disabled={isPending && pendingRef === n.ref}
                        >
                          {isPending && pendingRef === n.ref ? "Atualizando…" : "Atualizar"}
                        </button>
                      )}
                      {n.status === "autorizada" && (
                        <button
                          onClick={() => handleCancelar(n.ref)}
                          className={`${styles.btnSecondary} ${styles.btnSmall}`}
                          disabled={isPending && pendingRef === n.ref}
                        >
                          {isPending && pendingRef === n.ref ? "Cancelando…" : "Cancelar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              {ativo && notas.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
                    Nenhuma nota emitida ainda.
                  </td>
                </tr>
              )}
              {!ativo && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
                    Nenhuma nota para mostrar.
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
