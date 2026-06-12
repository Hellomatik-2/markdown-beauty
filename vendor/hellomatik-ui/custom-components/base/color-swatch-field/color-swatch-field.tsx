"use client";

/**
 * ColorSwatchField — selector unificado de color por paleta finita.
 *
 *   <ColorSwatchField
 *     label="Color de la carpeta"
 *     value={folder.color}
 *     onChange={(hex) => setFolderColor(id, hex)}
 *     onClear={() => setFolderColor(id, undefined)}
 *   />
 *
 * Único componente para TODOS los pickers de color del producto: modales,
 * paneles, context menus, drawers de nodos, ajustes. Garantiza que los
 * swatches tengan el mismo tamaño, gap, outline al seleccionar y a11y en
 * cualquier pantalla.
 *
 * - Wrap del primitivo `AriaColorSwatchPicker` + `SwatchItem` (base).
 * - `onClear` opcional: muestra "Quitar color" debajo cuando hay `value`.
 * - Paleta por defecto: FOLDER_PALETTE_COLORS (la más estable, 8 colores).
 */

import { ColorSwatchPicker as AriaColorSwatchPicker, parseColor } from "react-aria-components";
import { SwatchItem } from "@/components/application/color-picker/color-picker";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { FOLDER_PALETTE_COLORS, type PaletteColor } from "@/data/colors";
import { cx } from "@/utils/cx";

export interface ColorSwatchFieldProps {
    /** Hex actualmente seleccionado, o undefined si no hay color. */
    value?: string;
    /** Cambio de color (siempre llega un hex de la paleta). */
    onChange: (hex: string) => void;
    /** Paleta a mostrar. Default: FOLDER_PALETTE_COLORS. */
    palette?: PaletteColor[];
    /** Tamaño del swatch. Default: "md". */
    size?: "sm" | "md";
    /** aria-label obligatorio (lectores de pantalla). */
    label: string;
    /** Si se pasa, muestra "Quitar color" cuando hay value. */
    onClear?: () => void;
    /** Clase extra para el wrapper externo. */
    className?: string;
    /** Clase extra para la rejilla de swatches (ej. para más/menos gap). */
    swatchesClassName?: string;
}

export function ColorSwatchField({
    value,
    onChange,
    palette = FOLDER_PALETTE_COLORS,
    size = "md",
    label,
    onClear,
    className,
    swatchesClassName,
}: ColorSwatchFieldProps) {
    // react-aria necesita un Color parseable; pasamos undefined si no hay match.
    const selectedValue = value ? safeParse(value) : undefined;

    return (
        <div className={cx("flex flex-col gap-2", className)}>
            <AriaColorSwatchPicker
                aria-label={label}
                value={selectedValue}
                onChange={(color) => {
                    const picked = color.toString("hex").toLowerCase();
                    const opt = palette.find(
                        (o) => o.hex.toLowerCase() === picked,
                    );
                    if (opt) onChange(opt.hex);
                }}
                className={cx("flex flex-wrap gap-1.5", swatchesClassName)}
            >
                {palette.map((opt) => (
                    <Tooltip key={opt.id} title={opt.label} delay={300}>
                        <SwatchItem
                            color={opt.hex}
                            size={size}
                            aria-label={opt.label}
                            // Apple/UU pattern (mismo que UU gradient picker en color-picker.tsx:391):
                            //   · hover = scale, no color overlay
                            //   · selected outline = focus-ring (alto contraste con bg)
                            //     en vez de outline-(--swatch-color) que era invisible
                            //     cuando el swatch coincidía con el bg (#14120b sobre dark).
                            className={(state) => cx(
                                "transition-transform duration-150 ease-out hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100",
                                state.isSelected && "outline-focus-ring",
                            )}
                        />
                    </Tooltip>
                ))}
            </AriaColorSwatchPicker>

            {/* Quitar color — solo si el caller permite limpiar y hay selección. */}
            {value && onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    className="self-start text-xs text-tertiary outline-focus-ring transition-colors hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-1"
                >
                    Quitar color
                </button>
            )}
        </div>
    );
}

/** parseColor falla si recibe un hex inválido — protegemos al consumer. */
function safeParse(hex: string) {
    try {
        return parseColor(hex);
    } catch {
        return undefined;
    }
}
