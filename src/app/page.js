import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { getAllVehicles } from "@/lib/repositories/vehicles";
import { getWhatsAppGenericUrl } from "@/lib/whatsapp";
import { anoVeiculo } from "@/lib/anoVeiculo";
import styles from "./page.module.css";

/**
 * Home — capa editorial, não catálogo.
 *
 * A narrativa é: um veículo protagonista ocupando a tela, três frases de
 * curadoria, uma composição de destaques em pesos diferentes, a casa, e o
 * convite para o acervo. O carro é o protagonista; a interface é direção de
 * arte e não disputa com ele.
 *
 * SEM JAVASCRIPT DE CLIENTE, DE PROPÓSITO. Todo o movimento é CSS
 * scroll-driven (ver page.module.css): o contador de cada seção é fixo, então
 * não há estado a acompanhar, e o que restaria para o JS — parallax e reveal —
 * o navegador faz sozinho, fora da thread principal. Página pública que não
 * hidrata nada é a que responde melhor no celular.
 */

function precoFormatado(price) {
  if (!price) return "Sob consulta";
  return price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
}

function kmFormatado(mileage) {
  if (mileage === 0) return "0 km";
  if (!mileage) return null;
  return `${mileage.toLocaleString("pt-BR")} km`;
}

/** As etiquetas do veículo — só as que existem, sem espaço vazio. */
function etiquetas(v) {
  return [
    anoVeiculo(v),
    kmFormatado(v.mileage),
    v.blindagem?.blindado ? "Blindado" : null,
    v.transmission,
  ].filter(Boolean);
}

export const metadata = {
  title: "Vamaq Motors — Boutique de veículos premium e esportivos",
  description:
    "Curadoria de veículos premium, esportivos e superesportivos. Mais de 13 anos de mercado, procedência verificada e atendimento direto.",
};

