"use client";

/**
 * AIOrb — Mascot del asistente. Single source of truth.
 *
 * Implementación: ambient SiriOrb (Apple Intelligence vibe) — orb abstracto
 * con conic gradients animados. SIN cara humana. Decisión basada en target:
 * ejecutivos de empresas grandes / multinacionales. Un orb ambient lee como
 * infraestructura seria, no como mascot de startup.
 *
 * COLORES: usamos los tokens `--color-utility-{accent}-{300/500/700}`
 * de Design System directamente (var() refs). Beneficios:
 *   • Paleta única — mismo color que pinta el resto de la app para el
 *     mismo acento (badges, SpotlightIcons, hairlines).
 *   • Dark mode automático — UU invierte estos tokens internamente; no
 *     necesitamos un observer ni paletas duplicadas.
 *   • Si el design system cambia, el orb sigue al sistema sin tocarlo.
 *
 * ACCENT → token UU mapping (alineado con `ACCOUNT_ACCENT` en
 * `accounts-catalog.ts` y con el color picker de `create-agent-modal`):
 *   brand   → utility-brand-*       (Hellomatik purple #6938EF base)
 *   blue    → utility-blue-*        (#1570EF)
 *   violet  → utility-purple-*      (#7839EE)
 *   warm    → utility-orange-*      (#E04F16)
 *   green   → utility-success-*     (#099250)
 *   pink    → utility-pink-*        (#DD2590)
 *   indigo  → utility-indigo-*      (#444CE7)
 *   gray    → utility-neutral-*     (#535862)
 *
 * BORDE: ring sutil de 1 px usando el token -300 del acento. Más visible
 * sobre fondos claros sin ser ruidoso.
 *
 * Estados (3):
 *   • idle   → animación calmada (22 s), scale 1
 *   • hover  → animación más alerta (14 s), scale 1.08 spring overshoot
 *   • active → animación rápida "pensando" (7 s), scale 1.02
 *
 * API pública (`size`, `state`, `accent`, `className`, `seed`) intacta
 * para los 20+ consumidores. `seed` se acepta pero se ignora.
 */

