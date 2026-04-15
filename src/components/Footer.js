'use client';

import Link from 'next/link';
import LogoVamaq from './LogoVamaq';
import { getWhatsAppGenericUrl } from '@/data/vehicles';
import styles from './Footer.module.css';

const QUICK_LINKS = [
  { href: '/acervo', label: 'Acervo' },
  { href: '/sobre', label: 'Sobre' },
  { href: '/contato', label: 'Contato' },
];

const WHATSAPP_URL = getWhatsAppGenericUrl(
  'Ola! Gostaria de mais informacoes sobre os veiculos da Vamaq Motors.'
);

function InstagramIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function YouTubeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function WhatsAppIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function MapPinIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PhoneIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function MailIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}

function ClockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.footer__inner}>
        <div className={styles.footer__grid}>
          {/* Column 1: Brand */}
          <div>
            <Link href="/" className={styles['footer__brand-logo']} aria-label="Vamaq Motors">
              <LogoVamaq className={styles['footer__brand-logo-img']} />
            </Link>
            <p className={styles['footer__brand-desc']}>
              Boutique automotiva especializada em veiculos premium, esportivos e superesportivos. Curadoria rigorosa e procedencia garantida.
            </p>
            <div className={styles.footer__socials}>
              <a
                href="https://instagram.com/vamaqmotors"
                className={styles['footer__social-link']}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram da Vamaq Motors"
              >
                <InstagramIcon className={styles['footer__social-icon']} />
              </a>
              <a
                href="https://youtube.com/@vamaqmotors"
                className={styles['footer__social-link']}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube da Vamaq Motors"
              >
                <YouTubeIcon className={styles['footer__social-icon']} />
              </a>
              <a
                href={WHATSAPP_URL}
                className={styles['footer__social-link']}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp da Vamaq Motors"
              >
                <WhatsAppIcon className={styles['footer__social-icon']} />
              </a>
            </div>
          </div>

          {/* Column 2: Quick links */}
          <div>
            <h3 className={styles.footer__heading}>Links Rapidos</h3>
            <nav className={styles.footer__links} aria-label="Links do rodape">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={styles.footer__link}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Column 3: Contact info */}
          <div>
            <h3 className={styles.footer__heading}>Contato</h3>
            <div className={styles['footer__contact-list']}>
              <div className={styles['footer__contact-item']}>
                <MapPinIcon className={styles['footer__contact-icon']} />
                <span>Av. Europa, 158 — Jardim Europa, Sao Paulo - SP</span>
              </div>
              <div className={styles['footer__contact-item']}>
                <PhoneIcon className={styles['footer__contact-icon']} />
                <span>(11) 99999-9999</span>
              </div>
              <div className={styles['footer__contact-item']}>
                <MailIcon className={styles['footer__contact-icon']} />
                <span>contato@vamaqmotors.com.br</span>
              </div>
              <div className={styles['footer__contact-item']}>
                <ClockIcon className={styles['footer__contact-icon']} />
                <span>Seg a Sex: 9h - 18h<br />Sab: 9h - 14h</span>
              </div>
            </div>
          </div>

          {/* Column 4: Newsletter */}
          <div>
            <h3 className={styles.footer__heading}>Newsletter</h3>
            <p className={styles['footer__newsletter-text']}>
              Receba novidades sobre os veiculos que chegam ao nosso acervo.
            </p>
            <form
              className={styles['footer__newsletter-form']}
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                className={styles['footer__newsletter-input']}
                placeholder="Seu melhor e-mail"
                aria-label="Endereco de e-mail para newsletter"
                required
              />
              <button type="submit" className={styles['footer__newsletter-btn']}>
                Inscrever
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className={styles.footer__bottom}>
        <div className={styles['footer__bottom-inner']}>
          <p className={styles.footer__copyright}>
            &copy; 2026 Vamaq Motors. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
