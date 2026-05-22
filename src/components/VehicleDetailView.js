'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import VehicleCard from '@/components/VehicleCard';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import styles from '@/app/veiculo/[slug]/veiculo.module.css';

function resolveGalleryImages(vehicle) {
  const images = vehicle?.images;
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  const list = [];
  if (images.main) list.push(images.main);
  if (Array.isArray(images.gallery)) {
    for (const url of images.gallery) {
      if (url && !list.includes(url)) list.push(url);
    }
  }
  return list;
}

function ArrowIcon({ direction }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === 'left' ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 6 15 12 9 18" />
      )}
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function VehicleDetailView({ vehicle, related = [], isPreview = false }) {
  const whatsappUrl = getWhatsAppUrl(vehicle);
  const galleryImages = resolveGalleryImages(vehicle);
  const count = galleryImages.length;

  const [index, setIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('images');
  const trackRef = useRef(null);

  const goTo = useCallback(
    (next) => {
      if (count <= 1) return;
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [prev, next]);

  const initialRender = useRef(true);
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[index];
    if (child) {
      const childCenter = child.offsetLeft - track.offsetLeft + child.offsetWidth / 2;
      track.scrollTo({ left: childCenter - track.clientWidth / 2, behavior: 'smooth' });
    }
  }, [index]);

  const version = vehicle.fuel
    ? `${vehicle.power || ''} ${vehicle.fuel} ${vehicle.transmission || ''}`.trim()
    : '';

  return (
    <main id="main-content" className={styles.page}>
      {/* ===== HERO SECTION ===== */}
      <section className={styles.hero}>
        <img className={styles.heroBgImg} src="/images/bg-gradient.svg" alt="" aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroInfo}>
            <h5 className={styles.heroBrand}>{vehicle.brand}</h5>
            <h1 className={styles.heroModel}>{vehicle.model}</h1>
            {version && <h2 className={styles.heroVersion}>{version}</h2>}

            <div className={styles.heroMeta}>
              <div className={styles.heroMetaItem}>
                <span className={styles.heroMetaLabel}>Ano</span>
                <span className={styles.heroMetaValue}>{vehicle.year}</span>
              </div>
              <div className={styles.heroMetaItem}>
                <span className={styles.heroMetaLabel}>Km</span>
                <span className={styles.heroMetaValue}>
                  {vehicle.mileage?.toLocaleString('pt-BR') || '0'}km
                </span>
              </div>
            </div>

            {vehicle.price ? (
              <h2 className={styles.heroPrice}>
                R$ {vehicle.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h2>
            ) : (
              <h2 className={`${styles.heroPrice} ${styles.heroPriceConsult}`}>
                Sob consulta
              </h2>
            )}

            <a
              href={isPreview ? '#' : whatsappUrl}
              className={styles.heroCta}
              target={isPreview ? undefined : '_blank'}
              rel={isPreview ? undefined : 'noopener noreferrer'}
              onClick={isPreview ? (e) => e.preventDefault() : undefined}
              aria-disabled={isPreview || undefined}
            >
              <span className={styles.heroCtaInner}>
                Fazer proposta
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </a>
          </div>

          <div className={styles.heroImage}>
            {galleryImages[0] ? (
              <img
                src={galleryImages[0]}
                alt={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
                className={styles.heroImg}
                loading="eager"
              />
            ) : (
              <div className={styles.heroPlaceholder}>
                <svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Fotos em breve</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== GALLERY & INFO SECTION ===== */}
      <section className={styles.gallerySection}>
        <div className={styles.gallerySidebar}>
          <h5 className={styles.galleryBrand}>{vehicle.brand}</h5>
          <h2 className={styles.galleryModel}>{vehicle.model}</h2>
          {version && <h3 className={styles.galleryVersion}>{version}</h3>}

          <ul className={styles.tabs} role="tablist">
            <li>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'images'}
                className={`${styles.tab} ${activeTab === 'images' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('images')}
              >
                Imagens
              </button>
            </li>
            <li>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'info'}
                className={`${styles.tab} ${activeTab === 'info' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('info')}
              >
                Informações principais
              </button>
            </li>
          </ul>

          {activeTab === 'info' && (
            <ul className={styles.specsList}>
              <li className={styles.specItem}>
                <span className={styles.specLabel}>Quilometragem</span>
                <span className={styles.specValue}>
                  {vehicle.mileage?.toLocaleString('pt-BR') || '0'}km
                </span>
              </li>
              <li className={styles.specItem}>
                <span className={styles.specLabel}>Ano de fabricação</span>
                <span className={styles.specValue}>{vehicle.year}</span>
              </li>
              <li className={styles.specItem}>
                <span className={styles.specLabel}>Câmbio</span>
                <span className={styles.specValue}>{vehicle.transmission || '—'}</span>
              </li>
              <li className={styles.specItem}>
                <span className={styles.specLabel}>Combustível</span>
                <span className={styles.specValue}>{vehicle.fuel || '—'}</span>
              </li>
              <li className={styles.specItem}>
                <span className={styles.specLabel}>Cor externa</span>
                <span className={styles.specValue}>{vehicle.color || '—'}</span>
              </li>
              {vehicle.specs?.engine && (
                <li className={styles.specItem}>
                  <span className={styles.specLabel}>Motor</span>
                  <span className={styles.specValue}>{vehicle.specs.engine}</span>
                </li>
              )}
              {vehicle.power && (
                <li className={styles.specItem}>
                  <span className={styles.specLabel}>Potência</span>
                  <span className={styles.specValue}>{vehicle.power}</span>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className={styles.galleryMain}>
          {activeTab === 'images' && galleryImages.length > 0 ? (
            <>
              <div className={styles.galleryTrack} ref={trackRef}>
                {galleryImages.map((src, i) => (
                  <img
                    key={`${src}-${i}`}
                    src={src}
                    alt={`${vehicle.brand} ${vehicle.model} — foto ${i + 1}`}
                    className={`${styles.galleryImage} ${i === index ? styles.galleryImageActive : ''}`}
                    loading={i < 3 ? 'eager' : 'lazy'}
                    draggable={false}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>
              {count > 1 && (
                <div className={styles.galleryControls}>
                  <span className={styles.galleryCounter}>{index + 1}/{count}</span>
                  <div className={styles.galleryProgress}>
                    <div
                      className={styles.galleryProgressBar}
                      style={{ width: `${((index + 1) / count) * 100}%` }}
                    />
                  </div>
                  <div className={styles.galleryNav}>
                    <button type="button" className={styles.galleryNavBtn} onClick={prev} aria-label="Anterior">
                      <ArrowIcon direction="left" />
                    </button>
                    <button type="button" className={styles.galleryNavBtn} onClick={next} aria-label="Próxima">
                      <ArrowIcon direction="right" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : activeTab === 'images' ? (
            <div className={styles.galleryEmpty}>
              <p>Nenhuma imagem disponível</p>
            </div>
          ) : null}

          {activeTab === 'info' && (
            <div className={styles.infoPanel}>
              {vehicle.description && (
                <div className={styles.infoPanelBlock}>
                  <h4 className={styles.infoPanelTitle}>Sobre este veículo</h4>
                  <p className={styles.infoPanelText}>{vehicle.description}</p>
                </div>
              )}
              {vehicle.specs?.engine && (
                <div className={styles.infoPanelBlock}>
                  <h4 className={styles.infoPanelTitle}>Performance</h4>
                  <dl className={styles.performanceList}>
                    <div className={styles.performanceItem}>
                      <dt>Motor</dt>
                      <dd>{vehicle.specs.engine}</dd>
                    </div>
                    {vehicle.specs.acceleration && (
                      <div className={styles.performanceItem}>
                        <dt>0 a 100 km/h</dt>
                        <dd>{vehicle.specs.acceleration}</dd>
                      </div>
                    )}
                    {vehicle.specs.topSpeed && (
                      <div className={styles.performanceItem}>
                        <dt>Velocidade máxima</dt>
                        <dd>{vehicle.specs.topSpeed}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h3 className={styles.ctaEyebrow}>Expanda seu horizonte</h3>
          <p className={styles.ctaTitle}>
            Escolha o modelo para se adequar ao seu modo de vida.
          </p>
          <p className={styles.ctaDesc}>
            A intenção da Vamaq Motors é ser a escolha automotiva mais excelente
            para seus consumidores e fazer parte das ocasiões únicas em suas vidas.
          </p>
          <Link href="/acervo" className={styles.ctaButton}>
            <span className={styles.ctaButtonInner}>
              Conhecer acervo
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </Link>
        </div>
      </section>

      {/* ===== RELATED VEHICLES ===== */}
      {related.length > 0 && (
        <section className={styles.relatedSection}>
          <div className="container">
            <div className={styles.relatedHeader}>
              <h2 className={styles.sectionTitle}>Você também pode gostar</h2>
              <Link href="/acervo" className={styles.relatedLink}>
                Ver acervo completo →
              </Link>
            </div>
            <div className={styles.relatedGrid}>
              {related.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== MOBILE CTA ===== */}
      {!isPreview && (
        <div className={styles.mobileCta}>
          <a
            href={whatsappUrl}
            className="btn btn--primary btn--lg btn--full"
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon />
            Tenho Interesse
          </a>
        </div>
      )}
    </main>
  );
}
