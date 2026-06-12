/**
 * ChatPanel — réplica del chat-assistant de MOPTIONS: una TERMINAL.
 *
 * Como en Warp, cada intercambio es un BLOQUE discreto: tarjeta con
 * canalón de acento a la izquierda (marca=tú, verde=agente), cabecera
 * `❯ tú` / `agente` + hora que al hover revela copiar, cuerpo
 * monoespaciado y plegable. El composer es el prompt: `❯` teal,
 * textarea mono, divisor gradiente y toolbar con el icono de Claude.
 *
 * El "modelo" es Claude Code sandboxeado al documento activo, y al
 * teclear «/» se autocompletan sus slash commands (↑↓/Enter/Tab).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, ChevronRight, Copy01, MessagePlusSquare, FolderClosed } from "@hm/icons";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { cx } from "@/utils/cx";

// Paleta Warp dark (el default del terminal de Moptions)
const TERM_BG = "#181818";
const TERM_FG = "#d8d8d8";
const TERM_TEAL = "#7cafc2";
const TERM_CLAY = "#D97757";

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    error?: boolean;
}

interface ChatEvent {
    kind: "delta" | "done" | "error";
    docPath: string;
    text?: string;
    message?: string;
    isError?: boolean;
}

interface SlashCommand {
    name: string;
    description: string;
}

interface ChatPanelProps {
    docPath: string;
    /** Contenido ACTUAL del doc — viaja en cada turno, así el asistente
     *  siempre conoce la última versión autoguardada. */
    docContent: string;
    fileTitle: string;
    onClose: () => void;
}

let nextId = 0;
const genId = () => `m${++nextId}-${performance.now().toFixed(0)}`;

const IS_TAURI = "__TAURI_INTERNALS__" in window;

/** Preview en navegador (vite dev): datos de muestra para validar la UI. */
const DEMO_COMMANDS: SlashCommand[] = [
    { name: "compact", description: "Compacta la conversación conservando lo esencial" },
    { name: "cost", description: "Coste y duración de la sesión actual" },
    { name: "context", description: "Visualiza el uso de contexto de la sesión" },
    { name: "review", description: "Revisa el documento con ojo crítico" },
    { name: "status", description: "Estado de Claude Code (modelo, cuenta, sesión)" },
];

/** Conversaciones por documento — viven mientras la app esté abierta,
 *  igual que el mapa de sesiones --resume del backend. */
const conversationStore = new Map<string, ChatMessage[]>();
const streamingStore = new Set<string>();

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/** Marca "sunburst" de Claude (réplica de foundations/claude-icon de Moptions). */
function ClaudeIcon({ className }: { className?: string }) {
    const rays = Array.from({ length: 12 }, (_, i) => i * 30);
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                {rays.map((deg) => {
                    const a = (deg * Math.PI) / 180;
                    return <line key={deg} x1={12 + Math.cos(a) * 3.1} y1={12 + Math.sin(a) * 3.1} x2={12 + Math.cos(a) * 9.3} y2={12 + Math.sin(a) * 9.3} />;
                })}
            </g>
        </svg>
    );
}

/** Línea de estado "pensando" (estilo ToolStatusLine de Moptions). */
function ThinkingLine() {
    return (
        <div className="flex items-center gap-2 py-0.5">
            <span className="size-2 animate-pulse rounded-full bg-utility-brand-500" />
            <span className="text-[12px] text-[#8E8E93]">pensando…</span>
        </div>
    );
}

/** TerminalBlock — réplica del bloque Warp de Moptions (sin dep motion:
 *  la entrada usa hm-fade-swap). */
