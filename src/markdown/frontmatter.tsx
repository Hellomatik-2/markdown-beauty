import { parse as parseYaml } from "yaml";
import { Badge } from "@/components/base/badges/badges";

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface Frontmatter {
    data: Record<string, unknown>;
    /** Contenido sin el bloque YAML. */
    body: string;
}

/** Separa el frontmatter YAML del cuerpo. Devuelve data vacía si no hay. */
export function splitFrontmatter(content: string): Frontmatter {
    const match = FM_RE.exec(content);
    if (!match) return { data: {}, body: content };
    try {
        const data = parseYaml(match[1]);
        if (data && typeof data === "object" && !Array.isArray(data)) {
            return { data: data as Record<string, unknown>, body: content.slice(match[0].length) };
        }
    } catch {
        /* YAML inválido: mostrar el documento tal cual */
    }
    return { data: {}, body: content };
}

function formatScalar(value: unknown): string {
    if (value instanceof Date) return value.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
    if (typeof value === "boolean") return value ? "Sí" : "No";
    if (value == null) return "—";
    return String(value);
}

function PropertyValue({ value }: { value: unknown }) {
    if (Array.isArray(value)) {
        return (
            <span className="flex flex-wrap items-center gap-1">
                {value.map((item, i) => (
                    <Badge key={i} size="sm" color="gray" type="modern">
                        {formatScalar(item)}
                    </Badge>
                ))}
            </span>
        );
    }
    if (value != null && typeof value === "object") {
        return <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary">{JSON.stringify(value)}</code>;
    }
    return <span className="text-sm text-secondary">{formatScalar(value)}</span>;
}

/**
 * Propiedades del documento (frontmatter) estilo Notion: filas discretas
 * clave → valor encima del contenido, separadas por un divisor.
 */
export function FrontmatterProperties({ data }: { data: Record<string, unknown> }) {
    const entries = Object.entries(data);
    if (entries.length === 0) return null;

    return (
        <div className="no-print mb-8 border-b border-secondary pb-6">
            <dl className="flex flex-col gap-1.5">
                {entries.map(([key, value]) => (
                    <div key={key} className="flex items-baseline gap-3">
                        <dt className="w-32 shrink-0 truncate text-sm text-quaternary capitalize">{key.replace(/[_-]/g, " ")}</dt>
                        <dd className="min-w-0">
                            <PropertyValue value={value} />
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
