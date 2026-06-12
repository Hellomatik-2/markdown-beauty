"use client";

/**
 * ResizableSplit — divider arrastrable entre dos paneles.
 *
 *   ┌──────────────────┬─┬──────────────────┐
 *   │                  │ │                  │
 *   │       left       │║│      right       │
 *   │      60%         │ │      40%         │
 *   │                  │ │                  │
 *   └──────────────────┴─┴──────────────────┘
 *
 * Patrón Apple HIG "Split Views" (Xcode/Pages/Keynote/Mail/Finder):
 *   · Divider visible 1px con hover/active state
 *   · Drag continuo (sin modos discretos)
 *   · Doble-click → reset a default
 *   · Min sizes para que ningún panel quede inutilizable
 *   · Keyboard accessible (WAI-ARIA Splitter pattern)
 *   · Estado persistente por consumer (storageKey opcional)
 *
 * Responsive:
 *   · ≥lg: horizontal split con divider arrastrable
 *   · <lg: stack vertical sin divider (mobile/tablet)
 *
 * UU canon:
 *   · Tokens semánticos (bg-secondary, bg-fg-quaternary, bg-brand-solid, ring-focus-ring)
 *   · Sin colores arbitrarios
 *   · A11y completa (role separator + aria-orientation + aria-valuenow)
 *
 * Implementación:
 *   · Pointer events (cubre mouse + touch + pen)
 *   · setPointerCapture/releasePointerCapture para drag fuera del handle
 *   · ref-driven (no re-render por frame durante el drag — el clientX se
 *     proyecta sobre el container y se commit al state, pero usamos
 *     transform/style direct para evitar layout shift jarring)
 *   · localStorage opcional con storageKey por consumer
 *
 * Cero invenciones primitivas: composición sobre HTML semántico + Tailwind.
 */

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent,
    type ReactNode,
} from "react";
import { cx } from "@/utils/cx";

interface Props {
    /** Panel izquierdo. */
    left:           ReactNode;
    /** Panel derecho. */
    right:          ReactNode;
    /** Porcentaje inicial del panel izquierdo. Default 60. */
    defaultPct?:    number;
    /** Mínimo % del panel izquierdo. Default 30. */
    minLeftPct?:    number;
    /** Mínimo px del panel derecho — evita que las cards revientan
     *  cuando se arrastra demasiado a la derecha. Default 360. */
    minRightPx?:    number;
    /** Si se pasa, persiste el % en localStorage bajo esta key. */
    storageKey?:    string;
    /** Clase opcional sobre el container externo. */
    className?:     string;
    /** aria-label del divider. Default "Redimensionar paneles". */
    ariaLabel?:     string;
}

