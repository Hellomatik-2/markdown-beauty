"use client";

/**
 * MetricsChart03 — KPI card con sparkline area-chart.
 *
 * Este archivo originalmente exportaba 9 variantes del componente Metrics
 * (Simple, Icon01-04, Chart01-04) — una galería UU completa. El mockup
 * sólo consume `MetricsChart03` (4× en `dashboards/gmb/overview-tab.tsx`).
 * Eliminadas las 8 variantes dead — el archivo pasa de 678 LOC a ~120.
 *
 * Para reintroducir cualquier variante eliminada, el UU paid pack original
 * tiene los componentes en `metrics.tsx` del download oficial.
 */

import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Copy01, Eye, Share01 } from "@hm/icons";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { CurveType } from "recharts/types/shape/Curve";
import { IconBadge } from "@/components/base/badges/badges";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { cx } from "@/utils/cx";

const ActionsDropdown = () => {
    const t = useTranslations("common.metricsActions");
    return (
    <Dropdown.Root>
        <Dropdown.DotsButton />

        <Dropdown.Popover className="w-min">
            <Dropdown.Menu>
                <Dropdown.Item icon={Eye}>
                    <span className="pr-4">{t("viewMore")}</span>
                </Dropdown.Item>
                <Dropdown.Item icon={Share01}>
                    <span className="pr-4">{t("share")}</span>
                </Dropdown.Item>
                <Dropdown.Item icon={Copy01}>
                    <span className="pr-4">{t("copyLink")}</span>
                </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown.Popover>
    </Dropdown.Root>
    );
};

interface MetricChangeIndicatorProps {
    trend: "positive" | "negative";
    value?: string;
    className?: string;
}

/**
 * MetricChangeIndicator — chip de tendencia KPI.
 *
 * Unificado (2026-05-22) con el patrón de /actividad: UU `IconBadge`
 * pill-color sm con `color=success/error` + icono direccional dinámico
 * (ArrowUp en positive, ArrowDown en negative). Antes usaba texto plano
 * coloreado y iconos `TrendUp01/TrendDown01` — visualmente inconsistente
 * con KpiCard de /actividad. Ahora ambos dashboards muestran el delta de
 * forma idéntica.
 */
const MetricChangeIndicator = ({ trend, value, className }: MetricChangeIndicatorProps) => {
    return (
        <IconBadge
            type="pill-color"
            color={trend === "positive" ? "success" : "error"}
            size="sm"
            iconLeading={trend === "positive" ? ArrowUp : ArrowDown}
            className={className}
        >
            {value ?? ""}
        </IconBadge>
    );
};

const lineData3 = [{ value: 0 }, { value: 9 }, { value: 6 }, { value: 15 }];

export const MetricsChart03 = ({
    title = "2,000",
    subtitle = "View 24 hours",
    change,
    changeTrend,
    changeDescription,
    chartColor,
    chartAreaFill,
    chartCurveType,
    chartData = lineData3,
    footer,
    className,
}: {
    title?: string;
    subtitle?: string;
    /** Texto del delta (incluye %, signo, etc.). */
    change: string;
    /** Color del badge: success (verde) o error (rojo). */
    changeTrend: "positive" | "negative";
    /** Texto opcional al lado del badge — útil cuando el período no es
     *  obvio en el contexto (sin calendar picker visible). */
    changeDescription?: string;
    chartColor?: string;
    chartAreaFill?: string;
    chartCurveType?: CurveType;
    chartData?: { value: number }[];
    footer?: ReactNode;
    className?: string;
}) => {
    const id = useId();

    chartColor = chartColor ?? (changeTrend === "positive" ? "text-fg-success-secondary" : "text-fg-error-secondary");

    return (
        <div className={cx("rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset", className)}>
            <div className="relative flex flex-col gap-4 px-4 py-5 md:gap-5 md:px-5">
                <div className="flex flex-col gap-2">
                    {/* A11y: era <h3> pero el "subtitle" de una metric card
                         es semánticamente un label, no un section heading.
                         Causaba heading-skip (h1→h3) en /gmb. Cambiado a <p>:
                         identidad visual idéntica + outline limpio. */}
                    <p className="text-sm font-medium text-tertiary">{subtitle}</p>

                    <div className="flex items-center gap-4">
                        <p className="flex-1 text-display-sm font-semibold text-primary">{title}</p>
                        <div className="flex gap-2">
                            <MetricChangeIndicator trend={changeTrend} value={change} />
                            {changeDescription && <span className="text-sm font-medium text-tertiary">{changeDescription}</span>}
                        </div>
                    </div>
                </div>

                <ResponsiveContainer initialDimension={{ width: 1, height: 1 }} height={72}>
                    <AreaChart
                        data={chartData}
                        margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="currentColor" className={chartColor} stopOpacity="1" />
                                <stop offset="95%" stopColor="currentColor" className={chartColor} stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        <Area
                            isAnimationActive={false}
                            className={chartColor}
                            dataKey="value"
                            type={chartCurveType || "monotone"}
                            stroke="currentColor"
                            strokeWidth={2}
                            fill={chartAreaFill || `url(#gradient-${id})`}
                            fillOpacity={0.2}
                            activeDot={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>

                <div className="absolute top-4 right-4 md:top-5 md:right-5">
                    <ActionsDropdown />
                </div>
            </div>

            {footer && <div className="flex items-center justify-end border-t border-secondary p-3 pr-4 md:p-4 md:pr-5">{footer}</div>}
        </div>
    );
};
