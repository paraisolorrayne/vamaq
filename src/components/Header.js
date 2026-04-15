'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import LogoVamaq from './LogoVamaq';
import { getWhatsAppGenericUrl } from '@/data/vehicles';
import styles from './Header.module.css';

const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/acervo', label: 'Acervo' },
  { href: '/sobre', label: 'Sobre' },
  { href: '/contato', label: 'Contato' },
];

const WHATSAPP_MESSAGE = 'Ola! Gostaria de mais informacoes sobre os veiculos da Vamaq Motors.';

function WhatsAppIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > 50);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const whatsappUrl = getWhatsAppGenericUrl(WHATSAPP_MESSAGE);

  const headerClass = [
    styles.header,
    isScrolled ? styles['header--scrolled'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hamburgerClass = [
    styles.header__hamburger,
    isMenuOpen ? styles['header__hamburger--open'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  const overlayClass = [
    styles.header__overlay,
    isMenuOpen ? styles['header__overlay--open'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={headerClass} role="banner">
      <div className={styles.header__inner}>
        {/* Logo */}
        <Link href="/" className={styles.header__logo} aria-label="Vamaq Motors - Pagina inicial">
          <LogoVamaq className={styles['header__logo-img']} />
        </Link>

        {/* Desktop nav */}
        <nav className={styles.header__nav} aria-label="Navegacao principal">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles['header__nav-link']}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <a
          href={whatsappUrl}
          className={styles.header__cta}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Fale conosco pelo WhatsApp"
        >
          <WhatsAppIcon className={styles['header__cta-icon']} />
          Fale Conosco
        </a>

        {/* Mobile hamburger */}
        <button
          className={hamburgerClass}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
        >
          <span className={styles['header__hamburger-line']} />
          <span className={styles['header__hamburger-line']} />
          <span className={styles['header__hamburger-line']} />
        </button>
      </div>

      {/* Mobile overlay */}
      <div
        id="mobile-menu"
        className={overlayClass}
        role="dialog"
        aria-modal={isMenuOpen}
        aria-label="Menu de navegacao"
      >
        <nav aria-label="Navegacao mobile">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles['header__overlay-link']}
              onClick={closeMenu}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <a
          href={whatsappUrl}
          className={styles['header__overlay-cta']}
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeMenu}
        >
          <WhatsAppIcon className={styles['header__overlay-cta-icon']} />
          Fale Conosco
        </a>
      </div>
    </header>
  );
}
