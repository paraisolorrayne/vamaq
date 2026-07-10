// Renderização de criativos para Instagram (canvas 2D) — portado do
// Gerador-Criativos-Vamaq.html. Puro: recebe o canvas e um objeto de dados,
// sem ler o DOM. Usado pela página /admin/criativos.

const ORANGE = "#FF6A00";
const DARK = "#0A0A0A";
const INK = "#111111";
const GREY = "#555555";
const SOFT = "#888888";
const LINE = "#E5E5E5";

export const FORMATS = {
  story: { w: 1080, h: 1920, label: "Story · 1080×1920", tag: "STORY" },
  feed: { w: 1080, h: 1350, label: "Feed · 1080×1350", tag: "FEED" },
};

export const TEMPLATE_HINTS = {
  vitrine:
    "Vitrine: fundo branco premium, foto em card, specs e preço (vazio = “Consulte o Valor”).",
  performance:
    "Performance: fundo escuro, números grandes (potência, 0–100, km) e CTA laranja.",
  acervo: "Acervo: lista de até 4 carros (Story) ou 3 (Feed) em cards brancos.",
};

// data = {
//   fmt: 'story'|'feed', tpl: 'vitrine'|'performance'|'acervo',
//   values: { marca, modelo, ano, km, preco, badges, potencia, cambio,
//             combustivel, aceleracao, handle, site, ctaText, at1, at2, asub },
//   acervo: [{ nome, ano, km, preco } x4],
//   images: { foto1, logo, logoLight, logoDark, ac: [Image|null x4] },
//   f1: { zoom, x, y },  acOpts: [{ zoom, x } x4],
// }
export function renderCreative(cv, data) {
  const ctx = cv.getContext("2d");
  const f = FORMATS[data.fmt];
  if (cv.width !== f.w || cv.height !== f.h) {
    cv.width = f.w;
    cv.height = f.h;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const val = (k) => (data.values[k] || "").trim();

  /* ---------- helpers ---------- */
  function spacedText(text, cx, y, font, spacing, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const chars = [...text];
    let total = 0;
    for (const ch of chars) total += ctx.measureText(ch).width + spacing;
    total -= spacing;
    let x = cx - total / 2;
    for (const ch of chars) {
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + spacing;
    }
    return total;
  }
  function spacedWidth(text, font, spacing) {
    ctx.font = font;
    const chars = [...text];
    let total = 0;
    for (const ch of chars) total += ctx.measureText(ch).width + spacing;
    return total - spacing;
  }
  function wrapLines(text, font, maxW) {
    ctx.font = font;
    const words = text.split(/\s+/),
      lines = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Foto sem exigir recorte:
     'cover'    — preenche a janela (pode cortar bordas)
     'fit'      — carro inteiro; sobras com blur da própria foto + véu branco
     'fit-dark' — carro inteiro; sobras com blur + véu escuro
     'dark'     — carro inteiro; sobras em fundo escuro sólido fundido com a foto */
  function drawPhoto(img, rx, ry, rw, rh, opt, mode) {
    opt = opt || { zoom: 1, x: 0.5, y: 0.5 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    const base =
      mode === "cover"
        ? Math.max(rw / img.width, rh / img.height)
        : Math.min(rw / img.width, rh / img.height);
    const scale = base * opt.zoom;
    const dw = img.width * scale,
      dh = img.height * scale;
    const rangeX = Math.max(dw - rw, rw * 0.6);
    const rangeY = Math.max(dh - rh, rh * 0.6);
    const dx = rx + (rw - dw) / 2 - ((opt.x ?? 0.5) - 0.5) * rangeX;
    const dy = ry + (rh - dh) / 2 - ((opt.y ?? 0.5) - 0.5) * rangeY;
    if (dw < rw - 1 || dh < rh - 1) {
      if (mode === "dark") {
        const gd = ctx.createLinearGradient(0, ry, 0, ry + rh);
        gd.addColorStop(0, "#0a0a0a");
        gd.addColorStop(1, "#161616");
        ctx.fillStyle = gd;
        ctx.fillRect(rx, ry, rw, rh);
      } else {
        const bs = base * 1.25;
        ctx.filter = "blur(45px)";
        ctx.drawImage(
          img,
          rx + (rw - img.width * bs) / 2,
          ry + (rh - img.height * bs) / 2,
          img.width * bs,
          img.height * bs
        );
        ctx.filter = "none";
        ctx.fillStyle =
          mode === "fit-dark" ? "rgba(10,10,10,.45)" : "rgba(255,255,255,.35)";
        ctx.fillRect(rx, ry, rw, rh);
      }
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    if (mode === "dark") {
      if (dy > ry + 2) {
        const gt = ctx.createLinearGradient(0, dy - 2, 0, dy + 160);
        gt.addColorStop(0, "rgba(10,10,10,1)");
        gt.addColorStop(1, "rgba(10,10,10,0)");
        ctx.fillStyle = gt;
        ctx.fillRect(rx, Math.max(ry, dy - 2), rw, 162);
      }
      if (dy + dh < ry + rh - 2) {
        const gb = ctx.createLinearGradient(0, dy + dh - 160, 0, dy + dh + 2);
        gb.addColorStop(0, "rgba(10,10,10,0)");
        gb.addColorStop(1, "rgba(10,10,10,1)");
        ctx.fillStyle = gb;
        ctx.fillRect(
          rx,
          dy + dh - 160,
          rw,
          Math.min(162, ry + rh - (dy + dh - 160))
        );
      }
    }
    ctx.restore();
  }

  function placeholder(rx, ry, rw, rh, label, dark) {
    const g = ctx.createLinearGradient(rx, ry, rx, ry + rh);
    if (dark) {
      g.addColorStop(0, "#151515");
      g.addColorStop(1, "#242424");
    } else {
      g.addColorStop(0, "#F0F0F2");
      g.addColorStop(1, "#E4E4E7");
    }
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = dark ? "rgba(255,255,255,.30)" : "rgba(0,0,0,.30)";
    ctx.font = "600 " + Math.min(28, rh / 5) + "px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, rx + rw / 2, ry + rh / 2 + 9);
    ctx.textAlign = "left";
  }

  function drawLogo(cx, cy, maxW, onDark) {
    const img =
      data.images.logo || (onDark ? data.images.logoDark : data.images.logoLight);
    if (!img || !img.complete || !img.naturalWidth) {
      ctx.fillStyle = onDark ? "#fff" : INK;
      ctx.textAlign = "center";
      ctx.font = "700 54px Rajdhani, sans-serif";
      ctx.fillText("VAMAQ", cx, cy + 6);
      ctx.textAlign = "left";
      return;
    }
    const lh = (img.naturalHeight / img.naturalWidth) * maxW;
    ctx.drawImage(img, cx - maxW / 2, cy - lh / 2, maxW, lh);
  }

  function fitSize(text, weight, startPx, minPx, maxW, spacing) {
    let s = startPx;
    while (
      s > minPx &&
      spacedWidth(text, `${weight} ${s}px Rajdhani, sans-serif`, spacing) > maxW
    )
      s -= 2;
    return s;
  }

  function drawPill(cx, cy, text, o) {
    ctx.font = o.font;
    const tw = ctx.measureText(text).width;
    const w = tw + o.padX * 2,
      h = o.h;
    rr(cx - w / 2, cy - h / 2, w, h, h / 2);
    if (o.bg) {
      ctx.fillStyle = o.bg;
      ctx.fill();
    }
    if (o.border) {
      ctx.strokeStyle = o.border;
      ctx.lineWidth = o.lw || 2;
      ctx.stroke();
    }
    ctx.fillStyle = o.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy + 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    return w;
  }

  function badgeRow(cy, list, onDark) {
    if (!list.length) return;
    const font = "600 25px Inter, sans-serif";
    ctx.font = font;
    const padX = 26,
      gap = 18,
      h = 62;
    let total = 0;
    for (const b of list) total += ctx.measureText(b).width + padX * 2 + gap;
    total -= gap;
    let x = (cv.width - total) / 2;
    for (const b of list) {
      const w = ctx.measureText(b).width + padX * 2;
      rr(x, cy - h / 2, w, h, h / 2);
      if (onDark) {
        ctx.fillStyle = "rgba(255,106,0,.14)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,106,0,.55)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,106,0,.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,106,0,.35)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = ORANGE;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b, x + w / 2, cy + 2);
      x += w + gap;
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function specStrip(cy, items, onDark) {
    items = items.filter((i) => i.v);
    if (!items.length) return;
    const W = cv.width;
    const colW = Math.min(300, (W - 160) / items.length);
    const total = colW * items.length;
    let x = (W - total) / 2;
    for (let i = 0; i < items.length; i++) {
      const cx = x + colW / 2;
      ctx.textAlign = "center";
      ctx.fillStyle = onDark ? "#FFFFFF" : INK;
      ctx.font = "700 50px Rajdhani, sans-serif";
      ctx.fillText(items[i].v, cx, cy);
      ctx.fillStyle = SOFT;
      ctx.font = "600 20px Inter, sans-serif";
      spacedText(
        items[i].l.toUpperCase(),
        cx,
        cy + 44,
        "600 20px Inter, sans-serif",
        3,
        SOFT
      );
      if (i < items.length - 1) {
        ctx.strokeStyle = onDark ? "rgba(255,255,255,.16)" : LINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + colW, cy - 44);
        ctx.lineTo(x + colW, cy + 46);
        ctx.stroke();
      }
      x += colW;
    }
    ctx.textAlign = "left";
  }

  function footerLine(y, onDark) {
    const W = cv.width;
    const handle = val("handle") || "@vamaqmotors";
    const site = val("site") || "vamaqmotors.com.br";
    const f1 = "600 26px Inter, sans-serif",
      f2 = "400 26px Inter, sans-serif";
    ctx.font = f1;
    const w1 = ctx.measureText(handle).width;
    ctx.font = f2;
    const w2 = ctx.measureText("  ·  " + site).width;
    let x = (W - w1 - w2) / 2;
    ctx.font = f1;
    ctx.fillStyle = ORANGE;
    ctx.fillText(handle, x, y);
    ctx.font = f2;
    ctx.fillStyle = onDark ? "#777" : SOFT;
    ctx.fillText("  ·  " + site, x + w1, y);
  }

  function getBadges() {
    return val("badges")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 3);
  }

  /* ================================================================
     TEMPLATE 1 — VITRINE (White Luxury)
  ================================================================ */
  function renderVitrine() {
    const W = cv.width,
      H = cv.height,
      S = data.fmt === "story";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);

    const marca = val("marca").toUpperCase();
    const modelo = val("modelo").toUpperCase();
    const ano = val("ano");
    const km = val("km");
    const preco = val("preco");
    const badges = getBadges();

    drawLogo(W / 2, S ? 132 : 104, S ? 320 : 270, false);

    let y = S ? 300 : 236;
    spacedText(
      "ACERVO SELECIONADO",
      W / 2,
      y,
      "600 25px Inter, sans-serif",
      9,
      ORANGE
    );

    y += S ? 74 : 60;
    if (marca) spacedText(marca, W / 2, y, "500 32px Inter, sans-serif", 7, GREY);

    y += S ? 84 : 70;
    if (modelo) {
      let size = fitSize(modelo, 700, S ? 96 : 84, 44, 940, 3);
      const lines =
        spacedWidth(modelo, `700 ${size}px Rajdhani, sans-serif`, 3) > 940
          ? wrapLines(modelo, `700 ${size}px Rajdhani, sans-serif`, 940)
          : [modelo];
      for (const ln of lines) {
        spacedText(ln, W / 2, y, `700 ${size}px Rajdhani, sans-serif`, 3, INK);
        y += size + 8;
      }
      y -= size + 8;
    }

    y += S ? 66 : 56;
    const meta = [ano, km ? km + " km" : ""].filter(Boolean).join("   ·   ");
    if (meta) spacedText(meta, W / 2, y, "400 31px Inter, sans-serif", 2, GREY);

    if (badges.length) {
      y += S ? 72 : 60;
      badgeRow(y - 12, badges, false);
    }

    /* foto em card arredondado com sombra sutil */
    const phX = 64,
      phW = W - 128;
    const phY = S ? (badges.length ? 760 : 716) : badges.length ? 606 : 566;
    const phH = S ? (badges.length ? 700 : 744) : badges.length ? 420 : 460;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.12)";
    ctx.shadowBlur = 46;
    ctx.shadowOffsetY = 18;
    rr(phX, phY, phW, phH, 28);
    ctx.fillStyle = "#F0F0F2";
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(phX, phY, phW, phH, 28);
    ctx.clip();
    if (data.images.foto1)
      drawPhoto(data.images.foto1, phX, phY, phW, phH, data.f1, "fit");
    else placeholder(phX, phY, phW, phH, "FOTO DO VEÍCULO", false);
    ctx.restore();

    /* specs com divisórias finas */
    const specY = phY + phH + (S ? 128 : 86);
    specStrip(
      specY,
      [
        { v: val("potencia"), l: "Potência" },
        { v: val("cambio"), l: "Câmbio" },
        { v: val("combustivel"), l: "Combustível" },
      ],
      false
    );

    /* preço ou Consulte */
    const ctaTxt = val("ctaText").toUpperCase();
    const both = !!(preco && ctaTxt && S); // preço + botão só cabem juntos no Story
    if (preco) {
      spacedText(
        "R$ " + preco,
        W / 2,
        specY + (S ? (both ? 150 : 168) : 118),
        `700 ${S ? 80 : 64}px Rajdhani, sans-serif`,
        2,
        INK
      );
      if (both)
        drawPill(W / 2, specY + 214, ctaTxt, {
          font: "700 25px Inter, sans-serif",
          padX: 40,
          h: 72,
          bg: ORANGE,
          color: "#fff",
        });
    } else {
      drawPill(W / 2, specY + (S ? 142 : 106), ctaTxt || "CONSULTE O VALOR", {
        font: "700 28px Inter, sans-serif",
        padX: 48,
        h: 88,
        bg: ORANGE,
        color: "#fff",
      });
    }

    /* rodapé (linha fina só no Story — no Feed o espaço é curto) */
    if (S && !both) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(72, H - 96);
      ctx.lineTo(W - 72, H - 96);
      ctx.stroke();
    }
    footerLine(H - 40, false);
  }

  /* ================================================================
     TEMPLATE 2 — PERFORMANCE (escuro #0A0A0A)
  ================================================================ */
  function renderPerformance() {
    const W = cv.width,
      H = cv.height,
      S = data.fmt === "story";
    ctx.fillStyle = DARK;
    ctx.fillRect(0, 0, W, H);

    const marca = val("marca").toUpperCase();
    const modelo = val("modelo").toUpperCase();
    const ano = val("ano");
    const km = val("km");
    const preco = val("preco");
    const badges = getBadges();

    drawLogo(W / 2, S ? 140 : 110, S ? 330 : 270, true);

    ctx.fillStyle = ORANGE;
    ctx.fillRect(W / 2 - 55, S ? 226 : 178, 110, 5);

    let y = S ? 320 : 258;
    if (marca)
      spacedText(marca, W / 2, y, "600 27px Inter, sans-serif", 10, ORANGE);

    y += S ? 96 : 80;
    if (modelo) {
      let size = fitSize(modelo, 700, S ? 104 : 88, 46, 960, 3);
      const lines =
        spacedWidth(modelo, `700 ${size}px Rajdhani, sans-serif`, 3) > 960
          ? wrapLines(modelo, `700 ${size}px Rajdhani, sans-serif`, 960)
          : [modelo];
      for (const ln of lines) {
        spacedText(ln, W / 2, y, `700 ${size}px Rajdhani, sans-serif`, 3, "#FFFFFF");
        y += size + 8;
      }
      y -= size + 8;
    }

    y += S ? 62 : 52;
    const meta = [ano, km ? km + " km" : ""].filter(Boolean).join("   ·   ");
    if (meta) spacedText(meta, W / 2, y, "400 30px Inter, sans-serif", 2, "#9a9a9a");

    if (badges.length && S) badgeRow(y + 66, badges, true);

    /* foto full-bleed fundida no fundo escuro */
    const phY = S ? (badges.length ? 668 : 610) : 520;
    const phH = S ? 760 : 480;
    if (data.images.foto1)
      drawPhoto(data.images.foto1, 0, phY, W, phH, data.f1, "dark");
    else placeholder(0, phY, W, phH, "FOTO DO VEÍCULO", true);

    /* números grandes de performance */
    const stats = [
      { v: val("potencia"), l: "Potência" },
      { v: val("aceleracao"), l: "0–100 km/h" },
      { v: km ? km + " km" : "", l: "Rodados" },
    ];
    const statY = phY + phH + (S ? 130 : 104);
    specStrip(statY, stats, true);

    /* CTA */
    const ctaTxt = val("ctaText").toUpperCase();
    const ctaY = statY + (S ? 150 : 116);
    drawPill(
      W / 2,
      ctaY,
      ctaTxt || (preco ? "R$ " + preco : "CONSULTE O VALOR"),
      { font: "700 30px Inter, sans-serif", padX: 52, h: 94, bg: ORANGE, color: "#fff" }
    );

    footerLine(H - 42, true);
  }

  /* ================================================================
     TEMPLATE 3 — ACERVO (lista de carros, cards brancos)
  ================================================================ */
  function renderAcervo() {
    const W = cv.width,
      H = cv.height,
      S = data.fmt === "story";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);

    drawLogo(W / 2, S ? 118 : 96, S ? 270 : 240, false);

    const t1 = val("at1").toUpperCase(),
      t2 = val("at2").toUpperCase();
    let y = S ? 288 : 232;
    const both = (t1 + " " + t2).trim();
    const size = fitSize(both, 700, S ? 96 : 82, 50, 900, 4);
    if (t1 && t2) {
      spacedText(t1 + " " + t2, W / 2, y, `700 ${size}px Rajdhani, sans-serif`, 4, INK);
    } else if (both) {
      spacedText(both, W / 2, y, `700 ${size}px Rajdhani, sans-serif`, 4, INK);
    }
    ctx.fillStyle = ORANGE;
    ctx.fillRect(W / 2 - 55, y + 26, 110, 5);

    const sub = val("asub");
    if (sub)
      spacedText(sub, W / 2, y + (S ? 92 : 80), "400 28px Inter, sans-serif", 1, GREY);

    /* cards */
    const maxCards = S ? 4 : 3;
    const cards = [];
    for (let i = 0; i < 4; i++) {
      const nome = (data.acervo[i].nome || "").trim();
      if (nome || data.images.ac[i]) cards.push(i);
    }
    const list = cards.slice(0, maxCards);
    const areaY = S ? 470 : 400;
    const areaH = (S ? H - 190 : H - 150) - areaY - 30;
    const gap = 26;
    const n = Math.max(list.length, 1);
    const chRaw = (areaH - gap * (n - 1)) / n;
    const ch = Math.min(chRaw, S ? 300 : 280);
    const cx0 = 56,
      cw = W - 112;
    let cy = areaY + (areaH - (ch * n + gap * (n - 1))) / 2;

    if (!list.length) {
      ctx.fillStyle = SOFT;
      ctx.textAlign = "center";
      ctx.font = "500 30px Inter, sans-serif";
      ctx.fillText("Preencha os carros do acervo no formulário", W / 2, areaY + areaH / 2);
      ctx.textAlign = "left";
    }

    for (const i of list) {
      const item = data.acervo[i];
      const nome = (item.nome || "").trim().toUpperCase();
      const anokm = [
        (item.ano || "").trim(),
        (item.km || "").trim() ? (item.km || "").trim() + " km" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const preco = (item.preco || "").trim();

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.08)";
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 10;
      rr(cx0, cy, cw, ch, 24);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.restore();
      rr(cx0, cy, cw, ch, 24);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.stroke();

      /* janela horizontal da foto — carro sempre inteiro */
      const pw = Math.round(ch * 1.5);
      ctx.save();
      rr(cx0, cy, cw, ch, 24);
      ctx.clip();
      if (data.images.ac[i])
        drawPhoto(
          data.images.ac[i],
          cx0,
          cy,
          pw,
          ch,
          { zoom: data.acOpts[i].zoom, x: data.acOpts[i].x, y: 0.5 },
          "fit"
        );
      else placeholder(cx0, cy, pw, ch, "FOTO", false);
      ctx.restore();

      /* texto à direita */
      const tx = cx0 + pw + 36,
        tw = cw - pw - 66;
      let ny = cy + ch * 0.32;
      if (nome) {
        /* 1) tenta caber em UMA linha reduzindo a fonte (evita linha órfã) */
        let ns = 46;
        ctx.font = `700 ${ns}px Rajdhani, sans-serif`;
        while (ns > 34 && ctx.measureText(nome).width > tw) {
          ns -= 2;
          ctx.font = `700 ${ns}px Rajdhani, sans-serif`;
        }
        let lines = ctx.measureText(nome).width <= tw ? [nome] : null;
        /* 2) senão, quebra em até 2 linhas */
        if (!lines) {
          lines = wrapLines(nome, `700 ${ns}px Rajdhani, sans-serif`, tw);
          while (lines.length > 2 && ns > 28) {
            ns -= 2;
            lines = wrapLines(nome, `700 ${ns}px Rajdhani, sans-serif`, tw);
          }
        }
        if (lines.length === 1) ny = cy + ch * 0.36;
        ctx.fillStyle = INK;
        ctx.font = `700 ${ns}px Rajdhani, sans-serif`;
        for (const ln of lines) {
          ctx.fillText(ln, tx, ny);
          ny += ns + 4;
        }
      }
      if (anokm) {
        ctx.fillStyle = GREY;
        ctx.font = "400 26px Inter, sans-serif";
        ctx.fillText(anokm, tx, ny + 8);
      }
      ctx.fillStyle = ORANGE;
      ctx.font = "700 36px Rajdhani, sans-serif";
      ctx.fillText(preco ? "R$ " + preco : "CONSULTE", tx, cy + ch - 34);

      cy += ch + gap;
    }
    if (cards.length > maxCards) {
      ctx.fillStyle = SOFT;
      ctx.font = "500 24px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "+" + (cards.length - maxCards) + " no formato Story",
        W / 2,
        areaY + areaH + 24
      );
      ctx.textAlign = "left";
    }

    /* faixa escura de rodapé */
    const fh = S ? 150 : 120;
    ctx.fillStyle = DARK;
    ctx.fillRect(0, H - fh, W, fh);
    ctx.fillStyle = ORANGE;
    ctx.fillRect(0, H - fh, W, 5);
    footerLine(H - fh / 2 + 10, true);
  }

  if (data.tpl === "vitrine") renderVitrine();
  else if (data.tpl === "performance") renderPerformance();
  else renderAcervo();
}

function slug(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

export function exportName(data) {
  const tag = FORMATS[data.fmt].tag;
  if (data.tpl === "acervo") return `VAMAQ-ACERVO-${tag}-v1.png`;
  const parts = [
    "VAMAQ",
    slug(data.values.marca || ""),
    slug(data.values.modelo || ""),
    (data.values.ano || "").trim(),
  ].filter(Boolean);
  if (data.tpl === "performance") parts.push("PERFORMANCE");
  return parts.join("-") + `-${tag}-v1.png`;
}

// Carrega um SVG de /public e devolve um Image com width/height iguais ao
// viewBox (sem isso o SVG desenha letterboxed no canvas, pois os arquivos da
// marca têm width/height maiores que o viewBox).
export async function loadSvgLogo(path) {
  const res = await fetch(path);
  if (!res.ok) return null;
  let svg = await res.text();
  const vb = svg.match(/viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/);
  if (vb) {
    svg = svg
      .replace(/width="[\d.]+"/, `width="${vb[3]}"`)
      .replace(/height="[\d.]+"/, `height="${vb[4]}"`);
  }
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } catch {
    return null;
  } finally {
    // revoga após o load — o Image já foi decodificado
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
