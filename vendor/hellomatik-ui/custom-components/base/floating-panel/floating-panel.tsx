"use client";

/**
 * FloatingPanel — panel flotante NO-modal estilo iChat / Messages.
 *
 * Patrón consolidado del DS para drawers que NO son modales bloqueantes:
 *
 *   · Sin backdrop — la app de detrás sigue clickable.
 *   · Coexiste con el AI chat: se desplaza hacia la izquierda cuando el
 *     panel del AI Assistant está abierto (vía CSS var `--ai-panel-offset`).
 *   · Click outside cierra el panel, EXCEPTO cuando el click es sobre
 *     dropdowns / menús / listboxes / AI assistant — esos se montan en
 *     portal y son interacciones legítimas dentro del panel abierto.
 *   · ESC cierra.
 *   · Portalizado a `document.body` para escapar containing blocks creados
 *     por `filter`/`transform`/`perspective` ancestrales (ej: el blur de
 *     `AgentSwitchContent` durante el cambio de agente).
 *
 * Para drawers MODALES (con backdrop, app bloqueada de fondo) usa
 * `SlideoutMenu` o `Modal` UU canónico — este primitivo es para el caso
 * explícitamente NO-modal.
 */

import {
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { motionTokens } from "@/utils/motion";
import { cx } from "@/utils/cx";

interface FloatingPanelProps {
    /** Estado controlado de apertura. */
    open: boolean;
    /** Callback al cambiar el estado (cierre por ESC / click-outside / etc.). */
    onOpenChange: (open: boolean) => void;
    /** Etiqueta accesible del diálogo. */
    ariaLabel?: string;
    /** Deshabilita el cierre con tecla ESC. Default: false. */
    disableEscapeKey?: boolean;
    /** Deshabilita el cierre por click fuera del panel. Default: false. */
    disableClickOutside?: boolean;
    /** Clases extra del panel — sobreescribe defaults (size, position, etc.). */
    className?: string;
    /** Contenido del panel. */
    children: ReactNode;
}

const TRANSITION = motionTokens.drawer;

/**
 * Selectores CSS que se EXIMEN del click-outside-cierra. React-aria monta
 * sus overlays (Dropdown, Select, Modal anidados) en portal con estos
 * roles, y un click ahí no debe cerrar el panel padre. `[data-ai-assistant]`
 * cubre el FAB y el panel del AI chat.
 */
const CLICK_OUTSIDE_EXEMPT_SELECTOR =
    "[role='dialog'], [role='menu'], [role='listbox'], [data-ai-assistant]";

export function FloatingPanel({
    open,
    onOpenChange,
    ariaLabel,
    disableEscapeKey = false,
    disableClickOutside = false,
    className,
    children,
}: FloatingPanelProps) {
    // Portal guard: createPortal(..., document.body) requiere window.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const panelRef = useRef<HTMLDivElement>(null);

    // ESC cierra.
    useEffect(() => {
        if (!open || disableEscapeKey) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onOpenChange(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onOpenChange, disableEscapeKey]);

    // Click outside cierra (con exclusiones para overlays react-aria).
    useEffect(() => {
        if (!open || disableClickOutside) return;
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (panelRef.current?.contains(target)) return;
            if ((target as Element).closest?.(CLICK_OUTSIDE_EXEMPT_SELECTOR)) return;
            onOpenChange(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [open, onOpenChange, disableClickOutside]);

    const node = (
        <AnimatePresence>
            {open && (
                <m.aside
                    key="floating-panel"
                    ref={panelRef}
                    role="dialog"
                    aria-modal="false"
                    aria-label={ariaLabel}
                    initial={{ x: "calc(100% + 24px)", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "calc(100% + 24px)", opacity: 0 }}
                    transition={TRANSITION}
                    className={cx(
                        // Default: anclado top-right con margen 12px, ancho max 560px,
                        // alto adaptativo al contenido (capado a viewport - 24px),
                        // rounded-xl flotante con sombra. El `right` se compone con
                        // `--ai-panel-offset` para desplazarse cuando el AI chat abre.
                        "fixed top-3 right-[calc(var(--ai-panel-offset,0px)+0.75rem)] z-50 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-secondary bg-primary shadow-2xl transition-[right] motion-drawer",
                        className,
                    )}
                >
                    {children}
                </m.aside>
            )}
        </AnimatePresence>
    );

    if (!mounted) return null;
    return createPortal(node, document.body);
}