function TerminalBlock({ message }: { message: ChatMessage }) {
    const isUser = message.role === "user";
    const [collapsed, setCollapsed] = useState(false);
    const [copied, setCopied] = useState(false);

    const hasText = !!message.content;
    const thinking = !isUser && !hasText;

    function copy() {
        if (!message.content) return;
        void navigator.clipboard?.writeText(message.content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        });
    }

    return (
        <div className="group hm-fade-swap relative overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.02] transition-colors hover:border-white/15 hover:bg-white/[0.04]">
            {/* Canalón de acento (verde=salida del agente, marca=comando del usuario) */}
            <span aria-hidden className={cx("absolute top-0 left-0 h-full w-[2px]", isUser ? "bg-brand-solid/70" : "bg-utility-green-500/60")} />

            {/* Cabecera: prompt + hora + (hover) copiar */}
            <div className="flex items-center justify-between px-3 pt-1.5 pl-3.5">
                <button
                    type="button"
                    onClick={() => setCollapsed((c) => !c)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 transition-colors hover:text-white/75"
                >
                    {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                    <span className={cx("font-hack", isUser ? "text-[#7cafc2]" : "text-utility-green-400")}>{isUser ? "❯ tú" : "agente"}</span>
                    <span className="text-white/25 tabular-nums">{formatTime(message.timestamp)}</span>
                </button>

                {hasText && (
                    <button
                        type="button"
                        onClick={copy}
                        aria-label="Copiar bloque"
                        title="Copiar"
                        className="text-white/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white/85"
                    >
                        {copied ? <Check className="size-3.5 text-utility-green-400" /> : <Copy01 className="size-3.5" />}
                    </button>
                )}
            </div>

            {/* Cuerpo */}
            {!collapsed && (
                <div className="px-3 pt-1 pb-2.5 pl-3.5">
                    {thinking ? (
                        <ThinkingLine />
                    ) : (
                        <div
                            className={cx("font-hack text-[13px] leading-[1.55] whitespace-pre-wrap", message.error && "text-error-primary")}
                            style={message.error ? undefined : { color: TERM_FG }}
                        >
                            {message.content}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function ChatPanel({ docPath, docContent, fileTitle, onClose }: ChatPanelProps) {
    const [, force] = useState(0);
    const rerender = useCallback(() => force((n) => n + 1), []);
    const [input, setInput] = useState("");
    const [focused, setFocused] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [commands, setCommands] = useState<SlashCommand[]>([]);
    const [cmdIndex, setCmdIndex] = useState(0);
    const cmdDismissed = useRef(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const messages = conversationStore.get(docPath) ?? [];
    const isStreaming = streamingStore.has(docPath);

    // ── Slash commands ────────────────────────────────────────────────
    useEffect(() => {
        if (!IS_TAURI) {
            setCommands(DEMO_COMMANDS);
            return;
        }
        invoke<SlashCommand[]>("chat_list_commands")
            .then(setCommands)
            .catch(() => {});
    }, []);

    const slashQuery = input.startsWith("/") && !input.includes(" ") && !input.includes("\n") ? input.slice(1).toLowerCase() : null;
    const filteredCommands = useMemo(() => {
        if (slashQuery === null || cmdDismissed.current) return [];
        const starts = commands.filter((c) => c.name.toLowerCase().startsWith(slashQuery));
        const contains = commands.filter((c) => !c.name.toLowerCase().startsWith(slashQuery) && c.name.toLowerCase().includes(slashQuery));
        return [...starts, ...contains].slice(0, 12);
    }, [commands, slashQuery]);

    useEffect(() => {
        setCmdIndex(0);
    }, [slashQuery]);

    const pickCommand = useCallback((cmd: SlashCommand) => {
        setInput(`/${cmd.name} `);
        inputRef.current?.focus();
    }, []);

    // ── Stream global: cada evento al bucket de SU documento ──────────
    useEffect(() => {
        const un = listen<ChatEvent>("chat-event", (event) => {
            const { kind, docPath: path, text, message } = event.payload;
            const bucket = conversationStore.get(path);
            if (!bucket) return;
            const last = bucket[bucket.length - 1];
            if (kind === "delta" && last?.role === "assistant") {
                last.content += text ?? "";
            } else if (kind === "done") {
                streamingStore.delete(path);
            } else if (kind === "error") {
                streamingStore.delete(path);
                if (last?.role === "assistant" && last.content === "") {
                    last.content = message ?? "Algo ha fallado.";
                    last.error = true;
                }
            }
            rerender();
        });
        return () => {
            void un.then((f) => f());
        };
    }, [rerender]);

    // Autoscroll al final con cada delta
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    });

    // Autogrow del textarea (estilo Moptions: min 22px, max 128px)
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        if (input) el.style.height = Math.min(el.scrollHeight, 128) + "px";
    }, [input]);

    const sendMessage = useCallback(
        (message: string) => {
            if (!message || streamingStore.has(docPath)) return;
            const bucket = conversationStore.get(docPath) ?? [];
            bucket.push({ id: genId(), role: "user", content: message, timestamp: Date.now() });
            bucket.push({ id: genId(), role: "assistant", content: "", timestamp: Date.now() });
            conversationStore.set(docPath, bucket);
            streamingStore.add(docPath);
            rerender();
            if (!IS_TAURI) {
                // Demo en navegador: respuesta simulada
                setTimeout(() => {
                    const b = conversationStore.get(docPath);
                    const last = b?.[b.length - 1];
                    if (last?.role === "assistant") last.content = `demo — en la app nativa respondería sobre «${docPath.split("/").pop()}».\nHas dicho: ${message}`;
                    streamingStore.delete(docPath);
                    rerender();
                }, 1200);
                return;
            }
            invoke("chat_send", { docPath, docContent, message }).catch((e) => {
                streamingStore.delete(docPath);
                const b = conversationStore.get(docPath);
                const last = b?.[b.length - 1];
                if (last?.role === "assistant") {
                    last.content = String(e);
                    last.error = true;
                }
                rerender();
            });
        },
        [docPath, docContent, rerender],
    );

    const handleSubmit = useCallback(() => {
        const text = input.trim();
        if (!text || isStreaming) return;
        cmdDismissed.current = false;
        setInput("");
        sendMessage(text);
    }, [input, isStreaming, sendMessage]);

    /** Teclas del prompt: primero el menú de comandos (↑↓/Enter/Tab/Esc),
     *  después Enter envía (Shift+Enter = nueva línea). */
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (filteredCommands.length) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCmdIndex((i) => (i + 1) % filteredCommands.length);
                    return;
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCmdIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
                    return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    pickCommand(filteredCommands[cmdIndex]);
                    return;
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    cmdDismissed.current = true;
                    rerender();
                    return;
                }
            }
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [filteredCommands, cmdIndex, pickCommand, handleSubmit, rerender],
    );

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        cmdDismissed.current = false;
        setInput(e.target.value);
    }, []);

    const resetConversation = useCallback(() => {
        conversationStore.set(docPath, []);
        streamingStore.delete(docPath);
        void invoke("chat_reset", { docPath }).catch(() => {});
        rerender();
        inputRef.current?.focus();
    }, [docPath, rerender]);

    // Hook de test/automatización: MB_CHAT_TEST (+ MB_CHAT_TEST2 tras la
    // primera respuesta, para validar la continuidad --resume).
    const chatTest = useRef<{ ran: boolean; second: string | null; secondSent: boolean }>({ ran: false, second: null, secondSent: false });
    useEffect(() => {
        if (chatTest.current.ran || !IS_TAURI) return;
        chatTest.current.ran = true;
        void invoke<[string | null, string | null]>("get_chat_test")
            .then(([first, second]) => {
                chatTest.current.second = second ?? null;
                if (first && (conversationStore.get(docPath)?.length ?? 0) === 0) sendMessage(first);
            })
            .catch(() => {});
    }, [docPath, sendMessage]);
    useEffect(() => {
        const t = chatTest.current;
        if (!isStreaming && t.second && !t.secondSent && messages.length === 2) {
            t.secondSent = true;
            sendMessage(t.second);
        }
    }, [isStreaming, messages.length, sendMessage]);

    return (
        <div className="flex h-full w-90 flex-col" style={{ backgroundColor: TERM_BG, color: TERM_FG }}>
            {/* ── Header de la terminal ───────────────────────────────── */}
            <div className="relative flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Ocultar asistente"
                        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md p-2 text-white/40 transition-colors duration-150 hover:bg-white/10 hover:text-white/85"
                    >
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
                            <path d="m6 17 5-5-5-5m7 10 5-5-5-5" />
                        </svg>
                    </button>
                    <span className="font-hack truncate px-1 text-[13px] font-medium text-white/85">{fileTitle}.md</span>
                </div>
                <div className="flex items-center gap-px">
                    {messages.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setConfirmOpen(true)}
                            aria-label="Nueva conversación"
                            className="inline-flex size-9 items-center justify-center rounded-md p-2 text-white/40 transition-colors duration-150 hover:bg-white/10 hover:text-white/85"
                        >
                            <MessagePlusSquare className="size-5" aria-hidden="true" />
                        </button>
                    )}
                </div>

                {/* Popover de confirmación (oscuro, terminal) */}
                {confirmOpen && (
                    <>
                        <div aria-hidden="true" onClick={() => setConfirmOpen(false)} className="fixed inset-0 z-[10050]" />
                        <div
                            role="alertdialog"
                            className="absolute top-[calc(100%+6px)] right-2 z-[10051] w-72 rounded-xl p-3.5 shadow-lg ring-1 ring-white/15"
                            style={{ backgroundColor: "#1f1f1f" }}
                        >
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-white/90">¿Empezar de nuevo?</p>
                                    <p className="text-xs text-white/50">La conversación actual con el documento se descartará.</p>
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmOpen(false)}
                                        className="inline-flex cursor-pointer items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold text-white/55 transition-colors duration-150 hover:bg-white/10"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setConfirmOpen(false);
                                            resetConversation();
                                        }}
                                        className="inline-flex cursor-pointer items-center justify-center rounded-md bg-brand-solid px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-solid_hover"
                                    >
                                        Empezar nueva
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Bloques (Warp) ──────────────────────────────────────── */}
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {messages.length === 0 ? (
                    <div className="font-hack flex h-full flex-col items-start justify-end gap-1 px-1 pb-2 text-[13px] leading-[1.7]">
                        <p className="text-white/60">
                            <span className="text-utility-green-400">agente</span> listo · solo conoce <span className="text-white/85">{fileTitle}.md</span>
                        </p>
                        <p className="text-white/35">resúmenes, dudas, "¿dónde dice…?"</p>
                        <p className="text-white/35">
                            <span className="text-[#7cafc2]">/</span> para los comandos de Claude Code
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {messages.map((msg) => (
                            <TerminalBlock key={msg.id} message={msg} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Composer (prompt de Warp, réplica Moptions) ─────────── */}
            <footer className="relative shrink-0 p-3 pt-1">
                {/* Menú de slash commands (terminal) */}
                {filteredCommands.length > 0 && (
                    <div
                        role="listbox"
                        aria-label="Comandos de Claude Code"
                        className="absolute right-3 bottom-full left-3 z-30 mb-1.5 max-h-72 overflow-y-auto rounded-xl p-1 shadow-lg ring-1 ring-white/15"
                        style={{ backgroundColor: "#1f1f1f" }}
                    >
                        {filteredCommands.map((cmd, i) => (
                            <button
                                key={cmd.name}
                                type="button"
                                role="option"
                                aria-selected={i === cmdIndex}
                                onMouseEnter={() => setCmdIndex(i)}
                                onClick={() => pickCommand(cmd)}
                                className={cx(
                                    "flex w-full cursor-pointer items-baseline gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors duration-100",
                                    i === cmdIndex ? "bg-white/10" : "hover:bg-white/10",
                                )}
                            >
                                <span className="font-hack shrink-0 text-[13px] font-medium text-[#7cafc2]">/{cmd.name}</span>
                                <span className="font-hack min-w-0 truncate text-[11px] text-white/45">{cmd.description}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className={cx("rounded-xl border transition-colors", focused ? "border-[#7cafc2]/50 bg-white/[0.05]" : "border-white/10 bg-white/[0.035]")}>
                    {/* Prompt: ❯ + textarea + chip del documento (el "tab" de Warp) */}
                    <div className="flex items-start gap-2 px-3 pt-2.5">
                        <span className="font-hack mt-[3px] shrink-0 text-[15px] leading-none text-[#7cafc2] select-none">❯</span>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            placeholder="Mensaje al agente…"
                            aria-label="Mensaje para el asistente"
                            rows={1}
                            disabled={isStreaming}
                            className="font-hack max-h-32 min-h-[22px] w-full resize-none bg-transparent text-[14px] leading-[1.45] placeholder:text-white/30 focus:outline-none disabled:opacity-50"
                            style={{ color: TERM_FG }}
                        />
                        <span className="font-hack mt-[1px] shrink-0 rounded-md bg-[#7cafc2]/15 px-2 py-0.5 text-[11px] font-medium text-[#7cafc2]">{fileTitle}.md</span>
                    </div>

                    {/* Línea de acento teal (como en Warp) */}
                    <div className="mx-3 mt-2 h-px bg-gradient-to-r from-[#7cafc2]/45 via-[#7cafc2]/12 to-transparent" />

                    {/* Toolbar */}
                    <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
                        <span className="flex size-7 shrink-0 items-center justify-center" title="Claude Code">
                            <ClaudeIcon className="size-[16px] text-[#D97757]" />
                        </span>

                        {/* / comandos */}
                        <button
                            type="button"
                            title="Comandos de Claude Code"
                            onClick={() => {
                                cmdDismissed.current = false;
                                setInput("/");
                                inputRef.current?.focus();
                            }}
                            className="font-hack flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-white/[0.03] px-2 text-[12px] text-white/65 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white/90"
                        >
                            <span className="text-[#7cafc2]">/</span> comandos
                        </button>

                        {/* derecha: cwd + enviar */}
                        <div className="ml-auto flex shrink-0 items-center gap-1 pl-1">
                            <span className="font-hack hidden h-7 items-center gap-1.5 rounded-md bg-white/[0.03] px-2 text-[12px] text-white/55 ring-1 ring-white/10 md:flex">
                                <FolderClosed className="size-[14px]" /> ~/{fileTitle}.md
                            </span>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!input.trim() || isStreaming}
                                aria-label="Enviar"
                                className={cx(
                                    "flex size-7 items-center justify-center rounded-md transition-colors active:scale-90",
                                    input.trim() && !isStreaming ? "bg-brand-solid text-white" : "bg-white/10 text-white/30",
                                )}
                            >
                                <ArrowUp className="size-[17px]" strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
