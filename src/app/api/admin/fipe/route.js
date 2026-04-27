import { NextResponse } from "next/server";

const FIPE_BASE = "https://parallelum.com.br/fipe/api/v1";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") || "carros";
  const marca = searchParams.get("marca");
  const modelo = searchParams.get("modelo");
  const ano = searchParams.get("ano");

  try {
    let url;

    if (ano && modelo && marca) {
      url = `${FIPE_BASE}/${tipo}/marcas/${marca}/modelos/${modelo}/anos/${ano}`;
    } else if (modelo && marca) {
      url = `${FIPE_BASE}/${tipo}/marcas/${marca}/modelos/${modelo}/anos`;
    } else if (marca) {
      url = `${FIPE_BASE}/${tipo}/marcas/${marca}/modelos`;
    } else {
      url = `${FIPE_BASE}/${tipo}/marcas`;
    }

    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Erro ao consultar tabela FIPE" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Falha na conexão com a API FIPE" },
      { status: 502 }
    );
  }
}
