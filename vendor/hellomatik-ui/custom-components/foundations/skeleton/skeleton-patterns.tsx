"use client";

/**
 * Skeleton patterns reutilizables — composiciones del primitivo
 * `<Skeleton>` que imitan los layouts más comunes de la plataforma:
 *
 *   - PageBandSkeleton      → título grande + subtítulo + acción
 *   - MetricRowSkeleton     → fila de stat-cards (totales/conversiones…)
 *   - FilterBarSkeleton     → search + chips de filtros
 *   - TableSkeleton         → tabla con N filas y M columnas
 *   - CardGridSkeleton      → grid de cards (integrations, workflows…)
 *   - ListDetailSkeleton    → 3 columnas (lista + thread + sidebar)
 *   - EditorCanvasSkeleton  → toolbar + canvas vacío
 *   - ChartCardSkeleton     → card con un gráfico mock
 *
 * Todos respetan los tokens DesignSystem: `bg-secondary`, `bg-primary`,
 * `border-secondary`, etc. Cero hardcoding de colores ni tamaños fuera
 * de la escala oficial.
 */

import { Skeleton } from "./skeleton";
import { cx } from "@/utils/cx";

// ─── Tallas calibradas para títulos / subtítulos ──────────────────
//
// `text-display-xs` (24 px Inter semibold) renderiza a ~12-13 px por
// carácter en Inter. Estas tallas mapean RANGOS de longitud de título
// para que el skeleton no quede sistemáticamente más ancho que el
// texto real — el bug reportado por el usuario era que en páginas con
// títulos cortos (Workspace, Actividad, Mi perfil) el skeleton era
// 2x el ancho final. Cada talla se calibró midiendo títulos reales:
//
//   xs  →  w-28  (112 px)  — "Trash", "Mi perfil"
//   sm  →  w-36  (144 px)  — "Dashboard", "Actividad", "Workspace"
//   md  →  w-44  (176 px)  — "Integraciones", "Conocimiento",
//                            "Automatizaciones"
//   lg  →  w-56  (224 px)  — "Configuración del agente" y títulos
//                            con más de 17 caracteres

export type SkTitleSize    = "xs" | "sm" | "md" | "lg";
export type SkSubtitleSize = "sm" | "md" | "lg";

const TITLE_W: Record<SkTitleSize, string> = {
    xs: "w-28",
    sm: "w-36",
    md: "w-44",
    lg: "w-56",
};

const SUBTITLE_W: Record<SkSubtitleSize, string> = {
    sm: "w-56",  // descripciones cortas
    md: "w-72",  // por defecto
    lg: "w-96",  // descripciones largas
};

/**
 * Cabecera de página calibrada. Sustituye los pares ad-hoc:
 *
 *   <div className="flex flex-col gap-2">
 *       <Skeleton.Line className="h-6 w-52" />   // arbitrario
 *       <Skeleton.Line className="h-3 w-80" />   // arbitrario
 *   </div>
 *   <Skeleton.Block className="h-9 w-44 …" />
 *
 * por una única llamada con tallas explícitas y bien calibradas.
 */
export interface PageHeaderSkeletonProps {
    titleSize?:    SkTitleSize;
    /** "none" oculta el subtítulo. */
    subtitleSize?: SkSubtitleSize | "none";
    /** Ancho del action button principal (ej. "w-28"). */
    actionWidth?:  string;
    /** Renderiza un icono cuadrado a la izquierda (size-12). */
    leadingIcon?:  boolean;
    className?:    string;
}

export const PageHeaderSkeleton = ({
    titleSize    = "md",
    subtitleSize = "md",
    actionWidth,
    leadingIcon  = false,
    className,
}: PageHeaderSkeletonProps) => (
    <div className={cx("flex items-start justify-between gap-4", className)}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
            {leadingIcon && <Skeleton.Block className="size-12 shrink-0 rounded-xl" />}
            <div className="flex flex-1 flex-col gap-2">
                <Skeleton.Line className={cx("h-6", TITLE_W[titleSize])} />
                {subtitleSize !== "none" && (
                    <Skeleton.Line className={cx("h-3", SUBTITLE_W[subtitleSize])} />
                )}
            </div>
        </div>
        {actionWidth && (
            <Skeleton.Block className={cx("h-9 rounded-md", actionWidth)} />
        )}
    </div>
);

// ─── TabBarSkeleton ──────────────────────────────────────────────
//
// Barra de tabs underline. Acepta `widths` explícito (recomendado) o
// `count` para usar un patrón distribuido por defecto. Evitamos el
// "todas las tabs miden lo mismo" — los reales varían (ej. "General"
// vs "Notificaciones" vs "Seguridad y privacidad").

const DEFAULT_TAB_WIDTHS = ["w-20", "w-28", "w-24", "w-32", "w-20", "w-28"];

