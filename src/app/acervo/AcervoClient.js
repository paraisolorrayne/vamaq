"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import VehicleCard from "@/components/VehicleCard";
import {
  FAIXAS_KM,
  FAIXAS_PRECO,
  FILTROS_VAZIOS,
  ORDENS,
  chipsDe,
  filtraVeiculos,
  filtrosDaQuery,
  filtrosParaQuery,
  modelosDisponiveis,
  opcoesDe,
  ordenaVeiculos,
  temFiltroAtivo,
} from "@/lib/acervo/filtros";
import styles from "./acervo.module.css";

const POR_PAGINA = 9;

/**
 * O acervo — a tela onde o cliente decide.
 *
 * O ESTADO DOS FILTROS VIVE NA URL, não em useState. Três coisas saem de graça
 * disso: o vendedor manda a busca pronta no WhatsApp, quem abre um carro e
 * volta não perde o que filtrou, e o botão voltar do navegador funciona como
 * a pessoa espera. A regra de filtro em si está em lib/acervo/filtros.js, pura
 * e com teste — aqui só se liga a tela nela.
 */
export default function AcervoClient({ veiculos = [] }) {
  return (
    <Suspense fallback={<p className={styles.page}>Carregando showroom…</p>}>
      <Acervo veiculos={veiculos} />
    </Suspense>
  );
}

