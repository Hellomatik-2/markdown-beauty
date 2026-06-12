"use client";

/**
 * LoadingShell — wrapper de skeleton para `loading.tsx` en App Router.
 *
 * El sidebar global (`AppSidebar`) y la `CommandPalette` viven en el
 * root layout — persisten entre navegaciones. Por eso este shell SOLO
 * cubre la columna derecha (header sticky + slot de contenido), nunca
 * el sidebar.
 *
 * Patrón "delayed skeleton":
 *   - durante los primeros ~200ms se muestra vacía (fondo bg-primary)
 *   - si la navegación tarda más, aparece el skeleton de contenido
 *   - una vez visible se mantiene ≥300ms para evitar flicker
 *
 * Esto es lo mismo que hacen Vercel, Linear, Stripe Dashboard.
 *
 * Si la red del usuario es 2G/3G/Save-Data, el delay baja a ~80ms
 * (vía `useDelayedLoading` adaptativo).
 */

import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { Skeleton } from "./skeleton";
import { cx } from "@/utils/cx";

interface LoadingShellProps {
    /** Skeleton del contenido principal. Visible solo tras el delay. */
    children: React.ReactNode;
    /** Si true (default), incluye el header placeholder arriba. */
    withChrome?: boolean;
    /** Clase del wrapper interno del contenido (max-width, padding, etc). */
    contentClassName?: string;
}

export function LoadingShell({
    children,
    withChrome = true,
    contentClassName,
}: LoadingShellProps) {
    const showSkeleton = useDelayedLoading(true, {
        delay: 200,
        minVisible: 300,
    });

    if (!withChrome) {
        return (
            <Skeleton.Region className="min-h-dvh bg-primary">
                <div
                    className={cx(
                        "transition-opacity duration-150",
                        showSkeleton ? "opacity-100" : "opacity-0",
                    )}
                >
                    {children}
                </div>
            </Skeleton.Region>
        );
    }

    return (
        <Skeleton.Region className="flex min-h-dvh w-full min-w-0 flex-1 flex-col bg-primary">
            <HeaderPlaceholder />
            <main className="flex-1">
                {/* Container canónico — replica EXACTAMENTE el `<div>` interno
                    de PageShell (`views/page-shell.tsx` línea ~234) para que
                    el skeleton tenga el mismo ancho/centrado que el contenido
                    real. `contentClassName` se layerea encima vía tailwind-merge:
                    si el consumer pasa `px-3` o `max-w-none`, esos ganan.
                    Sin esta línea los skeletons se estiraban a full viewport
                    mientras los reales estaban capados a max-w-6xl. */}
                <div
                    className={cx(
                        "mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 lg:px-8 lg:py-6",
                        contentClassName,
                    )}
                >
                    <div
                        className={cx(
                            "transition-opacity duration-150",
                            showSkeleton ? "opacity-100" : "opacity-0",
                        )}
                    >
                        {children}
                    </div>
                </div>
            </main>
        </Skeleton.Region>
    );
}

/**
 * Placeholder del header sticky superior — breadcrumbs + acciones
 * derecha (notificaciones, avatar). Tarjeta visual coherente con
 * `<header className="sticky top-0 h-12 …">` real.
 */
const HeaderPlaceholder = () => (
    <div
        aria-hidden="true"
        className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-secondary bg-primary/90 px-3 backdrop-blur"
    >
        <Skeleton.Block className="size-7" />
        <Skeleton.Line className="h-3 w-24" />
        <Skeleton.Line className="h-3 w-32" />
        <div className="ml-auto flex items-center gap-2">
            <Skeleton.Circle size={8} />
            <Skeleton.Circle size={8} />
        </div>
    </div>
);
