import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, RefreshCcw01 } from "@hm/icons";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { cx } from "@/utils/cx";
import { MarkdownRenderer } from "../markdown/markdown-renderer";

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

interface ChatPanelProps {
    docPath: string;
    /** Contenido ACTUAL del doc — viaja en cada turno, así el asistente
     *  siempre conoce la última versión autoguardada. */
    docContent: string;
    fileTitle: string;
}

let nextId = 0;
const genId = () => `m${++nextId}-${performance.now().toFixed(0)}`;

/** Conversaciones por documento — viven mientras la app esté abierta,
 *  igual que el mapa de sesiones --resume del backend. */
const conversationStore = new Map<string, ChatMessage[]>();
const streamingStore = new Set<string>();

/** Chat del documento (mismo patrón que el asistente de Moptions, pero
 *  el agente solo conoce el markdown activo). Streaming vía eventos
 *  Tauri "chat-event" emitidos por el spawn del CLI de Claude. */
export function ChatPanel({ docPath, docContent, fileTitle }: ChatPanelProps) {
    const [, force] = useState(0);
    const rerender = useCallback(() => force((n) => n + 1), []);
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const messages = conversationStore.get(docPath) ?? [];
    const isStreaming = streamingStore.has(docPath);

    // Stream global: cada evento se enruta al bucket de SU documento
    // (un doc en segundo plano puede seguir terminando su respuesta).
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

    const send = useCallback(() => {
        const message = input.trim();
        if (!message) return;
        setInput("");
        sendMessage(message);
    }, [input, sendMessage]);

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

    const resetConversation = useCallback(() => {
        conversationStore.set(docPath, []);
        streamingStore.delete(docPath);
        void invoke("chat_reset", { docPath }).catch(() => {});
        rerender();
        inputRef.current?.focus();
    }, [docPath, rerender]);

    return (
        <div className="flex h-full w-90 flex-col bg-primary">
            {/* Cabecera del chat */}
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-secondary px-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-primary">Asistente</p>
                    <p className="truncate text-xs text-quaternary">Solo conoce «{fileTitle}»</p>
                </div>
                {messages.length > 0 && (
                    <ButtonUtility size="xs" color="tertiary" icon={RefreshCcw01} tooltip="Nueva conversación" onClick={resetConversation} />
                )}
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                        <p className="text-sm font-medium text-secondary">Pregúntale al documento</p>
                        <p className="text-xs leading-relaxed text-quaternary">
                            Resúmenes, dudas, "¿dónde dice…?" — el asistente lee «{fileTitle}» y nada más.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {messages.map((msg) =>
                            msg.role === "user" ? (
                                <div key={msg.id} className="ml-8 self-end rounded-2xl rounded-br-md bg-secondary px-3.5 py-2 text-sm text-primary">
                                    {msg.content}
                                </div>
                            ) : msg.content === "" ? (
                                <div key={msg.id} className="flex items-center gap-1.5 px-1 py-2">
                                    {[0, 1, 2].map((i) => (
                                        <span
                                            key={i}
                                            className="size-1.5 animate-pulse rounded-full bg-fg-quaternary"
                                            style={{ animationDelay: `${i * 200}ms`, animationDuration: "1.2s" }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div key={msg.id} className={cx("chat-markdown min-w-0 text-sm", msg.error && "text-error-primary")}>
                                    <MarkdownRenderer
                                        content={msg.content}
                                        docPath={docPath}
                                        onOpenExternal={() => {}}
                                        onOpenDoc={() => {}}
                                        toAssetUrl={(p) => p}
                                        resolveRelative={(p) => p}
                                    />
                                </div>
                            ),
                        )}
                    </div>
                )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-secondary p-3">
                <div className="flex items-end gap-2 rounded-xl border border-secondary bg-primary px-3 py-2 focus-within:border-brand">
                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        placeholder={`Pregunta sobre ${fileTitle}…`}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                        className="max-h-30 min-w-0 flex-1 resize-none bg-transparent text-sm text-primary outline-none placeholder:text-placeholder"
                    />
                    <button
                        type="button"
                        aria-label="Enviar"
                        disabled={!input.trim() || isStreaming}
                        onClick={send}
                        className={cx(
                            "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                            input.trim() && !isStreaming ? "bg-brand-solid text-white hover:bg-brand-solid_hover" : "bg-secondary text-fg-quaternary",
                        )}
                    >
                        <ArrowUp className="size-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
