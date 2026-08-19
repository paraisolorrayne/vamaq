"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import styles from "../../../admin.module.css";
import { emitirNotaEntradaAction } from "../../actions";

/**
 * Nota fiscal de ENTRADA — a que a Vamaq emite ao COMPRAR um veículo de
 * pessoa física.
 *
 * É o passo que destrava a venda: o texto obrigatório da nota de saída cita o
 * número da nota de entrada do carro. Enquanto a entrada depender do
 * escritório, nenhuma venda sai.
 *
 * Comprando de EMPRESA não se emite nada aqui — a empresa é contribuinte e
 * emite a própria nota de venda. A tela diz isso antes de a pessoa preencher
 * tudo e levar o erro no fim.
 */
const VAZIO = {
  nome: "",
  doc: "",
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  municipio: "",
  uf: "MG",
};

export default function EntradaClient({ veiculo, ativo, notaExistente }) {
  const [remetente, setRemetente] = useState(VAZIO);
  const [valor, setValor] = useState("");
  const [consignacao, setConsignacao] = useState(false);
  const [erro, setErro] = useState(null);
  const [isPending, startTransition] = useTransition();

  const nomeVeiculo = `${veiculo.brand} ${veiculo.model} ${veiculo.year}${
    veiculo.placa ? ` — ${veiculo.placa}` : ""
  }`;

  function set(campo, v) {
    setRemetente((r) => ({ ...r, [campo]: v }));
  }

  function emitir(e) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const r = await emitirNotaEntradaAction(veiculo.id, {
        remetente,
        valorAquisicao: Number(String(valor).replace(/\./g, "").replace(",", ".")) || 0,
        consignacao,
      });
      if (r?.error) setErro(r.error);
    });
  }

  if (!ativo) {
    return (
      <>
        <Link href="/admin/fiscal" className={styles.backLinkContent}>← Notas Fiscais</Link>
        <p style={{ padding: 24 }}>O emissor fiscal não está configurado neste ambiente.</p>
      </>
    );
  }

  if (notaExistente) {
    const processando = notaExistente.status === "processando";
    return (
      <>
        <Link href="/admin/fiscal" className={styles.backLinkContent}>← Notas Fiscais</Link>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Nota de entrada</h1>
        </div>
        <div
          className={styles.card}
          style={{
            borderLeft: `4px solid ${processando ? "#7cb08e" : "#e8b84b"}`,
            background: processando ? "#eef6f0" : "#fff7e8",
          }}
        >
          <strong style={{ color: processando ? "#2e7d4f" : "#a8752e" }}>
            {processando
              ? "A nota já foi enviada — a SEFAZ está autorizando"
              : "Este veículo já tem nota de entrada"}
          </strong>
          <p style={{ fontSize: "0.9rem", color: "#333", margin: "6px 0 0" }}>
            {processando
              ? `A nota de entrada do ${nomeVeiculo} está na fila da SEFAZ. Não emita de novo — o status vira Autorizada sozinho.`
              : `O ${nomeVeiculo} já tem nota de entrada autorizada. Para emitir outra, cancele a atual primeiro.`}
          </p>
          <p style={{ margin: "16px 0 0" }}>
            <Link href="/admin/fiscal" className={styles.btnPrimary}>Ver em Notas Fiscais</Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Link href="/admin/fiscal" className={styles.backLinkContent}>← Notas Fiscais</Link>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Nota de entrada</h1>
        <p className={styles.pageSubtitle}>{nomeVeiculo}</p>
      </div>

      <div className={styles.card} style={{ marginBottom: 24, borderLeft: "4px solid #7f9ad6" }}>
        <strong>Só para compra de pessoa física</strong>
        <p style={{ fontSize: "0.9rem", color: "#333", margin: "6px 0 0" }}>
          Se você comprou o carro de uma <strong>empresa</strong>, não emita nada aqui:
          quem emite a nota é ela, e a Vamaq só recebe e guarda. Emitir também
          colocaria duas notas na mesma compra.
        </p>
        <p style={{ fontSize: "0.9rem", color: "#333", margin: "6px 0 0" }}>
          Esta nota é o que <strong>destrava a venda</strong>: o texto da nota de venda
          precisa citar o número dela — e ele vem preenchido sozinho depois que esta
          for autorizada.
        </p>
      </div>

      {/* O escritório emitiu entrada de vários carros antes de o sistema
          existir, e essas notas não estão aqui. O sistema não tem como saber
          disso — só quem operou sabe. Perguntar antes custa uma linha; uma
          segunda nota de entrada do mesmo carro custa cancelamento e
          explicação para a fiscalização. */}
      <div className={styles.card} style={{ marginBottom: 24, borderLeft: "4px solid #e8b84b", background: "#fff7e8" }}>
        <strong style={{ color: "#a8752e" }}>Confira antes: o Rodrigo já emitiu a deste carro?</strong>
        <p style={{ fontSize: "0.9rem", color: "#333", margin: "6px 0 0" }}>
          As notas que o escritório emitiu <strong>não aparecem aqui</strong> — elas saíram
          por fora do sistema. Se este carro já tem nota de entrada emitida por ele,
          <strong> não emita outra</strong>: seriam duas notas para a mesma compra, e desfazer
          exige cancelamento.
        </p>
        <p style={{ fontSize: "0.9rem", color: "#333", margin: "6px 0 0" }}>
          Na dúvida, pergunte a ele. Emita aqui os carros que <strong>ainda não têm nota
          nenhuma</strong> — que são justamente os que estão parados.
        </p>
      </div>

      {erro && (
        <div className={styles.card} style={{ marginBottom: 24, borderLeft: "4px solid #b91c1c" }}>
          <p style={{ color: "#b91c1c", fontSize: "0.9rem", margin: 0 }}>{erro}</p>
        </div>
      )}

      <form onSubmit={emitir} className={styles.card}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>
          Quem vendeu o veículo para a Vamaq
        </h3>
        <div className={styles.formGrid}>
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.formLabel}>Nome completo *</label>
            <input className={styles.formInput} value={remetente.nome}
              onChange={(e) => set("nome", e.target.value)} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>CPF *</label>
            <input className={styles.formInput} value={remetente.doc}
              onChange={(e) => set("doc", e.target.value)} placeholder="000.000.000-00" required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>CEP *</label>
            <input className={styles.formInput} value={remetente.cep}
              onChange={(e) => set("cep", e.target.value)} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Logradouro *</label>
            <input className={styles.formInput} value={remetente.logradouro}
              onChange={(e) => set("logradouro", e.target.value)} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Número *</label>
            <input className={styles.formInput} value={remetente.numero}
              onChange={(e) => set("numero", e.target.value)} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Bairro *</label>
            <input className={styles.formInput} value={remetente.bairro}
              onChange={(e) => set("bairro", e.target.value)} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Município *</label>
            <input className={styles.formInput} value={remetente.municipio}
              onChange={(e) => set("municipio", e.target.value)} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>UF *</label>
            <input className={styles.formInput} value={remetente.uf} maxLength={2}
              onChange={(e) => set("uf", e.target.value.toUpperCase())} required />
          </div>
        </div>

        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "24px 0 16px" }}>A compra</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Valor pago pelo veículo *</label>
            <input className={styles.formInput} value={valor}
              onChange={(e) => setValor(e.target.value)} placeholder="150.000,00" required />
          </div>
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.toggleLabel} style={{ minHeight: 48, display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={consignacao}
                onChange={(e) => setConsignacao(e.target.checked)} />
              <span>
                O carro veio em <strong>consignação</strong> (a Vamaq não comprou — vai
                vender pelo dono)
              </span>
            </label>
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={isPending}
            style={{ minHeight: 48 }}>
            {isPending ? "Emitindo…" : "Emitir nota de entrada"}
          </button>
          <Link href="/admin/fiscal" className={styles.btnSecondary}>Cancelar</Link>
        </div>
      </form>
    </>
  );
}
