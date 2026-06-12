/**
 * ChatPanel — el iChat del widget :5174 portado tal cual (PromptInput +
 * Message + MatrixLoader, mismas clases) con dos diferencias de fondo:
 * el "modelo" es un Claude Code sandboxeado al documento activo, y el
 * input autocompleta los slash commands de Claude Code (lista filtrable
 * con ↑↓/Enter/Tab, como el propio CLI).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessagePlusSquare } from "@hm/icons";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { cx } from "@/utils/cx";
import { MarkdownRenderer } from "../markdown/markdown-renderer";
import { MatrixLoader } from "./matrix-loader";
import { Message, MessageContent } from "./message";
import { PromptInput, PromptInputSubmit, PromptInputTextarea, PromptInputToolbar, PromptInputTools } from "./prompt-input";

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
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

/** Preview en navegador (vite dev): comandos y respuestas de muestra
 *  para poder ver/validar la UI sin el backend nativo. */
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

/** TypingDots del widget: MatrixLoader + label (réplica exacta). */
function TypingDots({ label }: { label?: string }) {
    return (
        <span className="inline-flex items-center gap-1.5" role="status">
            <MatrixLoader size={16} />
            <span
                key={label || "thinking"}
                className="hm-fade-swap text-sm font-medium"
                style={{ color: "color-mix(in srgb, var(--color-text-primary) 50%, transparent)" }}
            >
                {label || "Pensando…"}
            </span>
        </span>
    );
}