export interface TabBarSkeletonProps {
    /** Anchos explícitos en orden. Si lo pasas, ignora `count`. */
    widths?: string[];
    /** Si no pasas widths, se toman los primeros N del patrón por defecto. */
    count?: number;
    className?: string;
}

export const TabBarSkeleton = ({ widths, count = 4, className }: TabBarSkeletonProps) => {
    const ws = widths ?? DEFAULT_TAB_WIDTHS.slice(0, count);
    return (
        <div className={cx("flex items-center gap-6 border-b border-secondary pb-2.5", className)}>
            {ws.map((w, i) => (
                <Skeleton.Line key={i} className={cx("h-3", w)} />
            ))}
        </div>
    );
};

// ─── BadgeRowSkeleton ────────────────────────────────────────────
//
// Fila de pills/badges con anchos variables. Sustituye al patrón
// repetido de N `Skeleton.Block` con el mismo width (que producía
// reflow visual al cargar — los badges reales son texto variable).

const DEFAULT_BADGE_WIDTHS = ["w-12", "w-16", "w-14", "w-20", "w-12", "w-18", "w-14", "w-16"];

export interface BadgeRowSkeletonProps {
    widths?:   string[];
    count?:    number;
    /** Altura del badge — h-5 para pill-color sm, h-6 para md, h-8 para chips. */
    height?:   string;
    className?: string;
}

export const BadgeRowSkeleton = ({
    widths,
    count = 4,
    height = "h-5",
    className,
}: BadgeRowSkeletonProps) => {
    const ws = widths ?? DEFAULT_BADGE_WIDTHS.slice(0, count);
    return (
        <div className={cx("flex flex-wrap items-center gap-1.5", className)}>
            {ws.map((w, i) => (
                <Skeleton.Block key={i} className={cx("rounded-full", height, w)} />
            ))}
        </div>
    );
};

export const PageBandSkeleton = () => (
    <div className="flex items-start justify-between gap-4 border-b border-secondary px-8 pt-8 pb-6">
        <div className="flex flex-col gap-2">
            <Skeleton.Line className="h-6 w-48" />
            <Skeleton.Line className="h-3 w-72" />
        </div>
        <Skeleton.Block className="h-9 w-28" />
    </div>
);

export const MetricRowSkeleton = ({ items = 4 }: { items?: number }) => (
    <div className="grid gap-4 px-8 py-6 lg:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: items }).map((_, i) => (
            <Skeleton.Card key={i}>
                <div className="flex items-center gap-3">
                    <Skeleton.Block className="size-9" />
                    <div className="flex flex-1 flex-col gap-2">
                        <Skeleton.Line className="h-3 w-20" />
                        <Skeleton.Line className="h-5 w-16" />
                    </div>
                </div>
            </Skeleton.Card>
        ))}
    </div>
);

export const FilterBarSkeleton = () => (
    <div className="flex flex-wrap items-center gap-2 px-8 pb-4">
        <Skeleton.Block className="h-9 w-64" />
        <Skeleton.Block className="h-9 w-32" />
        <Skeleton.Block className="h-9 w-32" />
        <Skeleton.Block className="h-9 w-32" />
    </div>
);

export const TableSkeleton = ({
    rows = 6,
    cols = 4,
}: {
    rows?: number;
    cols?: number;
}) => (
    <div className="mx-8 mb-8 overflow-hidden rounded-xl border border-secondary bg-primary">
        {/* Header */}
        <div className="grid gap-4 border-b border-secondary bg-secondary/40 px-5 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((_, i) => (
                <Skeleton.Line key={i} className="h-3 w-20" />
            ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, r) => (
            <div
                key={r}
                className="grid gap-4 border-b border-secondary px-5 py-4 last:border-b-0"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: cols }).map((_, c) => (
                    <div key={c} className="flex items-center gap-2">
                        {c === 0 && <Skeleton.Circle size={8} />}
                        <Skeleton.Line className="h-3 w-full max-w-[12rem]" />
                    </div>
                ))}
            </div>
        ))}
    </div>
);

export const CardGridSkeleton = ({
    cards = 9,
    columns = 3,
}: {
    cards?: number;
    columns?: 2 | 3 | 4;
}) => {
    const gridCls =
        columns === 2 ? "sm:grid-cols-2" :
        columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" :
        "sm:grid-cols-2 lg:grid-cols-3";
    return (
        <div className={`grid gap-4 px-8 pb-8 ${gridCls}`}>
            {Array.from({ length: cards }).map((_, i) => (
                <Skeleton.Card key={i}>
                    <div className="flex items-start gap-3">
                        <Skeleton.Block className="size-10" />
                        <div className="flex flex-1 flex-col gap-2">
                            <Skeleton.Line className="h-4 w-3/4" />
                            <Skeleton.Line className="h-3 w-1/2" />
                        </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-1.5">
                        <Skeleton.Line className="h-3 w-full" />
                        <Skeleton.Line className="h-3 w-5/6" />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                        <Skeleton.Block className="h-6 w-20" />
                        <Skeleton.Block className="h-7 w-16" />
                    </div>
                </Skeleton.Card>
            ))}
        </div>
    );
};

