// Gerador de PDF com design para contratos VAMAQ (venda e consignação).
// Recebe { title, content } já preenchido e produz um documento A4 estilizado
// usando jsPDF (vetorial, sem dependência de imagens externas).

// --- Paleta da marca (ver src/styles/variables.css) ---
const ACCENT = [255, 106, 0]; // laranja VAMAQ
const INK = [17, 17, 17]; // títulos / valores fortes
const TEXT = [55, 55, 60]; // corpo de texto
const MUTED = [125, 125, 132]; // rótulos / legendas
const BORDER = [225, 225, 228];
const SOFT = [253, 243, 236]; // fundo dos cards (creme quente da marca)
const ROW_SHADE = [250, 250, 251];

// --- Geometria A4 (mm) ---
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 12;
const BOTTOM_LIMIT = PAGE_H - 20; // conteúdo não passa daqui (espaço p/ rodapé)

export async function generateContractPdf(preview) {
  const doc = await buildContractDoc(preview);
  doc.save(`${preview.title.replace(/\s+/g, "_")}.pdf`);
}

// Constrói o documento jsPDF (sem salvar) — separado para permitir testes.
// opts.logos = { dark, light } permite injetar logos já rasterizadas
// ({ dataUrl, aspect }), p.ex. em geração server-side. Se ausente, são
// carregadas via canvas no browser.
export async function buildContractDoc(preview, opts = {}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const blocks = parseContract(preview);

  // Logo rasterizada (no-op fora do browser → cai no wordmark em texto).
  // Cabeçalho e rodapé claros usam a versão sobre fundo claro.
  const logoLight =
    opts.logos?.light ?? (await loadVamaqLogo("/images/vamaq-logo-on-light.svg"));

  // Estado de layout
  let y = 0;

  // ---------- helpers ----------
  const setText = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  function ensure(h) {
    if (y + h > BOTTOM_LIMIT) {
      doc.addPage();
      y = drawRunningHeader();
    }
  }

  function drawHeaderBand() {
    // Cabeçalho claro: logomarca + data de emissão + filete inferior
    if (logoLight) {
      const logoH = 11;
      const logoW = logoH * logoLight.aspect;
      doc.addImage(logoLight.dataUrl, "PNG", MARGIN, 8, logoW, logoH);
    } else {
      // Fallback: wordmark em texto
      doc.setFont("helvetica", "bold");
      doc.setFontSize(21);
      setText(INK);
      doc.text("VAMAQ", MARGIN, 17);
      const w = doc.getTextWidth("VAMAQ");
      setText(ACCENT);
      doc.text(" MOTORS", MARGIN + w, 17);
    }

    // Data de emissão (direita, em duas linhas)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(MUTED);
    doc.text("Emitido em", PAGE_W - MARGIN, 11.5, { align: "right" });
    doc.text(formatToday(), PAGE_W - MARGIN, 15.5, { align: "right" });

    // Filete divisor
    setDraw(BORDER);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, 24, PAGE_W - MARGIN, 24);

    return 33; // y inicial do conteúdo
  }

  function drawRunningHeader() {
    if (logoLight) {
      const logoH = 6.5;
      const logoW = logoH * logoLight.aspect;
      doc.addImage(logoLight.dataUrl, "PNG", MARGIN, 7, logoW, logoH);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setText(INK);
      doc.text("VAMAQ", MARGIN, 13);
      const w = doc.getTextWidth("VAMAQ");
      setText(ACCENT);
      doc.text(" MOTORS", MARGIN + w, 13);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(MUTED);
    doc.text(preview.title, PAGE_W - MARGIN, 12, { align: "right" });
    setDraw(BORDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 16, PAGE_W - MARGIN, 16);
    return 23;
  }

  function drawTitle() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(ACCENT);
    doc.text("COMPRA · VENDA · CONSIGNAÇÃO DE VEÍCULOS", MARGIN, y);
    y += 5.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    setText(INK);
    const lines = doc.splitTextToSize(preview.title.toUpperCase(), CONTENT_W);
    doc.text(lines, MARGIN, y);
    y += lines.length * 6.6 + 1;

    setDraw(ACCENT);
    doc.setLineWidth(0.9);
    doc.line(MARGIN, y, MARGIN + 13, y);
    y += 7;
  }

  function sectionLabel(label) {
    ensure(9);
    y += 2.5;
    setFill(ACCENT);
    doc.rect(MARGIN, y - 3, 2, 3.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setText(INK);
    doc.text(label, MARGIN + 4.5, y);
    y += 5;
  }

  // Cabeçalho de seção pendente (blocos "heading"): só é desenhado junto com
  // o início do bloco seguinte, para nunca ficar órfão no fim da página.
  let pendingHeading = null;
  function flushHeading(nextH) {
    if (!pendingHeading) return;
    ensure(9 + nextH);
    sectionLabel(pendingHeading);
    pendingHeading = null;
  }

  function renderParty(b) {
    const padX = 6;
    const padTop = 5.5;
    const padBottom = 4.5;
    const titleGap = b.title ? 6.5 : 1;
    const lineH = 5.3;

    // Coluna de rótulos dimensionada pelo rótulo mais largo do bloco (com
    // teto), para rótulos longos (ex.: checklist) não invadirem os valores.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.6);
    const labelW = Math.min(
      Math.max(
        24,
        ...b.items
          .filter((it) => it.kind === "kv")
          .map((it) => doc.getTextWidth(`${it.k}:`) + 3)
      ),
      60
    );
    const valW = CONTENT_W - padX * 2 - labelW;

    // Pré-mede linhas (endereços podem quebrar), preservando a ordem
    const laid = b.items.map((it) => {
      if (it.kind === "kv") {
        return { kind: "kv", k: it.k, vlines: doc.splitTextToSize(it.v || "—", valW) };
      }
      return { kind: "text", lines: doc.splitTextToSize(it.text, CONTENT_W - padX * 2) };
    });

    let bodyH = 0;
    laid.forEach((it) => {
      const n = it.kind === "kv" ? Math.max(1, it.vlines.length) : it.lines.length;
      bodyH += n * lineH;
    });
    const h = padTop + titleGap + bodyH + padBottom;

    flushHeading(h + 4);
    ensure(h + 4);

    setFill(SOFT);
    doc.roundedRect(MARGIN, y, CONTENT_W, h, 1.6, 1.6, "F");
    setFill(ACCENT);
    doc.rect(MARGIN, y, 1.4, h, "F");

    let yy = y + padTop + 2;
    if (b.title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      setText(ACCENT);
      doc.text(b.title.toUpperCase(), MARGIN + padX, yy);
    }

    yy += titleGap;
    laid.forEach((it) => {
      if (it.kind === "kv") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.6);
        setText(MUTED);
        doc.text(`${it.k}:`, MARGIN + padX, yy);
        setText(TEXT);
        doc.text(it.vlines, MARGIN + padX + labelW, yy);
        yy += Math.max(1, it.vlines.length) * lineH;
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.8);
        setText(INK);
        doc.text(it.lines, MARGIN + padX, yy);
        yy += it.lines.length * lineH;
      }
    });

    y += h + 5;
  }

  function renderVehicle(b) {
    const rows = b.rows;
    const cols = 2;
    const cellW = CONTENT_W / cols;
    const cellH = 11;
    const nRows = Math.ceil(rows.length / cols);

    // A grade não é dividida entre páginas, então o rótulo só entra se ela
    // couber inteira junto — evita rótulo órfão no fim da página. Um cabeçalho
    // pendente (ex.: "VEÍCULO 1", "VEÍCULO DADO NA TROCA PELA COMPRADORA")
    // vira o rótulo da grade, no lugar do genérico.
    const label = pendingHeading || "DADOS DO VEÍCULO";
    pendingHeading = null;
    ensure(9 + nRows * cellH + 4);
    sectionLabel(label);
    const top = y;

    rows.forEach(([k, v], i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = MARGIN + c * cellW;
      const cy = top + r * cellH;
      if (r % 2 === 0) {
        setFill(ROW_SHADE);
        doc.rect(x, cy, cellW, cellH, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      setText(MUTED);
      doc.text(k.toUpperCase(), x + 4, cy + 4.2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      setText(INK);
      const val = doc.splitTextToSize(v || "—", cellW - 8)[0];
      doc.text(val, x + 4, cy + 8.7);
    });

    setDraw(BORDER);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, top, CONTENT_W, nRows * cellH);
    doc.line(MARGIN + cellW, top, MARGIN + cellW, top + nRows * cellH);
    y = top + nRows * cellH + 7;
  }

  function renderClause(b) {
    flushHeading(16);
    ensure(16);
    y += 3.5;
    setFill(ACCENT);
    doc.rect(MARGIN, y - 3.1, 2.2, 3.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.8);
    setText(INK);
    const lines = doc.splitTextToSize(b.text, CONTENT_W - 5);
    doc.text(lines, MARGIN + 4.8, y);
    y += lines.length * 5 + 1.5;
  }

  function renderPara(b) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.4);
    setText(TEXT);
    const lines = doc.splitTextToSize(b.text, CONTENT_W);
    // Junto com o cabeçalho pendente, garante ao menos as 2 primeiras linhas
    flushHeading(Math.min(lines.length, 2) * 5.2);
    lines.forEach((ln) => {
      ensure(5.2);
      doc.text(ln, MARGIN, y);
      y += 5;
    });
    y += 2.4;
  }

  function renderSignatures(sigs) {
    const gap = 14;
    const colW = (CONTENT_W - gap) / 2;
    // Duas assinaturas por linha; uma assinatura sozinha (ex.: anuente)
    // fica centralizada, como no modelo de referência.
    const rows = [];
    for (let i = 0; i < sigs.length; i += 2) rows.push(sigs.slice(i, i + 2));
    rows.forEach((row, ri) => {
      ensure(32);
      y += ri === 0 ? 12 : 6;
      row.forEach((s, idx) => {
        const x =
          row.length === 1
            ? MARGIN + (CONTENT_W - colW) / 2
            : MARGIN + idx * (colW + gap);
        const cx = x + colW / 2;
        setDraw(INK);
        doc.setLineWidth(0.4);
        doc.line(x, y, x + colW, y);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        setText(INK);
        doc.text(s.name || "", cx, y + 5, { align: "center" });
        let yy = y + 9.4;
        if (s.sub) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.6);
          setText(TEXT);
          doc.text(s.sub, cx, yy, { align: "center" });
          yy += 4.4;
        }
        if (s.role) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.4);
          setText(MUTED);
          doc.text(s.role.toUpperCase(), cx, yy, { align: "center" });
        }
      });
      y += 18;
    });
  }

  function renderWitnesses(b) {
    ensure(28);
    y += 6;
    // Título "TESTEMUNHAS"
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(MUTED);
    doc.text("TESTEMUNHAS", MARGIN, y);
    y += 8;

    const gap = 14;
    const colW = (CONTENT_W - gap) / 2;
    const people = (b.people && b.people.length ? b.people : [{}, {}]).slice(0, 2);
    while (people.length < 2) people.push({});

    people.forEach((p, idx) => {
      const x = MARGIN + idx * (colW + gap);
      // Linha "Nome:"
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      setText(MUTED);
      doc.text("Nome:", x, y);
      const nameX = x + doc.getTextWidth("Nome: ");
      setDraw(BORDER);
      doc.setLineWidth(0.3);
      doc.line(nameX, y + 0.6, x + colW, y + 0.6);
      if (p.nome) {
        setText(TEXT);
        doc.text(p.nome, nameX + 1, y - 0.4);
      }
      // Linha "CPF:"
      const y2 = y + 8;
      setText(MUTED);
      doc.text("CPF:", x, y2);
      const cpfX = x + doc.getTextWidth("CPF: ");
      setDraw(BORDER);
      doc.line(cpfX, y2 + 0.6, x + colW, y2 + 0.6);
      if (p.cpf) {
        setText(TEXT);
        doc.text(p.cpf, cpfX + 1, y2 - 0.4);
      }
    });
    y += 16;
  }

  function drawFooters() {
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      setDraw(BORDER);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, FOOTER_Y - 3.5, PAGE_W - MARGIN, FOOTER_Y - 3.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText(MUTED);
      doc.text(
        "VAMAQ MOTORS LTDA.  ·  Documento gerado digitalmente",
        MARGIN,
        FOOTER_Y
      );
      doc.text(`Página ${p} de ${total}`, PAGE_W - MARGIN, FOOTER_Y, {
        align: "right",
      });
    }
  }

  // ---------- render ----------
  y = drawHeaderBand();
  drawTitle();

  const signatures = [];
  let witnesses = null;
  for (const b of blocks) {
    switch (b.type) {
      case "party":
        renderParty(b);
        break;
      case "vehicle":
        renderVehicle(b);
        break;
      case "kv":
        renderParty({
          title: "",
          items: b.rows.map(([k, v]) => ({ kind: "kv", k, v })),
        });
        break;
      case "clause":
        renderClause(b);
        break;
      case "heading":
        pendingHeading = b.text.toUpperCase();
        break;
      case "para":
        renderPara(b);
        break;
      case "signature":
        signatures.push(b);
        break;
      case "witnesses":
        witnesses = b;
        break;
      default:
        break;
    }
  }
  flushHeading(0);
  if (signatures.length) renderSignatures(signatures);
  if (witnesses) renderWitnesses(witnesses);

  drawFooters();

  return doc;
}

