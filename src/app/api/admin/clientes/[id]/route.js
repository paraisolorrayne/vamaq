import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getCliente, updateCliente, setClienteAtivo } from "@/lib/clientes/repo";

export const dynamic = "force-dynamic";

// Mesmo formato usado em ARQUIVO_VALIDO (src/lib/documentos.js): um `id` que
// nem bate com a forma de um UUID nunca vai achar linha no banco. Sem essa
// checagem, o Postgres rejeita o tipo antes da query rodar e isso vira 500
// genérico — mas um id malformado na URL não é erro de servidor, é o mesmo
// "não encontrado" que um UUID válido porém inexistente. Tratamos os dois
// igual, inclusive para não revelar a diferença entre "não existe" e "nem é
// id" pra quem estiver adivinhando ids na URL.
const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request, { params }) {
  const auth = await requireApiRole(["secretaria", "financeiro", "vendedor"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!UUID_VALIDO.test(id)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  try {
    const cliente = await getCliente(id);
    if (!cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ cliente });
  } catch (err) {
    console.error("Falha ao buscar cliente:", err);
    return NextResponse.json({ error: "Falha ao buscar o cliente" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const auth = await requireApiRole(["secretaria", "financeiro"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!UUID_VALIDO.test(id)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const res = await updateCliente(id, body);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ cliente: res.cliente });
  } catch (err) {
    // A checagem de duplicidade em updateCliente roda em JS antes do update
    // — não é atômica com o banco. Numa corrida (duas abas editando/criando
    // com o mesmo CPF/CNPJ ao mesmo tempo), uma delas passa pela checagem e
    // só estoura no índice único do Postgres (clientes_doc_key). Esse
    // caminho cobre a corrida; o {error} do repo acima cobre o caso comum.
    if (err.code === "23505" && err.constraint === "clientes_doc_key") {
      return NextResponse.json({ error: "Já existe um cliente com esse CPF/CNPJ." }, { status: 400 });
    }
    console.error("Falha ao atualizar cliente:", err);
    return NextResponse.json({ error: "Falha ao atualizar o cliente" }, { status: 500 });
  }
}

// Não apaga o registro: cliente com contrato ou nota fiscal é histórico, e
// apagar de verdade derrubaria o vínculo com o veículo por cascade. Em vez
// disso, só marca como inativo (some das listas, mas continua na base).
export async function DELETE(_request, { params }) {
  const auth = await requireApiRole(["secretaria", "financeiro"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!UUID_VALIDO.test(id)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  try {
    await setClienteAtivo(id, false);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Falha ao desativar cliente:", err);
    return NextResponse.json({ error: "Falha ao desativar o cliente" }, { status: 500 });
  }
}