/**
 * 3 columnas: lista de items (w-80) + detalle central (flex-1) +
 * sidebar de metadata (w-[340px], opcional). Modela history y
 * content/[docId] cuando el detalle se abre.
 */
export const ListDetailSkeleton = ({
    showRightPane = true,
}: { showRightPane?: boolean }) => (
    <div className="flex h-[calc(100dvh-3rem)] flex-1 overflow-hidden">
        {/* Lista */}
        <div className="hidden w-80 shrink-0 flex-col gap-2 border-r border-secondary bg-primary p-3 lg:flex">
            <Skeleton.Block className="h-9 w-24" />
            <div className="mt-2 flex flex-col gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg p-2">
                        <Skeleton.Circle size={8} />
                        <div className="flex flex-1 flex-col gap-2">
                            <Skeleton.Line className="h-3 w-3/4" />
                            <Skeleton.Line className="h-3 w-1/2" />
                            <Skeleton.Line className="h-3 w-2/3" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
        {/* Detalle / thread */}
        <div className="flex flex-1 flex-col bg-secondary/20">
            <div className="flex items-center gap-3 border-b border-secondary bg-primary px-5 py-3">
                <Skeleton.Circle size={10} />
                <div className="flex flex-1 flex-col gap-2">
                    <Skeleton.Line className="h-3 w-40" />
                    <Skeleton.Line className="h-3 w-64" />
                </div>
                <Skeleton.Block className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-4 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`flex max-w-2xl gap-3 ${i % 2 ? "ml-auto" : ""}`}>
                        {i % 2 === 0 && <Skeleton.Circle size={8} />}
                        <Skeleton.Block className="h-16 w-72" />
                    </div>
                ))}
            </div>
        </div>
        {/* Sidebar metadata */}
        {showRightPane && (
            <div className="hidden w-[340px] shrink-0 flex-col gap-4 border-l border-secondary bg-primary p-5 xl:flex">
                <div className="flex items-center justify-between">
                    <Skeleton.Block className="h-6 w-24" />
                    <Skeleton.Line className="h-3 w-12" />
                </div>
                <Skeleton.Line className="h-3 w-32" />
                <div className="flex flex-col gap-2">
                    <Skeleton.Line className="h-3 w-full" />
                    <Skeleton.Line className="h-3 w-full" />
                    <Skeleton.Line className="h-3 w-5/6" />
                </div>
                <div className="mt-4 flex flex-col gap-2">
                    <Skeleton.Line className="h-3 w-20" />
                    <Skeleton.Block className="h-24 w-full" />
                </div>
            </div>
        )}
    </div>
);

export const EditorCanvasSkeleton = () => (
    <div className="flex h-[calc(100dvh-3rem)] flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-secondary bg-primary px-4 py-2">
            <div className="flex items-center gap-2">
                <Skeleton.Block className="h-7 w-7" />
                <Skeleton.Line className="h-4 w-40" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton.Block className="h-8 w-20" />
                <Skeleton.Block className="h-8 w-24" />
            </div>
        </div>
        {/* Canvas con nodos placeholder */}
        <div className="relative flex flex-1 overflow-hidden bg-secondary/30">
            <div className="absolute left-12 top-12 flex flex-col gap-12">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton.Card key={i} className="w-56">
                        <Skeleton.Line className="h-3 w-32" />
                        <Skeleton.Line className="mt-2 h-3 w-24" />
                    </Skeleton.Card>
                ))}
            </div>
            <div className="absolute right-12 top-32 flex flex-col gap-12">
                {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton.Card key={i} className="w-56">
                        <Skeleton.Line className="h-3 w-28" />
                        <Skeleton.Line className="mt-2 h-3 w-20" />
                    </Skeleton.Card>
                ))}
            </div>
        </div>
    </div>
);

export const ChartCardSkeleton = ({
    height = "h-64",
}: { height?: string }) => (
    <Skeleton.Card>
        <div className="flex items-center justify-between pb-4">
            <div className="flex flex-col gap-2">
                <Skeleton.Line className="h-3 w-32" />
                <Skeleton.Line className="h-5 w-24" />
            </div>
            <Skeleton.Block className="h-7 w-24" />
        </div>
        <Skeleton.Block className={`${height} w-full`} />
    </Skeleton.Card>
);
