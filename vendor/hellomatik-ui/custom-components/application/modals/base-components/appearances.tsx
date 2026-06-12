/**
 * Mini-tarjetas de preview para el selector de tema (claro · oscuro · sistema).
 * Cada una pinta una maqueta abstracta del dashboard con los tokens del modo.
 *
 *   ┌────────────────────┐
 *   │ ░░░ │  ▔▔▔▔▔▔▔▔▔   │
 *   │ ░░░ │  ▁▁▁▁  ▁▁▁   │
 *   │ ░░░ │  ▔▔   ▔▔▔▔   │
 *   └────────────────────┘
 *
 * El modo "Sistema" parte el cuadro en diagonal entre claro y oscuro para
 * indicar que sigue la preferencia del sistema.
 */

import type { SVGProps } from "react";
import { cx } from "@/utils/cx";

interface AppearanceCardProps extends SVGProps<SVGSVGElement> {
    className?: string;
}

/* 124×80 — los 4 previews caben en una sola fila del
    AppearanceSettingsModal (max-w-172 ≈ 688 px, área útil ≈ 600 px tras
    padding). Con W=156 anterior la cuarta tarjeta se cortaba a la
    derecha. Ratio 1.56 se mantiene para no deformar las maquetas. */
const W = 124;
const H = 80;

/* ── LIGHT ─────────────────────────────────────────────────────────────── */
export const Light = ({ className, ...props }: AppearanceCardProps) => (
    <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        xmlns="http://www.w3.org/2000/svg"
        className={cx("block", className)}
        {...props}
    >
        <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="9.5" fill="#FAFAFA" stroke="#E4E4E7" />
        {/* sidebar */}
        <rect x="8" y="8" width="36" height={H - 16} rx="6" fill="#F4F4F5" />
        <rect x="14" y="14" width="24" height="3" rx="1.5" fill="#D4D4D8" />
        <rect x="14" y="22" width="20" height="3" rx="1.5" fill="#E4E4E7" />
        <rect x="14" y="30" width="22" height="3" rx="1.5" fill="#E4E4E7" />
        <rect x="14" y="38" width="18" height="3" rx="1.5" fill="#E4E4E7" />
        {/* main area */}
        <rect x="52" y="12" width="44" height="4" rx="2" fill="#27272A" />
        <rect x="52" y="22" width="80" height="3" rx="1.5" fill="#A1A1AA" />
        <rect x="52" y="30" width="64" height="3" rx="1.5" fill="#A1A1AA" />
        {/* cards */}
        <rect x="52" y="42" width={W - 60} height="20" rx="4" fill="#FFFFFF" stroke="#E4E4E7" />
        <rect x="52" y="68" width={W - 60} height="20" rx="4" fill="#FFFFFF" stroke="#E4E4E7" />
    </svg>
);

/* ── DARK ──────────────────────────────────────────────────────────────── */
export const Dark = ({ className, ...props }: AppearanceCardProps) => (
    <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        xmlns="http://www.w3.org/2000/svg"
        className={cx("block", className)}
        {...props}
    >
        <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="9.5" fill="#0A0A0A" stroke="#27272A" />
        <rect x="8" y="8" width="36" height={H - 16} rx="6" fill="#18181B" />
        <rect x="14" y="14" width="24" height="3" rx="1.5" fill="#52525B" />
        <rect x="14" y="22" width="20" height="3" rx="1.5" fill="#27272A" />
        <rect x="14" y="30" width="22" height="3" rx="1.5" fill="#27272A" />
        <rect x="14" y="38" width="18" height="3" rx="1.5" fill="#27272A" />
        <rect x="52" y="12" width="44" height="4" rx="2" fill="#FAFAFA" />
        <rect x="52" y="22" width="80" height="3" rx="1.5" fill="#52525B" />
        <rect x="52" y="30" width="64" height="3" rx="1.5" fill="#52525B" />
        <rect x="52" y="42" width={W - 60} height="20" rx="4" fill="#18181B" stroke="#27272A" />
        <rect x="52" y="68" width={W - 60} height="20" rx="4" fill="#18181B" stroke="#27272A" />
    </svg>
);

