"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "../../admin.module.css";
import Novidade from "../../Novidade";
import { anoVeiculo } from "@/lib/anoVeiculo";

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

// Os status vêm do Assinafy (GET /v1/documents/statuses). Traduzidos para o
// que a pessoa precisa saber: se pode parar de acompanhar ou não. Status
// desconhecido cai no default e aparece cru, em vez de sumir da tela.
const STATUS_LABEL = {
  uploading: "Enviando",
  uploaded: "Processando",
  metadata_processing: "Processando",
  metadata_ready: "Processando",
  pending_signature: "Aguardando assinatura",
  certificating: "Finalizando",
  certificated: "Assinado",
  rejected_by_signer: "Recusado pelo cliente",
  rejected_by_user: "Cancelado",
  expired: "Prazo expirado",
  failed: "Falhou",
};

const STATUS_VIVOS = [
  "uploading",
  "uploaded",
  "metadata_processing",
  "metadata_ready",
  "pending_signature",
  "certificating",
];

function veiculoDoDocumento(doc) {
  const ano = anoVeiculo(doc);
  if (!doc.brand && !doc.model && !ano && !doc.placa) return "—";
  const nome = [doc.brand, doc.model, ano].filter(Boolean).join(" ");
  return [nome, doc.placa].filter(Boolean).join(" — ") || "—";
}

/** O link de assinatura do cliente — o fallback que vai por WhatsApp na mão. */
function linkDoCliente(doc) {
  const signers = Array.isArray(doc.assinatura_signers) ? doc.assinatura_signers : [];
  return signers.find((s) => s.papel === "cliente")?.signing_url || null;
}

function StatusAssinatura({ doc }) {
  const status = doc.assinatura_status;
  if (!status) return <span style={{ color: "#6b7280" }}>—</span>;
  const label = STATUS_LABEL[status] || status;
  if (status === "certificated") return <span className={styles.badgeSuccess}>{label}</span>;
  if (STATUS_VIVOS.includes(status)) return <span className={styles.badgeWarning}>{label}</span>;
  return <span style={{ color: "#b91c1c" }}>{label}</span>;
}