// --- Parser: texto preenchido -> blocos semânticos ---
function parseContract(preview) {
  const lines = preview.content.split("\n").map((l) => l.replace(/\s+$/, ""));
  // remove a 1ª linha se for o próprio título
  if (
    lines.length &&
    lines[0].trim().toUpperCase() === preview.title.trim().toUpperCase()
  ) {
    lines.shift();
  }

  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) {
      i++;
      continue;
    }

    // Cabeçalho de parte (VENDEDOR:, COMPRADOR:, CONSIGNANTE (...):, CONSIGNATÁRIA:)
    if (isPartyHeader(t)) {
      const title = t.replace(/:$/, "").trim();
      const items = []; // preserva a ordem original (kv e texto)
      i++;
      while (i < lines.length && lines[i].trim()) {
        const l = lines[i].trim();
        const m = matchKv(l);
        if (m) items.push({ kind: "kv", k: m[1], v: m[2] });
        else items.push({ kind: "text", text: l });
        i++;
      }
      blocks.push({ type: "party", title, items });
      continue;
    }

    // Cláusula
    if (/^CL[ÁA]USULA/i.test(t)) {
      blocks.push({ type: "clause", text: t });
      i++;
      continue;
    }


    // Testemunhas (TESTEMUNHAS + pares Nome:/CPF:)
    if (/^TESTEMUNHAS$/i.test(t)) {
      i++;
      const people = [];
      let current = null;
      while (i < lines.length) {
        const l = lines[i].trim();
        if (!l) {
          i++;
          continue;
        }
        if (/^_{3,}/.test(l) || isPartyHeader(l) || /^CL[ÁA]USULA/i.test(l)) break;
        const m = matchKv(l);
        if (m && /^nome$/i.test(m[1])) {
          current = { nome: m[2], cpf: "" };
          people.push(current);
        } else if (m && /^cpf$/i.test(m[1]) && current) {
          current.cpf = m[2];
        }
        i++;
      }
      blocks.push({ type: "witnesses", people });
      continue;
    }

    // Assinatura
    if (/^_{3,}/.test(t)) {
      i++;
      const labels = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^_{3,}/.test(lines[i].trim()) &&
        labels.length < 3
      ) {
        labels.push(lines[i].trim());
        i++;
      }
      // Última linha é o papel (CONSIGNANTE/CONSIGNATÁRIA/...); a do meio (se
      // houver) é uma linha de identificação (CPF/CNPJ).
      const name = labels[0] || "";
      const role = labels.length > 1 ? labels[labels.length - 1] : "";
      const sub = labels.length > 2 ? labels[1] : "";
      blocks.push({ type: "signature", name, sub, role });
      continue;
    }

    // Cabeçalho de seção — linha curta toda em maiúsculas sem ":" final
    // (ex.: "DA QUILOMETRAGEM" no termo de vistoria). Vem depois dos blocos
    // de testemunhas/assinaturas para não capturá-los.
    if (isSectionHeading(t)) {
      blocks.push({ type: "heading", text: t });
      i++;
      continue;
    }

    // Grupo chave: valor (veículo ou genérico)
    if (matchKv(t)) {
      const rows = [];
      while (i < lines.length && lines[i].trim()) {
        const m = matchKv(lines[i].trim());
        if (!m) break;
        rows.push([m[1], m[2]]);
        i++;
      }
      const isVehicle = rows.some((r) => /^marca$/i.test(r[0]));
      blocks.push({ type: isVehicle ? "vehicle" : "kv", rows });
      continue;
    }

    // Parágrafo (junta linhas consecutivas)
    const para = [];
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "para", text: para.join(" ") });
  }
  return blocks;
}

