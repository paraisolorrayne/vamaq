"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import { formataDoc } from "@/lib/clientes/doc";
import { formatValorBR } from "@/lib/money";
import { anoVeiculo } from "@/lib/anoVeiculo";
import { rotuloEtapa } from "@/lib/crm/etapas";
import { rotuloVeiculo } from "@/lib/crm/rotuloVeiculo";

const fmtData = (d) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
const fmtDataHora = (d) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const money = (n) => "R$ " + formatValorBR(Number(n) || 0);

const PAPEL_LABEL = { comprou: "Comprou", vendeu: "Vendeu", consignou: "Consignou" };
const ORIGEM_LABEL = { contrato: "do contrato", nota: "da nota", manual: "manual" };

// Mesmos rótulos de src/app/admin/documentos/gerados/GeradosClient.js — os
// valores em `tipo` usam o slug técnico, aqui é o nome que o operador reconhece.
const TIPO_DOC_LABEL = {
  "compra-venda": "Compra e venda",
  venda: "Venda",
  consignacao: "Consignação",
  "termo-vistoria": "Termo de vistoria",
};

// Mesmos rótulos de src/app/admin/fiscal/FiscalClient.js.
const STATUS_NOTA_LABEL = {
  autorizada: "Autorizada",
  processando: "Processando",
  erro: "Erro",
  cancelada: "Cancelada",
};

