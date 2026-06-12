"use client";

import type { ToasterProps } from "sonner";
import { Toaster as SonnerToaster, useSonner } from "sonner";
import { cx } from "@/utils/cx";

// top-right: consistente con `useFlash` (que llama sonner.custom con
// position: "top-right" para no chocar con el FAB del AI chat en
// bottom-right). Antes era bottom-right → desync con los toasts emitidos.
export const DEFAULT_TOAST_POSITION = "top-right";

export const ToastsOverlay = () => {
    const { toasts } = useSonner();

    const styles = {
        "top-right": {
            className: "top-0 right-0",
            background: "linear-gradient(215deg, rgba(0, 0, 0, 0.10) 0%, rgba(0, 0, 0, 0.00) 50%)",
        },
        "top-left": {
            className: "top-0 left-0",
            background: "linear-gradient(139deg, rgba(0, 0, 0, 0.10) 0%, rgba(0, 0, 0, 0.00) 40.64%)",
        },
        "bottom-right": {
            className: "bottom-0 right-0",
            background: "linear-gradient(148deg, rgba(0, 0, 0, 0.00) 58.58%, rgba(0, 0, 0, 0.10) 97.86%)",
        },
        "bottom-left": {
            className: "bottom-0 left-0",
            background: "linear-gradient(214deg, rgba(0, 0, 0, 0.00) 54.54%, rgba(0, 0, 0, 0.10) 95.71%)",
        },
    };

    // Deduplicated list of positions
    const positions = toasts.reduce<NonNullable<ToasterProps["position"]>[]>((acc, t) => {
        acc.push(t.position || DEFAULT_TOAST_POSITION);
        return acc;
    }, []);

    return (
        <>
            {Object.entries(styles).map(([position, style]) => (
                <div
                    key={position}
                    className={cx(
                        "pointer-events-none fixed z-40 hidden h-72.5 w-130 transition duration-500 xs:block",
                        style.className,
                        positions.includes(position as keyof typeof styles) ? "visible opacity-100" : "invisible opacity-0",
                    )}
                    style={{
                        background: style.background,
                    }}
                />
            ))}
            <div
                className={cx(
                    "pointer-events-none fixed right-0 bottom-0 left-0 z-40 h-67.5 w-full bg-linear-to-t from-black/10 to-transparent transition duration-500 xs:hidden",
                    positions.length > 0 ? "visible opacity-100" : "invisible opacity-0",
                )}
            />
        </>
    );
};

export const Toaster = () => (
    <>
        <SonnerToaster
            position={DEFAULT_TOAST_POSITION}
            // visibleToasts: 5 toasts visibles a la vez (default Sonner = 3).
            //   Encima de 5 se silencian en silencio → en sesiones con
            //   varias acciones rápidas, perdíamos flashes. 5 es el límite
            //   sin saturar viewport (~5×72 px = 360 px).
            // expand: al hover, los toasts apilados se separan y muestran
            //   todos completos en lugar de quedar ocultos detrás. Mejora
            //   muchísimo la legibilidad cuando hay 3+.
            // gap: 12 px entre toasts (Sonner default 14 px, UU live demo
            //   también 14 px). Probamos antes con 4 px imitando macOS, pero
            //   con varias subidas seguidas los toasts perdían identidad —
            //   se leían como un bloque continuo, no como mensajes
            //   independientes. 12 px da separación clara sin disgregar.
            visibleToasts={5}
            expand
            gap={12}
            // Sonner default = 4000ms, pero algunos toasts custom heredaban
            // ventanas largas (hasta 30 s para "task" toasts) que mantenían
            // el contenedor `<section>` interceptando clicks bajo el toast
            // mucho después de que el contenido visual hubiera desaparecido.
            // 3 s es el rango Linear/Slack para feedback no-crítico.
            duration={3000}
            // Hot-fix del bug "toast bloquea clicks": el wrapper de Sonner
            // ocupa espacio aunque sólo haya un toast en esquina. Forzamos
            // pointer-events-none en el wrapper y re-activamos sólo en cada
            // toast hijo para que las áreas vacías sean clickables.
            toastOptions={{ className: "pointer-events-auto" }}
            className="!pointer-events-none"
            style={
                {
                    "--width": "400px",
                } as React.CSSProperties
            }
        />
        <ToastsOverlay />
    </>
);
