/**
 * Logos de Hellomatik — sistema Paul Rand.
 *
 *   · `HellomatikSymbol` — annulus (círculo con núcleo transparente
 *     recortado) en brand green #3B6B52. Es el símbolo nuclear de la
 *     marca y el AIOrb en su estado más quieto. Cuando el agente vive,
 *     este mismo círculo se anima (ver `components/foundations/ai-orb/`).
 *     Para favicon, app icon, social avatar, lockups compactos, indicador
 *     de presencia.
 *
 *   · `HellomatikLogo` — wordmark oficial (letterforms diseñadas en SVG)
 *     con el dot sobre la 'i' en brand green. Para login, signup, emails,
 *     sidebar footer, header — donde aparece el nombre completo.
 *
 *   · `HellomatikMark` — isotipo "hi" cuadrado (legacy). Deprecated en
 *     favor de `HellomatikSymbol`. Mantener por compatibilidad mientras
 *     se migran sus 6 usos.
 *
 * Color brand canónico: #3B6B52 (verde profundo, naturaleza, único en
 * el segmento AI saturado de azules). Razones de no-azul documentadas
 * en BRAND_BOOKLET.md.
 */

interface LogoProps {
    className?: string;
}

// ─────────────────────────────────────────────────────────────────────
// HellomatikSymbol — annulus brand green.
//
// Forma única + universal + atemporal. Pasa los 7 tests Paul Rand.
// El núcleo es transparente real (fill-rule evenodd) — toma el color
// del fondo en cualquier superficie sin necesidad de variantes.
//
// Convención de tamaño: el SVG es 1:1 (viewBox 48×48). Usar Tailwind
// `size-*` o `h-* w-*`:
//   `size-4`   → 16px (favicon, inline indicator)
//   `size-5`   → 20px (sidebar footer compacto)
//   `size-6`   → 24px (header, breadcrumbs)
//   `size-8`   → 32px (default — onboarding, hero medium)
//   `size-12`  → 48px (auth pages, splash)
//   `size-16+` → 64px+ (onboarding splash grande)
// ─────────────────────────────────────────────────────────────────────

export const HellomatikSymbol = ({ className = "size-8" }: LogoProps) => (
    <svg
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Hellomatik"
        role="img"
    >
        {/* Annulus: círculo exterior + núcleo recortado.
            fill-rule="evenodd" hace que el núcleo sea transparente real,
            mostrando el color del fondo (no blanco). */}
        <path
            fill="#3B6B52"
            fillRule="evenodd"
            d="M24 4a20 20 0 1 0 0 40 20 20 0 0 0 0-40zm0 15a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"
        />
    </svg>
);

// ─────────────────────────────────────────────────────────────────────
// HellomatikLogo — wordmark oficial.
//
// Renderiza "Hellomatik" en Hedvig Letters Serif (cargada via next/font
// como var `--font-hedvig`). Sin custom dot — el dot estándar de Hedvig
// sobre la 'i' es parte del diseño tipográfico oficial.
//
// Tamaño: usar Tailwind `text-*`. Default `text-3xl` ≈ 30px (para login).
// ─────────────────────────────────────────────────────────────────────

export const HellomatikLogo = ({ className = "text-3xl" }: LogoProps) => (
    <span
        className={`inline-block whitespace-nowrap leading-none tracking-tight ${className}`}
        style={{
            fontFamily: 'var(--font-hedvig), Georgia, "Times New Roman", serif',
        }}
        aria-label="Hellomatik"
        role="img"
    >
        Hellomatik
    </span>
);

// ─────────────────────────────────────────────────────────────────────
// HellomatikInitial — la 'H' sola en Hedvig.
//
// Para usos compactos donde el wordmark completo NO cabe:
//   · Sidebar rail (36-44px wide)
//   · Modales / cards cuadradas
//   · Favicons inline / app icons pequeños
//
// Es la misma tipografía Hedvig que el wordmark — preserva el lenguaje
// serif coherente sin ocupar el espacio horizontal de "Hellomatik".
// ─────────────────────────────────────────────────────────────────────

export const HellomatikInitial = ({ className = "text-2xl" }: LogoProps) => (
    <span
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{
            fontFamily: 'var(--font-hedvig), Georgia, "Times New Roman", serif',
        }}
        aria-label="Hellomatik"
        role="img"
    >
        H
    </span>
);

// ─────────────────────────────────────────────────────────────────────
// HellomatikMark — isotipo "hi" cuadrado en SVG block-geométrico.
//
// 5 piezas sólidas que dibujan una h y una i:
//   h: poste izquierdo (altura plena) + hombro recto + pata derecha (½).
//   i: tittle redondo + stem.
//
// Diseñado por nosotros (no es preset de UU). Color via `currentColor`
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
