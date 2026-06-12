"use client";

import React from "react";
import { cx } from "@/utils/cx";

/**
 * ActionCard — tarjeta-botón grande (h-20) que vive en las "actions"
 * arriba de cada vista (knowledge, workflows, etc.). NO es un Button UU
 * estándar (el ratio es vertical, icono pequeño arriba + label abajo),
 * pero replica TODOS los detalles canónicos de Button UU para que se
 * sienta nativo en el ecosistema:
 *
 *   · `cursor-pointer outline-brand transition duration-100 ease-linear`
 *     — timing y outline tokens de la base.
 *   · `before:absolute` + `before:inset-px` skeuomorphic inner border
 *     (en variant `primary`) — el "toque" táctil de la base.
 *   · `shadow-xs-skeuomorphic ring-1 ring-primary ring-inset` (en
 *     variant `secondary`) — la elevación + borde-anillo característico
 *     de los Button UU secondary. Es la diferencia visual más distintiva
 *     entre "botón random" y "botón UU".
 *   · `*:data-icon:size-4 *:data-icon:shrink-0 *:data-icon:transition-inherit-all`
 *     — los iconos hijos heredan estilos consistentes vía atributo
 *     `data-icon`, igual que en Button UU (permite override desde el
 *     padre sin tocar el componente icono).
 *   · `group` en root + `hover:*:data-icon:text-fg-quaternary_hover`
 *     — el icono reacciona al hover del padre con un cambio sutil
 *     (mismo patrón que Button UU).
 *   · `hover:bg-primary_hover hover:text-secondary_hover` (variant
 *     `secondary`) — hover sutil, NO `hover:bg-tertiary` (que era un
 *     salto de color más fuerte).
 *   · `disabled:cursor-not-allowed disabled:opacity-50`.
 */

export interface ActionCardProps {
    icon: React.FC<{ className?: string }>;
    label: string;
    onClick?: () => void;
    variant?: "primary" | "secondary" | "brand";
    /** Desactiva el botón con styling canónico de la base
     *  (cursor not-allowed + opacity 50). */
    disabled?: boolean;
}

export const ActionCard = ({ icon: Icon, label, onClick, variant = "secondary", disabled = false }: ActionCardProps) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cx(
            // Base — todos los Button UU comparten estas clases (line 13
            // de button.tsx): `group` para reactividad de hijos, `relative`
            // para el `before:absolute` skeuomorphic, timing UU, outline
            // canónico, disabled state, y `*:data-icon:` patterns para
            // que los iconos hijos hereden estilos sin hardcodear.
            "group relative flex h-20 min-w-48 basis-44 flex-col items-start justify-between whitespace-nowrap rounded-2xl p-4 pb-3 text-sm font-medium",
            "cursor-pointer outline-brand transition duration-100 ease-linear before:absolute focus-visible:outline-2 focus-visible:outline-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "*:data-icon:pointer-events-none *:data-icon:size-4 *:data-icon:shrink-0 *:data-icon:transition-inherit-all",
            // ── Variant secondary — base canónica Button UU + ajustes
            //   para tamaño card (80px de alto, no 32-44px del button).
            //   En cards grandes el label ES el contenido principal, no
            //   secundario → `text-primary` (no `text-secondary`). El icon
            //   sube a `text-fg-tertiary` (~50% opacity, no quaternary
            //   ~30%) para no quedar fantasma en el área amplia. Resto
            //   idéntico a Button UU: bg + shadow + ring inset.
            variant === "secondary" && [
                "bg-primary text-primary shadow-xs-skeuomorphic ring-1 ring-primary ring-inset",
                "hover:bg-primary_hover",
                "*:data-icon:text-fg-tertiary hover:*:data-icon:text-fg-tertiary_hover",
            ],
            // ── Variant primary — Button UU primary canónico con before:
            //   skeuomorphic border interno.
            variant === "primary" && [
                "bg-brand-solid text-white shadow-xs-skeuomorphic ring-1 ring-transparent ring-inset hover:bg-brand-solid_hover",
                "before:inset-px before:rounded-[15px] before:border before:border-white/12 before:mask-b-from-0%",
                "*:data-icon:text-white/60 hover:*:data-icon:text-white/70",
            ],
            // ── Variant brand — ring brand visible, fondo sutil. Mantiene
            //   identidad propia (no es un secondary disfrazado).
            variant === "brand" && [
                "bg-secondary text-brand-secondary shadow-xs-skeuomorphic ring-1 ring-brand ring-inset",
                "hover:bg-primary_hover",
                "*:data-icon:text-fg-brand-secondary hover:*:data-icon:text-fg-brand-secondary_hover",
            ],
        )}
    >
        {/* Icono — sin className: hereda size/color via `*:data-icon:`
            del padre. data-icon es el attribute que UU usa internamente
            para que el padre controle estilos de sus iconos hijos. */}
        <Icon data-icon="" aria-hidden="true" />
        {label}
    </button>
);