export default function FichaClient({ cliente: clienteInicial }) {
  const [cliente, setCliente] = useState(clienteInicial);
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState(clienteInicial.tipo || "pf");
  const [dadosErr, setDadosErr] = useState(null);
  const [salvo, setSalvo] = useState(false);

  const [vehicles, setVehicles] = useState([]);
  const [vehiclesErr, setVehiclesErr] = useState(null);
  const [ligarErr, setLigarErr] = useState(null);

  // Confirmação de ativar/desativar e de desfazer vínculo: inline, na própria
  // tela — sem janelinha nativa do navegador. Mesma regra do CRM (ver
  // src/app/admin/tutoriais/crm/page.js: "não existe janelinha de
  // confirmação"), aqui adaptada porque a ficha não tem uma tela por ação —
  // o botão vira a pergunta, com "Cancelar" ao lado, até a pessoa decidir.
  const [confirmarStatus, setConfirmarStatus] = useState(false);
  const [confirmarDesfazerId, setConfirmarDesfazerId] = useState(null);

  // Estoque para o select de "Ligar outro carro" — carregado à parte porque
  // não vem em getCliente() (que só traz os veículos já ligados).
  useEffect(() => {
    let cancelado = false;
    fetch("/api/admin/vehicles")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado) setVehicles(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelado)
          setVehiclesErr("Não deu para carregar o estoque — recarregue a página para ligar um carro.");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(false), 3000);
    return () => clearTimeout(t);
  }, [salvo]);

  // Depois de ligar/desfazer um carro, busca a ficha de novo em vez de tentar
  // mesclar o estado local — o backend decide se o vínculo é novo ou já
  // existia (dedup de "mesmo carro, mesmo papel"), e é mais simples confiar
  // nessa resposta do que reimplementar a regra aqui.
  async function recarregarCliente() {
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}`);
      const data = await res.json();
      if (res.ok && data.cliente) setCliente(data.cliente);
    } catch {
      // A lista de carros só fica desatualizada; recarregar a página resolve.
    }
  }

  function salvarDados(e) {
    e.preventDefault();
    setDadosErr(null);
    setSalvo(false);
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setDadosErr(data.error || "Falha ao salvar as alterações.");
          return;
        }
        setCliente((c) => ({ ...c, ...data.cliente }));
        setSalvo(true);
      } catch {
        setDadosErr("Falha ao salvar as alterações.");
      }
    });
  }

  function confirmarAlternarAtivo() {
    setConfirmarStatus(false);
    const vaiAtivar = cliente.ativo === false;
    setDadosErr(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ativo: vaiAtivar }),
        });
        const data = await res.json();
        if (!res.ok) {
          setDadosErr(data.error || (vaiAtivar ? "Falha ao reativar o cliente." : "Falha ao desativar o cliente."));
          return;
        }
        setCliente((c) => ({ ...c, ativo: vaiAtivar }));
      } catch {
        setDadosErr(vaiAtivar ? "Falha ao reativar o cliente." : "Falha ao desativar o cliente.");
      }
    });
  }

  function ligarVeiculo(e) {
    e.preventDefault();
    setLigarErr(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const vehicleId = fd.get("vehicleId");
    if (!vehicleId) {
      setLigarErr("Escolha um veículo.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/clientes/${cliente.id}/veiculos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicleId,
            papel: fd.get("papel"),
            data: fd.get("data") || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setLigarErr(data.error || "Falha ao ligar o veículo.");
          return;
        }
        form.reset();
        await recarregarCliente();
      } catch {
        setLigarErr("Falha ao ligar o veículo.");
      }
    });
  }

  function confirmarDesfazerVinculo(v) {
    setConfirmarDesfazerId(null);
    setLigarErr(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/clientes/${cliente.id}/veiculos?vinculoId=${v.vinculo_id}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (!res.ok) {
          setLigarErr(data.error || "Falha ao desfazer o vínculo.");
          return;
        }
        setCliente((c) => ({
          ...c,
          veiculos: c.veiculos.filter((x) => x.vinculo_id !== v.vinculo_id),
        }));
      } catch {
        setLigarErr("Falha ao desfazer o vínculo.");
      }
    });
  }

  return (
    <>
      <Link href="/admin/clientes" className={styles.backLinkContent}>← Clientes</Link>
      <div
        className={styles.pageHeader}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}
      >
        <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>{cliente.nome}</h1>
        {cliente.ativo === false ? (
          <span className={styles.badgeWarning} style={{ background: "#f3f4f6", color: "#6b7280" }}>
            Inativo
          </span>
        ) : (
          <span className={styles.badgeSuccess}>Ativo</span>
        )}
      </div>

      {dadosErr && (
        <div className={styles.card} style={{ marginBottom: 16, borderLeft: "4px solid #b91c1c" }}>
          <p style={{ color: "#b91c1c", margin: 0 }}>{dadosErr}</p>
        </div>
      )}

      {/* Dados */}
      <div className={styles.card} style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Dados</h3>
        <form onSubmit={salvarDados} className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nome *</label>
            <input name="nome" defaultValue={cliente.nome} className={styles.formInput} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tipo</label>
            <select
              name="tipo"
              className={styles.formSelect}
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="pf">Pessoa física</option>
              <option value="pj">Pessoa jurídica</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>CPF/CNPJ</label>
            <input
              name="doc"
              defaultValue={cliente.doc ? formataDoc(cliente.doc) : ""}
              className={styles.formInput}
              placeholder="Só números ou com pontuação"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>RG</label>
            <input name="rg" defaultValue={cliente.rg || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>CNH</label>
            <input name="cnh" defaultValue={cliente.cnh || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Categoria</label>
            <input name="cnh_categoria" defaultValue={cliente.cnh_categoria || ""} className={styles.formInput} placeholder="Ex: AB" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Telefone</label>
            <input name="telefone" defaultValue={cliente.telefone || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>E-mail</label>
            <input name="email" type="email" defaultValue={cliente.email || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>CEP</label>
            <input name="cep" defaultValue={cliente.cep || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Logradouro</label>
            <input name="logradouro" defaultValue={cliente.logradouro || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Número</label>
            <input name="numero" defaultValue={cliente.numero || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Complemento</label>
            <input name="complemento" defaultValue={cliente.complemento || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Bairro</label>
            <input name="bairro" defaultValue={cliente.bairro || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Município</label>
            <input name="municipio" defaultValue={cliente.municipio || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>UF</label>
            <input
              name="uf"
              defaultValue={cliente.uf || ""}
              className={styles.formInput}
              maxLength={2}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          {tipo === "pj" && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Representante</label>
                <input name="representante_nome" defaultValue={cliente.representante_nome || ""} className={styles.formInput} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CPF do representante</label>
                <input name="representante_cpf" defaultValue={cliente.representante_cpf || ""} className={styles.formInput} />
              </div>
            </>
          )}
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.formLabel}>Observações</label>
            <textarea name="obs" rows={2} defaultValue={cliente.obs || ""} className={styles.formTextarea} />
          </div>
          <div className={styles.formActions} style={{ alignItems: "center", gap: 12 }}>
            <button type="submit" className={styles.btnPrimary} disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar alterações"}
            </button>
            {salvo && <span style={{ color: "#15803d", fontSize: "0.85rem" }}>✓ Alterações salvas.</span>}
          </div>
        </form>

        {cliente.ativo === false ? (
          <div style={{ marginTop: 16 }}>
            <p style={{ marginTop: 0, marginBottom: 12, fontSize: "0.85rem", color: "#6b7280" }}>
              Cliente inativo — some das buscas, mas segue no histórico.
            </p>
            {confirmarStatus ? (
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <span style={{ fontSize: "0.85rem" }}>Reativar {cliente.nome}? Ele volta a aparecer nas buscas.</span>
                <button type="button" className={styles.btnPrimary} onClick={confirmarAlternarAtivo} disabled={isPending}>
                  Sim, reativar
                </button>
                <button type="button" className={styles.btnSecondary} onClick={() => setConfirmarStatus(false)} disabled={isPending}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button type="button" className={styles.btnPrimary} onClick={() => setConfirmarStatus(true)} disabled={isPending}>
                Reativar cliente
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            {confirmarStatus ? (
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <span style={{ fontSize: "0.85rem" }}>
                  Desativar {cliente.nome}? Ele some das buscas, mas o histórico continua.
                </span>
                <button type="button" className={styles.btnDanger} onClick={confirmarAlternarAtivo} disabled={isPending}>
                  Sim, desativar
                </button>
                <button type="button" className={styles.btnSecondary} onClick={() => setConfirmarStatus(false)} disabled={isPending}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button type="button" className={styles.btnDanger} onClick={() => setConfirmarStatus(true)} disabled={isPending}>
                Desativar cliente
              </button>
            )}
          </div>
        )}
      </div>

      {/* Carros */}
      <div className={styles.card} style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Carros</h3>

        {ligarErr && <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>{ligarErr}</p>}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Placa</th>
                <th>Papel</th>
                <th>Data</th>
                <th>Origem</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cliente.veiculos.map((v) => (
                <tr key={v.vinculo_id}>
                  <td>
                    <strong>{v.brand} {v.model}</strong>
                    {anoVeiculo(v) ? ` (${anoVeiculo(v)})` : ""}
                  </td>
                  <td>{v.placa || "—"}</td>
                  <td>{PAPEL_LABEL[v.papel] || v.papel}</td>
                  <td>{fmtData(v.data)}</td>
                  <td>{ORIGEM_LABEL[v.origem] || v.origem}</td>
                  <td>
                    {confirmarDesfazerId === v.vinculo_id ? (
                      <div className={styles.tableActions}>
                        <span style={{ fontSize: "0.8rem" }}>Desfazer o vínculo?</span>
                        <button
                          type="button"
                          className={`${styles.btnDanger} ${styles.btnSmall}`}
                          onClick={() => confirmarDesfazerVinculo(v)}
                          disabled={isPending}
                        >
                          Sim, desfazer
                        </button>
                        <button
                          type="button"
                          className={`${styles.btnSecondary} ${styles.btnSmall}`}
                          onClick={() => setConfirmarDesfazerId(null)}
                          disabled={isPending}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className={styles.tableActions}>
                        <Link
                          href={`/admin/estoque/novo?id=${v.vehicle_id}`}
                          className={`${styles.btnSecondary} ${styles.btnSmall}`}
                        >
                          Ver veículo
                        </Link>
                        <button
                          type="button"
                          className={`${styles.btnDanger} ${styles.btnSmall}`}
                          onClick={() => setConfirmarDesfazerId(v.vinculo_id)}
                          disabled={isPending}
                        >
                          Desfazer vínculo
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {cliente.veiculos.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#6b7280", padding: 16 }}>
                    Nenhum carro ligado a este cliente ainda. Os vínculos aparecem sozinhos quando você
                    gera um contrato com ele selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={ligarVeiculo} className={styles.formGrid} style={{ marginTop: 16 }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ligar outro carro</label>
            <select name="vehicleId" className={styles.formSelect} defaultValue="" required>
              <option value="" disabled>— escolha —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} {anoVeiculo(v)}{v.placa ? ` — ${v.placa}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Papel</label>
            <select name="papel" className={styles.formSelect} defaultValue="comprou">
              <option value="comprou">Comprou</option>
              <option value="vendeu">Vendeu</option>
              <option value="consignou">Consignou</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Data</label>
            <input name="data" type="date" className={styles.formInput} />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={isPending}>
              Ligar
            </button>
          </div>
        </form>
        {vehiclesErr && <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginBottom: 0 }}>{vehiclesErr}</p>}
      </div>

      {/* Oportunidades */}
      <div className={styles.card} style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Oportunidades</h3>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Veículo</th>
                <th>Valor</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {cliente.oportunidades.map((o) => (
                <tr key={o.id}>
                  <td>{rotuloEtapa(o.etapa)}</td>
                  <td>{rotuloVeiculo(o) || "—"}</td>
                  <td>{o.valor != null ? money(o.valor) : "—"}</td>
                  <td>{fmtDataHora(o.created_at)}</td>
                </tr>
              ))}
              {cliente.oportunidades.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#6b7280", padding: 16 }}>
                    Nenhuma oportunidade registrada para este cliente ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Documentos e notas */}
      <div className={styles.card}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Documentos e notas</h3>

        <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 8 }}>Contratos gerados</h4>
        <div className={styles.tableWrap} style={{ marginBottom: 24 }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Título</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cliente.documentos.map((d) => (
                <tr key={d.id}>
                  <td>{TIPO_DOC_LABEL[d.tipo] || d.tipo}</td>
                  <td>{d.titulo}</td>
                  <td>{fmtDataHora(d.created_at)}</td>
                  <td>
                    <a
                      href={`/api/admin/documentos-gerados/${d.id}/arquivo`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.btnSecondary} ${styles.btnSmall}`}
                    >
                      Abrir
                    </a>
                  </td>
                </tr>
              ))}
              {cliente.documentos.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#6b7280", padding: 16 }}>
                    Nenhum contrato gerado para este cliente ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 8 }}>Notas fiscais emitidas</h4>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {cliente.notas.map((n) => (
                <tr key={n.ref}>
                  <td>{n.ref}</td>
                  <td>{STATUS_NOTA_LABEL[n.status] || n.status}</td>
                  <td>{n.valor != null ? money(n.valor) : "—"}</td>
                  <td>{fmtDataHora(n.created_at)}</td>
                </tr>
              ))}
              {cliente.notas.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#6b7280", padding: 16 }}>
                    Nenhuma nota fiscal emitida para este cliente ainda.
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
