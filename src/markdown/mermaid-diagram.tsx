import { useEffect, useRef, useState } from "react";
import { CodeBlock } from "./code-block";

let seq = 0;

/** ¿Está activo el modo oscuro? (clase en <html>) */
function isDark(): boolean {
    return document.documentElement.classList.contains("dark-mode");
}

/**
 * Renderiza un bloque ```mermaid como diagrama SVG (import lazy: mermaid
 * pesa ~1.5 MB y solo se carga si el documento lo usa). Si el diagrama
 * no parsea, cae al bloque de código normal para no perder contenido.
 */
export function MermaidDiagram({ code }: { code: string }) {
    const [svg, setSvg] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const [dark, setDark] = useState(isDark);
    const idRef = useRef(`mb-mermaid-${++seq}`);

    // Seguir el cambio de tema (el toggle vive fuera del renderer)
    useEffect(() => {
        const observer = new MutationObserver(() => setDark(isDark()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const mermaid = (await import("mermaid")).default;
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: "strict",
                    theme: dark ? "dark" : "neutral",
                    fontFamily: "var(--font-body)",
                });
                const { svg } = await mermaid.render(`${idRef.current}-${dark ? "d" : "l"}`, code);
                if (!cancelled) setSvg(svg);
            } catch {
                if (!cancelled) setFailed(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [code, dark]);

    if (failed) return <CodeBlock code={code} lang="text" />;
    if (!svg) {
        return <div className="my-6 h-40 animate-pulse rounded-xl bg-secondary" aria-label="Generando diagrama…" />;
    }

    return (
        <figure
            className="my-6 flex justify-center overflow-x-auto rounded-xl border border-secondary bg-primary_alt p-5 [&_svg]:h-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