function isPartyHeader(t) {
  return (
    /^(VENDEDOR|COMPRADOR|CONSIGNANTE|CONSIGNAT[ÁA]RI|ANUENTE|DADOS PARA PAGAMENTO)/i.test(t) &&
    t.endsWith(":")
  );
}

// rótulo curto seguido de ":" — ex.: "Nome:", "Endereço:", "RENAVAM:",
// "Razão Social:", "Nº do CRV:", "Código de Segurança do CRV:" (aceita
// espaços, barra, dígitos e ordinais).
function matchKv(t) {
  const m = t.match(/^([A-Za-z0-9À-ÿºª°().\/ -]{2,34}):\s*(.*)$/);
  if (!m) return null;
  return [t, m[1].trim(), m[2].trim()];
}

function isSpecial(t) {
  return (
    isPartyHeader(t) ||
    /^CL[ÁA]USULA/i.test(t) ||
    /^TESTEMUNHAS$/i.test(t) ||
    /^_{3,}/.test(t) ||
    isSectionHeading(t) ||
    !!matchKv(t)
  );
}

// Linha curta toda em maiúsculas, sem ":" no fim — título de seção de termos
// (a checagem de party/cláusula/testemunhas acontece antes desta).
function isSectionHeading(t) {
  return (
    t.length <= 60 &&
    !t.endsWith(":") &&
    /^[A-ZÀ-Ü0-9ºª°()\/.–— -]+$/.test(t) &&
    /[A-ZÀ-Ü]{2}/.test(t)
  );
}

function formatToday() {
  try {
    return new Date().toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

// Carrega um SVG da pasta /public, rasteriza para PNG via canvas e devolve
// { dataUrl, aspect }. Só funciona no browser; fora dele retorna null (o
// cabeçalho então usa o wordmark em texto como fallback).
async function loadVamaqLogo(path) {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    let svg = await res.text();
    const vb = svg.match(/viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/);
    if (!vb) return null;
    const vbW = parseFloat(vb[3]);
    const vbH = parseFloat(vb[4]);
    const aspect = vbW / vbH;

    // Iguala width/height ao viewBox para rasterizar sem bordas vazias
    const targetW = 800;
    const pxW = targetW;
    const pxH = Math.round(targetW / aspect);
    svg = svg
      .replace(/width="\d+"/, `width="${pxW}"`)
      .replace(/height="\d+"/, `height="${pxH}"`);

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = pxW;
      canvas.height = pxH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, pxW, pxH);
      return { dataUrl: canvas.toDataURL("image/png"), aspect };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}
