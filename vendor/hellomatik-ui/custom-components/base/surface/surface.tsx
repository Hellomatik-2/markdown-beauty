"use client";

/**
 * Surface — primitivo de superficie levantada (UU-style).
 *
 *   ┌─ Surface tone="default" padding="md" radius="md" ───────┐
 *   │  rounded-xl border border-secondary bg-primary_alt p-4  │
 *   │                                                         │
 *   │  children                                               │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Reemplaza el patrón inline `<div className="rounded-xl border
 * border-secondary bg-primary_alt p-4">` que apareció 30+ veces en la
 * app — esto ES exactamente el caso "extraer primitivo, no inline" de
 * la memoria del usuario (`feedback_uu_extract_primitive_over_inline`).
 *
 * Apple HIG · Depth: las superficies elevan contenido con un borde
 * fino, no con sombras llamativas. Token de borde `border-secondary`.
 *
 * Convención de imports:
 *
 *   import { Surface } from "@/components/base/surface/surface";
 *
 *   <Surface tone="muted" padding="lg" radius="md">
 *     ...
 *   </Surface>
 */

import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/utils/cx";

type SurfaceTone = "default" | "muted" | "subtle";
type SurfacePadding = "none" | "sm" | "md" | "lg" | "xl";
type SurfaceRadius = "sm" | "md" | "lg";

export interface SurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    /** Background tone.
     *  - "default": `bg-primary_alt` (sección destacada — patrón canónico).
     *  - "muted":   `bg-secondary` (sección apagada — útil en skeletons o
     *               agrupar info menos relevante).
     *  - "subtle":  `bg-primary` (sin contraste extra — sólo el borde
     *               delimita; usar para info callouts dentro de cards
     *               existentes). */
    tone?: SurfaceTone;
    /** Inner padding scale. Default `md` (p-4). */
    padding?: SurfacePadding;
    /** Border radius. Default `md` (rounded-xl). */
    radius?: SurfaceRadius;
    /** Si true, no se aplica `border`. Útil cuando la Surface vive dentro
     *  de otra Surface y el doble borde es ruido. */
    borderless?: boolean;
    children?: ReactNode;
}

const TONE_BG: Record<SurfaceTone, string> = {
    default: "bg-primary_alt",
    muted:   "bg-secondary",
    subtle:  "bg-primary",
};

const PADDING: Record<SurfacePadding, string> = {
    none: "",
    sm:   "p-3",
    md:   "p-4",
    lg:   "p-5",
    xl:   "p-6",
};

const RADIUS: Record<SurfaceRadius, string> = {
    sm: "rounded-lg",
    md: "rounded-xl",
    lg: "rounded-2xl",
};

export function Surface({
    tone = "default",
    padding = "md",
    radius = "md",
    borderless = false,
    className,
    children,
    ...rest
}: SurfaceProps) {
    return (
        <div
            className={cx(
                !borderless && "border border-secondary",
                TONE_BG[tone],
                PADDING[padding],
                RADIUS[radius],
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    );
}