import React, { use, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import SiriOrb from "./siri-orb";
import { ScopeContext } from "@/views/_shared/agent-context";
import { AppearanceContext } from "@/views/_shared/appearance-context";
import { cx } from "@/utils/cx";

export type OrbState = "idle" | "hover" | "active";

export type OrbAccent =
    | "brand"
    | "blue"
    | "violet"
    | "warm"
    | "green"
    | "pink"
    | "indigo"
    | "gray";

export interface AIOrbProps {
    size?: number;
    state?: OrbState;
    className?: string;
    /** Override manual del acento. Si no se pasa, lee el del agente activo. */
    accent?: OrbAccent;
    /** Aceptado por compatibilidad de API — ignorado (orb sin variación). */
    seed?: string;
}

// ── Mapeo accent → UU palette family ────────────────────────────────
//
// Cada acento del catálogo `AccountAccent` apunta a una de las familias
// `utility-*` de Design System. La suffix se completa con -300/-500/-700
// para los tres tonos del conic gradient + el ring.

// IMPORTANT: estos nombres deben coincidir EXACTAMENTE con los tokens
// `--color-utility-{family}-{shade}` que existen en `theme.css`. Verificado:
//   brand, blue, purple, orange, green, pink, indigo, neutral existen.
//   ⚠ "success" NO existe como utility-* (es un alias de Tailwind classes,
//     no un CSS var). Usar "green" para verdes — si se usa "success" aquí
//     el conic-gradient queda con var undefined y el orb NO se renderiza.
const ACCENT_FAMILY: Record<OrbAccent, string> = {
    brand:  "brand",
    blue:   "blue",
    violet: "purple",
    warm:   "orange",
    green:  "green",
    pink:   "pink",
    indigo: "indigo",
    gray:   "neutral",
};

interface OrbColors {
    bg: string;
    c1: string;
    c2: string;
    c3: string;
}

// Paleta Hellomatik para el orb — extrapolación directa de cómo Tailwind
// construye la familia `blue-700/500/300`: mismo hue, distintas lightness
// alrededor del tono institucional. Sin negros: cada stop tiene chroma
// suficiente para leerse claramente como verde, no como carbón.
//
//   Referencia blue (para entender la relación):
//     blue-700  oklch(48.8% 0.243 264) ── darker shade  (c1)
//     blue-500  oklch(62.3% 0.214 260) ── accent        (c2)  ← bg-brand-solid
//     blue-300  oklch(80.9% 0.105 252) ── lighter shade (c3)
//
//   Hellomatik green (mismo patrón, anclado en `#3B6B52`):
//     c1  oklch(38% 0.12 152) ── verde profundo SATURADO (no negro)
//                                lightness +10% y chroma 2× para que el
//                                "darker shade" lea como verde, no como
//                                near-black; equivalente al jump
//                                lightness/chroma de blue-700 vs blue-500.
//     c2  `#3B6B52`           ── verde institucional EXACTO (acento plataforma)
//     c3  oklch(80% 0.10 152) ── verde claro de la MISMA familia (no mint)
//
// Hue 152° = el hue de `#3B6B52` (forest green). Manteniéndolo constante
// los tres stops se sienten "del mismo color", igual que el azul.
const HELLOMATIK_ORB_PALETTE: Pick<OrbColors, "c1" | "c2" | "c3"> = {
    c1: "oklch(38% 0.12 152)",
    c2: "#3B6B52",
    c3: "oklch(80% 0.10 152)",
};

function buildColors(accent: OrbAccent, hellomatik: boolean): OrbColors {
    if (hellomatik) {
        return {
            bg: "var(--color-bg-primary)",
            ...HELLOMATIK_ORB_PALETTE,
        };
    }
    const family = ACCENT_FAMILY[accent] ?? ACCENT_FAMILY.blue;
    return {
        // bg = el fondo "neutro" del orb (recorta el centro vía mask radial).
        // Usamos `--color-bg-primary` para que coincida con la página y el orb
        // parezca "transparente" en el centro.
        bg: "var(--color-bg-primary)",
        // ⚠ Usamos `--color-{family}-{shade}` (BASE) en lugar de
        // `--color-utility-{family}-{shade}` porque la chain de las utility
        // está rota en Turbopack para orange-300 e indigo-300 (resuelven a
        // rgb(0,0,0) → conic-gradient invisible). Las base tokens funcionan
        // para todas las familias y son los mismos tonos exactos en light mode.
        c1: `var(--color-${family}-700)`,
        c2: `var(--color-${family}-500)`,
        c3: `var(--color-${family}-300)`,
    };
}

function buildRing(accent: OrbAccent, hellomatik: boolean): string {
    if (hellomatik) {
        // Ring derivado del institucional para coherencia con el chrome.
        return `color-mix(in oklch, ${HELLOMATIK_ORB_PALETTE.c2} 25%, transparent)`;
    }
    const family = ACCENT_FAMILY[accent] ?? ACCENT_FAMILY.blue;
    // Ring MUY sutil: -300 al 25 % de opacidad vía color-mix. Da definición
    // mínima al borde sin destacar (apenas perceptible sobre fondo claro).
    return `color-mix(in oklch, var(--color-${family}-300) 25%, transparent)`;
}

const FALLBACK_ACCENT: OrbAccent = "blue";

// ── State → tuning ─────────────────────────────────────────────────
//
// Decisión: NO variar duración ni scale por estado. Razones:
//   • Cuando el usuario hace click en el FAB, el state pasa (hover→idle
//     o hover→unmount→nueva orbe). Si la duración o el scale cambian, el
//     usuario percibe un salto visual desagradable.
//   • Para que la orbe del FAB y la del panel se sientan SINCRONIZADAS
//     (misma posición angular en el momento de la transición), DEBEN
//     compartir exactamente la misma duración. La sincronización fina la
//     da el `--animation-delay` calculado relativo al timeline-origin.
//
// Si necesitas distinguir "thinking" (active) visualmente, mejor añade
// elementos secundarios (typing dots, halo extra) que mover la rotación.

const STATE_DURATIONS: Record<OrbState, number> = {
    idle:   22,
    hover:  22,
    active: 22,
};

const STATE_SCALES: Record<OrbState, number> = {
    idle:   1,
    hover:  1,
    active: 1,
};

// Timeline-origin global — punto de referencia para calcular el
// animation-delay de cada orbe. Persistido en `window.__hmOrbTimelineOrigin`
// para sobrevivir HMR de Turbopack/Next (sin esto, el módulo se re-evalúa
// con HMR y cada nueva instancia usa un origen distinto → fases desincronizadas).
//
// Usamos `Date.now()` (wall-clock) en lugar de `performance.now()` porque
// performance.now() se RESETEA con cada page reload, pero el flag de window
// puede persistir → ORIGIN quedaría en una escala temporal distinta a las
// mediciones de cada mount. Date.now() es absoluto y siempre consistente.
const ORB_TIMELINE_ORIGIN: number = (() => {
    if (typeof window === "undefined") return Date.now();
    const w = window as unknown as { __hmOrbTimelineOrigin?: number };
    if (w.__hmOrbTimelineOrigin === undefined) {
        w.__hmOrbTimelineOrigin = Date.now();
    }
    return w.__hmOrbTimelineOrigin;
})();

// ── ThinkingHalo ───────────────────────────────────────────────────
//
// Anillo punteado rotante alrededor del orb cuando state === "active"
// (chat typing). Patrón visual tomado del `dot-circle` del componente
// `loading-indicator` de Design System (FREE). Funciona como capa
// independiente al SiriOrb: no afecta su sync ni su animación; comunica
// "pensando" sin tocar el orb.
//
// Diseño: dos arcos opuestos con stroke-dasharray "0.1 8" (= dashed)
// + linear-gradient (currentColor → currentColor 0.48 opacity) + spin
// 1.5s. El currentColor se hereda del padre → matchea el accent del agente.

interface ThinkingHaloProps {
    size: number;
    /** Color del trazo — viene del accent via var(--color-${family}-500). */
    color: string;
}

const ThinkingHalo: React.FC<ThinkingHaloProps> = ({ size, color }) => {
    // 2px de padding alrededor del orb para que el halo respire visualmente.
    const haloSize = size + 8;
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 36 36"
            fill="none"
            className="pointer-events-none absolute animate-spin"
            style={{
                width:        haloSize,
                height:       haloSize,
                top:          `calc(50% - ${haloSize / 2}px)`,
                left:         `calc(50% - ${haloSize / 2}px)`,
                color:        color,
                animationDuration: "1.6s",
            }}
        >
            <path
                d="M34 18C34 15.8989 33.5861 13.8183 32.7821 11.8771C31.978 9.93586 30.7994 8.17203 29.3137 6.68629C27.828 5.20055 26.0641 4.022 24.1229 3.21793C22.1817 2.41385 20.1011 2 18 2C15.8988 2 13.8183 2.41385 11.8771 3.21793C9.93585 4.022 8.17203 5.20055 6.68629 6.68629C5.20055 8.17203 4.022 9.93586 3.21793 11.8771C2.41385 13.8183 2 15.8989 2 18"
                stroke="url(#hm-halo-g1)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="0.1 6"
            />
            <path
                d="M3.21793 24.1229C4.022 26.0641 5.20055 27.828 6.68629 29.3137C8.17203 30.7994 9.93585 31.978 11.8771 32.7821C13.8183 33.5861 15.8988 34 18 34C20.1011 34 22.1817 33.5861 24.1229 32.7821C26.0641 31.978 27.828 30.7994 29.3137 29.3137C30.7994 27.828 31.978 26.0641 32.7821 24.1229"
                stroke="url(#hm-halo-g2)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="0.1 6"
            />
            <defs>
                <linearGradient id="hm-halo-g1" x1="34" y1="18" x2="2" y2="18" gradientUnits="userSpaceOnUse">
                    <stop stopColor="currentColor" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0.5" />
                </linearGradient>
                <linearGradient id="hm-halo-g2" x1="33" y1="23.5" x2="3" y2="24" gradientUnits="userSpaceOnUse">
                    <stop stopOpacity="0" stopColor="currentColor" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0.48" />
                </linearGradient>
            </defs>
        </svg>
    );
};