export function ChatPanel({ docPath, docContent, fileTitle, onClose }: ChatPanelProps) {
    const [, force] = useState(0);
    const rerender = useCallback(() => force((n) => n + 1), []);
    const [input, setInput] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [commands, setCommands] = useState<SlashCommand[]>([]);
    const [cmdIndex, setCmdIndex] = useState(0);
    const cmdDismissed = useRef(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const messages = conversationStore.get(docPath) ?? [];
    const isStreaming = streamingStore.has(docPath);

    // ── Slash commands: lista una vez, menú filtrado mientras se teclea ─
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
        textareaRef.current?.focus();
    }, []);

    /** Navegación del menú en fase captura: ↑↓ mueven, Enter/Tab completan
     *  (sin enviar), Esc lo cierra — antes de que el textarea procese. */
    const onComposerKeyDownCapture = useCallback(
        (e: React.KeyboardEvent) => {
            if (!filteredCommands.length) return;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                setCmdIndex((i) => (i + 1) % filteredCommands.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                setCmdIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();
                pickCommand(filteredCommands[cmdIndex]);
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cmdDismissed.current = true;
                rerender();
            }
        },
        [filteredCommands, cmdIndex, pickCommand, rerender],
    );

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

    const sendMessage = useCallback(
        (message: string) => {
            if (!message || streamingStore.has(docPath)) return;
            const bucket = conversationStore.get(docPath) ?? [];
            bucket.push({ id: genId(), role: "user", content: message });
            bucket.push({ id: genId(), role: "assistant", content: "" });
            conversationStore.set(docPath, bucket);
            streamingStore.add(docPath);
            rerender();
            if (!IS_TAURI) {
                // Demo en navegador: respuesta simulada
                setTimeout(() => {
                    const b = conversationStore.get(docPath);
                    const last = b?.[b.length - 1];
                    if (last?.role === "assistant") last.content = `**Demo** — en la app nativa respondería sobre «${docPath.split("/").pop()}». Has dicho: ${message}`;
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

    const handleSubmit = useCallback(
        (text: string) => {
            cmdDismissed.current = false;
            sendMessage(text);
        },
        [sendMessage],
    );

    const handleValueChange = useCallback((next: string) => {
        cmdDismissed.current = false;
        setInput(next);
    }, []);

    const resetConversation = useCallback(() => {
        conversationStore.set(docPath, []);
        streamingStore.delete(docPath);
        void invoke("chat_reset", { docPath }).catch(() => {});
        rerender();
        textareaRef.current?.focus();
    }, [docPath, rerender]);

    // Hook de test/automatización: MB_CHAT_TEST (+ MB_CHAT_TEST2 tras la
    // primera respuesta, para validar la continuidad --resume).
    const chatTest = useRef<{ ran: boolean; second: string | null; secondSent: boolean }>({ ran: false, second: null, secondSent: false });
    useEffect(() => {
        if (chatTest.current.ran) return;
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

    const status = isStreaming ? "streaming" : "idle";
    const lastMsg = messages[messages.length - 1];

    return (
        <div className="flex h-full w-90 flex-col bg-primary">
            {/* ── Header (réplica WidgetHeader) ───────────────────────── */}
            <div className="relative flex h-12 shrink-0 items-center justify-between gap-3 border-b border-secondary/60 px-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Ocultar asistente"
                        className="group relative inline-flex size-9 cursor-pointer items-center justify-center rounded-md p-2 text-fg-quaternary outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
                            <path d="m6 17 5-5-5-5m7 10 5-5-5-5" />
                        </svg>
                    </button>
                    <span className="hm-fade-swap truncate px-1 text-sm font-semibold text-primary">{fileTitle}</span>
                </div>
                <div className="flex items-center gap-px">
                    {messages.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setConfirmOpen(true)}
                            aria-label="Nueva conversación"
                            className="inline-flex size-9 items-center justify-center rounded-md p-2 text-fg-quaternary outline-focus-ring transition-colors duration-150 hover:bg-primary_hover hover:text-fg-quaternary_hover"
                        >
                            <MessagePlusSquare className="size-5" aria-hidden="true" />
                        </button>
                    )}
                </div>

                {/* Popover de confirmación (réplica WidgetHeader) */}
                {confirmOpen && (
                    <>
                        <div aria-hidden="true" onClick={() => setConfirmOpen(false)} className="fixed inset-0 z-[10050]" />
                        <div role="alertdialog" className="absolute top-[calc(100%+6px)] right-2 z-[10051] w-72 rounded-xl bg-primary p-3.5 shadow-lg ring-1 ring-secondary">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-primary">¿Empezar de nuevo?</p>
                                    <p className="text-xs text-tertiary">La conversación actual con el documento se descartará.</p>
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmOpen(false)}
                                        className="inline-flex cursor-pointer items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold text-tertiary outline-focus-ring transition-colors duration-150 hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setConfirmOpen(false);
                                            resetConversation();
                                        }}
                                        className="inline-flex cursor-pointer items-center justify-center rounded-md bg-brand-solid px-3 py-1.5 text-sm font-semibold text-white outline-focus-ring transition-colors duration-150 hover:bg-brand-solid_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                                    >
                                        Empezar nueva
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Mensajes (réplica iChat: user burbuja, assistant prosa) ── */}
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                        <p className="text-sm font-medium text-secondary">Pregúntale al documento</p>
                        <p className="text-xs leading-relaxed text-quaternary">
                            Resúmenes, dudas, "¿dónde dice…?" — el asistente lee «{fileTitle}» y nada más. Escribe <span className="rounded bg-secondary px-1 font-mono">/</span> para los comandos de Claude Code.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        {messages.map((msg) =>
                            msg.role === "user" ? (
                                <Message key={msg.id} from="user">
                                    <MessageContent variant="filled" className="whitespace-pre-wrap">
                                        {msg.content}
                                    </MessageContent>
                                </Message>
                            ) : (
                                <Message key={msg.id} from="assistant">
                                    <MessageContent variant="flat" className={cx(msg.error && "text-error-primary")}>
                                        {msg.content === "" ? (
                                            <TypingDots />
                                        ) : (
                                            <div className="chat-markdown min-w-0">
                                                <MarkdownRenderer
                                                    content={msg.content}
                                                    docPath={docPath}
                                                    onOpenExternal={() => {}}
                                                    onOpenDoc={() => {}}
                                                    toAssetUrl={(p) => p}
                                                    resolveRelative={(p) => p}
                                                />
                                            </div>
                                        )}
                                    </MessageContent>
                                </Message>
                            ),
                        )}
                    </div>
                )}
            </div>

            {/* ── Composer (réplica WidgetChatInput) + menú de comandos ── */}
            <div className="relative shrink-0 p-3 pt-1">
                {filteredCommands.length > 0 && (
                    <div
                        role="listbox"
                        aria-label="Comandos de Claude Code"
                        className="absolute right-3 bottom-full left-3 z-30 mb-1.5 max-h-72 overflow-y-auto rounded-xl bg-primary p-1 shadow-lg ring-1 ring-secondary"
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
                                    "flex w-full cursor-pointer items-baseline gap-2.5 rounded-md px-2.5 py-1.5 text-left outline-focus-ring transition-colors duration-100",
                                    i === cmdIndex ? "bg-primary_hover" : "hover:bg-primary_hover",
                                )}
                            >
                                <span className="shrink-0 font-mono text-sm font-medium text-primary">/{cmd.name}</span>
                                <span className="min-w-0 truncate text-xs text-tertiary">{cmd.description}</span>
                            </button>
                        ))}
                    </div>
                )}
                <div onKeyDownCapture={onComposerKeyDownCapture}>
                    <PromptInput status={status} value={input} onValueChange={handleValueChange} onSubmit={handleSubmit}>
                        <PromptInputTextarea ref={textareaRef} placeholder={`Pregunta sobre ${fileTitle}…`} aria-label="Mensaje para el asistente" />
                        <PromptInputToolbar>
                            <PromptInputTools>
                                <span className="px-1 text-xs text-quaternary select-none">/ comandos</span>
                            </PromptInputTools>
                            <PromptInputTools>
                                <PromptInputSubmit />
                            </PromptInputTools>
                        </PromptInputToolbar>
                    </PromptInput>
                </div>
            </div>

            {/* streaming sin contenido aún en doc en segundo plano: nada extra */}
            {isStreaming && lastMsg?.role !== "assistant" && null}
        </div>
    );
}
