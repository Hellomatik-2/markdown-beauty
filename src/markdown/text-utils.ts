import { isValidElement, type ReactNode } from "react";

/** Texto plano de un árbol de nodos React (para slugs y aria-labels). */
export function textOf(node: ReactNode): string {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(textOf).join("");
    if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
    return "";
}

/** Slugger con contador de duplicados (estilo GitHub). */
export function createSlugger() {
    const seen = new Map<string, number>();
    return (text: string): string => {
        const base =
            text
                .toLowerCase()
                .trim()
                .normalize("NFKD")
                .replace(/[̀-ͯ]/g, "")
                .replace(/[^a-z0-9\s_-]/g, "")
                .replace(/[\s_]+/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "") || "seccion";
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        return n === 0 ? base : `${base}-${n}`;
    };
}

/** dirname para rutas POSIX (macOS). */
export function dirname(path: string): string {
    const i = path.lastIndexOf("/");
    return i <= 0 ? "/" : path.slice(0, i);
}

/** Resuelve `relative` contra `baseDir` normalizando `.` y `..`. */
export function resolvePath(baseDir: string, relative: string): string {
    if (relative.startsWith("/")) return relative;
    const segments = baseDir.split("/").filter(Boolean);
    for (const part of relative.split("/")) {
        if (part === "" || part === ".") continue;
        if (part === "..") segments.pop();
        else segments.push(part);
    }
    return "/" + segments.join("/");
}