export function ResizableSplit({
    left,
    right,
    defaultPct = 60,
    minLeftPct = 30,
    minRightPx = 360,
    storageKey,
    className,
    ariaLabel = "Redimensionar paneles",
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Dos valores distintos:
    //   · `userPct`     → intención del usuario (lo que guardamos en
    //                     localStorage). NO se modifica por re-clamps
    //                     automáticos cuando el container cambia de tamaño.
    //   · `displayPct`  → derivado en render aplicando clamp según el
    //                     ancho actual del container. Si el container se
    //                     estrecha (ej. abrir el chat lateral), el display
    //                     baja pero el user-intent se conserva — al volver
    //                     a ampliarse, vuelve al ratio original.
    // Bug previo: el ResizeObserver llamaba `setPct(clampPct(prev))` y
    // ese nuevo valor se persistía como user-intent, perdiendo el ratio
    // original al cerrar el chat. Apple HIG · Stability: la UI debe
    // respetar la decisión explícita del usuario y no degradarla.
    const [userPct, setUserPct] = useState<number>(defaultPct);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
        if (!storageKey) return;
        try {
            const stored = localStorage.getItem(storageKey);
            const parsed = stored !== null ? Number(stored) : NaN;
            if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
                setUserPct(parsed);
            }
        } catch {
            // localStorage puede fallar en modo privado / quota. Ignorar.
        }
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey) return;
        try {
            localStorage.setItem(storageKey, String(Math.round(userPct)));
        } catch {
            // Idem.
        }
    }, [userPct, storageKey]);

    // Clamp considerando minLeftPct y minRightPx (que depende del width
    // actual del container). Reactivo a containerWidth para que cambios
    // de viewport recalculen el clamp en el siguiente render.
    const clampPct = useCallback((next: number): number => {
        const minPct = minLeftPct;
        const totalPx = containerWidth;
        if (totalPx <= 0) return Math.max(next, minPct);
        const maxPct = Math.max(minPct, 100 - (minRightPx / totalPx) * 100);
        return Math.min(Math.max(next, minPct), maxPct);
    }, [minLeftPct, minRightPx, containerWidth]);

    // ResizeObserver actualiza el ancho — NO toca `userPct`. El display
    // se recalcula sólo en render (más abajo).
    useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === "undefined") return;
        // Inicial.
        setContainerWidth(container.clientWidth);
        const ro = new ResizeObserver(() => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth);
            }
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    // Display = userPct clampado al espacio actual disponible.
    const pct = clampPct(userPct);
    // Setter alias: las acciones del usuario (drag, keyboard, doubleClick)
    // siguen llamándose `setPct` y modifican el user-intent.
    const setPct: (v: number | ((p: number) => number)) => void = (v) => {
        setUserPct((prev) => {
            const next = typeof v === "function" ? v(prev) : v;
            // Clamp solo al rango ABSOLUTO [0, 100] — el clamp visual
            // se aplica en render. Guardamos la intención.
            return Math.min(Math.max(next, 0), 100);
        });
    };

    const isDraggingRef = useRef(false);

    const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        isDraggingRef.current = true;
    };

    const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0) return;
        const next = ((e.clientX - rect.left) / rect.width) * 100;
        setPct(clampPct(next));
    };

    const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // En algunos browsers releasePointerCapture puede tirar si
            // el capture ya se liberó automáticamente. Ignorar.
        }
        isDraggingRef.current = false;
    };

    /** Doble-click sobre el divider → reset al default (convención macOS). */
    const handleDoubleClick = () => {
        setPct(defaultPct);
    };

    /** Keyboard accessible (WAI-ARIA Splitter pattern):
     *   ←/→        ±5%
     *   Shift+←/→  ±1%
     *   Home       minLeftPct
     *   End        máximo permitido
     *   Enter/Space reset a default
     */
    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const step = e.shiftKey ? 1 : 5;
        switch (e.key) {
            case "ArrowLeft":
                e.preventDefault();
                setPct((p) => clampPct(p - step));
                break;
            case "ArrowRight":
                e.preventDefault();
                setPct((p) => clampPct(p + step));
                break;
            case "Home":
                e.preventDefault();
                setPct(clampPct(minLeftPct));
                break;
            case "End":
                e.preventDefault();
                setPct(clampPct(100));
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                setPct(defaultPct);
                break;
        }
    };

    return (
        <div
            ref={containerRef}
            className={cx(
                // `lg:items-start` evita que las columnas se estiren al
                // alto del row (default `align-items: stretch`). Sin esto,
                // al expandir un acordeón en la columna derecha, la
                // izquierda también se "estiraba" → el contenido sticky
                // del PDF percibía un cambio de container y saltaba
                // visualmente. Apple HIG · Stability: una columna no
                // debería moverse por una acción en la otra columna.
                "flex min-h-0 min-w-0 flex-col lg:flex-row lg:items-start",
                className,
            )}
        >
            {/* Panel izquierdo. En <lg ocupa todo el ancho; en lg+ usa
                 flexBasis controlado por `pct`. min-w-0 + min-h-0 para
                 que el contenido pueda usar overflow propio. */}
            <div
                className="min-h-0 min-w-0 lg:basis-[var(--split-left)]"
                style={{ "--split-left": `${pct}%` } as React.CSSProperties}
            >
                {left}
            </div>

            {/* Divider — solo en lg+. role/aria del WAI-ARIA Splitter.
                 Hit area 8px (w-2) con línea visual 1px centrada. Cursor
                 col-resize. Focus visible UU. Sin animación decorativa
                 (Apple HIG: restraint). */}
            <div
                role="separator"
                aria-orientation="vertical"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={minLeftPct}
                aria-valuemax={100}
                aria-label={ariaLabel}
                tabIndex={0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onDoubleClick={handleDoubleClick}
                onKeyDown={handleKeyDown}
                className={cx(
                    "group relative hidden shrink-0 cursor-col-resize touch-none select-none lg:flex",
                    // Hit area 24px (mx-2 + w-2 + mx-2 = 8+8+8). Coincide
                     // con `gap-6` del grid clásico, preserva respiración
                     // visual cuando sustituye un grid con gap.
                    "mx-2 w-2 items-stretch",
                    // El padre tiene `items-start` para no propagar
                    // cambios de altura entre columnas. El divider sin
                    // embargo SÍ debe estirarse al alto natural del row
                    // (el del panel más alto) para que la línea vertical
                    // recorra toda la separación.
                    "lg:self-stretch",
                    "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                )}
            >
                {/* Línea visual del divider — visible por defecto (gris
                     medio Apple-style), prominente en hover/drag. 1px de
                     ancho centrado en el hit area de 8px (espacio
                     invisible para tap target cómodo). El default antes
                     era `bg-secondary` (~5% opacidad) y no se percibía
                     como un control manipulable — el usuario no veía
                     el affordance de drag. Apple HIG · Affordance:
                     un control debe verse como tal. */}
                <span
                    aria-hidden="true"
                    className={cx(
                        "pointer-events-none mx-auto h-full w-px",
                        "bg-quaternary transition-colors",
                        "group-hover:bg-fg-quaternary group-active:bg-brand-solid",
                    )}
                />
            </div>

            {/* Panel derecho. En lg+ usa flex-1 (toma el resto). En <lg
                 ocupa todo el ancho debajo del izquierdo. */}
            <div className="min-h-0 min-w-0 lg:flex-1">{right}</div>
        </div>
    );
}
