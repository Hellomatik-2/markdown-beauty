/**
 * ChatPanel — la TERMINAL de Claude Code de verdad, como el /terminal
 * de Moptions: un iframe a ttyd (xterm.js por websocket) donde corre el
 * CLI `claude` INTERACTIVO completo — su TUI real, su autocompletado de
 * comandos real, sus permisos reales. Sin UI inventada encima.
 *
 * El agente nace scoped al documento activo: la app regenera el prompt
 * del sistema (chat_set_doc) y cada sesión nueva de la terminal lo lee.
 * Cada documento mantiene SU terminal viva (iframes persistentes
 * ocultos, como el iframe único de Moptions que nunca se desmonta).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCcw01 } from "@hm/icons";
import { invoke } from "@tauri-apps/api/core";

const TERM_BG = "#181818";

interface ChatPanelProps {
    docPath: string;
    /** Contenido ACTUAL del doc — el prompt se regenera con cada cambio
     *  (autosave incluido); las sesiones nuevas nacen al día. */
    docContent: string;
    fileTitle: string;
    onClose: () => void;
}

const IS_TAURI = "__TAURI_INTERNALS__" in window;

/** Terminales vivas por documento (clave → reloadKey). Persisten
 *  mientras la app esté abierta, aunque cambies de pestaña. */
const terminalStore = new Map<string, number>();

export function ChatPanel({ docPath, docContent, fileTitle, onClose }: ChatPanelProps) {
    const [, force] = useState(0);
    const rerender = useCallback(() => force((n) => n + 1), []);
    const [url, setUrl] = useState<string | null>(null);
    const readyDocs = useRef(new Set<string>());

    useEffect(() => {
        if (!IS_TAURI) return;
        invoke<string>("chat_terminal_url")
            .then(setUrl)
            .catch(() => {});
    }, []);

    // Prompt del documento SIEMPRE al día (cada autosave lo refresca);
    // la terminal del doc solo se monta cuando su prompt ya está escrito.
    useEffect(() => {
        if (!IS_TAURI) return;
        let cancelled = false;
        invoke("chat_set_doc", { docPath, docContent })
            .then(() => {
                if (cancelled) return;
                if (!terminalStore.has(docPath)) terminalStore.set(docPath, 0);
                readyDocs.current.add(docPath);
                rerender();
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [docPath, docContent, rerender]);

    const restartSession = useCallback(() => {
        // remonta SOLO el iframe del doc activo → claude nuevo con el
        // prompt recién regenerado
        terminalStore.set(docPath, (terminalStore.get(docPath) ?? 0) + 1);
        rerender();
    }, [docPath, rerender]);

    const terminals = Array.from(terminalStore.entries()).filter(([path]) => readyDocs.current.has(path));

    return (
        <div className="flex h-full w-90 flex-col" style={{ backgroundColor: TERM_BG }}>
            {/* ── Cabecera mínima ─────────────────────────────────────── */}
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Ocultar terminal"
                        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md p-2 text-white/40 transition-colors duration-150 hover:bg-white/10 hover:text-white/85"
                    >
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
                            <path d="m6 17 5-5-5-5m7 10 5-5-5-5" />
                        </svg>
                    </button>
                    <span className="font-hack truncate px-1 text-[13px] font-medium text-white/85">{fileTitle}.md</span>
                </div>
                <button
                    type="button"
                    onClick={restartSession}
                    aria-label="Nueva sesión con este documento"
                    title="Nueva sesión con este documento"
                    className="inline-flex size-9 items-center justify-center rounded-md p-2 text-white/40 transition-colors duration-150 hover:bg-white/10 hover:text-white/85"
                >
                    <RefreshCcw01 className="size-4.5" aria-hidden="true" />
                </button>
            </div>

            {/* ── La terminal (ttyd + claude interactivo) ─────────────── */}
            <div className="relative min-h-0 flex-1">
                {!IS_TAURI ? (
                    <div className="font-hack flex h-full flex-col items-start justify-end gap-1 px-4 pb-4 text-[13px] leading-[1.7]">
                        <p className="text-white/60">modo preview — la terminal real (ttyd + claude) solo corre en la app nativa</p>
                    </div>
                ) : (
                    url &&
                    terminals.map(([path, reload]) => (
                        <iframe
                            key={`${path}|${reload}`}
                            src={url}
                            title={`Claude Code — ${path.split("/").pop()}`}
                            allow="clipboard-read; clipboard-write"
                            className="absolute inset-0 size-full border-0"
                            style={{ display: path === docPath ? undefined : "none", backgroundColor: TERM_BG }}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
