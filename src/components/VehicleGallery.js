'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './VehicleGallery.module.css';

/**
 * Vehicle image gallery with dynamic image count.
 *
 * Props:
 *  - images: string[] — ordered list of image URLs. Any length (0, 1, many).
 *  - alt:    string   — base alt text (index is appended).
 *  - badge:  ReactNode — optional badge overlaid on the main image.
 */
export default function VehicleGallery({ images = [], alt = 'Veículo', badge = null }) {
  const safeImages = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const count = safeImages.length;
  const hasImages = count > 0;
  const isCarousel = count > 1;

  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbsRef = useRef(null);

  const goTo = useCallback(
    (next) => {
      if (!isCarousel) return;
      setIndex(((next % count) + count) % count);
    },
    [count, isCarousel]
  );

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  /* Keyboard navigation in lightbox */
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lightboxOpen, prev, next]);

  /* Lock body scroll when lightbox is open */
  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen]);

  /* Keep the active thumbnail visible in the strip */
  useEffect(() => {
    const strip = thumbsRef.current;
    if (!strip) return;
    const active = strip.children[index];
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [index]);

  return (
    <div className={styles.gallery}>
      {/* Main stage */}
      <div className={styles.stage}>
        {hasImages ? (
          <button
            type="button"
            className={styles.mainButton}
            onClick={() => setLightboxOpen(true)}
            aria-label="Abrir imagem em tela cheia"
          >
            <img
              src={safeImages[index]}
              alt={`${alt} — foto ${index + 1} de ${count}`}
              className={styles.mainImage}
              loading="eager"
              draggable={false}
            />
          </button>
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className={styles.placeholderText}>Fotos em breve</span>
          </div>
        )}

        {badge && <span className={styles.badge}>{badge}</span>}

        {isCarousel && (
          <>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navBtnPrev}`}
              onClick={prev}
              aria-label="Imagem anterior"
            >
              <ArrowIcon direction="left" />
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navBtnNext}`}
              onClick={next}
              aria-label="Próxima imagem"
            >
              <ArrowIcon direction="right" />
            </button>

            <div className={styles.counter} aria-live="polite">
              <span className={styles.counterCurrent}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={styles.counterSep}> / </span>
              <span className={styles.counterTotal}>
                {String(count).padStart(2, '0')}
              </span>
            </div>
          </>
        )}

        {hasImages && (
          <button
            type="button"
            className={styles.expandBtn}
            onClick={() => setLightboxOpen(true)}
            aria-label="Ampliar imagem"
          >
            <ExpandIcon />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {isCarousel && (
        <div className={styles.thumbs} ref={thumbsRef} role="tablist" aria-label="Miniaturas">
          {safeImages.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Ver foto ${i + 1}`}
              className={`${styles.thumb} ${i === index ? styles.thumbActive : ''}`}
              onClick={() => goTo(i)}
            >
              <img
                src={src}
                alt=""
                className={styles.thumbImage}
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && hasImages && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Galeria de fotos em tela cheia"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
            aria-label="Fechar galeria"
          >
            &times;
          </button>

          {isCarousel && (
            <div className={styles.lightboxCounter}>
              {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
            </div>
          )}

          <img
            src={safeImages[index]}
            alt={`${alt} — foto ${index + 1} de ${count}`}
            className={styles.lightboxImage}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />

          {isCarousel && (
            <>
              <button
                type="button"
                className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Imagem anterior"
              >
                <ArrowIcon direction="left" />
              </button>
              <button
                type="button"
                className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Próxima imagem"
              >
                <ArrowIcon direction="right" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ArrowIcon({ direction = 'right' }) {
  const isLeft = direction === 'left';
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {isLeft ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
