/**
 * VAMAQ Motors — official logo.
 * The SVG file ships with its own background + brand gradients, so we render
 * it as a static image (no currentColor tint).
 */
export default function LogoVamaq({ className, title = 'Vamaq Motors' }) {
  return (
    <img
      src="/images/VAMAQ-LOGO.svg"
      alt={title}
      className={className}
      draggable={false}
    />
  );
}
