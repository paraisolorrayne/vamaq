"use client";

/**
 * Confirmação de marcar vendido, pelo Estoque (venda de balcão — ver
 * docs/superpowers/specs/2026-08-10-marcar-vendido-design.md). Irmã de
 * src/app/admin/crm/[id]/vender/VenderForm.js: mesmo botão, mesmo hábito de
 * resetar o estado de salvando no `finally`. A diferença é o cliente: aqui
 * é OPCIONAL (a venda pode ser marcada sem ele e vinculada depois), então
 * este componente carrega o SeletorCliente que a tela do CRM não precisa.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../../admin.module.css";
import crm from "../../../crm/crm.module.css";
import SeletorCliente from "../../../crm/SeletorCliente";

export default function VenderForm({ veiculoId }) {
  const router = useRouter();
  const [clienteNome, setClienteNome] = useState("");
  const [clienteId, setClienteId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Qualquer edição no nome depois de escolher alguém invalida a escolha —
  // mesmo hábito de FormOportunidade.js (handleClienteNomeChange): sem
  // isto, um clienteId de uma busca anterior ficaria colado a um nome
  // digitado depois, sem relação com ele.
  function handleChangeNome(v) {
    setClienteNome(v);
    setClienteId(null);
  }

  function handleSelecionarCliente(cliente) {
    setClienteNome(cliente.nome);
    setClienteId(cliente.id);
  }

  async function confirmar() {
    setErro("");
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/vehicles/${veiculoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "vendido", clienteId: clienteId || null }),
      });
      if (!res.ok) throw new Error("Falha ao marcar como vendido");
      router.push("/admin/estoque");
    } catch {
      setErro("Não foi possível marcar a venda agora. Verifique a conexão e tente de novo.");
    } finally {
      // `finally`, não só o `catch` — ver VenderForm.js do CRM e
      // SeletorCliente.js: sem isto uma falha deixaria o botão travado.
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className={styles.formGroup} style={{ marginBottom: 20 }}>
        <label className={styles.formLabel}>Cliente (opcional)</label>
        <SeletorCliente
          valor={clienteNome}
          onChangeValor={handleChangeNome}
          onSelecionar={handleSelecionarCliente}
          inputClassName={`${styles.formInput} ${crm.campoToque}`}
          placeholder="Nome do cliente que comprou"
          disabled={salvando}
          clienteVinculado={Boolean(clienteId)}
        />
      </div>

      <ul className={crm.avisos}>
        <li className={crm.avisoItem}>O veículo é marcado como <strong>VENDIDO</strong>.</li>
        <li className={crm.avisoItem}>Ele sai do site na hora.</li>
        <li className={crm.avisoItem}>
          A receita <strong>não</strong> é lançada sozinha: registre-a no Financeiro,
          ligada a este veículo — sem isso a margem não sai.
        </li>
      </ul>

      {erro && <p className={crm.acoesErro}>{erro}</p>}

      <div className={crm.formActions}>
        <button type="button" className={crm.btnPrimario} disabled={salvando} onClick={confirmar}>
          {salvando ? "Confirmando..." : "Confirmar a venda"}
        </button>
        <Link href="/admin/estoque" className={crm.btnSecundario}>
          Cancelar
        </Link>
      </div>
    </div>
  );
}
