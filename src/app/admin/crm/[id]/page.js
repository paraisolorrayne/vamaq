import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getOportunidade } from "@/lib/crm/oportunidades";
import { resumoCliente } from "@/lib/clientes/repo";
import { rotuloEtapa } from "@/lib/crm/etapas";
import { rotuloVeiculo } from "@/lib/crm/rotuloVeiculo";
import { formatValorBR } from "@/lib/money";
import AcoesCard from "./AcoesCard";
import crm from "../crm.module.css";

export const metadata = {
  title: "Oportunidade — Vamaq Motors",
  robots: { index: false, follow: false },
};

// A ficha do cliente (/admin/clientes/<id>) é de secretaria, financeiro e
// admin — ver requireRole em src/app/admin/clientes/[id]/page.js. O vendedor
// não abre. Descoberto aqui, no Server Component, que tem a sessão de
// verdade: nada de adivinhar pelo erro de uma requisição nem de esconder o
// link só com CSS (ambos enganam justamente quem tem menos contexto).
const PAPEIS_COM_FICHA = ["secretaria", "financeiro", "admin"];

function veiculoLabel(o) {
  return rotuloVeiculo(o) || null;
}

function valorLabel(o) {
  return o.valor != null ? `R$ ${formatValorBR(Number(o.valor))}` : null;
}

function textoCarros(n) {
  if (n === 0) return "Nenhum carro no histórico deste cliente ainda.";
  if (n === 1) return "1 carro no histórico deste cliente.";
  return `${n} carros no histórico deste cliente.`;
}

export default async function OportunidadePage({ params }) {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade,
  // igual à lista (src/app/admin/crm/page.js).
  const user = await requireRole(["vendedor", "secretaria"]);
  const { id } = await params;
  const o = await getOportunidade(id);
  if (!o) notFound();

  const podeAbrirFicha = PAPEIS_COM_FICHA.includes(user.role);
  // resumoCliente(), não getCliente(): esta tela é aberta pelo vendedor, que
  // não tem acesso à ficha (nem ao dado fiscal que ela carrega) — ver o
  // comentário de resumoCliente em src/lib/clientes/repo.js.
  const resumo = o.cliente_id ? await resumoCliente(o.cliente_id) : null;
  const veiculosCount = resumo ? resumo.veiculos_count : 0;

  const linhas = [
    ["Veículo", veiculoLabel(o)],
    ["Valor", valorLabel(o)],
    ["Origem", o.origem],
    ["Telefone", o.telefone],
    ["E-mail", o.email],
    ["Observações", o.obs],
  ];
  if (o.etapa === "perdido") linhas.push(["Motivo da perda", o.motivo_perda]);

  return (
    <>
      <Link href="/admin/crm" className={crm.voltar}>
        ← Voltar
      </Link>

      <div className={crm.detailHead}>
        <h1 className={crm.detailNome}>
          {o.cliente_id && podeAbrirFicha ? (
            <Link href={`/admin/clientes/${o.cliente_id}`} className={crm.clienteLink}>
              {o.cliente_nome}
            </Link>
          ) : (
            o.cliente_nome
          )}
        </h1>
        <span
          className={`${crm.etapaBadge} ${o.etapa === "ganho" ? crm.etapaBadgeGanho : ""} ${
            o.etapa === "perdido" ? crm.etapaBadgePerdido : ""
          }`}
        >
          {rotuloEtapa(o.etapa)}
        </span>
      </div>

      {o.cliente_id && <p className={crm.clienteMeta}>{textoCarros(veiculosCount)}</p>}

      {/* Item 1 da revisão 2 (fix-revisao2-report.md): o vendedor registra
          "Carlinhos" e vincula ao cadastro "Carlos Eduardo Mendes" — sem
          isto a tela só mostrava "Carlinhos" e ninguém conseguia ligar um
          nome ao outro. Para TODOS os papéis, inclusive o vendedor: é ele
          quem mais precisa saber a quem o nome digitado corresponde. */}
      {o.cliente_cadastrado_nome && o.cliente_cadastrado_nome !== o.cliente_nome && (
        <p className={crm.clienteMeta}>cadastro: {o.cliente_cadastrado_nome}</p>
      )}

      <div className={crm.dados}>
        {linhas.map(([label, value]) => (
          <div key={label} className={crm.dadoRow}>
            <span className={crm.dadoLabel}>{label}</span>
            <span className={crm.dadoValue}>{value || "—"}</span>
          </div>
        ))}
      </div>

      <AcoesCard oportunidade={o} />
    </>
  );
}
