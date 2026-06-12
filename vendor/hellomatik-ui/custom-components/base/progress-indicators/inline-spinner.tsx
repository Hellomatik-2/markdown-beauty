"use client";

import type { SVGProps } from "react";
import { cx } from "@/utils/cx";

/**
 * InlineSpinner — micro-spinner para indicadores de progreso inline
 * (badges, status pills, autosave). Mirrora exactamente el SVG que
 * usa `Button` cuando `isLoading={true}` (viewBox 20×20, dos círculos
 * con `stroke-current`, `animate-spin`).
 *
 * Por qué existe:
 *
 *  · El `LoadingIndicator` de la base (line-simple / line-spinner /
 *    dot-circle) tiene tamaño mínimo `size-8` (32px) — pensado para
 *    estados de carga full-section, no para chips de 24px de alto.
 *
 *  · El patrón canónico de la base para spinners pequeños vive embebido
 *    en `Button`. Extraerlo aquí permite reutilizarlo en autosave
 *    badges (Notion / Google Docs style) sin hand-rollear `<svg>`
 *    en el consumer.
 *
 *  · Hereda color via `stroke-current` → toma el `text-*` del padre
 *    sin props extra. Funciona dentro de cualquier Badge UU.
 */

const SIZE_CLASS = {
    xs: "size-3",
    sm: "size-3.5",
    md: "size-4",
} as const;

interface InlineSpinnerProps extends Omit<SVGProps<SVGSVGElement>, "viewBox"> {
    size?: keyof typeof SIZE_CLASS;
}

export const InlineSpinner = ({ size = "sm", className, ...props }: InlineSpinnerProps) => (
    <svg
        aria-hidden="true"
        fill="none"
        viewBox="0 0 20 20"
        className={cx(SIZE_CLASS[size], className)}
        {...props}
    >
        {/* Background circle — opacidad reducida (track) */}
        <circle className="stroke-current opacity-30" cx="10" cy="10" r="8" fill="none" strokeWidth="2" />
        {/* Arc giratorio — mismo dash que UU Button */}
        <circle
            className="origin-center animate-spin stroke-current"
            cx="10"
            cy="10"
            r="8"
            fill="none"
            strokeWidth="2"
            strokeDasharray="12.5 50"
            strokeLinecap="round"
        />
    </svg>
);
