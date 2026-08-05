"use client";

import { useMemo, useState } from "react";
import styles from "../../admin.module.css";

const fmtData = (d) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

// Rótulo amigável do tipo de documento — os valores em TIPOS (src/lib/documentos.js)
// usam o slug técnico, aqui é o nome que a Louanny reconhece na tela.
const TIPO_LABEL = {
  "compra-venda": "Compra e venda",
  venda: "Venda",
  consignacao: "Consignação",
  "termo-vistoria": "Termo de vistoria",
};

function veiculoDoDocumento(doc) {
  if (!doc.brand && !doc.model && !doc.year && !doc.placa) return "—";
  const nome = [doc.brand, doc.model, doc.year].filter(Boolean).join(" ");
  return [nome, doc.placa].filter(Boolean).join(" — ") || "—";
}

export default function GeradosClient({ documentos }) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return documentos;
    return documentos.filter((d) => {
      const cliente = (d.cliente || "").toLowerCase();
      const placa = (d.placa || "").toLowerCase();
      return cliente.includes(termo) || placa.includes(termo);
    });
  }, [documentos, busca]);

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Documentos gerados</h1>
        <p className={styles.pageSubtitle}>
          Contratos e documentos já gerados, guardados para consulta
        </p>
      </div>

      <div className={styles.card}>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente ou placa..."
            className={styles.formInput}
          />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Veículo</th>
                <th>Gerado por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((d) => (
                <tr key={d.id}>
                  <td>{fmtData(d.created_at)}</td>
                  <td>{TIPO_LABEL[d.tipo] || d.tipo}</td>
                  <td>{d.cliente || "—"}</td>
                  <td>{veiculoDoDocumento(d)}</td>
                  <td>{d.criado_por_nome || "—"}</td>
                  <td>
                    <a
                      href={`/api/admin/documentos-gerados/${d.id}/arquivo`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.btnSecondary}
                    >
                      Abrir
                    </a>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
                    {documentos.length === 0
                      ? "Nenhum documento guardado ainda."
                      : "Nenhum documento encontrado para essa busca."}
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
