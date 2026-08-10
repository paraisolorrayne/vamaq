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
import { dadosDoCliente } from "@/lib/crm/vinculoCliente";
import styles from "../admin.module.css";
import crm from "./crm.module.css";
import SeletorCliente from "./SeletorCliente";

function veiculoOptionLabel(v) {
  const ano = anoVeiculo(v);
  return [v.brand, v.model, ano].filter(Boolean).join(" ");
}

export default function FormOportunidade({ valoresIniciais, oportunidadeId }) {
  const router = useRouter();
  const editando = Boolean(oportunidadeId);
  const iniciais = valoresIniciais || {};

  const [clienteNome, setClienteNome] = useState(iniciais.cliente_nome || "");
  const [clienteId, setClienteId] = useState(iniciais.cliente_id || null);
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

  // Item 3 da revisão 2 (fix-revisao2-report.md): a oportunidade tinha
  // vínculo (`iniciais.cliente_id`) e handleClienteNomeChange zera o
  // `clienteId` a cada tecla — certo, o vínculo pode não valer mais. O
  // problema era o desfecho: salvar direto desfazia o vínculo em silêncio.
  // `tinhaVinculo` guarda o estado ORIGINAL (não muda depois de montado) só
  // para saber se há algo a perder; `avisoDesvincular` gate o submit até a
  // pessoa confirmar explicitamente, sem janelinha nativa do navegador.
  const tinhaVinculo = Boolean(iniciais.cliente_id);
  const [avisoDesvincular, setAvisoDesvincular] = useState(false);

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

  // Qualquer edição no nome invalida o vínculo anterior até a pessoa escolher
  // de novo (ou cadastrar) — sem isso, um `cliente_id` de uma busca antiga
  // ficaria colado a um nome digitado depois, sem relação com ele.
  function handleClienteNomeChange(v) {
    setClienteNome(v);
    setClienteId(null);
    // Qualquer nova edição no nome invalida um aviso que já estava na tela —
    // a pessoa pode estar corrigindo o nome de volta ou vai escolher outro
    // cliente; o aviso de desvincular só volta se ela tentar salvar de novo
    // sem vínculo.
    setAvisoDesvincular(false);
  }

  function handleSelecionarCliente(cliente) {
    setAvisoDesvincular(false);
    const dados = dadosDoCliente(cliente);
    // Preenche ao CRIAR, preserva ao EDITAR — as duas metades não são a
    // mesma regra, mesmo parecendo.
    //
    // Criando (sem oportunidadeId): o que está em `clienteNome` até aqui é
    // só o termo de BUSCA que a pessoa digitou para achar o cliente — ex.
    // "Carl" para achar "Carlos Eduardo Mendes" — não é apelido de ninguém.
    // Escolher o resultado troca pelo nome completo do cadastro, sempre,
    // mesmo que o campo já tivesse algo digitado.
    //
    // Editando uma oportunidade que já existe, o nome em tela pode ser como
    // o vendedor decidiu chamar a pessoa ("Carlinhos") — aí preserva (item 2
    // da revisão 2, fix-revisao2-report.md) e só preenche a partir do
    // cadastro quando o campo ainda está vazio; o nome oficial do cadastro
    // ("Carlos Eduardo Mendes") já aparece à parte assim que o vínculo
    // existe (item 1), então nada se perde mantendo o que foi digitado.
    // VincularForm.js nunca sobrescreve `cliente_nome` (só o `cliente_id`
    // muda por lá) — ele só existe para oportunidades que já existem, ou
    // seja, é sempre o caso "editando" desta distinção.
    setClienteNome((atual) => (!editando || !atual.trim() ? dados.cliente_nome : atual));
    // item 4 do fix-duplicado-report.md: só sobrescreve telefone/e-mail
    // quando o cadastro trouxe algo — nunca com um campo em branco. Sem
    // isto, um cliente recém-criado sem e-mail no cadastro (porque o POST
    // também não mandava) apagava o e-mail que a pessoa acabou de digitar
    // no formulário, mesmo já tendo corrigido o POST para enviá-lo: o mesmo
    // buraco valia para escolher um cliente já cadastrado sem telefone/
    // e-mail enquanto o formulário já tinha um digitado.
    setTelefone((atual) => dados.telefone || atual);
    setEmail((atual) => dados.email || atual);
    setClienteId(dados.cliente_id);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");

    if (!clienteNome.trim()) {
      setErro("Nome do cliente é obrigatório.");
      return;
    }

    // Item 3: tinha vínculo, não tem mais — pede confirmação explícita antes
    // de salvar em vez de desfazer em silêncio. Primeiro submit com o aviso
    // ainda fechado só abre o aviso e PARA aqui, sem salvar; um segundo
    // clique, agora no botão "Sim, salvar sem vínculo", é a confirmação.
    if (tinhaVinculo && !clienteId && !avisoDesvincular) {
      setAvisoDesvincular(true);
      return;
    }

    setSalvando(true);
    const payload = {
      cliente_nome: clienteNome.trim(),
      cliente_id: clienteId || null,
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
        <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
          <label className={styles.formLabel}>Cliente *</label>
          {/* A proteção contra cadastro duplicado (ver task-3-brief.md):
              achar tem que ser mais fácil que criar. Por isso a busca abre
              assim que a pessoa digita, com os resultados sempre visíveis
              (nunca atrás de mais um toque) e o "cadastrar novo" só aparece
              quando a busca já rodou e não achou ninguém. */}
          <SeletorCliente
            valor={clienteNome}
            onChangeValor={handleClienteNomeChange}
            onSelecionar={handleSelecionarCliente}
            telefoneParaCriar={telefone}
            emailParaCriar={email}
            inputClassName={`${styles.formInput} ${crm.campoToque}`}
            placeholder="Nome do cliente"
            required
            clienteVinculado={Boolean(clienteId)}
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

      {avisoDesvincular && (
        <p className={crm.avisoCampo}>
          O nome não corresponde mais ao cliente vinculado — salvar agora desfaz o
          vínculo com o cadastro. Confirme abaixo para salvar assim mesmo, ou
          escolha o cliente de novo no campo acima.
        </p>
      )}

      <div className={crm.formActions}>
        <button
          type="submit"
          className={`${avisoDesvincular ? styles.btnDanger : styles.btnPrimary} ${crm.acaoToque}`}
          disabled={salvando}
        >
          {salvando ? "Salvando..." : avisoDesvincular ? "Sim, salvar sem vínculo" : "Salvar"}
        </button>
        {avisoDesvincular ? (
          <button
            type="button"
            className={`${styles.btnSecondary} ${crm.acaoToque}`}
            onClick={() => setAvisoDesvincular(false)}
            disabled={salvando}
          >
            Cancelar
          </button>
        ) : (
          <Link href={cancelarHref} className={`${styles.btnSecondary} ${crm.acaoToque}`}>
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
