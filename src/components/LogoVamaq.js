/**
 * VAMAQ Motors — logo (monocromático, fundo transparente).
 * variant="light"  → wordmark escuro, para fundos CLAROS (padrão)
 * variant="dark"   → wordmark branco, para fundos ESCUROS
 */
export default function LogoVamaq({ className, variant = 'light', title = 'Vamaq Motors' }) {
  const src =
    variant === 'dark'
      ? '/images/vamaq-logo-on-dark.svg'
      : '/images/vamaq-logo-on-light.svg';
  return (
    <img src={src} alt={title} className={className} draggable={false} />
  );
}
