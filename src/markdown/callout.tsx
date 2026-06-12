import type { FC, ReactNode } from "react";
import { AlertOctagon, AlertTriangle, AnnotationAlert, InfoCircle, Lightbulb02 } from "@hm/icons";
import { Surface } from "@/components/base/surface/surface";
import { cx } from "@/utils/cx";

export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";

interface KindSpec {
    icon: FC<{ className?: string }>;
    label: string;
    iconClass: string;
}

export const CALLOUT_KINDS: Record<CalloutKind, KindSpec> = {
    note: { icon: InfoCircle, label: "Nota", iconClass: "text-utility-blue-600" },
    tip: { icon: Lightbulb02, label: "Consejo", iconClass: "text-utility-success-600" },
    important: { icon: AnnotationAlert, label: "Importante", iconClass: "text-utility-purple-600" },
    warning: { icon: AlertTriangle, label: "Atención", iconClass: "text-utility-warning-600" },
    caution: { icon: AlertOctagon, label: "Cuidado", iconClass: "text-utility-error-600" },
};

/**
 * Callout estilo Notion para los alerts de GFM (`> [!NOTE]` …),
 * construido sobre la Surface del kit: superficie neutra elevada,
 * el color vive solo en el icono (nada de fondos tintados).
 */
export function Callout({ kind, children }: { kind: CalloutKind; children: ReactNode }) {
    const spec = CALLOUT_KINDS[kind];
    const Icon = spec.icon;

    return (
        <Surface tone="default" padding="lg" radius="md" className="my-5 flex gap-3">
            <Icon className={cx("mt-0.5 size-5 shrink-0", spec.iconClass)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary">{spec.label}</p>
                <div className="mt-1 text-sm leading-relaxed text-tertiary [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">{children}</div>
            </div>
        </Surface>
    );
}
