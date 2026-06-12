"use client";

/**
 * ContextMenu — chrome canónico para menús contextuales (right-click) que
 * aparecen anclados al cursor en una posición arbitraria del viewport.
 *
 * Usa primitivos react-aria (`AriaPopover` + `AriaDialog`) con un trigger
 * virtual posicionado en (x, y) para que el sistema de posicionamiento de
 * react-aria gestione:
 *
 *   · Portalización a `document.body`
 *   · Click-outside cierra (vía `isDismissable`)
 *   · ESC cierra (vía gestión de teclado de AriaPopover)
 *   · Flip automático al borde del viewport
 *   · Focus trap + restore focus
 *   · ARIA roles correctos
 *
 * Se añade una capa extra de cierre on-scroll/on-resize, que es UX típica
 * de context menus (si el usuario hace scroll, el menú flotante deja de
 * tener sentido referencial al elemento que disparó).
 *
 * El consumidor sólo se encarga de:
 *   · Registrar el listener de `contextmenu` (filtrar por target adecuado)
 *   · Setear `position` cuando se debe abrir
 *   · Renderizar los items dentro como children
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
    Dialog as AriaDialog,
    Popover as AriaPopover,
} from "react-aria-components";
import { cx } from "@/utils/cx";

interface ContextMenuProps {
    /** Posición del cursor cuando se abrió (clientX/clientY). null = cerrado. */
    position: { x: number; y: number } | null;
    /** Callback al cerrarse. */
    onClose: () => void;
    /** Etiqueta accesible. Default: "Menú contextual". */
    ariaLabel?: string;
    /** Clases extra del contenedor. Override de defaults (min-w, padding…). */
    className?: string;
    children: ReactNode;
}

export function ContextMenu({
    position,
    onClose,
    ariaLabel = "Menú contextual",
    className,
    children,
}: ContextMenuProps) {
    const isOpen = position !== null;

    // Trigger virtual 0×0 anclado al cursor. AriaPopover lo usa como
    // referencia de anclaje y aplica su lógica de flip/clamp al viewport.
    const virtualRef = useRef<HTMLDivElement>(null);

    // Portal target — se resuelve client-side para evitar problemas SSR y
    // para escapar de cualquier ancestor con `filter`/`transform` activo
    // (los ancestros con filter crean un nuevo containing block para
    // `position:fixed`, desplazando el ancla del cursor).
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    useEffect(() => { setPortalTarget(document.body); }, []);

    // Cierra al hacer scroll o redimensionar — UX clásica de context menu:
    // el anclaje al cursor pierde sentido si el contenido se mueve.
    useEffect(() => {
        if (!isOpen) return;
        const handler = () => onClose();
        window.addEventListener("scroll", handler, true);
        window.addEventListener("resize", handler);
        return () => {
            window.removeEventListener("scroll", handler, true);
            window.removeEventListener("resize", handler);
        };
    }, [isOpen, onClose]);

    return (
        <>
            {/* Virtual trigger portado a document.body para escapar de
                cualquier ancestor con filter/transform que crearía un
                containing block falso para position:fixed. */}
            {portalTarget && createPortal(
                <div
                    ref={virtualRef}
                    aria-hidden="true"
                    style={{
                        position: "fixed",
                        top: position?.y ?? 0,
                        left: position?.x ?? 0,
                        width: 0,
                        height: 0,
                        pointerEvents: "none",
                    }}
                />,
                portalTarget,
            )}

            <AriaPopover
                triggerRef={virtualRef}
                isOpen={isOpen}
                onOpenChange={(open) => {
                    if (!open) onClose();
                }}
                placement="bottom start"
                offset={2}
                className={({ isEntering, isExiting }) =>
                    cx(
                        "z-[60] origin-top-left will-change-transform",
                        isEntering && "duration-150 ease-out animate-in fade-in zoom-in-95",
                        isExiting && "duration-100 ease-in animate-out fade-out zoom-out-95",
                    )
                }
            >
                <AriaDialog
                    aria-label={ariaLabel}
                    className={cx(
                        "min-w-60 overflow-visible rounded-xl bg-primary p-1 shadow-xl ring-1 ring-secondary outline-hidden",
                        className,
                    )}
                >
                    {children}
                </AriaDialog>
            </AriaPopover>
        </>
    );
}
