"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { normalizaBusca } from "@/lib/buscaVeiculo";
import { anoVeiculo } from "@/lib/anoVeiculo";
import { podeMarcarVendido } from "@/lib/vendaVeiculo";
import styles from "../admin.module.css";

export default function EstoqueClient({ podeEmitirNota }) {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <EstoqueConteudo podeEmitirNota={podeEmitirNota} />
    </Suspense>
  );
}

function EstoqueConteudo({ podeEmitirNota }) {
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  // Vem do atalho "Buscar por placa" do Dashboard: /admin/estoque?busca=ABC1D23
  const [search, setSearch] = useState(searchParams.get("busca") || "");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/vehicles")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setVehicles(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Desativar em vez de excluir: o veículo sai do site mas fica no estoque,
  // preservando o histórico (PR-C do ADR-002). Reativar volta pra 'disponível'.
  async function setStatus(id, status, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    await fetch(`/api/admin/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setRefreshKey((k) => k + 1);
  }

  // POR QUE OS LINKS DE AÇÃO LEVAM prefetch={false} (14/08/2026):
  // o <Link> do Next pré-carrega toda rota que entra na tela. Com 43 carros na
  // lista e três ações por linha, isso disparava mais de 100 requisições para
  // /admin/estoque/novo — uma tela client de ~1.300 linhas — todas de uma vez.
  // O processo Node engasgava, várias voltavam 503, e o clique de verdade da
  // operadora ficava na fila atrás delas: o botão "Editar" parecia travado.
  // Ninguém abre 43 carros; abre um. Prefetch aqui é desperdício puro.
  //
  // A placa e o CHASSI entram na busca — são os dois jeitos naturais de
  // procurar um carro específico, inclusive anos depois de vendido, e é o que
  // a proposta prometeu ("busca por placa, chassi ou período").
  const alvo = normalizaBusca(search);
  const filtered = alvo
    ? vehicles.filter((v) =>
        normalizaBusca(
          `${v.brand} ${v.model} ${v.color} ${v.placa || ""} ${v.chassi || ""}`
        ).includes(alvo)
      )
    : vehicles;

  const pendentes = vehicles.filter((v) => vehiclePendencias(v).length > 0).length;

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Estoque</h1>
        <p className={styles.pageSubtitle}>
          Gerencie os veículos disponíveis no site
          {pendentes > 0 && (
            <>
              {" · "}
              <span style={{ color: "#92400e", fontWeight: 600 }}>
                ⚠ {pendentes} com pendência de inventário (placa/documentos/RENAVE)
              </span>
            </>
          )}
        </p>
      </div>

      <div
        className={styles.card}
        style={{ marginBottom: 24 }}
      >
        <div className={styles.toolbar}>
          <input
            type="text"
            placeholder="Buscar por marca, modelo, cor, placa ou chassi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${styles.formInput} ${styles.toolbarSearch}`}
          />
          <Link href="/admin/estoque/novo" className={styles.btnPrimary}>
            + Novo Veículo
          </Link>
        </div>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando estoque...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🚗</div>
            <div className={styles.emptyText}>
              {search
                ? "Nenhum veículo encontrado para esta busca"
                : "Nenhum veículo cadastrado ainda"}
            </div>
            {!search && (
              <Link href="/admin/estoque/novo" className={styles.btnPrimary}>
                + Adicionar Primeiro Veículo
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className={`${styles.tableWrap} ${styles.hideOnMobile}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Veículo</th>
                  <th>Ano</th>
                  <th>Km</th>
                  <th>Cor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id}>
                    <td>
                      {v.images?.main ? (
                        <img
                          src={v.images.main}
                          alt={`${v.brand} ${v.model}`}
                          className={styles.tableThumbnail}
                        />
                      ) : (
                        <div
                          className={styles.tableThumbnail}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.7rem",
                            color: "#999",
                          }}
                        >
                          Sem foto
                        </div>
                      )}
                    </td>
                    <td>
                      <strong>
                        {v.brand} {v.model}
                      </strong>
                    </td>
                    <td>{anoVeiculo(v)}</td>
                    <td>{v.quilometragem?.toLocaleString("pt-BR")} km</td>
                    <td>{v.color}</td>
                    <td>
                      <StatusBadge vehicle={v} />
                      <PendenciaBadge vehicle={v} />
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <Link
                          href={`/admin/estoque/novo?id=${v.id}`}
                          prefetch={false}
                          className={`${styles.btnSecondary} ${styles.btnSmall}`}
                        >
                          Editar
                        </Link>
                        {podeMarcarVendido(v) && (
                          <Link
                            href={`/admin/estoque/${v.id}/vender`}
                            prefetch={false}
                            className={`${styles.btnSecondary} ${styles.btnSmall}`}
                            style={{ minHeight: 48 }}
                          >
                            Marcar vendido
                          </Link>
                        )}
                        {v.status === "vendido" && podeEmitirNota && (
                          <Link
                            href={`/admin/fiscal/emitir/${v.id}`}
                            prefetch={false}
                            className={`${styles.btnSecondary} ${styles.btnSmall}`}
                          >
                            Emitir nota
                          </Link>
                        )}
                        <StatusButton vehicle={v} onSet={setStatus} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lista em cards — visível apenas no mobile */}
          <div className={styles.cardList}>
            {filtered.map((v) => (
              <div key={v.id} className={styles.vehicleCard}>
                <div className={styles.vehicleCardTop}>
                  {v.images?.main ? (
                    <img
                      src={v.images.main}
                      alt={`${v.brand} ${v.model}`}
                      className={styles.vehicleCardThumb}
                    />
                  ) : (
                    <div
                      className={styles.vehicleCardThumb}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        color: "#999",
                      }}
                    >
                      Sem foto
                    </div>
                  )}
                  <div className={styles.vehicleCardInfo}>
                    <strong className={styles.vehicleCardTitle}>
                      {v.brand} {v.model}
                    </strong>
                    <span className={styles.vehicleCardMeta}>
                      {anoVeiculo(v)} · {v.quilometragem?.toLocaleString("pt-BR")} km
                      {v.color ? ` · ${v.color}` : ""}
                    </span>
                    <span>
                      <StatusBadge vehicle={v} />
                      <PendenciaBadge vehicle={v} />
                    </span>
                  </div>
                </div>
                <div className={styles.vehicleCardActions}>
                  <Link
                    href={`/admin/estoque/novo?id=${v.id}`}
                    prefetch={false}
                    className={`${styles.btnSecondary} ${styles.btnSmall}`}
                  >
                    Editar
                  </Link>
                  {podeMarcarVendido(v) && (
                    <Link
                      href={`/admin/estoque/${v.id}/vender`}
                      prefetch={false}
                      className={`${styles.btnSecondary} ${styles.btnSmall}`}
                      style={{ minHeight: 48 }}
                    >
                      Marcar vendido
                    </Link>
                  )}
                  {v.status === "vendido" && podeEmitirNota && (
                    <Link
                      href={`/admin/fiscal/emitir/${v.id}`}
                      prefetch={false}
                      className={`${styles.btnSecondary} ${styles.btnSmall}`}
                    >
                      Emitir nota
                    </Link>
                  )}
                  <StatusButton vehicle={v} onSet={setStatus} />
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </>
  );
}

// Ação de ciclo de vida na lista: substitui "Excluir". Carro inativo pode ser
// reativado; os demais podem ser desativados (saem do site, ficam no estoque).
function StatusButton({ vehicle, onSet }) {
  if (vehicle.status === "inativo") {
    return (
      <button
        onClick={() => onSet(vehicle.id, "disponivel")}
        className={styles.btnSecondary}
      >
        Reativar
      </button>
    );
  }
  return (
    <button
      onClick={() =>
        onSet(
          vehicle.id,
          "inativo",
          "Desativar este veículo? Ele sai do site, mas continua no estoque (histórico preservado). Dá para reativar depois."
        )
      }
      className={styles.btnDanger}
    >
      Desativar
    </button>
  );
}

// Pendência de inventário (PR-Inventário): falta placa e/ou documentos.
function vehiclePendencias(v) {
  const faltas = [];
  if (!v.placa) faltas.push("placa");
  if (!Array.isArray(v.documentos) || v.documentos.length === 0)
    faltas.push("documentos");
  const renaveStatus = v.renave?.status || "nao_iniciado";
  if (renaveStatus !== "registrado" && renaveStatus !== "saida")
    faltas.push("RENAVE");
  return faltas;
}

function PendenciaBadge({ vehicle }) {
  const faltas = vehiclePendencias(vehicle);
  if (faltas.length === 0) return null;
  return (
    <span
      className={styles.badgeWarning}
      title={`Inventário incompleto — falta: ${faltas.join(", ")}`}
      style={{ background: "#fef3c7", color: "#92400e", marginLeft: 6 }}
    >
      ⚠ {faltas.join(" + ")}
    </span>
  );
}

function StatusBadge({ vehicle }) {
  if (vehicle.status === "vendido") {
    return (
      <span
        className={styles.badgeWarning}
        style={{ background: "#dcfce7", color: "#15803d" }}
      >
        Vendido
      </span>
    );
  }
  if (vehicle.status === "inativo") {
    return (
      <span
        className={styles.badgeWarning}
        style={{ background: "#f3f4f6", color: "#6b7280" }}
      >
        Inativo
      </span>
    );
  }
  if (vehicle.status === "reservado") {
    return (
      <span
        className={styles.badgeWarning}
        style={{ background: "#fef9c3", color: "#a16207" }}
      >
        Reservado
      </span>
    );
  }
  if (!vehicle.published) {
    return (
      <span
        className={styles.badgeWarning}
        title="Não aparece no site — edite e marque 'Publicado no site'"
        style={{ background: "#fee2e2", color: "#b91c1c" }}
      >
        Oculto
      </span>
    );
  }
  if (vehicle.featured) {
    return <span className={styles.badgeSuccess}>Destaque</span>;
  }
  return <span className={styles.badgeWarning}>Normal</span>;
}
