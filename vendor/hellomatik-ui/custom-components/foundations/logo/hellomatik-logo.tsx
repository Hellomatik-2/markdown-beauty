/**
 * Logos de Hellomatik.
 *
 *   · `HellomatikLogo` — wordmark tipográfico (Inter). Para login,
 *     signup, emails, etc. donde aparece el nombre completo.
 *   · `HellomatikMark`  — isotipo "hi" cuadrado en SVG block-geométrico.
 *     Para el rail del panel, favicon, avatares de canal, lockups
 *     compactos.
 *
 * Por qué dos lenguajes (tipografía + isotipo custom): mismo patrón que
 * Stripe, Linear, Vercel, OpenAI — el isotipo es la firma única y
 * memorable de la marca; el wordmark se apoya en una buena tipografía
 * (en nuestro caso Inter, que ya carga el sistema) para mantener
 * legibilidad y elegancia profesional sin reinventar cada letra.
 */

interface LogoProps {
    className?: string;
}

// ─────────────────────────────────────────────────────────────────────
// HellomatikLogo — wordmark tipográfico (Inter).
//
// "hellomatik" en una sola palabra, todo en minúsculas. El color sigue
// `currentColor` (text-primary del padre).
// ─────────────────────────────────────────────────────────────────────

export const HellomatikLogo = ({ className = "text-display-xs" }: LogoProps) => (
    <span
        className={`inline-flex items-center whitespace-nowrap font-inter font-medium tracking-tight leading-none ${className}`}
        aria-label="Hellomatik"
        role="img"
    >
        hellomatik
    </span>
);

// ─────────────────────────────────────────────────────────────────────
// HellomatikMark — isotipo "hi" cuadrado en SVG block-geométrico.
//
// 5 piezas sólidas que dibujan una h y una i:
//   h: poste izquierdo (altura plena) + hombro recto + pata derecha (½).
//   i: tittle redondo + stem.
//
// Diseñado por nosotros (no es preset de la base). Color via `currentColor`
// para que invierta en dark mode sin tocar el SVG.
//
// Por qué "hi": rima con "hellomatik" (empieza por hi) y con la
// naturaleza conversacional del producto. Es una firma de marca, no una
// abreviación tipográfica.
// ─────────────────────────────────────────────────────────────────────

export const HellomatikMark = ({ className = "size-5" }: LogoProps) => (
    <svg
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        fill="currentColor"
        aria-label="Hellomatik"
        role="img"
    >
        {/* h — poste izquierdo, altura plena */}
        <rect x="4"  y="6"  width="8"  height="36" rx="2" />
        {/* h — hombro que une el poste izquierdo con la pata derecha */}
        <rect x="8"  y="18" width="14" height="6" />
        {/* h — pata derecha, mitad inferior */}
        <rect x="18" y="18" width="8"  height="24" rx="2" />
        {/* i — tittle (punto) redondo */}
        <rect x="32" y="6"  width="8"  height="8"  rx="4" />
        {/* i — stem */}
        <rect x="32" y="18" width="8"  height="24" rx="2" />
    </svg>
);
