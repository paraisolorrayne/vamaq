"use client";

import { useState } from "react";
import styles from "../admin.module.css";
import { GRUPOS } from "@/lib/fin/planoContas";

/**
 * Criar uma categoria SEM sair do formulário que está sendo preenchido.
 *
 * POR QUE ISTO EXISTE: a tela de Categorias já existia, mas só se chegava nela
 * pelo hub do Financeiro. Quem descobre que falta uma categoria descobre no
 * meio do lançamento — com valor, data e descrição já digitados. O caminho era
 * abandonar o formulário, criar a categoria em outra tela e digitar tudo de
 * novo. Ninguém faz isso duas vezes: na terceira, a despesa vai para qualquer
 * categoria parecida, e o DRE começa a mentir.
 *
 * Abre embaixo do seletor, não em popup (mesma regra do CRM). Ao criar, a
 * categoria nova já vem SELECIONADA — senão a pessoa cria e esquece de
 * escolher, que é o mesmo erro com um passo a mais.
 *
 * `tipo` é 'expense' ou 'revenue' e limita os grupos oferecidos: lançando uma
 * despesa, não faz sentido poder criar uma categoria de receita.
 */
export default function NovaCategoria({ tipo, onCriada }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const grupos = GRUPOS.filter((g) => g.tipo === tipo);
  const grupoSel = grupos.find((g) => g.id === grupoId);

  function abrir() {
    setAberto(true);
    setErro(null);
    // Despesa quase sempre é administrativa; receita só tem um grupo. Nascer
    // com o palpite certo poupa um toque no caso comum.
    setGrupoId(grupos.some((g) => g.id === "administrativa") ? "administrativa" : grupos[0]?.id || "");
  }

  function fechar() {
    setAberto(false);
    setNome("");
    setErro(null);
  }

  async function criar() {
    const limpo = nome.trim();
    if (!limpo) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/admin/financeiro/contas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: limpo, grupoId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.error || "Não foi possível criar a categoria.");
        return;
      }
      onCriada(d);
      fechar();
    } catch {
      setErro("Falha de conexão. Tente de novo.");
    } finally {
      // No finally: sem isto o botão trava para sempre quando o servidor
      // responde erro, e parece que o sistema morreu.
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={abrir}
        style={{
          minHeight: 44,
          marginTop: 6,
          padding: 0,
          background: "none",
          border: "none",
          color: "#2f4d8f",
          font: "inherit",
          fontSize: "0.82rem",
          fontWeight: 600,
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        + Criar categoria
      </button>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        background: "#f7f8fa",
        border: "1px solid #d8dce5",
        borderRadius: 8,
      }}
    >
      <label className={styles.formLabel}>Nome da categoria</label>
      <input
        className={styles.formInput}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="ex.: Alarme e monitoramento"
        style={{ minHeight: 48 }}
        autoFocus
        // Enter aqui não pode submeter o formulário de fora (o lançamento
        // inteiro sairia pela metade) — cria a categoria e para por aqui.
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            criar();
          }
        }}
      />

      {grupos.length > 1 && (
        <>
          <label className={styles.formLabel} style={{ marginTop: 10 }}>
            Onde ela entra
          </label>
          <select
            className={styles.formSelect}
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
            style={{ minHeight: 48 }}
          >
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.rotulo}
              </option>
            ))}
          </select>
          {grupoSel && (
            <p style={{ fontSize: "0.78rem", color: "#666", margin: "6px 0 0" }}>{grupoSel.ajuda}</p>
          )}
        </>
      )}

      {erro && (
        <p style={{ fontSize: "0.82rem", color: "#b91c1c", margin: "8px 0 0" }}>{erro}</p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={criar}
          className={styles.btnPrimary}
          disabled={salvando || !nome.trim()}
          style={{ minHeight: 48 }}
        >
          {salvando ? "Criando…" : "Criar e usar"}
        </button>
        <button
          type="button"
          onClick={fechar}
          className={styles.btnSecondary}
          style={{ minHeight: 48 }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
