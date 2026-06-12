"use client";

/**
 * Skeleton — primitivos de carga compatibles con DesignSystem.
 *
 * Patrón: bloques con `bg-secondary` (token semántico) y animación
 * `animate-pulse` que insinúa actividad sin distraer. Usa el mismo
 * token que DesignSystem emplea para los fondos secundarios — en dark
 * mode se invierte automáticamente sin tocar nada aquí.
 *
 * Uso:
 *   <Skeleton.Line className="w-32" />
 *   <Skeleton.Circle size={8} />
 *   <Skeleton.Block className="h-40 w-full" />
 *
 * Recomendaciones (Carbon DS / Vercel / Nielsen):
 *   - El skeleton debe imitar la estructura del contenido real.
 *   - No mezclar skeletons con spinners — pick one.
 *   - Mantener el skeleton ≥300ms si llega a mostrarse, para evitar
 *     flicker. Esto se controla desde el lado consumidor con
 *     `useDelayedLoading`.
 */

import { cx } from "@/utils/cx";

interface SkeletonLineProps {
    className?: string;
    /** Si necesitas forzar una animación distinta de pulse. */
    animated?: boolean;
}

const SkeletonLine = ({ className, animated = true }: SkeletonLineProps) => (
    <span
        aria-hidden="true"
        className={cx(
            "block h-3 rounded-md bg-secondary",
            animated && "animate-pulse",
            className,
        )}
    />
);

const SkeletonCircle = ({
    size = 10,
    animated = true,
    className,
}: {
    size?: number;
    animated?: boolean;
    className?: string;
}) => (
    <span
        aria-hidden="true"
        style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
        className={cx(
            "inline-block shrink-0 rounded-full bg-secondary",
            animated && "animate-pulse",
            className,
        )}
    />
);

const SkeletonBlock = ({
    className,
    animated = true,
}: {
    className?: string;
    animated?: boolean;
}) => (
    <div
        aria-hidden="true"
        className={cx(
            "rounded-lg bg-secondary",
            animated && "animate-pulse",
            className,
        )}
    />
);

const SkeletonCard = ({
    className,
    children,
}: {
    className?: string;
    children?: React.ReactNode;
}) => (
    <div
        aria-hidden="true"
        className={cx(
            "rounded-xl border border-secondary bg-primary p-4",
            className,
        )}
    >
        {children}
    </div>
);

/**
 * Wrapper accesible para regiones cargando. Anuncia "Cargando…" a
 * lectores de pantalla solo una vez (aria-busy) y oculta los
 * placeholders visuales del árbol de accesibilidad.
 */
const SkeletonRegion = ({
    label = "Cargando",
    className,
    children,
}: {
    label?: string;
    className?: string;
    children: React.ReactNode;
}) => (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
        <span className="sr-only">{label}</span>
        {children}
    </div>
);

export const Skeleton = {
    Line:   SkeletonLine,
    Circle: SkeletonCircle,
    Block:  SkeletonBlock,
    Card:   SkeletonCard,
    Region: SkeletonRegion,
};

export type { SkeletonLineProps };