// ── Component ──────────────────────────────────────────────────────

export const AIOrb: React.FC<AIOrbProps> = ({
    size = 56,
    state = "idle",
    className,
    accent,
    seed: _seed,
}) => {
    void _seed;
    const scopeCtx = use(ScopeContext);
    const appearanceCtx = use(AppearanceContext);
    // Detección Hellomatik a prueba de fallos: combinamos TRES señales —
    // si CUALQUIERA dice "hellomatik", aplicamos la paleta verde. Razón:
    // cada una tiene su ventana de fallo (timing de hidratación, race con
    // el bootscript, dev-server cache), pero las tres conjuntas cubren
    // todos los casos.
    //   1. `useTheme().theme`  — fuente canónica de next-themes (puede
    //      devolver undefined durante el primer render del cliente).
    //   2. clase `.hellomatik-mode` en `<html>` — la aplica el bootscript
    //      o next-themes; la observamos con MutationObserver para que
    //      reaccione a cambios desde el modal de apariencia.
    //   3. `localStorage.theme === "hellomatik"` — última red de seguridad
    //      si el bootscript no se ha actualizado (dev cache) o falla
    //      por alguna razón. Se lee una sola vez al mount.
    const { theme } = useTheme();
    const [hasHellomatikClass, setHasHellomatikClass] = useState<boolean>(() => {
        if (typeof document === "undefined") return false;
        return document.documentElement.classList.contains("hellomatik-mode");
    });
    const [storedThemeIsHellomatik, setStoredThemeIsHellomatik] = useState(false);
    useEffect(() => {
        const html = document.documentElement;
        const update = () => setHasHellomatikClass(html.classList.contains("hellomatik-mode"));
        update();
        const observer = new MutationObserver(update);
        observer.observe(html, { attributes: true, attributeFilter: ["class"] });
        try {
            setStoredThemeIsHellomatik(window.localStorage.getItem("theme") === "hellomatik");
        } catch {
            // localStorage bloqueado (cookies off) — ignoramos esta señal.
        }
        return () => observer.disconnect();
    }, []);
    // Mounted gate: durante SSR + first client render devolvemos `false` para
    // que el HTML coincida con lo que el servidor pintó (sin hellomatik). React
    // no parchea estilos en hidratación mismatch — si dejamos que el primer
    // render del cliente devuelva `true`, el orb queda atrapado con la paleta
    // azul del SSR aunque el state cambie luego (bug confirmado en /workspace,
    // /knowledge). Activamos hellomatik solo después de useEffect → forzamos
    // un re-render post-hidratación que SÍ actualiza el DOM.
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);
    const isHellomatik =
        isMounted && (theme === "hellomatik" || hasHellomatikClass || storedThemeIsHellomatik);

    const currentAgentId = scopeCtx?.currentAgent?.id;
    const resolvedAccent: OrbAccent =
        accent
        ?? (currentAgentId ? appearanceCtx?.accentForAgent(currentAgentId) : undefined)
        ?? (scopeCtx?.currentAgent?.accent as OrbAccent | undefined)
        ?? FALLBACK_ACCENT;

    // Modo Hellomatik: paleta verde anclada en `#3B6B52` con shades cercanos
    // de la misma familia (hue 152°) — extrapolación directa de cómo el orb
    // azul usa blue-700/500/300. El accent override gana sobre el accent del
    // agente porque la elección de apariencia es una decisión de identidad
    // global, mismo principio que aplica BrandStyleSync.
    const colors   = buildColors(resolvedAccent, isHellomatik);
    const ring     = buildRing(resolvedAccent, isHellomatik);
    const duration = STATE_DURATIONS[state];
    const scale    = STATE_SCALES[state];

    // null on SSR + first client render (prevents hydration mismatch).
    // Set to the real wall-clock offset in useEffect (client-only).
    const [animationDelay, setAnimationDelay] = useState<number | null>(null);
    useEffect(() => {
        setAnimationDelay(-(Date.now() - ORB_TIMELINE_ORIGIN) / 1000);
    }, []);

    // Ring (1 px outer) + drop shadow muy suave para profundidad.
    const boxShadow = `0 0 0 1px ${ring}, 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)`;

    // Color del halo de "thinking" — usa el c2 del accent (el principal -500).
    // En modo Hellomatik, el halo también pasa por el institucional para
    // mantener coherencia con la paleta del orb.
    const family = ACCENT_FAMILY[resolvedAccent] ?? ACCENT_FAMILY.blue;
    const haloColor = isHellomatik
        ? HELLOMATIK_ORB_PALETTE.c2
        : `var(--color-${family}-500)`;

    return (
        <div
            className={cx("relative inline-block shrink-0 rounded-full", className)}
            style={{
                width:        size,
                height:       size,
                transform:    `scale(${scale})`,
                transition:   "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                willChange:   "transform",
                boxShadow,
                ...(animationDelay !== null && {
                    ["--animation-delay" as string]: `${animationDelay}s`,
                }),
            } as React.CSSProperties}
            aria-hidden="true"
        >
            <SiriOrb
                size={`${size}px`}
                colors={colors}
                animationDuration={duration}
            />
            {state === "active" && <ThinkingHalo size={size} color={haloColor} />}
        </div>
    );
};

export default AIOrb;
