"use client";

/**
 * Busca de cliente no cadastro — o mecanismo por trás da proteção contra
 * cadastro duplicado (ver task-3-brief.md). Usado em dois lugares:
 * FormOportunidade (campo "Cliente" do formulário) e VincularForm (tela
 * dedicada /admin/crm/[id]/vincular). Extraído para não duplicar o debounce,
 * a lista de resultados e o "cadastrar novo" entre os dois.
 *
 * Controlado pelo pai: `valor`/`onChangeValor` são o texto do campo (o pai
 * decide o que fazer com ele — no formulário, é o próprio `cliente_nome`).
 * `onSelecionar(cliente)` dispara tanto ao escolher um resultado quanto
 * depois de cadastrar um novo — para quem chama, as duas coisas são a mesma
 * ação: "este é o cliente".
 *
 * Sem auto-busca no carregamento (a menos que `autoBuscar`): abrir a tela de
 * editar com o nome já preenchido não pode disparar uma lista de resultados
 * cobrindo o formulário antes de a pessoa tocar em nada. `autoBuscar` existe
 * para a tela de vincular, cujo único propósito é essa busca — lá, o nome já
 * vem preenchido com o da oportunidade e a lista deve aparecer na hora.
 */

import { useEffect, useState } from "react";
import { formataDoc } from "@/lib/clientes/doc";
import crm from "./crm.module.css";

export default function SeletorCliente({
  valor,
  onChangeValor,
  onSelecionar,
  telefoneParaCriar,
  inputClassName,
  placeholder,
  required,
  autoBuscar,
  disabled,
  clienteVinculado,
}) {
  const [ativo, setAtivo] = useState(Boolean(autoBuscar));
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [buscaErro, setBuscaErro] = useState("");
  const [criando, setCriando] = useState(false);
  const [criarErro, setCriarErro] = useState("");

  // Busca com debounce: espera 300ms sem digitar antes de chamar a API —
  // mesmo mecanismo de src/app/admin/clientes/ClientesClient.js.
  useEffect(() => {
    if (!ativo) return undefined;
    const termo = valor.trim();
    if (!termo) {
      setResultados([]);
      setBuscaErro("");
      setBuscando(false);
      return undefined;
    }

    let cancelado = false;
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/clientes?busca=${encodeURIComponent(termo)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelado) return;
        if (!res.ok) {
          setBuscaErro(data.error || "Não foi possível buscar clientes agora.");
          setResultados([]);
          return;
        }
        setBuscaErro("");
        setResultados(Array.isArray(data.clientes) ? data.clientes : []);
      } catch {
        if (!cancelado) {
          setBuscaErro("Não foi possível buscar clientes agora.");
          setResultados([]);
        }
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, ativo]);

  function handleChange(e) {
    setCriarErro("");
    onChangeValor(e.target.value);
    setAtivo(true);
  }

  function escolher(cliente) {
    setAtivo(false);
    setResultados([]);
    setCriarErro("");
    onSelecionar(cliente);
  }

  async function cadastrarNovo() {
    setCriarErro("");
    setCriando(true);
    try {
      const res = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: valor.trim(),
          telefone: telefoneParaCriar ? telefoneParaCriar.trim() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCriarErro(
          res.status === 403
            ? "Você não tem permissão para cadastrar clientes."
            : data.error || "Não foi possível cadastrar o cliente agora."
        );
        return;
      }
      escolher(data.cliente);
    } catch {
      setCriarErro("Não foi possível cadastrar o cliente agora.");
    } finally {
      // `finally`, não só o `catch` — mesmo hábito do resto desta entrega
      // (ver FormOportunidade.js e AcoesCard.js): sem isto, uma falha
      // deixaria o botão "Cadastrar" travado para sempre.
      setCriando(false);
    }
  }

  const termo = valor.trim();
  const semResultado = ativo && !buscando && termo.length > 0 && resultados.length === 0;
  const bloqueado = Boolean(disabled);

  return (
    <div>
      <input
        type="text"
        value={valor}
        onChange={handleChange}
        className={inputClassName}
        placeholder={placeholder}
        required={required}
        disabled={bloqueado}
        autoComplete="off"
      />

      {buscando && <p className={crm.buscaStatus}>Buscando…</p>}
      {buscaErro && <p className={crm.avisoCampo}>{buscaErro}</p>}

      {clienteVinculado && !ativo && (
        <p className={crm.clienteVinculado}>Vinculado ao cadastro.</p>
      )}

      {resultados.length > 0 && (
        <div className={crm.buscaResultados}>
          {resultados.map((c) => (
            <button
              key={c.id}
              type="button"
              className={crm.resultadoItem}
              disabled={bloqueado}
              onClick={() => escolher(c)}
            >
              <span className={crm.resultadoNome}>{c.nome}</span>
              <span className={crm.resultadoMeta}>
                {[c.doc ? formataDoc(c.doc) : null, c.telefone].filter(Boolean).join(" · ") ||
                  "Sem CPF/CNPJ e sem telefone cadastrados"}
              </span>
            </button>
          ))}
        </div>
      )}

      {semResultado && (
        <>
          {criarErro && <p className={crm.acoesErro}>{criarErro}</p>}
          <button
            type="button"
            className={crm.btnSecundario}
            disabled={bloqueado || criando}
            onClick={cadastrarNovo}
          >
            {criando ? "Cadastrando…" : `Cadastrar «${termo}» como cliente novo`}
          </button>
        </>
      )}
    </div>
  );
}
