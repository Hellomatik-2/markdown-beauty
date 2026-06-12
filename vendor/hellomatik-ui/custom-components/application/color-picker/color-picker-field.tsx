"use client";

/**
 * ColorPickerField — campo de color con popover full UU.
 *
 * El campo muestra: [● swatch] #HEX  ⌄
 * Al click abre un popover con:
 *   · Área SV (saturation × brightness) 2D
 *   · Hue slider
 *   · Alpha slider
 *   · EyeDropper (si el navegador soporta `window.EyeDropper`)
 *   · Selector de formato (Hex · RGB · CSS · HSL · HSB)
 *   · Input del valor parseable en cualquier formato
 *   · Grid de swatches "Brand" (BRAND_COLORS canónico) abajo
 *
 * Esto reemplaza el patrón anterior `BrandSwatches inline` + `<Input>`
 * de hex separado por algo que:
 *   · entiende cualquier formato (Hex, RGB, CSS rgba(...), HSL, HSB)
 *   · ofrece selección visual (área + hue) sin necesidad de escribir
 *   · respeta el sistema canónico (16 BRAND_COLORS al pie del popover)
 *   · usa `EyeDropper` para sampler colores del viewport (Chromium)
 *
 * Cualquier hex válido (3-, 6- u 8-dígitos) es aceptado por el input
 * — react-aria-components valida y parsea internamente.
 */

import type { ReactNode } from "react";
import {
    ColorSwatchPicker as AriaColorSwatchPicker,
    Button as AriaButton,
    Dialog as AriaDialog,
    DialogTrigger as AriaDialogTrigger,
    Popover as AriaPopover,
} from "react-aria-components";
import { ChevronDown } from "@hm/icons";
import { useTranslations } from "next-intl";
import { cx } from "@/utils/cx";
import { BRAND_COLORS } from "./brand-swatches";
import { ColorPicker, SwatchItem } from "./color-picker";

export interface ColorPickerFieldProps {
    /** Hex actual (`#RRGGBB` o con alpha `#RRGGBBAA`). */
    value: string;
    /** Callback con hex normalizado en minúsculas. */
    onChange: (hex: string) => void;
    /** aria-label del trigger. */
    label?: string;
    /**
     * Override de la paleta de swatches inferior.
     * Default: `BRAND_COLORS` (16 colores Tailwind v4 @ -600).
     */
    swatches?: readonly string[];
    /**
     * Si `swatches` está vacío o se pasa `null`, se ocultan los swatches.
     * Útil cuando se quiere el picker puro (gradiente + hue + hex) sin
     * la quick-picker de marca.
     */
    hideSwatches?: boolean;
    /** Clase extra para el trigger. */
    className?: string;
    /** Render del contenido del trigger. Default: swatch + hex en minúsculas. */
    renderTrigger?: (value: string) => ReactNode;
    /** Anclaje del popover. Default: `"bottom start"`. */
    placement?: "bottom start" | "bottom end" | "top start" | "top end";
}

export function ColorPickerField({
    value,
    onChange,
    label,
    swatches = BRAND_COLORS,
    hideSwatches = false,
    className,
    renderTrigger,
    placement = "bottom start",
}: ColorPickerFieldProps) {
    const t = useTranslations("common.colorPicker");
    const triggerLabel = label ?? t("colorPickerAriaLabel");

    return (
        <AriaDialogTrigger>
            <AriaButton
                aria-label={triggerLabel}
                className={cx(
                    "group inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm shadow-xs ring-1 ring-primary outline-focus-ring transition-shadow duration-100 ease-linear ring-inset",
                    "cursor-pointer hover:ring-secondary",
                    "data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[pressed]:ring-secondary",
                    className,
                )}
            >
                {renderTrigger ? (
                    renderTrigger(value)
                ) : (
                    <>
                        <span
                            aria-hidden="true"
                            className="size-5 shrink-0 rounded-full ring-1 ring-alpha-black/10 ring-inset dark:ring-alpha-black/30"
                            style={{ backgroundColor: value }}
                        />
                        <span className="font-mono uppercase tabular-nums text-primary">
                            {normalizeHex(value)}
                        </span>
                        <ChevronDown className="size-4 shrink-0 text-tertiary transition-transform duration-100 group-data-[pressed]:rotate-180" aria-hidden="true" />
                    </>
                )}
            </AriaButton>

            <AriaPopover
                placement={placement}
                offset={6}
                containerPadding={8}
                className={(state) =>
                    cx(
                        "z-50 origin-(--trigger-anchor-point) outline-hidden will-change-transform",
                        state.isEntering &&
                            "duration-150 ease-out animate-in fade-in placement-top:slide-in-from-bottom-1 placement-bottom:slide-in-from-top-1",
                        state.isExiting &&
                            "duration-100 ease-in animate-out fade-out placement-top:slide-out-to-bottom-1 placement-bottom:slide-out-to-top-1",
                    )
                }
            >
                <AriaDialog className="outline-hidden">
                    <ColorPicker.Provider value={value} onChange={(c) => onChange(c.toString("hex").toLowerCase())}>
                        <ColorPicker.Dialog className="w-80">
                            <div className="flex flex-col gap-4 p-4">
                                {!hideSwatches && swatches.length > 0 && (
                                    <div className="flex flex-col gap-2 border-b border-secondary pb-4">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-quaternary">
                                            {t("brandLabel")}
                                        </p>
                                        <AriaColorSwatchPicker
                                            aria-label={t("brandLabel")}
                                            value={safeColorString(value)}
                                            onChange={(c) => onChange(c.toString("hex").toLowerCase())}
                                            className="flex flex-wrap gap-1.5"
                                        >
                                            {swatches.map((c) => (
                                                <SwatchItem key={c} color={c} />
                                            ))}
                                        </AriaColorSwatchPicker>
                                    </div>
                                )}

                                {/* Formato + valor */}
                                <div className="flex items-center gap-3">
                                    <ColorPicker.ColorFormatSelect />
                                    <ColorPicker.ColorValueInput />
                                </div>

                                <div className="flex items-start gap-3">
                                    <ColorPicker.EyeDropper />
                                    <div className="flex flex-1 flex-col gap-3">
                                        <ColorPicker.HueSlider />
                                        <ColorPicker.AlphaSlider />
                                    </div>
                                </div>

                                {/* Área SV + thumb */}
                                <ColorPicker.Area />
                            </div>
                        </ColorPicker.Dialog>
                    </ColorPicker.Provider>
                </AriaDialog>
            </AriaPopover>
        </AriaDialogTrigger>
    );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normaliza un hex con o sin alpha a `#RRGGBB` mayúscula para mostrar al
 * usuario en el trigger. Si el parseo falla, devuelve el valor tal cual.
 */
function normalizeHex(value: string): string {
    if (!value) return "";
    const v = value.toUpperCase();
    if (/^#[0-9A-F]{6}([0-9A-F]{2})?$/.test(v)) return v.slice(0, 7);
    return v;
}

/**
 * Devuelve `value` solo si parseColor lo aceptaría — si no, undefined.
 * Evita crash en `<AriaColorSwatchPicker value=...>` con strings inválidos.
 */
function safeColorString(value: string): string | undefined {
    if (!value) return undefined;
    return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value) ? value : undefined;
}