function Acervo({ veiculos }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filtros = useMemo(() => filtrosDaQuery(searchParams), [searchParams]);
  const pagina = Math.max(1, Number(searchParams.get("pagina")) || 1);

  const [drawerAberto, setDrawerAberto] = useState(false);

  /**
   * Escreve os filtros na URL. `replace` e não `push`: cada clique num
   * checkbox não deve virar uma entrada no histórico — sair da página
   * exigiria vinte toques no voltar. `scroll: false` mantém a pessoa onde
   * ela está em vez de jogá-la para o topo a cada ajuste.
   */
  const aplicar = useCallback(
    (novos, novaPagina = 1) => {
      const q = filtrosParaQuery(novos);
      const sp = new URLSearchParams(q);
      // Página 1 não vai para a URL: é o padrão, e poluir o link que vai para
      // o cliente com "pagina=1" não ajuda ninguém.
      if (novaPagina > 1) sp.set("pagina", String(novaPagina));
      const str = sp.toString();
      router.replace(str ? `/acervo?${str}` : "/acervo", { scroll: false });
    },
    [router]
  );

  const irParaPagina = useCallback(
    (n) => {
      aplicar(filtros, n);
      // Trocar de página é a única navegação daqui em que a pessoa espera
      // voltar ao começo da lista.
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [aplicar, filtros]
  );

  // --- Busca com debounce --------------------------------------------------
  // O campo tem estado local porque escrever na URL a cada tecla trava a
  // digitação. A URL recebe 300 ms depois da última tecla.
  //
  // NÃO HÁ SINCRONIA DE VOLTA (URL → campo): exigiria setState síncrono num
  // effect, que dispara render em cascata. Consequência conhecida e aceita:
  // ao usar o voltar do navegador, a LISTA fica correta (quem filtra é a URL)
  // e só o texto no campo pode ficar defasado.
  const [buscaLocal, setBuscaLocal] = useState(filtros.busca);

  useEffect(() => {
    if (buscaLocal === filtros.busca) return;
    const t = setTimeout(() => aplicar({ ...filtros, busca: buscaLocal }), 300);
    return () => clearTimeout(t);
  }, [buscaLocal, filtros, aplicar]);

  // --- Opções, derivadas da própria lista ----------------------------------
  // De graça: a lista já está aqui. Era isto que o servidor buscava em três
  // varreduras extras da tabela.
  const marcas = useMemo(() => opcoesDe(veiculos, "brand"), [veiculos]);
  const carrocerias = useMemo(() => opcoesDe(veiculos, "bodyType"), [veiculos]);
  const combustiveis = useMemo(() => opcoesDe(veiculos, "fuel"), [veiculos]);
  const cambios = useMemo(() => opcoesDe(veiculos, "transmission"), [veiculos]);
  const modelos = useMemo(
    () => modelosDisponiveis(veiculos, filtros.marcas),
    [veiculos, filtros.marcas]
  );

  const resultado = useMemo(
    () => ordenaVeiculos(filtraVeiculos(veiculos, filtros), filtros.ordem),
    [veiculos, filtros]
  );

  const chips = useMemo(() => chipsDe(filtros), [filtros]);
  const temFiltro = temFiltroAtivo(filtros);

  const totalPaginas = Math.max(1, Math.ceil(resultado.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = resultado.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  const alternar = (campo, valor) => {
    const atuais = filtros[campo] || [];
    const novos = atuais.includes(valor)
      ? atuais.filter((v) => v !== valor)
      : [...atuais, valor];
    aplicar({ ...filtros, [campo]: novos });
  };

  const limpar = () => {
    setBuscaLocal("");
    aplicar(FILTROS_VAZIOS);
    setDrawerAberto(false);
  };

  const numero = (campo) => (e) => {
    const v = e.target.value;
    aplicar({ ...filtros, [campo]: v === "" ? null : Number(v) });
  };

  const faixaPrecoAtiva = (faixa) =>
    filtros.precoMin === faixa.min && filtros.precoMax === faixa.max;

  const painel = (
    <div className={styles.sidebarInner}>
      <div className={styles.sidebarHeader}>
        <h2 className={styles.sidebarTitle}>Filtros</h2>
        <button
          className={styles.sidebarClose}
          onClick={() => setDrawerAberto(false)}
          aria-label="Fechar filtros"
          type="button"
        >
          &times;
        </button>
      </div>

      <Grupo label="Marca">
        <div className={styles.checkList}>
          {marcas.map((m) => (
            <label key={m} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={filtros.marcas.includes(m)}
                onChange={() => alternar("marcas", m)}
              />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </Grupo>

      {/* Modelo acompanha a marca: "Macan" numa lista com BMW selecionado é
          uma opção que só pode dar resultado vazio. */}
      {modelos.length > 1 && (
        <Grupo label={filtros.marcas.length ? "Modelo" : "Modelo (todas as marcas)"}>
          <div className={styles.checkList}>
            {modelos.map((m) => (
              <label key={m} className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={filtros.modelos.includes(m)}
                  onChange={() => alternar("modelos", m)}
                />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </Grupo>
      )}

      <Grupo label="Preço">
        <div className={styles.chipChoices}>
          {FAIXAS_PRECO.map((faixa) => (
            <button
              key={faixa.rotulo}
              type="button"
              className={`${styles.choice} ${faixaPrecoAtiva(faixa) ? styles.choiceOn : ""}`}
              aria-pressed={faixaPrecoAtiva(faixa)}
              onClick={() =>
                aplicar({
                  ...filtros,
                  precoMin: faixaPrecoAtiva(faixa) ? null : faixa.min,
                  precoMax: faixaPrecoAtiva(faixa) ? null : faixa.max,
                })
              }
            >
              {faixa.rotulo}
            </button>
          ))}
        </div>
        <div className={styles.inputRow}>
          <input
            type="number"
            inputMode="numeric"
            placeholder="mínimo"
            min="0"
            step="10000"
            value={filtros.precoMin ?? ""}
            onChange={numero("precoMin")}
            className={styles.input}
            aria-label="Preço mínimo"
          />
          <span className={styles.inputPrefix}>a</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="máximo"
            min="0"
            step="10000"
            value={filtros.precoMax ?? ""}
            onChange={numero("precoMax")}
            className={styles.input}
            aria-label="Preço máximo"
          />
        </div>
      </Grupo>

      {/* Ano com as DUAS pontas — antes só existia "até", então não havia
          como pedir "de 2022 pra cima", que é como se procura carro novo. */}
      <Grupo label="Ano">
        <div className={styles.inputRow}>
          <input
            type="number"
            inputMode="numeric"
            placeholder="de"
            min="1950"
            max="2100"
            value={filtros.anoMin ?? ""}
            onChange={numero("anoMin")}
            className={styles.input}
            aria-label="Ano mínimo"
          />
          <span className={styles.inputPrefix}>a</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="até"
            min="1950"
            max="2100"
            value={filtros.anoMax ?? ""}
            onChange={numero("anoMax")}
            className={styles.input}
            aria-label="Ano máximo"
          />
        </div>
      </Grupo>

      <Grupo label="Quilometragem">
        <div className={styles.chipChoices}>
          {FAIXAS_KM.map((faixa) => (
            <button
              key={faixa.rotulo}
              type="button"
              className={`${styles.choice} ${filtros.kmMax === faixa.max ? styles.choiceOn : ""}`}
              aria-pressed={filtros.kmMax === faixa.max}
              onClick={() =>
                aplicar({
                  ...filtros,
                  kmMax: filtros.kmMax === faixa.max ? null : faixa.max,
                })
              }
            >
              {faixa.rotulo}
            </button>
          ))}
        </div>
      </Grupo>

      <Grupo label="Tipo de veículo">
        <div className={styles.checkList}>
          {carrocerias.map((t) => (
            <label key={t} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={filtros.carrocerias.includes(t)}
                onChange={() => alternar("carrocerias", t)}
              />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </Grupo>

      <Grupo label="Combustível">
        <div className={styles.checkList}>
          {combustiveis.map((c) => (
            <label key={c} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={filtros.combustiveis.includes(c)}
                onChange={() => alternar("combustiveis", c)}
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
      </Grupo>

      {/* Câmbio só aparece se houver mais de uma opção no estoque — um filtro
          com uma escolha só não filtra nada e ocupa espaço. */}
      {cambios.length > 1 && (
        <Grupo label="Câmbio">
          <div className={styles.checkList}>
            {cambios.map((c) => (
              <label key={c} className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={filtros.cambios.includes(c)}
                  onChange={() => alternar("cambios", c)}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </Grupo>
      )}

      <Grupo label="Blindagem">
        <div className={styles.radioRow}>
          {[
            { valor: "todos", rotulo: "Todos" },
            { valor: "sim", rotulo: "Blindado" },
            { valor: "nao", rotulo: "Não blindado" },
          ].map((opt) => (
            <label key={opt.valor} className={styles.radioItem}>
              <input
                type="radio"
                name="blindagem"
                value={opt.valor}
                checked={filtros.blindagem === opt.valor}
                onChange={() => aplicar({ ...filtros, blindagem: opt.valor })}
              />
              <span>{opt.rotulo}</span>
            </label>
          ))}
        </div>
      </Grupo>

      {temFiltro && (
        <button type="button" className={styles.clearBtn} onClick={limpar}>
          Limpar filtros
        </button>
      )}
    </div>
  );

  return (
    <>
      <Header />
      <main id="main-content" className={styles.page}>
        <div className="container">
          <nav className={styles.breadcrumb} aria-label="Navegação">
            <Link href="/">Início</Link>
            <span aria-hidden="true"> / </span>
            <span>Showroom</span>
          </nav>

          <header className={`${styles.header} revela-entrada`}>
            <div>
              <h1 className={styles.title}>Showroom</h1>
              <p className={styles.subtitle}>
                {resultado.length === veiculos.length
                  ? `${veiculos.length} veículo${veiculos.length !== 1 ? "s" : ""} — curadoria rigorosa, procedência garantida.`
                  : `${resultado.length} de ${veiculos.length} veículo${veiculos.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </header>

          <div className={styles.layout}>
            <aside
              className={`${styles.sidebar} ${drawerAberto ? styles.sidebarOpen : ""}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) setDrawerAberto(false);
              }}
              aria-label="Filtros"
            >
              {painel}
            </aside>

            <div className={styles.results}>
              <div className={styles.toolbar}>
                <button
                  type="button"
                  className={styles.filterToggle}
                  onClick={() => setDrawerAberto(true)}
                  aria-label="Abrir filtros"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 6h16M7 12h10M10 18h4" />
                  </svg>
                  Filtrar
                  {chips.length > 0 && <span className={styles.contaFiltro}>{chips.length}</span>}
                </button>

                <input
                  type="search"
                  className={styles.busca}
                  placeholder="Busque por marca ou modelo"
                  value={buscaLocal}
                  onChange={(e) => setBuscaLocal(e.target.value)}
                  aria-label="Buscar por marca ou modelo"
                />

                <label className={styles.sortWrap}>
                  <span className={styles.sortLabel}>Ordenar por</span>
                  <select
                    className={styles.sort}
                    value={filtros.ordem}
                    onChange={(e) => aplicar({ ...filtros, ordem: e.target.value })}
                    aria-label="Ordenar veículos"
                  >
                    {ORDENS.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Os chips existem para a pessoa entender IMEDIATAMENTE o que
                  está filtrado — e poder desfazer uma coisa por vez, em vez de
                  ter que reabrir o painel e caçar o checkbox. */}
              {chips.length > 0 && (
                <div className={styles.chips}>
                  {chips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className={styles.chip}
                      onClick={() => {
                        if (chip.id === "busca") setBuscaLocal("");
                        aplicar(chip.remover(filtros));
                      }}
                      aria-label={`Remover filtro ${chip.rotulo}`}
                    >
                      {chip.rotulo}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                  <button type="button" className={styles.chipLimpar} onClick={limpar}>
                    Limpar tudo
                  </button>
                </div>
              )}

              {daPagina.length > 0 ? (
                <div className={`${styles.grid} revela-grupo`}>
                  {daPagina.map((veiculo, i) => (
                    <VehicleCard
                      key={veiculo.id}
                      vehicle={veiculo}
                      // Só o primeiro card: é o candidato a LCP da página.
                      prioridade={i === 0}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  <p>Nenhum veículo encontrado com os filtros selecionados.</p>
                  <button type="button" className={styles.clearBtn} onClick={limpar}>
                    Limpar filtros
                  </button>
                </div>
              )}

              {totalPaginas > 1 && (
                <nav className={styles.pagination} aria-label="Paginação">
                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => irParaPagina(Math.max(1, paginaAtual - 1))}
                    disabled={paginaAtual === 1}
                    aria-label="Página anterior"
                  >
                    ←
                  </button>

                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.pageBtn} ${n === paginaAtual ? styles.pageBtnActive : ""}`}
                      onClick={() => irParaPagina(n)}
                      aria-current={n === paginaAtual ? "page" : undefined}
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => irParaPagina(Math.min(totalPaginas, paginaAtual + 1))}
                    disabled={paginaAtual === totalPaginas}
                    aria-label="Próxima página"
                  >
                    →
                  </button>

                  <span className={styles.pageInfo}>
                    Página {paginaAtual} de {totalPaginas}
                  </span>
                </nav>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}

function Grupo({ label, children }) {
  return (
    <div className={styles.filterGroup}>
      <h3 className={styles.filterLabel}>{label}</h3>
      {children}
    </div>
  );
}
