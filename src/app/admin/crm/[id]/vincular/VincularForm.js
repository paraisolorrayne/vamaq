"use client";

/**
 * Tela dedicada de vincular (Step 3 da task-3): mesma busca do formulário
 * (SeletorCliente), mas aqui a oportunidade já existe — escolher um
 * resultado vincula na hora (PUT) e volta pro card. Não usa
 * dadosDoCliente() para reescrever cliente_nome/telefone/email da
 * oportunidade: só o cliente_id muda, o resto do lead fica como a pessoa já
 * registrou (ver task-3-brief.md, Step 3: "PUT na oportunidade com o
 * cliente_id").
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../../admin.module.css";
import crm from "../../crm.module.css";
import SeletorCliente from "../../SeletorCliente";

export default function VincularForm({ oportunidade: o }) {
  const router = useRouter();
  const [nomeBusca, setNomeBusca] = useState(o.cliente_nome || "");
  const [vinculando, setVinculando] = useState(false);
  const [erro, setErro] = useState("");

  async function vincular(cliente) {
    setErro("");
    setVinculando(true);
    try {
      const res = await fetch(`/api/admin/crm/oportunidades/${o.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_nome: o.cliente_nome,
          telefone: o.telefone,
          email: o.email,
          vehicle_id: o.vehicle_id,
          valor: o.valor,
          origem: o.origem,
          obs: o.obs,
          cliente_id: cliente.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível vincular agora.");
      }
      router.push(`/admin/crm/${o.id}`);
    } catch (err) {
      setErro(err.message || "Não foi possível vincular agora.");
    } finally {
      // `finally`, não só o `catch`: ver AcoesCard.js/FormOportunidade.js —
      // o mesmo hábito desta entrega, mesmo o sucesso trocando de rota.
      setVinculando(false);
    }
  }

  return (
    <div>
      {erro && <p className={crm.erroForm}>{erro}</p>}

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Nome do cliente</label>
        <SeletorCliente
          valor={nomeBusca}
          onChangeValor={setNomeBusca}
          onSelecionar={vincular}
          telefoneParaCriar={o.telefone}
          emailParaCriar={o.email}
          inputClassName={`${styles.formInput} ${crm.campoToque}`}
          placeholder="Nome do cliente"
          autoBuscar
          disabled={vinculando}
        />
      </div>

      <div className={crm.formActions}>
        <Link href={`/admin/crm/${o.id}`} className={crm.btnSecundario}>
          Cancelar
        </Link>
      </div>
    </div>
  );
}
