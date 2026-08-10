import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { listClientes, createCliente } from "@/lib/clientes/repo";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireApiRole(["secretaria", "financeiro", "vendedor"]);
  if (auth.error) return auth.error;

  const params = new URL(request.url).searchParams;
  const busca = params.get("busca") || "";
  const incluirInativos = params.get("incluirInativos") === "true";
  // Só o seletor do CRM manda `limite` (ver SeletorCliente.js): a listagem
  // completa de clientes (ClientesClient.js) não passa este parâmetro e
  // continua recebendo o resultado inteiro, sem corte. Faixa 1–50 evita tanto
  // 0/negativo (viraria "sem limite" acidental lá no repo, que só corta
  // quando `limite` é truthy) quanto um valor absurdo vindo de fora.
  const limiteN = parseInt(params.get("limite"), 10);
  const limite = Number.isFinite(limiteN) && limiteN > 0 ? Math.min(limiteN, 50) : undefined;

  try {
    const clientes = await listClientes({ busca, incluirInativos, limite });
    return NextResponse.json({ clientes, mais: Boolean(clientes.mais) });
  } catch (err) {
    console.error("Falha ao listar clientes:", err);
    return NextResponse.json({ error: "Falha ao listar os clientes" }, { status: 500 });
  }
}

export async function POST(request) {
  // O vendedor cadastra cliente de dentro do CRM — lead no pátio não espera.
  // Mas continua sem PUT/PATCH/DELETE e sem a ficha: administrar cadastro é da
  // secretaria e do financeiro. Ver a spec desta entrega.
  const auth = await requireApiRole(["secretaria", "financeiro", "vendedor"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const res = await createCliente(body);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ cliente: res.cliente });
  } catch (err) {
    // A checagem de duplicidade em createCliente roda em JS antes do insert
    // — não é atômica com o banco. Numa corrida (duas abas cadastrando o
    // mesmo CPF/CNPJ ao mesmo tempo), a segunda passa pela checagem e só
    // estoura no índice único do Postgres (clientes_doc_key). Esse caminho
    // cobre a corrida; o {error} do repo acima cobre o caso comum.
    if (err.code === "23505" && err.constraint === "clientes_doc_key") {
      return NextResponse.json({ error: "Já existe um cliente com esse CPF/CNPJ." }, { status: 400 });
    }
    console.error("Falha ao criar cliente:", err);
    return NextResponse.json({ error: "Falha ao criar o cliente" }, { status: 500 });
  }
}
