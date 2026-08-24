"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import styles from "../admin.module.css";
import { orientacaoDoErro, DONO } from "@/lib/fiscal/orientacao";
import {
  atualizarStatusAction,
  cancelarNotaAction,
  devolverConsignacaoAction,
  cartaCorrecaoAction,
  registrarCancelamentoExternoAction,
} from "./actions";
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



/**
 * O que fazer depois de uma nota cancelada.
 *
 * "Cancelada" responde o que aconteceu e deixa a pergunta seguinte no ar: e
 * agora, posso emitir de novo? Preciso preencher tudo outra vez? Sem resposta
 * na tela, essa pergunta vira mensagem para quem construiu o sistema.
 */
function LiberadoParaReemitir({ nota }) {
  const entrada = nota.operacao === "entrada";
  const destino = entrada
    ? `/admin/fiscal/entrada/${nota.vehicle_id}?refazer=${encodeURIComponent(nota.ref)}`
    : `/admin/fiscal/emitir/${nota.vehicle_id}`;

  return (
    <div
      style={{
        marginTop: 6,
        padding: "8px 10px",
        background: "#eef6f0",
        borderLeft: "3px solid #7cb08e",
        borderRadius: 4,
        maxWidth: 560,
      }}
    >
      <div
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.62rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#2e7d4f",
          fontWeight: 700,
        }}
      >
        Liberado para emitir de novo
      </div>
      <p style={{ fontSize: "0.82rem", color: "#374151", margin: "4px 0 0", lineHeight: 1.45 }}>
        {entrada
          ? "Não precisa começar do zero: o formulário abre preenchido com os dados desta nota. Confira o que estava errado, corrija e emita."
          : "O veículo voltou a aceitar nota de venda. Preencha a emissão normalmente."}
        {" "}A nota nova recebe um número próprio, e esta continua no histórico.
      </p>
      <p style={{ margin: "8px 0 0" }}>
        <Link
          href={destino}
          className={`${styles.btnPrimary} ${styles.btnSmall}`}
          style={{ display: "inline-flex", alignItems: "center", minHeight: 40 }}
        >
          {entrada ? "Emitir de novo com os mesmos dados" : "Emitir nota de venda"}
        </Link>
      </p>
    </div>
  );
}

/** Cores por dono do problema. Verde não entra: nada aqui é boa notícia. */
const COR_DONO = {
  [DONO.OPERACAO]: { fundo: "#fff7e8", borda: "#e8b84b", texto: "#a8752e" },
  [DONO.CONTABILIDADE]: { fundo: "#eef2fb", borda: "#7f9ad6", texto: "#2f4d8f" },
  [DONO.SUPORTE]: { fundo: "#fdf0ee", borda: "#d9776c", texto: "#b3392c" },
  [DONO.ESPERAR]: { fundo: "#f3f4f6", borda: "#c9cbd1", texto: "#4b5563" },
};

/**
 * O erro da SEFAZ traduzido em próximo passo.
 *
 * A mensagem crua continua embaixo, recolhida: é dela que a contabilidade
 * precisa, e é ela que se copia num WhatsApp. Mas quem lê primeiro é quem
 * opera a loja — e essa pessoa precisa saber o que fazer, não decifrar uma
 * rejeição em linguagem fiscal.
 */
function OrientacaoDoErro({ mensagem }) {
  const o = orientacaoDoErro(mensagem);
  const cor = COR_DONO[o.dono] || COR_DONO[DONO.CONTABILIDADE];

  async function copiar() {
    try {
      await navigator.clipboard.writeText(o.mensagemOriginal);
    } catch {
      // navegador sem permissão de área de transferência — o texto está à vista
    }
  }

  return (
    <div
      style={{
        marginTop: 6,
        padding: "8px 10px",
        background: cor.fundo,
        borderLeft: `3px solid ${cor.borda}`,
        borderRadius: 4,
        maxWidth: 560,
      }}
    >
      <div
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.62rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: cor.texto,
          fontWeight: 700,
        }}
      >
        {o.rotuloDono}
      </div>
      <p style={{ fontSize: "0.84rem", color: "#1f2937", margin: "4px 0 0", fontWeight: 600 }}>
        {o.resumo}
      </p>
      <p style={{ fontSize: "0.82rem", color: "#374151", margin: "4px 0 0", lineHeight: 1.45 }}>
        {o.oQueFazer}
      </p>
      <details style={{ marginTop: 6 }}>
        <summary style={{ fontSize: "0.75rem", color: "#6b7280", cursor: "pointer" }}>
          Ver o texto da SEFAZ (para enviar à contabilidade)
        </summary>
        <p
          style={{
            fontSize: "0.75rem",
            color: "#6b7280",
            margin: "6px 0 0",
            wordBreak: "break-word",
          }}
        >
          {o.mensagemOriginal}
        </p>
        <button
          type="button"
          onClick={copiar}
          style={{
            marginTop: 6,
            minHeight: 36,
            padding: "0 10px",
            fontSize: "0.75rem",
            background: "none",
            border: "1px solid #c9cbd1",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Copiar texto
        </button>
      </details>
    </div>
  );
}

