"use client";

import { ColorSwatchPicker as AriaColorSwatchPicker, parseColor } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { PALETTE_COLORS } from "@/data/colors";
import { cx } from "@/utils/cx";
import { SwatchItem } from "./color-picker";

// ── Paletas predefinidas ────────────────────────────────────────────────────
//
// `BRAND_COLORS` es el default que usa `BrandSwatches` cuando el caller no
// pasa una paleta propia. Apunta a la paleta canónica del sistema
// (`PALETTE_COLORS` en `data/colors.ts`) para que todos los pickers del
// mockup compartan los mismos hex `-700` (regla UU del PDF).

export const BRAND_COLORS = PALETTE_COLORS.map((c) => c.fg) as readonly string[];

export const SAVED_GRADIENTS = [
    "linear-gradient(180deg, #a5c0ee 0%, #fbc5ec 100%)",
    "linear-gradient(180deg, #fbc2eb 0%, #a18cd1 100%)",
    "linear-gradient(180deg, #ffd1ff 0%, #fad0c4 100%)",
    "linear-gradient(225deg, #fad0c4 0%, #ff9a9e 100%)",
    "linear-gradient(180deg, #fecfef 0%, #ff989c 100%)",
    "linear-gradient(135deg, #fad0c4 0%, #f1a7f1 50%, #c4a0e8 100%)",
    "linear-gradient(180deg, #e6dee9 0%, #fdcaf1 100%)",
    "linear-gradient(135deg, #d4c1ad 0%, #c7a4b6 50%, #b0a0cb 100%)",
    "linear-gradient(0deg, #cfc7f8 0%, #ebbba7 100%)",
] as const;

// ── Props ───────────────────────────────────────────────────────────────────

export interface BrandSwatchesProps {
    /** Hex actualmente seleccionado. */
    value?: string;
    /** Callback al seleccionar un color. */
    onChange: (hex: string) => void;
    /** Colores de la paleta. Default: BRAND_COLORS. */
    colors?: readonly string[];
    /**
     * Modo inline — solo muestra la rejilla de swatches, sin card wrapper ni
     * header. Úsalo al embeber dentro de formularios o modales.
     * Default: false (panel flotante con sombra).
     */
    inline?: boolean;
    /** aria-label para el picker (requerido en modo inline para a11y). */
    label?: string;
    /** Texto del enlace "Quitar color". Solo visible cuando hay `value` y se pasa este prop. */
    onClear?: () => void;
    /** Texto del "Quitar color". Default: "Quitar color". */
    clearLabel?: string;
    /** Tamaño de cada swatch. Default: "md". */
    size?: "sm" | "md";
    /**
     * Renderiza el primer swatch con un gap visual extra respecto al resto.
     * Pensado para destacar un color "por defecto" cuando el picker ofrece
     * una paleta amplia (ej. selector de agente con 28 colores). El primer
     * swatch lleva `mr-3` (12px) en su contenedor, sumado al `gap-1.5`
     * del picker → 18px de separación total con el siguiente swatch.
     */
    separateFirst?: boolean;
    // ── Panel-only props ──────────────────────────────────────────────────
    /** Título del panel. Default: "Brand". */
    title?: string;
    /** Subtítulo decorativo. Default: "Tailwind CSS v4.2". */
    subtitle?: string;
    /** Texto del botón "Docs". Omitir para ocultar. */
    docsLabel?: string;
    /** Callback al pulsar "Reset". Omitir para ocultar el botón. */
    onReset?: () => void;
    /** Callback al pulsar "Docs". Omitir para ocultar. */
    onDocs?: () => void;
    /** Clase extra para el wrapper externo. */
    className?: string;
}

// ── Componente ──────────────────────────────────────────────────────────────

export function BrandSwatches({
    value,
    onChange,
    colors = BRAND_COLORS,
    inline = false,
    label,
    onClear,
    clearLabel = "Quitar color",
    size = "md",
    separateFirst = false,
    title = "Brand",
    subtitle = "Tailwind CSS v4.2",
    docsLabel = "Docs",
    onReset,
    onDocs,
    className,
}: BrandSwatchesProps) {
    const selectedValue = value ? safeParse(value) : undefined;

    // Dedup hex preservando orden — react-aria's ColorSwatchPicker usa el
    // hex como clave interna de colección. Si dos swatches comparten hex
    // (caso típico cuando varios IDs legacy resuelven al mismo color
    // canónico, ej. `brand`+`purple` → violet), el segundo no sólo se
    // colapsa: tira swatches POSTERIORES también. Deduplicar arriba
    // evita el bug y garantiza que todos los colores únicos rendericen.
    const dedupColors = Array.from(new Set(colors.map((c) => c.toLowerCase())));

    const picker = (
        <>
            <AriaColorSwatchPicker
                aria-label={label ?? `${title} colors`}
                value={selectedValue}
                onChange={(color) => onChange(color.toString("hex").toLowerCase())}
                className="flex flex-wrap gap-1.5"
            >
                {dedupColors.map((c, i) => (
                    <SwatchItem
                        key={c}
                        color={c}
                        size={size}
                        className={(state) => cx(
                            "transition-transform duration-150 ease-out hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100",
                            state.isSelected && "outline-focus-ring",
                            // Gap visual extra tras el primer swatch (color "por
                            // defecto" del sistema), sumado al `gap-1.5` del
                            // picker → 18px entre el primero y el segundo.
                            separateFirst && i === 0 && "mr-3",
                        )}
                    />
                ))}
            </AriaColorSwatchPicker>

            {value && onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    className="self-start text-xs text-tertiary outline-focus-ring transition-colors hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-1"
                >
                    {clearLabel}
                </button>
            )}
        </>
    );

    if (inline) {
        return (
            <div className={cx("flex flex-col gap-2", className)}>
                {picker}
            </div>
        );
    }

    const showFooter = onDocs || onReset;

    return (
        <div className={cx(
            "flex w-69 flex-col gap-4 overflow-clip rounded-xl bg-primary p-4 shadow-xl ring-1 ring-secondary_alt",
            className,
        )}>
            <div className="flex items-start gap-3 text-sm">
                <p className="flex-1 font-semibold text-primary">{title}</p>
                <p className="text-quaternary">{subtitle}</p>
            </div>

            {picker}

            {showFooter && (
                <div className="flex items-start justify-between">
                    {onDocs ? (
                        <Button size="xs" color="link-gray" onClick={onDocs}>
                            {docsLabel}
                        </Button>
                    ) : (
                        <span />
                    )}
                    {onReset && (
                        <Button size="xs" color="link-gray" onClick={onReset}>
                            Reset
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Util ────────────────────────────────────────────────────────────────────

function safeParse(hex: string) {
    try {
        return parseColor(hex);
    } catch {
        return undefined;
    }
}
