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




const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * O pacote de XMLs do mês, num arquivo só, para mandar à contabilidade.
 *
 * POR QUE COMEÇA NO MÊS PASSADO: quem abre esta tela para mandar XML está
 * fechando o mês que acabou — dia 1º, o mês corrente tem zero nota. Deixar o
 * seletor no mês atual entregava um "nenhuma nota neste mês" logo no primeiro
 * clique de quem fez tudo certo.
 */
function PacoteXmls() {
  const agora = new Date();
  const anterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const [ano, setAno] = useState(anterior.getFullYear());
  const [mes, setMes] = useState(anterior.getMonth() + 1);
  const [baixando, setBaixando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [erro, setErro] = useState(null);

  async function baixar() {
    setBaixando(true);
    setErro(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/admin/fiscal/xmls?ano=${ano}&mes=${mes}`);
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}));
        setErro(dados.error || "Não foi possível montar o pacote.");
        return;
      }
      const total = Number(res.headers.get("X-Notas-Total")) || 0;
      const faltando = Number(res.headers.get("X-Notas-Faltando")) || 0;
      const blob = await res.blob();

      // O download nasce de um clique num link temporário: é o caminho que
      // funciona igual em todo navegador, inclusive no celular.
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `xmls-vamaq-${ano}-${String(mes).padStart(2, "0")}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setAviso(
        faltando > 0
          ? `Pacote baixado com ${total - faltando} de ${total} nota(s). As ${faltando} que faltaram estão listadas no arquivo _faltando.txt, dentro do zip.`
          : `Pacote baixado com ${total} nota(s) — entrada e saída.`
      );
    } catch {
      setErro("A conexão caiu no meio do download. Tente de novo.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className={styles.card} style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>
        XMLs do mês para a contabilidade
      </h3>
      <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 12px" }}>
        Baixa num arquivo só (.zip) todos os XMLs do mês — <strong>compra e
        venda</strong>, separados em pastas, canceladas incluídas. É esse arquivo
        que vai para o contador.
      </p>
      <div className={styles.toolbar} style={{ gap: 10, flexWrap: "wrap" }}>
        <select
          className={styles.formSelect}
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          style={{ width: "auto" }}
          aria-label="Mês do pacote"
        >
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          className={styles.formSelect}
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          style={{ width: "auto" }}
          aria-label="Ano do pacote"
        >
          {[agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button className={styles.btnPrimary} onClick={baixar} disabled={baixando}>
          {baixando ? "Montando o pacote…" : "Baixar XMLs do mês"}
        </button>
      </div>
      {baixando && (
        <p style={{ fontSize: "0.8rem", color: "#888", margin: "10px 0 0" }}>
          Buscando cada nota no emissor — em mês cheio isso leva alguns segundos.
        </p>
      )}
      {aviso && (
        <p style={{ fontSize: "0.85rem", color: "#15803d", margin: "10px 0 0" }}>{aviso}</p>
      )}
      {erro && (
        <p style={{ fontSize: "0.85rem", color: "#b91c1c", margin: "10px 0 0" }}>{erro}</p>
      )}
      <p style={{ fontSize: "0.8rem", color: "#888", margin: "10px 0 0" }}>
        Só entram as notas emitidas <strong>por aqui</strong> (série 2). O que o
        escritório emitiu na série 1 já está com ele.
      </p>
    </div>
  );
}

/**
 * Baixa de nota cancelada pela contabilidade, na própria linha.
 *
 * DOIS CAMINHOS À VISTA, não escondidos: quem tem o protocolo digita; quem só
 * tem a confirmação marca a caixa e escreve o nome. Antes isto era uma
 * corrente de três `window.prompt` — e prompt que recusa some, obrigando a
 * recomeçar. A operadora tentou, foi recusada pelo formato do número, e parou.
 */
function FormularioBaixa({ baixa, setBaixa, salvar, salvando }) {
  const semProtocolo = baixa.semProtocolo;
  const campo = (k) => (e) => setBaixa({ ...baixa, [k]: e.target.value });

  const pronto =
    baixa.motivo.trim().length >= 15 &&
    (semProtocolo ? baixa.confirmadoPor.trim().length >= 3 : baixa.protocolo.trim().length > 0);

  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        background: "#f7f8fa",
        border: "1px solid #d8dce5",
        borderRadius: 6,
        maxWidth: 420,
      }}
    >
      <strong style={{ fontSize: "0.85rem" }}>Registrar o cancelamento</strong>
      <p style={{ fontSize: "0.78rem", color: "#666", margin: "4px 0 10px", lineHeight: 1.4 }}>
        Só registre se a contabilidade confirmou que a SEFAZ aceitou. Se a nota antiga
        não estiver mesmo cancelada, o carro fica com duas notas válidas.
      </p>

      {!semProtocolo && (
        <>
          <label className={styles.formLabel}>Protocolo do cancelamento</label>
          <input
            className={styles.formInput}
            value={baixa.protocolo}
            onChange={campo("protocolo")}
            placeholder="15 números"
            inputMode="numeric"
            style={{ minHeight: 44 }}
          />
          <p style={{ fontSize: "0.74rem", color: "#888", margin: "4px 0 0" }}>
            É o número que a contabilidade recebe ao cancelar — diferente do protocolo
            de autorização impresso na DANFE.
          </p>
        </>
      )}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          fontSize: "0.82rem",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={Boolean(semProtocolo)}
          onChange={(e) =>
            setBaixa({ ...baixa, semProtocolo: e.target.checked, protocolo: "" })
          }
        />
        <span>Não tenho o protocolo</span>
      </label>

      {semProtocolo && (
        <>
          <label className={styles.formLabel}>Quem da contabilidade confirmou?</label>
          <input
            className={styles.formInput}
            value={baixa.confirmadoPor}
            onChange={campo("confirmadoPor")}
            placeholder="Nome de quem confirmou"
            style={{ minHeight: 44 }}
          />
          <p style={{ fontSize: "0.74rem", color: "#888", margin: "4px 0 0" }}>
            Fica registrado como a origem desta baixa.
          </p>
        </>
      )}

      <label className={styles.formLabel} style={{ marginTop: 10 }}>
        Por que foi cancelada?
      </label>
      <input
        className={styles.formInput}
        value={baixa.motivo}
        onChange={campo("motivo")}
        placeholder="Ex.: CFOP incorreto para operação interestadual"
        style={{ minHeight: 44 }}
      />
      <p style={{ fontSize: "0.74rem", color: "#888", margin: "4px 0 0" }}>
        Mínimo 15 caracteres — faltam{" "}
        {Math.max(0, 15 - baixa.motivo.trim().length)}.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={salvar}
          className={`${styles.btnPrimary} ${styles.btnSmall}`}
          disabled={!pronto || salvando}
          style={{ minHeight: 44 }}
        >
          {salvando ? "Registrando…" : "Registrar cancelamento"}
        </button>
        <button
          type="button"
          onClick={() => setBaixa(null)}
          className={`${styles.btnSecondary} ${styles.btnSmall}`}
          style={{ minHeight: 44 }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

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
        maxWidth: 420,
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
        maxWidth: 420,
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
  // Formulário de baixa de nota cancelada por fora, aberto na própria linha.
  const [baixa, setBaixa] = useState(null);

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

  // Abre o formulário na linha. NÃO usa window.prompt: uma corrente de três
  // perguntas que some ao ser recusada obriga a operadora a recomeçar do zero,
  // e a regra deste painel é tudo na tela, sem popup.
  function abrirBaixa(n) {
    setBaixa({ ref: n.ref, protocolo: "", confirmadoPor: "", motivo: "" });
    setErr(null);
  }

  function salvarBaixa() {
    const b = baixa;
    setErr(null);
    setPendingRef(b.ref);
    startTransition(async () => {
      const r = await registrarCancelamentoExternoAction(b.ref, {
        protocolo: b.protocolo,
        confirmadoPor: b.confirmadoPor,
        justificativa: b.motivo,
      });
      if (r?.error) setErr(r.error);
      else setBaixa(null);
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

      {ativo && <PacoteXmls />}

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
                      {n.cancelamento_externo && (
                        <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 4 }}>
                          pela contabilidade ·{" "}
                          {n.cancelamento_protocolo
                            ? `protocolo ${n.cancelamento_protocolo}`
                            : `confirmado por ${n.cancelamento_confirmado_por || "—"}, sem protocolo`}
                        </div>
                      )}
                      {/* Aqui e não na coluna do veículo: é nesta coluna que a
                          pessoa olha para saber o estado da nota e o que fazer
                          em seguida. Na coluna do carro o bloco estourava a
                          largura e ficava longe da pergunta que ele responde. */}
                      {n.status === "cancelada" && <LiberadoParaReemitir nota={n} />}
                      {baixa?.ref === n.ref && (
                        <FormularioBaixa
                          baixa={baixa}
                          setBaixa={setBaixa}
                          salvar={salvarBaixa}
                          salvando={isPending && pendingRef === n.ref}
                        />
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
                        {/* Pela NOSSA rota, não pela URL do emissor: a Focus
                            serve o arquivo sem Content-Disposition, e o
                            navegador mostrava a árvore de código sem oferecer
                            onde salvar. Aqui o arquivo desce com nome. */}
                        {n.xml_url && (
                          <a
                            href={`/api/admin/fiscal/notas/${encodeURIComponent(n.ref)}/xml`}
                            download
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
                          onClick={() => abrirBaixa(n)}
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
