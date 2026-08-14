"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import { anoVeiculo } from "@/lib/anoVeiculo";
import { normalizaBusca } from "@/lib/buscaVeiculo";
import { filtraPorPeriodo, semData } from "@/lib/estoque/periodo";

/**
 * Registro de entrada e saída dos veículos — o item do escopo que pede
 * "datas e valores de compra e venda" num lugar só.
 *
 * Os valores NÃO são digitados aqui: vêm do Financeiro, dos lançamentos já
 * ligados ao veículo. Um segundo campo para o mesmo número acabaria divergindo
 * do primeiro, e aí nenhum dos dois serve de registro.
 */

function money(n) {
  if (n === null || n === undefined) return "—";
  return (
    "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** "2026-08-14" -> "14/08/2026", sem passar por Date (fuso viraria dia 13). */
function dataBR(iso) {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "—";
}

const STATUS_ROTULO = {
  disponivel: "disponível",
  reservado: "reservado",
  vendido: "vendido",
  inativo: "inativo",
};

export default function EntradasSaidasClient({ linhas, podeVerValores }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [campo, setCampo] = useState("data_entrada");
  const [busca, setBusca] = useState("");

  const porPeriodo = filtraPorPeriodo(linhas, { de, ate, campo });
  const alvo = normalizaBusca(busca);
  const lista = alvo
    ? porPeriodo.filter((v) =>
        normalizaBusca(
          `${v.brand} ${v.model} ${v.placa || ""} ${v.chassi || ""}`
        ).includes(alvo)
      )
    : porPeriodo;

  const faltando = semData(linhas, campo);
  const comValor = lista.filter((v) => v.venda != null);
  const totalVenda = comValor.reduce((s, v) => s + Number(v.venda || 0), 0);
  const totalCompra = comValor.reduce((s, v) => s + Number(v.compra || 0), 0);

  return (
    <>
      <Link href="/admin/estoque" className={styles.backLinkContent}>← Estoque</Link>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Entradas e saídas</h1>
        <p className={styles.pageSubtitle}>
          Quando cada carro entrou e saiu da loja, com os valores de compra e venda
        </p>
      </div>

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
        >
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <label className={styles.formLabel}>Buscar</label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="marca, modelo, placa ou chassi"
              className={styles.formInput}
              style={{ minHeight: 48 }}
            />
          </div>
          <div>
            <label className={styles.formLabel}>Período por</label>
            <select
              value={campo}
              onChange={(e) => setCampo(e.target.value)}
              className={styles.formSelect}
              style={{ minHeight: 48 }}
            >
              <option value="data_entrada">data de entrada</option>
              <option value="data_saida">data de saída</option>
            </select>
          </div>
          <div>
            <label className={styles.formLabel}>De</label>
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className={styles.formInput}
              style={{ minHeight: 48 }}
            />
          </div>
          <div>
            <label className={styles.formLabel}>Até</label>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className={styles.formInput}
              style={{ minHeight: 48 }}
            />
          </div>
          {(de || ate || busca) && (
            <button
              type="button"
              onClick={() => { setDe(""); setAte(""); setBusca(""); }}
              className={`${styles.btnSecondary} ${styles.btnSmall}`}
              style={{ minHeight: 48 }}
            >
              Limpar
            </button>
          )}
        </div>

        {(de || ate) && faltando > 0 && (
          <p style={{ fontSize: "0.8rem", color: "#a8752e", margin: "12px 0 0" }}>
            {faltando} de {linhas.length} veículos ainda estão sem{" "}
            {campo === "data_entrada" ? "data de entrada" : "data de saída"} e ficam de fora
            deste período — o total abaixo não conta esses carros.
          </p>
        )}
      </div>

      <div className={styles.card}>
        {lista.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📋</div>
            <div className={styles.emptyText}>Nenhum veículo neste filtro.</div>
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Veículo</th>
                    <th>Entrada</th>
                    <th>Saída</th>
                    <th>Status</th>
                    {podeVerValores && (
                      <>
                        <th>Compra</th>
                        <th>Venda</th>
                        <th>Resultado</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <Link href={`/admin/estoque/novo?id=${v.id}`} prefetch={false}>
                          <strong>{v.brand} {v.model}</strong>
                        </Link>{" "}
                        {anoVeiculo(v)}
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#888" }}>
                          {v.placa || "sem placa"}
                        </span>
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{dataBR(v.data_entrada)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{dataBR(v.data_saida)}</td>
                      <td>{STATUS_ROTULO[v.status] || v.status}</td>
                      {podeVerValores && (
                        <>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>{money(v.compra)}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>{money(v.venda)}</td>
                          <td
                            style={{
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: 600,
                              color:
                                v.resultado == null
                                  ? "#888"
                                  : Number(v.resultado) >= 0
                                    ? "#15803d"
                                    : "#b91c1c",
                            }}
                          >
                            {money(v.resultado)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: "0.8rem", color: "#666", margin: "12px 0 0" }}>
              {lista.length} veículo{lista.length === 1 ? "" : "s"} no filtro.
              {podeVerValores && comValor.length > 0 && (
                <>
                  {" "}Com lançamento no financeiro: {comValor.length} — compra {money(totalCompra)},
                  venda {money(totalVenda)}.
                </>
              )}
            </p>
            {podeVerValores && (
              <p style={{ fontSize: "0.78rem", color: "#888", margin: "6px 0 0" }}>
                Os valores vêm dos lançamentos do Financeiro ligados a cada veículo — carro sem
                compra ou venda lançada aparece com “—”. O resultado já desconta os impostos da
                venda.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
