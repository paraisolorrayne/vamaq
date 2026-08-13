"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import styles from "../../../admin.module.css";
import { emitirNotaAction } from "../../actions";
import { impostosVeiculoUsado } from "@/lib/fiscal/impostos";
import { textoInformacoesComplementares } from "@/lib/fiscal/payload";
import { destinatarioDoCliente } from "@/lib/clientes/prefill";
import { formataDoc } from "@/lib/clientes/doc";

const DEST_VAZIO = {
  nome: "", doc: "", cep: "", logradouro: "", numero: "", bairro: "", municipio: "", uf: "",
};

// Dinheiro aqui é valor de nota fiscal: SEMPRE duas casas. formatValorBR usa
// minimumFractionDigits 0 porque serve aos preços do site ("R$ 175.000"), e
// com ele o PIS de 52,90 aparecia como "R$ 52,9" — que não é como se escreve
// dinheiro, e numa tela de conferência fiscal parece valor truncado.
function money(n) {
  return (
    "R$ " +
    (Number(n) || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** 95.238 -> "95,238" — percentual com vírgula, como o resto da tela. */
function pct(n) {
  return (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
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
  const [notaEntrada, setNotaEntrada] = useState("");

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
  // Mesma função que monta a nota — a tela não pode calcular de um jeito e o
  // payload de outro. Só depende do valor da venda.
  const custoPreenchido = String(custo).trim() !== "" && Number(custo) > 0;
  const imp = impostosVeiculoUsado(Number(venda) || 0, config || {});
  // Exatamente o texto que vai na nota — a operadora confere antes de emitir.
  const textoComplementar = textoInformacoesComplementares({
    config: config || {},
    custoAquisicao: Number(custo) || 0,
    numeroNotaEntrada: notaEntrada,
  });

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
        numeroNotaEntrada: fd.get("numeroNotaEntrada"),
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
                <label className={styles.formLabel}>Valor de aquisição *</label>
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
                    ? "vindo do financeiro — vai impresso nas informações complementares"
                    : "este veículo não tem compra lançada no financeiro — informe o valor pago"}
                </p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nº da nota de entrada</label>
                <input
                  name="numeroNotaEntrada"
                  value={notaEntrada}
                  onChange={(e) => setNotaEntrada(e.target.value)}
                  className={styles.formInput}
                  inputMode="numeric"
                />
                <p style={{ fontSize: "0.78rem", color: "#666", margin: 0 }}>
                  opcional — número da nota de entrada deste carro, se já existir
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: 16, padding: "10px 12px", background: "#F7F7F8",
                borderRadius: 6, fontSize: "0.8rem", color: "#555",
              }}
            >
              <strong style={{ display: "block", marginBottom: 4 }}>
                Informações complementares da nota
              </strong>
              <span style={{ fontFamily: "monospace", wordBreak: "break-word" }}>
                {custoPreenchido
                  ? textoComplementar
                  : "preencha o valor de aquisição para ver o texto que vai na nota"}
              </span>
            </div>
          </div>

          {/* Impostos */}
          <div className={styles.card} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Impostos</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 0 }}>
              Base do ICMS = valor da venda com redução de {pct(imp.reducaoBaseIcms)}% (veículo usado).
              PIS e COFINS incidem sobre a base do ICMS menos o ICMS. Recalcula sozinho conforme
              o valor da venda muda — o valor de aquisição não altera imposto nenhum.
            </p>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Base do ICMS</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{money(imp.baseIcms)}</p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Alíquota do ICMS</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{pct(imp.aliquotaIcms)}%</p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ICMS</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{money(imp.icms)}</p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Base do PIS/COFINS</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{money(imp.basePisCofins)}</p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>PIS ({pct(imp.aliquotaPis)}%)</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{money(imp.pis)}</p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>COFINS ({pct(imp.aliquotaCofins)}%)</label>
                <p style={{ margin: 0, fontWeight: 600 }}>{money(imp.cofins)}</p>
              </div>
            </div>
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
