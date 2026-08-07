"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import styles from "../../../admin.module.css";
import { emitirNotaAction } from "../../actions";
import { formatValorBR } from "@/lib/money";
import { icmsSeminovo } from "@/lib/fin/calc";
import { destinatarioDoCliente } from "@/lib/clientes/prefill";
import { formataDoc } from "@/lib/clientes/doc";

const DEST_VAZIO = {
  nome: "", doc: "", cep: "", logradouro: "", numero: "", bairro: "", municipio: "", uf: "",
};

function money(n) {
  return "R$ " + formatValorBR(Number(n) || 0);
}

const STATUS_LABEL = {
  processando: "processando",
  autorizada: "autorizada",
};

export default function EmitirClient({
  veiculo,
  config,
  custoAquisicao,
  custoOrigem,
  notaExistente,
  clientes,
  ativo,
  vehicleId,
}) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [venda, setVenda] = useState(veiculo.price ?? "");
  const [custo, setCusto] = useState(custoOrigem === "financeiro" ? custoAquisicao : "");
  const [dest, setDest] = useState(DEST_VAZIO);
  const [clienteIdSel, setClienteIdSel] = useState("");

  function setCampo(k, v) {
    setDest((p) => ({ ...p, [k]: v }));
  }

  function fillFromCliente(id) {
    setClienteIdSel(id || "");
    const cliente = (clientes || []).find((c) => c.id === id);
    if (!cliente) return;
    setDest(destinatarioDoCliente(cliente));
  }

  if (!ativo) {
    return (
      <>
        <Link href="/admin/fiscal" className={styles.backLinkContent}>← Notas Fiscais</Link>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Emitir nota fiscal</h1>
        </div>
        <div
          className={styles.card}
          style={{ borderLeft: "4px solid #e8b84b", background: "#fff7e8" }}
        >
          <strong style={{ color: "#a8752e" }}>Emissor fiscal ainda não ativado</strong>
          <p style={{ fontSize: "0.9rem", color: "#666", margin: "6px 0 0" }}>
            Para emitir notas fiscais, é preciso cadastrar na Focus NFe o token
            da conta e enviar o certificado digital A1 da Vamaq. São duas coisas
            diferentes: o token libera o acesso à Focus; o certificado é o que
            assina a nota perante a SEFAZ.
          </p>
        </div>
      </>
    );
  }

  if (notaExistente) {
    return (
      <>
        <Link href="/admin/fiscal" className={styles.backLinkContent}>← Notas Fiscais</Link>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Emitir nota fiscal</h1>
        </div>
        <div
          className={styles.card}
          style={{ borderLeft: "4px solid #e8b84b", background: "#fff7e8" }}
        >
          <strong style={{ color: "#a8752e" }}>Este veículo já tem nota fiscal</strong>
          <p style={{ fontSize: "0.9rem", color: "#666", margin: "6px 0 0" }}>
            {veiculo.brand} {veiculo.model} {veiculo.year} já tem uma nota{" "}
            {STATUS_LABEL[notaExistente.status] || notaExistente.status} (referência{" "}
            {notaExistente.ref}). Para emitir outra, cancele a nota atual primeiro.
          </p>
          <p style={{ margin: "16px 0 0" }}>
            <Link href="/admin/fiscal" className={styles.btnPrimary}>Ver em Notas Fiscais</Link>
          </p>
        </div>
      </>
    );
  }

  const semChassi = !veiculo.chassi;
  const aliquota = Number(config?.icms_seminovo_aliquota ?? 5);
  const vendaNum = Number(venda) || 0;
  const custoPreenchido = String(custo).trim() !== "";
  const custoNum = Number(custo) || 0;
  const base = Math.max(0, vendaNum - custoNum);
  const icms = icmsSeminovo(vendaNum, custoNum, aliquota);

  function handleEmitir(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // O destinatário sai do estado `dest` (controlado, para o seletor de
    // cliente conseguir preenchê-lo) e não mais do FormData — mas continua
    // sendo exatamente o que está na tela: o cliente selecionado não
    // substitui a validação, quem confere e valida é o formulário mesmo.
    const destinatario = { ...dest };
    if (
      !confirm(
        "Emitir a nota fiscal deste veículo? Depois de autorizada, o cancelamento só é possível em 24h."
      )
    ) {
      return;
    }
    setErr(null);
    startTransition(async () => {
      const r = await emitirNotaAction(vehicleId, {
        destinatario,
        valorVenda: fd.get("valorVenda"),
        custoAquisicao: fd.get("custoAquisicao"),
        clienteId: clienteIdSel || undefined,
      });
      if (r?.error) setErr(r.error);
      else if (r?.ok) setResultado(r);
    });
  }

  return (
    <>
      <Link href="/admin/fiscal" className={styles.backLinkContent}>← Notas Fiscais</Link>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Emitir nota fiscal</h1>
        <p className={styles.pageSubtitle}>
          {veiculo.brand} {veiculo.model} {veiculo.year} — confira os dados antes de enviar à SEFAZ
        </p>
      </div>

      {err && (
        <div className={styles.card} style={{ marginBottom: 24, borderLeft: "4px solid #b91c1c" }}>
          <p style={{ color: "#b91c1c", fontSize: "0.9rem", margin: 0 }}>{err}</p>
        </div>
      )}

      {resultado ? (
        <div className={styles.card} style={{ borderLeft: "4px solid #15803d" }}>
          <strong style={{ color: "#15803d" }}>Nota enviada</strong>
          <p style={{ margin: "8px 0 0" }}>
            Referência <strong>{resultado.ref}</strong> — status: <strong>{resultado.status}</strong>
          </p>
          <p style={{ margin: "16px 0 0" }}>
            <Link href="/admin/fiscal" className={styles.btnPrimary}>Ver em Notas Fiscais</Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleEmitir}>
          {/* Veículo */}
          <div className={styles.card} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Veículo</h3>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Marca / Modelo</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{veiculo.brand} {veiculo.model}</p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Ano de fabricação</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{veiculo.year}</p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Placa</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{veiculo.placa || "—"}</p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Chassi</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{veiculo.chassi || "—"}</p>
              </div>
            </div>
            {semChassi && (
              <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: 16, marginBottom: 0 }}>
                Este veículo está sem chassi cadastrado — a nota não pode ser emitida sem ele.{" "}
                <Link href={`/admin/estoque/novo?id=${vehicleId}`}>Completar o cadastro do veículo</Link>
              </p>
            )}
          </div>

          {/* Valores */}
          <div className={styles.card} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Valores</h3>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Valor da venda *</label>
                <input
                  name="valorVenda"
                  type="number"
                  step="0.01"
                  min="0"
                  value={venda}
                  onChange={(e) => setVenda(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Custo de aquisição *</label>
                <input
                  name="custoAquisicao"
                  type="number"
                  step="0.01"
                  min="0"
                  value={custo}
                  onChange={(e) => setCusto(e.target.value)}
                  className={styles.formInput}
                  style={custoOrigem === "financeiro" ? { background: "#F7F7F8" } : undefined}
                  readOnly={custoOrigem === "financeiro"}
                  required
                />
                <p style={{ fontSize: "0.78rem", color: "#666", margin: 0 }}>
                  {custoOrigem === "financeiro"
                    ? "vindo do financeiro"
                    : "este veículo não tem compra lançada no financeiro — informe o valor pago"}
                </p>
              </div>
            </div>
          </div>

          {/* Impostos */}
          <div className={styles.card} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Impostos</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 0 }}>
              ICMS do seminovo, calculado sobre o lucro da venda (venda − custo de aquisição) —
              recalcula sozinho conforme os valores acima mudam.
            </p>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Base de cálculo</label>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {custoPreenchido ? money(base) : "—"}
                </p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Alíquota</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{aliquota}%</p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ICMS</label>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {custoPreenchido ? money(icms) : "—"}
                </p>
              </div>
            </div>
            {!custoPreenchido && (
              <p style={{ fontSize: "0.78rem", color: "#666", margin: "8px 0 0" }}>
                informe o custo de aquisição para calcular
              </p>
            )}
          </div>

          {/* Cliente cadastrado */}
          {clientes && clientes.length > 0 && (
            <div className={styles.card} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Cliente cadastrado</h3>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                  <label className={styles.formLabel}>Preencher a partir de um cliente</label>
                  <select
                    className={styles.formSelect}
                    value={clienteIdSel}
                    onChange={(e) => fillFromCliente(e.target.value)}
                  >
                    <option value="">Selecione um cliente cadastrado...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}{c.doc ? ` — ${formataDoc(c.doc)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Destinatário */}
          <div className={styles.card} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Destinatário</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 0 }}>
              Confira os dados antes de emitir — a nota vai para a SEFAZ com o que estiver aqui.
            </p>
            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formLabel}>Nome *</label>
                <input
                  name="nome"
                  value={dest.nome}
                  onChange={(e) => setCampo("nome", e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CPF/CNPJ *</label>
                <input
                  name="doc"
                  value={dest.doc}
                  onChange={(e) => setCampo("doc", e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CEP *</label>
                <input
                  name="cep"
                  value={dest.cep}
                  onChange={(e) => setCampo("cep", e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formLabel}>Logradouro *</label>
                <input
                  name="logradouro"
                  value={dest.logradouro}
                  onChange={(e) => setCampo("logradouro", e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Número *</label>
                <input
                  name="numero"
                  value={dest.numero}
                  onChange={(e) => setCampo("numero", e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Bairro *</label>
                <input
                  name="bairro"
                  value={dest.bairro}
                  onChange={(e) => setCampo("bairro", e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Município *</label>
                <input
                  name="municipio"
                  value={dest.municipio}
                  onChange={(e) => setCampo("municipio", e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>UF *</label>
                <input
                  name="uf"
                  maxLength={2}
                  value={dest.uf}
                  onChange={(e) => setCampo("uf", e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={isPending || semChassi}>
              {isPending ? "Emitindo…" : "Emitir nota fiscal"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