export default async function HomePage() {
  // UMA leitura da tabela, não duas. A home pedia getFeaturedVehicles() E
  // getAllVehicles() — com 32 veículos, filtrar em memória custa menos que
  // uma segunda ida ao Postgres.
  const todos = await getAllVehicles();
  const destacados = todos.filter((v) => v.featured);

  const heroVehicle = destacados[0] || todos[0] || null;
  const heroId = heroVehicle?.id;
  const vitrine = [...destacados, ...todos]
    .filter((v, i, arr) => v.id !== heroId && arr.findIndex((o) => o.id === v.id) === i)
    .slice(0, 3);

  const [principal, ...secundarios] = vitrine;

  return (
    <>
      <Header />
      <main id="main-content" className={styles.page}>
        {/* ============ 01 — O VEÍCULO ============ */}
        <section className={styles.hero} aria-labelledby="hero-titulo">
          {heroVehicle ? (
            <>
              {/* A fotografia domina e sangra pela direita. O recorte muda
                  com o scroll (ver .heroMedia no CSS) — é o movimento que
                  abre a narrativa. */}
              <div className={styles.heroMedia}>
                {heroVehicle.images?.main ? (
                  <Image
                    src={heroVehicle.images.main}
                    alt={`${heroVehicle.brand} ${heroVehicle.model}`}
                    className={styles.heroImg}
                    fill
                    sizes="(max-width: 900px) 100vw, 62vw"
                    // O LCP da home é esta foto. `priority` está depreciado
                    // no Next 16 — este par é a forma atual.
                    loading="eager"
                    fetchPriority="high"
                  />
                ) : (
                  <div className={styles.heroMediaVazio} aria-hidden="true" />
                )}
                <div className={styles.heroVeu} aria-hidden="true" />
              </div>

              <div className={styles.heroTexto}>
                <span className={styles.contador}>01 / 04</span>
                <span className={styles.sobrescrito}>
                  Vamaq Motors — mais de 13 anos no mercado premium
                </span>

                <h1 id="hero-titulo" className={styles.heroTitulo}>
                  <span className={styles.heroMarca}>{heroVehicle.brand}</span>
                  <span className={styles.heroModelo}>{heroVehicle.model}</span>
                </h1>

                <p className={styles.heroPreco}>{precoFormatado(heroVehicle.price)}</p>

                <ul className={styles.pilulas}>
                  {etiquetas(heroVehicle).map((t) => (
                    <li key={t} className={styles.pilula}>
                      {t}
                    </li>
                  ))}
                </ul>

                <div className={styles.acoes}>
                  <Link
                    href={`/veiculo/${heroVehicle.slug}`}
                    className={styles.botaoPrimario}
                  >
                    Conhecer este veículo
                  </Link>
                  <Link href="/acervo" className={styles.botaoSecundario}>
                    Explorar acervo
                  </Link>
                </div>
              </div>

              <span className={styles.rolar} aria-hidden="true">
                Role para explorar
              </span>
            </>
          ) : (
            <div className={styles.heroTexto}>
              <span className={styles.sobrescrito}>Vamaq Motors</span>
              <h1 id="hero-titulo" className={styles.heroTitulo}>
                <span className={styles.heroModelo}>Boutique automotiva</span>
              </h1>
              <p className={styles.heroPreco}>Acervo em atualização</p>
              <div className={styles.acoes}>
                <Link href="/acervo" className={styles.botaoPrimario}>
                  Explorar acervo
                </Link>
                <a
                  href={getWhatsAppGenericUrl()}
                  className={styles.botaoSecundario}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fale conosco
                </a>
              </div>
            </div>
          )}
        </section>

        {/* ============ 02 — CURADORIA, EM TRÊS FRASES ============ */}
        <section className={styles.manifesto} aria-labelledby="manifesto-titulo">
          <span className={styles.contador}>02 / 04</span>
          <h2 id="manifesto-titulo" className={styles.manifestoTitulo}>
            <span className={styles.frase}>Não vendemos apenas carros.</span>
            <span className={`${styles.frase} ${styles.fraseForte}`}>
              Selecionamos aquilo que merece estar aqui.
            </span>
          </h2>
          <p className={styles.manifestoLinha}>
            Procedência. Curadoria. Performance.
          </p>
        </section>

        {/* ============ 03 — DESTAQUES, EM PESOS DIFERENTES ============ */}
        {principal && (
          <section className={styles.destaques} aria-labelledby="destaques-titulo">
            <div className={styles.destaquesTopo}>
              <span className={styles.contador}>03 / 04</span>
              <h2 id="destaques-titulo" className={styles.destaquesTitulo}>
                Do acervo
              </h2>
            </div>

            {/* Composição assimétrica: o primeiro ocupa a largura, os outros
                entram abaixo em par. Não é card/card/card. */}
            <article className={styles.destaquePrincipal}>
              <Link href={`/veiculo/${principal.slug}`} className={styles.destaqueLink}>
                <div className={styles.destaqueFoto}>
                  {principal.images?.main && (
                    <Image
                      src={principal.images.main}
                      alt={`${principal.brand} ${principal.model}`}
                      fill
                      sizes="(max-width: 900px) 100vw, 90vw"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className={styles.destaqueInfo}>
                  <h3 className={styles.destaqueNome}>
                    <span className={styles.destaqueMarca}>{principal.brand}</span>{" "}
                    {principal.model}
                  </h3>
                  <p className={styles.destaqueMeta}>
                    {etiquetas(principal).slice(0, 3).join(" · ")}
                  </p>
                  <p className={styles.destaquePreco}>{precoFormatado(principal.price)}</p>
                </div>
              </Link>
            </article>

            <div className={styles.destaquesPar}>
              {secundarios.map((v) => (
                <article key={v.id} className={styles.destaqueSecundario}>
                  <Link href={`/veiculo/${v.slug}`} className={styles.destaqueLink}>
                    <div className={styles.destaqueFoto}>
                      {v.images?.main && (
                        <Image
                          src={v.images.main}
                          alt={`${v.brand} ${v.model}`}
                          fill
                          sizes="(max-width: 900px) 100vw, 45vw"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className={styles.destaqueInfo}>
                      <h3 className={styles.destaqueNome}>
                        <span className={styles.destaqueMarca}>{v.brand}</span>{" "}
                        {v.model}
                      </h3>
                      <p className={styles.destaqueMeta}>
                        {etiquetas(v).slice(0, 3).join(" · ")}
                      </p>
                      <p className={styles.destaquePreco}>{precoFormatado(v.price)}</p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>

            <Link href="/acervo" className={styles.botaoSecundario}>
              Ver todo o acervo
            </Link>
          </section>
        )}

        {/* ============ 04 — A CASA ============ */}
        <section className={styles.curadoria} aria-labelledby="curadoria-titulo">
          {/* A fotografia começa contida e ganha espaço conforme se avança —
              o texto vive noutro plano, entrando mais devagar. */}
          <div className={styles.curadoriaFoto}>
            <Image
              src="/images/equipe/mateus-showroom.webp"
              alt="Showroom da Vamaq Motors"
              fill
              sizes="(max-width: 900px) 100vw, 55vw"
              loading="lazy"
            />
          </div>

          <div className={styles.curadoriaTexto}>
            <span className={styles.contador}>04 / 04</span>
            <h2 id="curadoria-titulo" className={styles.curadoriaTitulo}>
              Cada veículo entra no acervo por um motivo.
            </h2>
            <p className={styles.curadoriaCorpo}>
              Liderada por Mateus Parreira, com mais de 13 anos de experiência no
              mercado automotivo de luxo. Procedência não é detalhe — é o começo
              da conversa.
            </p>

            <dl className={styles.numeros}>
              <div className={styles.numero}>
                <dt className={styles.numeroRotulo}>Anos de mercado</dt>
                <dd className={styles.numeroValor}>13+</dd>
              </div>
              <div className={styles.numero}>
                <dt className={styles.numeroRotulo}>Veículos negociados</dt>
                <dd className={styles.numeroValor}>2.500+</dd>
              </div>
              <div className={styles.numero}>
                <dt className={styles.numeroRotulo}>Procedência verificada</dt>
                <dd className={styles.numeroValor}>100%</dd>
              </div>
            </dl>

            <div className={styles.acoes}>
              <a
                href={getWhatsAppGenericUrl()}
                className={styles.botaoPrimario}
                target="_blank"
                rel="noopener noreferrer"
              >
                Fale conosco
              </a>
              <Link href="/sobre" className={styles.botaoSecundario}>
                Conheça a Vamaq
              </Link>
            </div>
          </div>
        </section>
      </main>
      <WhatsAppFloat />
      <Footer />
    </>
  );
}