export default function FiscalClient({
  notas,
  ativo,
  vendidos,
  semEntrada = [],
  consignacoes = [],
}) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState(null);
  const [pendingRef, setPendingRef] = useState(null);
  const [veiculoSel, setVeiculoSel] = useState("");
  const [entradaSel, setEntradaSel] = useState("");

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

  function handleDevolver(c) {
    const dono = c.destinatario?.nome || "o dono";
    if (
      !window.confirm(
        `Emitir a nota de devolução do ${c.brand} ${c.model} para ${dono}?\n\n` +
          "É a nota que registra o carro voltando para quem o deixou em consignação. " +
          "Os dados saem da nota de entrada."
      )
    ) {
      return;
    }
    setErr(null);
    setPendingRef(c.ref);
    startTransition(async () => {
      const r = await devolverConsignacaoAction(c.vehicle_id);
      if (r?.error) setErr(r.error);
      setPendingRef(null);
    });
  }

  function handleAtualizar(ref) {
    setErr(null);
    setPendingRef(ref);
    startTransition(async () => {
      const r = await atualizarStatusAction(ref);
      if (r?.error) setErr(r.error);
      setPendingRef(null);
    });
  }

  function handleCancelamentoExterno(n) {
    const protocolo = window.prompt(
      "Protocolo do cancelamento (15 números)\n\n" +
        "É o código que a contabilidade recebe da SEFAZ ao cancelar — diferente do " +
        "protocolo de autorização que está na DANFE.\n\n" +
        "Só registre depois de confirmar que a SEFAZ aceitou o cancelamento. " +
        "Se a nota antiga não estiver mesmo cancelada, o carro fica com duas notas válidas."
    );
    if (protocolo == null) return;
    const motivo = window.prompt("Por que a nota foi cancelada? (mínimo 15 caracteres)");
    if (motivo == null) return;

    setErr(null);
    setPendingRef(n.ref);
    startTransition(async () => {
      const r = await registrarCancelamentoExternoAction(n.ref, {
        protocolo,
        justificativa: motivo,
      });
      if (r?.error) setErr(r.error);
      setPendingRef(null);
    });
  }

  function handleCorrigir(n) {
    const texto = window.prompt(
      "O que está errado na nota? (mínimo 15 caracteres)\n\n" +
        "A carta de correção NÃO corrige valor de imposto, quem é o cliente, nem a data. " +
        "Para esses, o caminho é cancelar ou emitir contra-nota."
    );
    if (texto == null) return;
    if (texto.trim().length < 15) {
      setErr(`A carta de correção precisa de pelo menos 15 caracteres — tem ${texto.trim().length}.`);
      return;
    }
    setErr(null);
    setPendingRef(n.ref);
    startTransition(async () => {
      const r = await cartaCorrecaoAction(n.ref, texto);
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

      {/* Nota de ENTRADA — a que a Vamaq emite ao COMPRAR de pessoa física.
          Fica num cartão próprio, e não como opção dentro do de cima, porque é
          a operação inversa: uma nasce da venda, a outra da compra. Misturar as
          duas num seletor só seria convite a emitir a errada. */}
      {ativo && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>
            Emitir nota de entrada
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 12px" }}>
            Ao <strong>comprar</strong> um carro de pessoa física. É esta nota que
            destrava a venda — o texto da nota de venda cita o número dela.
            Comprando de empresa, quem emite é ela.
          </p>
          {semEntrada.length === 0 ? (
            <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>
              Todos os veículos do estoque já têm nota de entrada.
            </p>
          ) : (
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Veículo comprado</label>
                <select
                  className={styles.formSelect}
                  value={entradaSel}
                  onChange={(e) => setEntradaSel(e.target.value)}
                >
                  <option value="">— escolha —</option>
                  {semEntrada.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} {v.year}
                      {v.placa ? ` — ${v.placa}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup} style={{ display: "flex", alignItems: "flex-end" }}>
                <Link
                  href={entradaSel ? `/admin/fiscal/entrada/${entradaSel}` : "#"}
                  className={styles.btnPrimary}
                  aria-disabled={!entradaSel}
                  style={{
                    minHeight: 48,
                    display: "inline-flex",
                    alignItems: "center",
                    pointerEvents: entradaSel ? "auto" : "none",
                    opacity: entradaSel ? 1 : 0.5,
                  }}
                >
                  Emitir nota de entrada
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Devolução de consignação (CFOP 5918) — o carro que não vendeu e volta
          para o dono. Só aparece quando há consignação aberta: cartão vazio na
          tela toda hora ensina a ignorar a tela. */}
      {ativo && consignacoes.length > 0 && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>
            Devolver carro consignado ao dono
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 12px" }}>
            Para o carro que entrou em consignação e não vendeu. Não precisa
            preencher nada: o dono e o valor saem da nota de entrada.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {consignacoes.map((c) => (
                  <tr key={c.ref}>
                    <td>
                      <strong>
                        {c.brand} {c.model} {c.year}
                      </strong>
                      <br />
                      <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                        {c.placa || "sem placa"} · de {c.destinatario?.nome || "—"}
                        {c.numero ? ` · entrada NF ${c.numero}` : ""}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => handleDevolver(c)}
                        className={`${styles.btnSecondary} ${styles.btnSmall}`}
                        disabled={isPending && pendingRef === c.ref}
                        style={{ minHeight: 48 }}
                      >
                        {isPending && pendingRef === c.ref
                          ? "Emitindo…"
                          : "Devolver ao dono"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                      {/* Entrada e saída convivem na mesma lista e do mesmo
                          carro. Sem dizer qual é qual, "duas notas do Cayenne"
                          parece duplicidade — e é o contrário: é o par certo. */}
                      {n.cancelamento_externo && (
                        <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>
                          cancelada pela contabilidade · protocolo {n.cancelamento_protocolo}
                        </div>
                      )}
                      {/* Sem isto, a única pista de que o veículo voltou a
                          aceitar nota era ele reaparecer num seletor lá em
                          cima — e ninguém repara nisso. */}
                      {n.status === "cancelada" && (
                        <LiberadoParaReemitir nota={n} />
                      )}
                      {n.operacao === "devolucao" && (
                        <div
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "#a8752e",
                            marginTop: 2,
                          }}
                        >
                          Devolução · consignação
                        </div>
                      )}
                      {n.operacao === "entrada" && (
                        <div
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "#2f4d8f",
                            marginTop: 2,
                          }}
                        >
                          Entrada · compra
                        </div>
                      )}
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
                        <OrientacaoDoErro mensagem={n.mensagem} />
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
                          onClick={() => handleCorrigir(n)}
                          className={`${styles.btnSecondary} ${styles.btnSmall}`}
                          disabled={isPending && pendingRef === n.ref}
                          title="Corrige campo que não determina imposto — serve depois de vencido o prazo de cancelamento"
                        >
                          {n.carta_correcao_qtd > 0 ? "Corrigir de novo" : "Carta de correção"}
                        </button>
                      )}
                      {/* Quando a contabilidade cancela pelo sistema dela — o
                          que inclui o cancelamento fora do prazo, que a loja
                          não consegue fazer sozinha —, é aqui que a loja
                          registra e destrava a reemissão do veículo. Sem isto,
                          a única saída era chamar suporte técnico. */}
                      {n.status === "autorizada" && (
                        <button
                          onClick={() => handleCancelamentoExterno(n)}
                          className={`${styles.btnSecondary} ${styles.btnSmall}`}
                          disabled={isPending && pendingRef === n.ref}
                          title="Use quando a contabilidade já cancelou esta nota pelo sistema dela"
                        >
                          Já cancelada por fora
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