/* ── SYSTEM (split diagonal) ───────────────────────────────────────────── */
export const System = ({ className, ...props }: AppearanceCardProps) => (
    <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        xmlns="http://www.w3.org/2000/svg"
        className={cx("block", className)}
        {...props}
    >
        <defs>
            {/* Mitad clara abajo, oscura arriba — separadas por línea diagonal. */}
            <clipPath id="appearance-light-half">
                <polygon points={`0,0 ${W},0 0,${H}`} />
            </clipPath>
            <clipPath id="appearance-dark-half">
                <polygon points={`${W},0 ${W},${H} 0,${H}`} />
            </clipPath>
        </defs>

        {/* base bordes redondeados — pinta la mitad clara */}
        <g clipPath="url(#appearance-light-half)">
            <rect x="0" y="0" width={W} height={H} rx="10" fill="#FAFAFA" />
            <rect x="8" y="8" width="36" height={H - 16} rx="6" fill="#F4F4F5" />
            <rect x="14" y="14" width="24" height="3" rx="1.5" fill="#D4D4D8" />
            <rect x="14" y="22" width="20" height="3" rx="1.5" fill="#E4E4E7" />
            <rect x="14" y="30" width="22" height="3" rx="1.5" fill="#E4E4E7" />
            <rect x="14" y="38" width="18" height="3" rx="1.5" fill="#E4E4E7" />
            <rect x="52" y="12" width="44" height="4" rx="2" fill="#27272A" />
            <rect x="52" y="22" width="80" height="3" rx="1.5" fill="#A1A1AA" />
            <rect x="52" y="30" width="64" height="3" rx="1.5" fill="#A1A1AA" />
            <rect x="52" y="42" width={W - 60} height="20" rx="4" fill="#FFFFFF" stroke="#E4E4E7" />
            <rect x="52" y="68" width={W - 60} height="20" rx="4" fill="#FFFFFF" stroke="#E4E4E7" />
        </g>

        {/* mitad oscura */}
        <g clipPath="url(#appearance-dark-half)">
            <rect x="0" y="0" width={W} height={H} rx="10" fill="#0A0A0A" />
            <rect x="8" y="8" width="36" height={H - 16} rx="6" fill="#18181B" />
            <rect x="14" y="14" width="24" height="3" rx="1.5" fill="#52525B" />
            <rect x="14" y="22" width="20" height="3" rx="1.5" fill="#27272A" />
            <rect x="14" y="30" width="22" height="3" rx="1.5" fill="#27272A" />
            <rect x="14" y="38" width="18" height="3" rx="1.5" fill="#27272A" />
            <rect x="52" y="12" width="44" height="4" rx="2" fill="#FAFAFA" />
            <rect x="52" y="22" width="80" height="3" rx="1.5" fill="#52525B" />
            <rect x="52" y="30" width="64" height="3" rx="1.5" fill="#52525B" />
            <rect x="52" y="42" width={W - 60} height="20" rx="4" fill="#18181B" stroke="#27272A" />
            <rect x="52" y="68" width={W - 60} height="20" rx="4" fill="#18181B" stroke="#27272A" />
        </g>

        {/* línea diagonal separadora */}
        <line x1={W} y1="0" x2="0" y2={H} stroke="#A1A1AA" strokeWidth="0.75" />
        {/* borde general redondeado */}
        <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="9.5" fill="none" stroke="#A1A1AA" />
    </svg>
);

/* ── HELLOMATIK (crema cálido + verde institucional) ──────────────────────
 * Replica el wireframe de Light pero con la paleta extraída 1:1 de la
 * plataforma original: background crema, texto marrón cálido, hairline
 * tierra sequoia, brand verde #3B6B52 visible en el sidebar.
 * ─────────────────────────────────────────────────────────────────────── */
export const Hellomatik = ({ className, ...props }: AppearanceCardProps) => (
    <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        xmlns="http://www.w3.org/2000/svg"
        className={cx("block", className)}
        {...props}
    >
        <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="9.5" fill="#FAF8F2" stroke="#E8E2D4" />
        {/* sidebar — crema más cálido */}
        <rect x="8" y="8" width="36" height={H - 16} rx="6" fill="#F1ECDF" />
        {/* item activo del sidebar — pintado en verde HM #3B6B52 */}
        <rect x="11" y="11" width="30" height="8" rx="2" fill="#3B6B52" />
        <rect x="14" y="14" width="22" height="2" rx="1" fill="#E5EFE8" />
        <rect x="14" y="22" width="20" height="3" rx="1.5" fill="#CDC5B0" />
        <rect x="14" y="30" width="22" height="3" rx="1.5" fill="#D9D2BC" />
        <rect x="14" y="38" width="18" height="3" rx="1.5" fill="#D9D2BC" />
        {/* main area — título marrón cálido */}
        <rect x="52" y="12" width="44" height="4" rx="2" fill="#3D2F22" />
        <rect x="52" y="22" width="80" height="3" rx="1.5" fill="#8C7B68" />
        <rect x="52" y="30" width="64" height="3" rx="1.5" fill="#8C7B68" />
        {/* cards */}
        <rect x="52" y="42" width={W - 60} height="20" rx="4" fill="#FCFAF4" stroke="#E8E2D4" />
        <rect x="52" y="68" width={W - 60} height="20" rx="4" fill="#FCFAF4" stroke="#E8E2D4" />
        {/* botón brand verde en card */}
        <rect x="120" y="46" width="14" height="4" rx="2" fill="#3B6B52" />
    </svg>
);