export default function GeradosClient({ documentos: iniciais, assinaturaConfigurada }) {
  const [documentos, setDocumentos] = useState(iniciais);
  const [busca, setBusca] = useState("");
  // Documento cujo formulário de e-mail está aberto (contrato sem cliente
  // cadastrado). Inline, não popup — a regra de "tudo é tela" do CRM.
  const [pedindoEmail, setPedindoEmail] = useState(null);
  const [email, setEmail] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [copiado, setCopiado] = useState(null);

  // Ao abrir a tela, confere no Assinafy os envios que ainda estão correndo.
  //
  // Não é só para a tela ficar atualizada. O GET de status é quem termina dois
  // serviços que o webhook sozinho não fecha: o pedido de assinatura que não
  // saiu porque o PDF demorou a processar, e a via certificada que ficou para
  // trás porque o `document_ready` chega enquanto o documento ainda está em
  // `certificating` — e não existe evento para quando a certificação termina.
  // Sem esta consulta, esses dois casos ficariam parados até alguém reenviar.
  //
  // Uma passada só, na abertura: são poucos documentos vivos por vez, e ficar
  // repetindo em intervalo gastaria chamada da API sem a Mayra estar olhando.
  useEffect(() => {
    const vivos = documentos.filter((d) => STATUS_VIVOS.includes(d.assinatura_status));
    if (!vivos.length) return;
    let cancelado = false;

    (async () => {
      for (const d of vivos) {
        try {
          const res = await fetch(`/api/admin/documentos-gerados/${d.id}/assinatura`);
          if (!res.ok) continue;
          const { atual } = await res.json();
          if (cancelado || !atual) continue;
          setDocumentos((lista) =>
            lista.map((x) =>
              x.id === d.id
                ? {
                    ...x,
                    assinatura_status: atual.status,
                    assinatura_signers: atual.signers || [],
                    tem_via_assinada: Boolean(atual.arquivo_assinado),
                  }
                : x
            )
          );
        } catch {
          // rede caiu no meio — a tela continua mostrando o que veio do banco
        }
      }
    })();

    return () => {
      cancelado = true;
    };
    // De propósito só na montagem: `documentos` muda a cada atualização feita
    // aqui dentro, e depender dele faria a consulta se realimentar sem parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quais contratos já ganharam uma versão corrigida. Sem esta marca, a lista
  // mostra os dois lado a lado sem dizer qual vale — e o risco é imprimir o
  // errado, que é exatamente o problema que a correção veio resolver.
  const substituidos = useMemo(
    () => new Set(documentos.map((d) => d.corrige_documento_id).filter(Boolean)),
    [documentos]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return documentos;
    return documentos.filter((d) => {
      const cliente = (d.cliente || "").toLowerCase();
      const placa = (d.placa || "").toLowerCase();
      const tipo = (TIPO_LABEL[d.tipo] || d.tipo || "").toLowerCase();
      const data = fmtData(d.created_at).toLowerCase();
      return (
        cliente.includes(termo) ||
        placa.includes(termo) ||
        tipo.includes(termo) ||
        data.includes(termo)
      );
    });
  }, [documentos, busca]);

  async function enviar(doc, emailInformado) {
    setOcupado(doc.id);
    setAviso(null);
    try {
      const res = await fetch(`/api/admin/documentos-gerados/${doc.id}/assinatura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailInformado ? { email: emailInformado } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setAviso({ id: doc.id, tipo: "erro", texto: data.error || "Falha ao enviar." });
        return;
      }
      const envio = data.envio || {};
      setDocumentos((atuais) =>
        atuais.map((d) =>
          d.id === doc.id
            ? {
                ...d,
                assinatura_status: envio.status || "pending_signature",
                assinatura_signers: envio.signers || [],
              }
            : d
        )
      );
      setPedindoEmail(null);
      setEmail("");
      if (data.aviso) setAviso({ id: doc.id, tipo: "ok", texto: data.aviso });
    } catch {
      setAviso({ id: doc.id, tipo: "erro", texto: "Sem conexão com o servidor." });
    } finally {
      setOcupado(null);
    }
  }

  function iniciarEnvio(doc) {
    // Cliente com e-mail no cadastro vai direto; sem e-mail, abre o campo.
    if (doc.cliente_email) return enviar(doc, null);
    setPedindoEmail(doc.id);
    setEmail("");
    setAviso(null);
  }

  async function reenviar(doc) {
    setOcupado(doc.id);
    setAviso(null);
    try {
      const res = await fetch(
        `/api/admin/documentos-gerados/${doc.id}/assinatura/reenviar`,
        { method: "POST" }
      );
      const data = await res.json();
      setAviso({
        id: doc.id,
        tipo: res.ok ? "ok" : "erro",
        texto: res.ok
          ? `E-mail reenviado para ${(data.reenviados || []).join(" e ")}.`
          : data.error || "Falha ao reenviar.",
      });
    } catch {
      setAviso({ id: doc.id, tipo: "erro", texto: "Sem conexão com o servidor." });
    } finally {
      setOcupado(null);
    }
  }

  async function copiarLink(doc) {
    const url = linkDoCliente(doc);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(doc.id);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      setAviso({ id: doc.id, tipo: "erro", texto: "Não consegui copiar. O link é: " + url });
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Documentos gerados</h1>
        <p className={styles.pageSubtitle}>
          Contratos e documentos já gerados, guardados para consulta
        </p>
      </div>

      {/* A mesma novidade aparece no tutorial de Documentos, com a mesma
          chave: dispensar num lugar dispensa nos dois. Aqui é o lugar que
          importa — é nesta tela que ela vai clicar, não no tutorial. */}
      {assinaturaConfigurada && (
        <Novidade
          id="assinatura-eletronica-2026-08"
          titulo="Agora dá para mandar o contrato para o cliente assinar pela internet"
        >
          <p>
            Cada contrato ganhou o botão <strong>Enviar para assinatura</strong>.
            O cliente recebe por e-mail e assina no celular; a Vamaq assina
            depois dele. Quando os dois assinam, o contrato assinado volta para
            cá sozinho, no botão <strong>Via assinada</strong>.
          </p>
          <p>
            Imprimir continua funcionando como sempre. O{" "}
            <Link href="/admin/tutoriais/documentos">
              tutorial de Documentos, passo 7
            </Link>{" "}
            explica o resto — inclusive o que fazer se o cliente disser que não
            recebeu o e-mail.
          </p>
        </Novidade>
      )}

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
                <th>Assinatura</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((d) => {
                const vivo = STATUS_VIVOS.includes(d.assinatura_status);
                const url = linkDoCliente(d);
                return (
                  <tr key={d.id}>
                    <td>{fmtData(d.created_at)}</td>
                    <td>
                      {TIPO_LABEL[d.tipo] || d.tipo}
                      {d.corrige_documento_id && (
                        <div style={{ fontSize: "0.75rem", color: "#2f4d8f" }}>
                          versão corrigida
                        </div>
                      )}
                      {substituidos.has(d.id) && (
                        <div style={{ fontSize: "0.75rem", color: "#b45309" }}>
                          substituído por uma correção
                        </div>
                      )}
                    </td>
                    <td>{d.cliente || "—"}</td>
                    <td>{veiculoDoDocumento(d)}</td>
                    <td>{d.criado_por_nome || "—"}</td>
                    <td>
                      <StatusAssinatura doc={d} />
                      {pedindoEmail === d.id && (
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="E-mail de quem assina"
                            className={styles.formInput}
                            style={{ minWidth: 220 }}
                          />
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            disabled={!email.trim() || ocupado === d.id}
                            onClick={() => enviar(d, email.trim())}
                          >
                            {ocupado === d.id ? "Enviando..." : "Enviar"}
                          </button>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={() => setPedindoEmail(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                      {aviso?.id === d.id && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 13,
                            color: aviso.tipo === "erro" ? "#b91c1c" : "#166534",
                          }}
                        >
                          {aviso.texto}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <a
                          href={`/api/admin/documentos-gerados/${d.id}/arquivo`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.btnSecondary}
                        >
                          Abrir
                        </a>

                        {/* Só aparece quando o contrato guardou os campos
                            digitados. Os gerados antes de 18/08/2026 têm só o
                            PDF — oferecer "Corrigir" neles levaria a um erro
                            depois do clique, que é pior que não oferecer. */}
                        {d.tem_dados && (
                          <Link
                            href={`/admin/documentos?corrigir=${d.id}`}
                            className={styles.btnSecondary}
                          >
                            Corrigir
                          </Link>
                        )}

                        {d.tem_via_assinada && (
                          <a
                            href={`/api/admin/documentos-gerados/${d.id}/assinado`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.btnPrimary}
                          >
                            Via assinada
                          </a>
                        )}

                        {/* "Não chegou o e-mail" tem duas saídas, e nenhuma
                            delas é reenviar o contrato do zero — isso subiria
                            um documento novo e gastaria mais uma das 100 do
                            mês. Reenviar repete a notificação; copiar link é o
                            fallback combinado, que a Mayra manda por WhatsApp. */}
                        {vivo && d.assinatura_status === "pending_signature" && (
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            disabled={ocupado === d.id}
                            onClick={() => reenviar(d)}
                          >
                            Reenviar e-mail
                          </button>
                        )}

                        {vivo && url && (
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={() => copiarLink(d)}
                          >
                            {copiado === d.id ? "Copiado!" : "Copiar link"}
                          </button>
                        )}

                        {assinaturaConfigurada && !vivo && !d.tem_via_assinada && pedindoEmail !== d.id && (
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            disabled={ocupado === d.id}
                            onClick={() => iniciarEnvio(d)}
                          >
                            {ocupado === d.id
                              ? "Enviando..."
                              : d.assinatura_status
                                ? "Enviar de novo"
                                : "Enviar para assinatura"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
                    {documentos.length === 0
                      ? "Nenhum documento guardado ainda."
                      : "Nenhum documento encontrado para essa busca."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!assinaturaConfigurada && (
          <p style={{ marginTop: 16, fontSize: 13, color: "#6b7280" }}>
            A assinatura eletrônica não está configurada neste ambiente.
          </p>
        )}
      </div>
    </>
  );
}
