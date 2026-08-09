"use client";

/**
 * Formulário de oportunidade do CRM — um só componente para as duas telas
 * (nova e editar). A entrega anterior deste repo (cadastro de clientes)
 * duplicou o formulário entre a lista e a ficha (~100 linhas quase
 * idênticas): um campo esquecido em um dos dois lados some em silêncio.
 * Aqui `novo/page.js` e `[id]/editar/page.js` só decidem o que passar em
 * `valoresIniciais`/`oportunidadeId` — o campo, a validação e o POST/PUT
 * vivem só aqui.
 *
 * `valoresIniciais.valor`, quando vem preenchido, já chega formatado em
 * pt-BR (a editar/page.js usa formatValorBR — é o que a pessoa espera ver).
 * Este componente NÃO reformata nem converte o valor antes de enviar: o
 * servidor entende o formato brasileiro via `valorDaOportunidade` (Task 2) —
 * converter aqui também recriaria duas regras de conversão divergentes.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { anoVeiculo } from "@/lib/anoVeiculo";
import { opcoesOrigem } from "@/lib/crm/origem";
import styles from "../admin.module.css";
import crm from "./crm.module.css";

function veiculoOptionLabel(v) {
  const ano = anoVeiculo(v);
  return [v.brand, v.model, ano].filter(Boolean).join(" ");
}

export default function FormOportunidade({ valoresIniciais, oportunidadeId }) {
  const router = useRouter();
  const editando = Boolean(oportunidadeId);
  const iniciais = valoresIniciais || {};

  const [clienteNome, setClienteNome] = useState(iniciais.cliente_nome || "");
  const [telefone, setTelefone] = useState(iniciais.telefone || "");
  const [email, setEmail] = useState(iniciais.email || "");
  const [vehicleId, setVehicleId] = useState(iniciais.vehicle_id || "");
  const [valor, setValor] = useState(iniciais.valor || "");
  const [origem, setOrigem] = useState(iniciais.origem || "");
  const [obs, setObs] = useState(iniciais.obs || "");

  // `origem` é texto livre no banco (sem CHECK) — ver o comentário em
  // src/lib/crm/origem.js. O valor atual entra na lista de opções quando
  // ela não o contém, para o <select> nunca trocar o valor em silêncio.
  const opcoes = opcoesOrigem(origem);

  const [veiculos, setVeiculos] = useState([]);
  const [veiculosErro, setVeiculosErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    fetch("/api/admin/vehicles")
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar veículos");
        return res.json();
      })
      .then((data) => {
        if (cancelado) return;
        const lista = Array.isArray(data) ? data : [];
        lista.sort((a, b) =>
          `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "pt-BR")
        );
        setVeiculos(lista);
      })
      .catch(() => {
        if (!cancelado) {
          setVeiculosErro("Não foi possível carregar a lista de veículos agora.");
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");

    if (!clienteNome.trim()) {
      setErro("Nome do cliente é obrigatório.");
      return;
    }

    setSalvando(true);
    const payload = {
      cliente_nome: clienteNome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      vehicle_id: vehicleId || null,
      valor: valor === "" ? null : valor,
      origem: origem || null,
      obs: obs.trim() || null,
    };

    try {
      const res = await fetch(
        editando
          ? `/api/admin/crm/oportunidades/${oportunidadeId}`
          : "/api/admin/crm/oportunidades",
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível salvar a oportunidade.");
      }
      router.push(`/admin/crm/${data.id}`);
    } catch (err) {
      setErro(err.message);
    } finally {
      // `finally`, não só o `catch`: hoje o sucesso faz `router.push` para
      // outra rota e este componente desmonta de verdade, então não haveria
      // diferença prática. Mas se um dia o push virar `router.refresh()`
      // (como no AcoesCard, que fica na mesma rota), o componente sobrevive
      // e o botão travaria desabilitado para sempre sem isto.
      setSalvando(false);
    }
  }

  const cancelarHref = editando ? `/admin/crm/${oportunidadeId}` : "/admin/crm";

  return (
    <form onSubmit={handleSubmit}>
      {erro && <p className={crm.erroForm}>{erro}</p>}

      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Cliente *</label>
          <input
            type="text"
            value={clienteNome}
            onChange={(e) => setClienteNome(e.target.value)}
            className={`${styles.formInput} ${crm.campoToque}`}
            placeholder="Nome do cliente"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Telefone</label>
          <input
            type="text"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className={`${styles.formInput} ${crm.campoToque}`}
            placeholder="Ex: (34) 99999-9999"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${styles.formInput} ${crm.campoToque}`}
            placeholder="cliente@email.com"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Veículo</label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className={`${styles.formSelect} ${crm.campoToque}`}
          >
            <option value="">Sem veículo vinculado</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {veiculoOptionLabel(v)}
              </option>
            ))}
          </select>
          {veiculosErro && <p className={crm.avisoCampo}>{veiculosErro}</p>}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Valor (R$)</label>
          <input
            type="text"
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={`${styles.formInput} ${crm.campoToque}`}
            placeholder="Ex: 180.000,00"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Origem</label>
          <select
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            className={`${styles.formSelect} ${crm.campoToque}`}
          >
            <option value="">Selecione</option>
            {opcoes.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
          <label className={styles.formLabel}>Observações</label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            className={`${styles.formTextarea} ${crm.campoToque}`}
            rows={4}
            placeholder="Anotações sobre a negociação"
          />
        </div>
      </div>

      <div className={crm.formActions}>
        <button
          type="submit"
          className={`${styles.btnPrimary} ${crm.acaoToque}`}
          disabled={salvando}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <Link href={cancelarHref} className={`${styles.btnSecondary} ${crm.acaoToque}`}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
