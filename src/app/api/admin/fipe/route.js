import { NextResponse } from "next/server";

const FIPE_BASE = "https://parallelum.com.br/fipe/api/v1";
const ALLOWED_TYPES = ["carros", "motos", "caminhoes"];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tipoRaw = searchParams.get("tipo");
  const tipo = ALLOWED_TYPES.includes(tipoRaw) ? tipoRaw : "carros";
  const marca = searchParams.get("marca");
  const modelo = searchParams.get("modelo");
  const ano = searchParams.get("ano");

  try {
    let url;

    const e = encodeURIComponent;
    if (ano && modelo && marca) {
      url = `${FIPE_BASE}/${tipo}/marcas/${e(marca)}/modelos/${e(modelo)}/anos/${e(ano)}`;
    } else if (modelo && marca) {
      url = `${FIPE_BASE}/${tipo}/marcas/${e(marca)}/modelos/${e(modelo)}/anos`;
    } else if (marca) {
      url = `${FIPE_BASE}/${tipo}/marcas/${e(marca)}/modelos`;
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
