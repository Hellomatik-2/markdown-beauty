import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy01, Download01, Edit05, FolderClosed, LayoutLeft, Monitor01, Moon01, Plus, Printer, Sun, X as CloseX } from "@hm/icons";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm as confirmDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Button } from "@/components/base/buttons/button";
import { SearchInput } from "@/components/base/input/search-input";
import { HellomatikLogo } from "@/components/foundations/logo/hellomatik-logo";
import { useClipboard } from "@/hooks/use-clipboard";
import { cx } from "@/utils/cx";
import type { EditorHandle } from "./markdown/editor-view";
import { FrontmatterProperties, splitFrontmatter } from "./markdown/frontmatter";
import { MarkdownRenderer } from "./markdown/markdown-renderer";
import { dirname, resolvePath } from "./markdown/text-utils";
import { useDocSearch } from "./markdown/use-doc-search";

interface Doc {
    path: string;
    content: string;
    modified_ms?: number;
}

interface TocEntry {
    id: string;
    text: string;
    level: number;
}

const TABS_KEY = "mb:tabs";
const ACTIVE_KEY = "mb:active-tab";
const THEME_KEY = "mb:theme";
const LEGACY_DARK_KEY = "mb:dark";
const MD_EXT = /\.(md|markdown|mdown|mkd|mdx)$/i;

type ThemePref = "system" | "light" | "dark";

const THEME_CYCLE: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
const THEME_META: Record<ThemePref, { icon: typeof Sun; label: string }> = {
    system: { icon: Monitor01, label: "Tema: sistema" },
    light: { icon: Sun, label: "Tema: claro" },
    dark: { icon: Moon01, label: "Tema: oscuro" },
};

function loadThemePref(): ThemePref {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
    // Migración desde el toggle binario antiguo (mb:dark)
    const legacy = localStorage.getItem(LEGACY_DARK_KEY);
    if (legacy != null) return legacy === "1" ? "dark" : "light";
    return "system";
}

/** Fuera de Tauri (vite dev en navegador) la app entra en modo preview:
 *  carga /sample.md por fetch y desactiva las APIs nativas. */
const IS_TAURI = "__TAURI_INTERNALS__" in window;

/** El editor (BlockNote) pesa: cargarlo solo cuando se entra a editar. */
const EditorView = lazy(() => import("./markdown/editor-view").then((m) => ({ default: m.EditorView })));

function fileTitle(path: string): string {
    const name = path.split("/").pop() ?? path;
    return name.replace(MD_EXT, "");
}

async function readDoc(path: string): Promise<Doc> {
    if (IS_TAURI) return invoke<Doc>("read_markdown", { path });
    return { path, content: await fetch(path).then((r) => r.text()) };
}

export default function App() {
    const [tabs, setTabs] = useState<Doc[]>([]);
    const [activePath, setActivePath] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [themePref, setThemePref] = useState<ThemePref>(loadThemePref);
    const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
    const dark = themePref === "dark" || (themePref === "system" && systemDark);
    const [toc, setToc] = useState<TocEntry[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLElement>(null);
    const articleRef = useRef<HTMLElement>(null);
    const scrollMemory = useRef<Map<string, number>>(new Map());
    const { copy, copied } = useClipboard();

    const [exportState, setExportState] = useState<"idle" | "busy" | "done">("idle");
    const searchInputRef = useRef<HTMLInputElement>(null);

    // ── Modo edición (WYSIWYG sobre el documento activo) ──────────────
    const [editing, setEditing] = useState(false);
    const [dirty, setDirty] = useState(false);
    const editorRef = useRef<EditorHandle>(null);
    const editingRef = useRef(false);
    editingRef.current = editing;
    const dirtyRef = useRef(false);
    dirtyRef.current = dirty;

    /** true si se puede abandonar la edición (confirma si hay cambios). */
    const confirmLeaveEdit = useCallback(async (): Promise<boolean> => {
        if (!editingRef.current || !dirtyRef.current) return true;
        const ok = await confirmDialog("Tienes cambios sin guardar. ¿Descartarlos?", {
            title: "Cambios sin guardar",
            kind: "warning",
            okLabel: "Descartar",
            cancelLabel: "Seguir editando",
        }).catch(() => false);
        return ok;
    }, []);

    const tabsRef = useRef(tabs);
    tabsRef.current = tabs;
    const activeRef = useRef(activePath);
    activeRef.current = activePath;
    /** true en cuanto el usuario/SO abre un archivo explícitamente — la
     *  restauración de sesión ya no debe cambiar la pestaña activa. */
    const explicitOpenRef = useRef(false);

    const doc = tabs.find((t) => t.path === activePath) ?? null;
    const frontmatter = doc ? splitFrontmatter(doc.content) : null;
    const search = useDocSearch(articleRef, doc ? `${doc.path}:${doc.content.length}` : null);

    // ── Abrir/actualizar documento como pestaña ───────────────────────
    const openDoc = useCallback(async (path: string, opts?: { silent?: boolean; activate?: boolean }) => {
        const activate = opts?.activate !== false;
        if (activate && path !== activeRef.current && editingRef.current) {
            if (!(await confirmLeaveEdit())) return;
            setEditing(false);
            setDirty(false);
        }
        if (activate) explicitOpenRef.current = true;
        try {
            const next = await readDoc(path);
            setTabs((prev) => {
                const i = prev.findIndex((t) => t.path === path);
                if (i >= 0) {
                    if (prev[i].content === next.content) return prev;
                    const copy = [...prev];
                    copy[i] = next;
                    return copy;
                }
                return [...prev, next];
            });
            if (activate) setActivePath(path);
            setError(null);
        } catch (e) {
            if (!opts?.silent) setError(String(e));
        }
    }, [confirmLeaveEdit]);

    /** Abre una mezcla de rutas (archivos .md y/o carpetas): las carpetas
     *  se expanden en el backend a todos sus markdowns (recursivo). */
    const openPaths = useCallback(
        async (paths: string[]) => {
            if (!paths.length) return;
            let files = paths;
            if (IS_TAURI) {
                files = await invoke<string[]>("expand_markdown_paths", { paths }).catch(() => paths.filter((p) => MD_EXT.test(p)));
            }
            if (!files.length) {
                setError("No hay documentos Markdown en lo que has soltado.");
                return;
            }
            for (let i = 0; i < files.length; i++) {
                await openDoc(files[i], { activate: i === 0 });
            }
        },
        [openDoc],
    );

    const closeTab = useCallback(
        (path: string) => {
            void (async () => {
                if (path === activeRef.current && !(await confirmLeaveEdit())) return;
                if (path === activeRef.current) {
                    setEditing(false);
                    setDirty(false);
                }
                scrollMemory.current.delete(path);
                setTabs((prev) => {
                    const i = prev.findIndex((t) => t.path === path);
                    const copy = prev.filter((t) => t.path !== path);
                    if (activeRef.current === path) {
                        const fallback = copy[Math.min(i, copy.length - 1)] ?? null;
                        setActivePath(fallback ? fallback.path : null);
                    }
                    return copy;
                });
            })();
        },
        [confirmLeaveEdit],
    );

    /** Activar pestaña respetando la edición en curso (confirma si dirty). */
    const activateTab = useCallback(
        (path: string) => {
            void (async () => {
                if (path === activeRef.current) return;
                if (!(await confirmLeaveEdit())) return;
                setEditing(false);
                setDirty(false);
                setActivePath(path);
            })();
        },
        [confirmLeaveEdit],
    );

    // ── Arranque: sesión previa + archivo de la asociación ────────────
    useEffect(() => {
        let disposed = false;
        const cleanups: Array<() => void> = [];

        if (!IS_TAURI) {
            void openDoc("/sample.md");
            return;
        }

        // Restaurar sesión (silenciosa: los archivos borrados se descartan)
        void (async () => {
            let saved: string[] = [];
            try {
                saved = JSON.parse(localStorage.getItem(TABS_KEY) ?? "[]");
            } catch {
                /* sesión corrupta: empezar de cero */
            }
            for (const path of saved) {
                if (disposed) return;
                await openDoc(path, { silent: true, activate: false });
            }
            if (!disposed && !explicitOpenRef.current && !activeRef.current) {
                const last = localStorage.getItem(ACTIVE_KEY);
                const candidates = tabsRef.current;
                const target = candidates.find((t) => t.path === last) ?? candidates[0];
                if (target && !explicitOpenRef.current) setActivePath(target.path);
            }
        })();

        // Doble click en Finder con la app ya abierta (archivo o carpeta)
        listen<string>("open-file", (event) => void openPaths([event.payload])).then((unlisten) => cleanups.push(unlisten));

        // Arranque: el RunEvent::Opened de macOS puede llegar antes O después
        // de que monte el frontend (y el emit puede perderse si aún no hay
        // listener). Sondeamos el estado Rust durante ~1s.
        void (async () => {
            for (let i = 0; i < 8; i++) {
                if (disposed) return;
                const opened = await invoke<string | null>("get_opened_file").catch(() => null);
                if (opened) {
                    void openPaths([opened]);
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, 125));
            }
        })();

        // Drag & drop de .md o CARPETAS sobre la ventana (las carpetas
        // abren todos sus markdowns en pestañas, como VS Code)
        getCurrentWebview()
            .onDragDropEvent((event) => {
                if (event.payload.type === "drop") void openPaths(event.payload.paths);
            })
            .then((unlisten) => cleanups.push(unlisten));

        // Releer al volver el foco (el archivo pudo cambiar fuera).
        // NUNCA durante la edición: pisaría el trabajo del usuario.
        const onFocus = () => {
            if (editingRef.current) return;
            const current = activeRef.current;
            if (current) void openDoc(current, { silent: true });
        };
        window.addEventListener("focus", onFocus);
        cleanups.push(() => window.removeEventListener("focus", onFocus));

        return () => {
            disposed = true;
            cleanups.forEach((fn) => fn());
        };
    }, [openDoc, openPaths]);

    // ── Persistir sesión de pestañas ──────────────────────────────────
    useEffect(() => {
        if (!IS_TAURI) return;
        localStorage.setItem(TABS_KEY, JSON.stringify(tabs.map((t) => t.path)));
        if (activePath) localStorage.setItem(ACTIVE_KEY, activePath);
    }, [tabs, activePath]);

    // ── Tema: claro (hellomatik cálido) / oscuro / sistema ────────────
    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark-mode", dark);
        root.classList.toggle("hellomatik-mode", !dark);
    }, [dark]);

    useEffect(() => {
        localStorage.setItem(THEME_KEY, themePref);
    }, [themePref]);

    // Con preferencia "sistema", seguir los cambios de macOS en vivo
    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    // Hook de test: MB_THEME fuerza el tema al arrancar
    useEffect(() => {
        if (!IS_TAURI) return;
        invoke<string | null>("get_startup_theme")
            .then((t) => {
                if (t === "dark" || t === "light" || t === "system") setThemePref(t);
            })
            .catch(() => {});
    }, []);

    // ── Título de ventana ─────────────────────────────────────────────
    useEffect(() => {
        const mark = dirty ? "• " : "";
        const title = doc ? `${mark}${fileTitle(doc.path)} — Markdown Beauty` : "Markdown Beauty";
        document.title = title;
        if (IS_TAURI) void getCurrentWindow().setTitle(title);
    }, [doc, dirty]);

    // ── Memoria de scroll por pestaña ─────────────────────────────────
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !activePath) return;
        el.scrollTop = scrollMemory.current.get(activePath) ?? 0;
        const onScroll = () => scrollMemory.current.set(activePath, el.scrollTop);
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, [activePath]);

    // ── TOC desde el DOM renderizado (fuente única de verdad) ────────
    useEffect(() => {
        const article = articleRef.current;
        if (!article || !doc) {
            setToc([]);
            return;
        }
        const headings = Array.from(article.querySelectorAll<HTMLHeadingElement>("h1[id], h2[id], h3[id]")).filter(
            (h) => !h.closest("[data-footnotes]"),
        );
        setToc(
            headings.map((h) => ({
                id: h.id,
                text: h.textContent?.replace(/^#\s*/, "").trim() ?? "",
                level: Number(h.tagName[1]),
            })),
        );

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActiveId(visible[0].target.id);
            },
            { root: scrollRef.current, rootMargin: "-48px 0px -70% 0px" },
        );
        headings.forEach((h) => observer.observe(h));
        return () => observer.disconnect();
    }, [doc]);

    // ── Guardar la edición: editor → Markdown → disco ─────────────────
    const saveEdits = useCallback(
        async (exit: boolean) => {
            if (!doc || !editorRef.current) return;
            try {
                const body = await editorRef.current.getMarkdown();
                // El frontmatter no entra al editor: se preserva tal cual
                const fmLen = doc.content.length - splitFrontmatter(doc.content).body.length;
                const next = doc.content.slice(0, fmLen) + body;
                await invoke("write_markdown", { path: doc.path, content: next });
                setTabs((prev) => prev.map((t) => (t.path === doc.path ? { ...t, content: next } : t)));
                setDirty(false);
                if (exit) setEditing(false);
            } catch (e) {
                const { message } = await import("@tauri-apps/plugin-dialog");
                void message(String(e), { title: "No se pudo guardar", kind: "error" }).catch(() => {});
            }
        },
        [doc],
    );

    const startEditing = useCallback(() => {
        if (!doc) return;
        search.close();
        setDirty(false);
        setEditing(true);
    }, [doc, search.close]);

    const discardEdits = useCallback(() => {
        void (async () => {
            if (!(await confirmLeaveEdit())) return;
            setEditing(false);
            setDirty(false);
        })();
    }, [confirmLeaveEdit]);

    /** Cmd+O estilo VS Code: un único diálogo nativo que acepta archivos
     *  Markdown y carpetas; el backend expande las carpetas a sus .md. */
    const pickFile = useCallback(async () => {
        if (!IS_TAURI) return;
        const files = await invoke<string[]>("pick_markdown_paths").catch(() => [] as string[]);
        for (let i = 0; i < files.length; i++) {
            await openDoc(files[i], { activate: i === 0 });
        }
    }, [openDoc]);

    // ── Atajos de teclado (Cmd+F búsqueda, Cmd+O abrir) ───────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && editingRef.current) {
                e.preventDefault();
                void saveEdits(false);
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f" && !editingRef.current) {
                e.preventDefault();
                search.setOpen(true);
                requestAnimationFrame(() => {
                    searchInputRef.current?.focus();
                    searchInputRef.current?.select();
                });
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
                e.preventDefault();
                void pickFile();
            } else if (e.key === "Escape" && search.open) {
                search.close();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [search.open, search.setOpen, search.close, pickFile, saveEdits]);

    // ── Ventana: arrastrar desde la barra/pestañas + doble clic = zoom ─
    /** El header NO usa -webkit-app-region: drag — WebKit se traga los
     *  eventos de ratón en esa región y los dblclick/click jamás llegan
     *  al DOM. El arrastre se hace por JS con umbral: si el ratón se
     *  mueve >6px con el botón pulsado se delega en el drag nativo de la
     *  ventana; un click normal (pestañas, botones) sigue llegando. */
    const dragWindowOnMove = useCallback((e: React.MouseEvent) => {
        if (!IS_TAURI || e.button !== 0) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const onMove = (ev: MouseEvent) => {
            if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 6) {
                cleanup();
                void getCurrentWindow().startDragging();
            }
        };
        const cleanup = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", cleanup);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", cleanup);
    }, []);

    /** Arrastre desde la zona libre del header (no botones/inputs; las
     *  pestañas llevan su propio onMouseDown y también arrastran). */
    const dragWindowFromHeader = useCallback(
        (e: React.MouseEvent) => {
            if ((e.target as Element).closest("button, [role='button'], [role='tab'], input")) return;
            dragWindowOnMove(e);
        },
        [dragWindowOnMove],
    );

    /** Doble clic en zona libre de la barra → maximizar/restaurar (zoom
     *  de macOS), como el titlebar nativo. Ignora botones y pestañas. */
    const zoomOnDoubleClick = useCallback((e: React.MouseEvent) => {
        if (!IS_TAURI) return;
        if ((e.target as Element).closest("button, [role='button'], [role='tab'], input")) return;
        void getCurrentWindow().toggleMaximize();
    }, []);

    // ── Exportar PDF directo (sin diálogo de impresión) ───────────────
    const exportPdf = useCallback(async () => {
        if (!doc || !IS_TAURI || exportState === "busy") return;
        const dest = await saveDialog({
            defaultPath: `${fileTitle(doc.path)}.pdf`,
            filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (!dest) return;
        setExportState("busy");
        try {
            // El PDF hereda el tema activo. En oscuro el backend compone
            // cada página sobre el color real del lienzo (la banda de
            // márgenes de NSPrintInfo quedaría blanca si no).
            const isDark = document.documentElement.classList.contains("dark-mode");
            const canvas = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
            const pageRgb = canvas?.slice(0, 3).map((n) => Number(n) / 255) ?? [1, 1, 1];
            // El sheet del save dialog tiene que desmontarse del todo antes
            // de anclar la NSPrintOperation modal a la misma ventana.
            await new Promise((resolve) => setTimeout(resolve, 700));
            await invoke("export_pdf", { dest, dark: isDark, pageRgb });
            setExportState("done");
            void revealItemInDir(dest).catch(() => {});
            setTimeout(() => setExportState("idle"), 2000);
        } catch (e) {
            setExportState("idle");
            setError(String(e));
        }
    }, [doc, exportState]);

    const docDir = doc ? dirname(doc.path) : "/";

    return (
        <div className="flex h-full flex-col bg-primary">
            {/* ── Barra superior: pestañas ────────────────────────────── */}
            <header
                onMouseDown={dragWindowFromHeader}
                onDoubleClick={zoomOnDoubleClick}
                className="no-print relative z-20 flex h-12 shrink-0 items-center gap-2 border-b border-secondary bg-primary pr-3 pl-[84px] select-none"
            >
                <div className="titlebar-no-drag flex items-center">
                    <ButtonUtility
                        size="xs"
                        color="tertiary"
                        icon={LayoutLeft}
                        tooltip={sidebarOpen ? "Ocultar índice" : "Mostrar índice"}
                        onClick={() => setSidebarOpen((v) => !v)}
                    />
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-1 self-stretch">
                    {tabs.length > 0 ? (
                        <>
                            <div role="tablist" aria-label="Documentos abiertos" className="flex min-w-0 items-center gap-1 overflow-x-auto py-2">
                                {tabs.map((tab) => {
                                    const isActive = tab.path === activePath;
                                    return (
                                        <span
                                            key={tab.path}
                                            role="tab"
                                            tabIndex={0}
                                            aria-selected={isActive}
                                            title={tab.path}
                                            onClick={() => activateTab(tab.path)}
                                            onMouseDown={dragWindowOnMove}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") activateTab(tab.path);
                                            }}
                                            onAuxClick={(e) => {
                                                if (e.button === 1) closeTab(tab.path);
                                            }}
                                            className={cx(
                                                "titlebar-no-drag group/tab flex h-7 max-w-44 shrink-0 cursor-pointer items-center gap-1 rounded-md py-1 pr-1 pl-2.5 text-sm transition-colors duration-100 select-none",
                                                isActive
                                                    ? "bg-secondary font-medium text-primary"
                                                    : "text-tertiary hover:bg-primary_hover hover:text-secondary",
                                            )}
                                        >
                                            <span className="truncate">{fileTitle(tab.path)}</span>
                                            <span
                                                role="button"
                                                tabIndex={-1}
                                                aria-label={`Cerrar ${fileTitle(tab.path)}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    closeTab(tab.path);
                                                }}
                                                className={cx(
                                                    "rounded-sm p-0.5 text-fg-quaternary transition-opacity duration-100 hover:bg-primary_hover hover:text-fg-quaternary_hover",
                                                    isActive ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100",
                                                )}
                                            >
                                                <CloseX className="size-3.5" />
                                            </span>
                                        </span>
                                    );
                                })}
                            </div>
                            <div className="titlebar-no-drag shrink-0">
                                <ButtonUtility size="xs" color="tertiary" icon={Plus} tooltip="Abrir documento…" onClick={() => void pickFile()} />
                            </div>
                        </>
                    ) : (
                        <span className="px-1 text-sm font-semibold text-quaternary">Markdown Beauty</span>
                    )}
                </div>

                <div className="titlebar-no-drag flex items-center gap-1">
                    {doc && editing && (
                        <>
                            <ButtonUtility
                                size="xs"
                                color="tertiary"
                                icon={Check}
                                tooltip={dirty ? "Guardar y terminar (⌘S guarda sin salir)" : "Terminar edición"}
                                onClick={() => void saveEdits(true)}
                            />
                            <ButtonUtility size="xs" color="tertiary" icon={CloseX} tooltip="Descartar cambios" onClick={discardEdits} />
                        </>
                    )}
                    {doc && !editing && (
                        <>
                            <ButtonUtility size="xs" color="tertiary" icon={Edit05} tooltip="Editar documento" onClick={startEditing} />
                            <ButtonUtility
                                size="xs"
                                color="tertiary"
                                icon={copied ? Check : Copy01}
                                tooltip="Copiar markdown"
                                onClick={() => copy(doc.content)}
                            />
                            {IS_TAURI && (
                                <ButtonUtility
                                    size="xs"
                                    color="tertiary"
                                    icon={exportState === "done" ? Check : Download01}
                                    isDisabled={exportState === "busy"}
                                    tooltip="Exportar PDF"
                                    onClick={() => void exportPdf()}
                                />
                            )}
                            <ButtonUtility
                                size="xs"
                                color="tertiary"
                                icon={Printer}
                                tooltip="Imprimir"
                                onClick={() => {
                                    if (IS_TAURI) invoke("plugin:webview|print").catch(() => window.print());
                                    else window.print();
                                }}
                            />
                        </>
                    )}
                    <ButtonUtility
                        size="xs"
                        color="tertiary"
                        icon={THEME_META[themePref].icon}
                        tooltip={`${THEME_META[themePref].label} — clic para cambiar`}
                        onClick={() => setThemePref((v) => THEME_CYCLE[v])}
                    />
                    {tabs.length === 0 && (
                        <ButtonUtility size="xs" color="tertiary" icon={FolderClosed} tooltip="Abrir documento…" onClick={() => void pickFile()} />
                    )}
                </div>
            </header>

            <div className="flex min-h-0 flex-1">
                {/* ── Índice (animado: anchura + fade, sin desmontar) ── */}
                {(() => {
                    const showToc = sidebarOpen && !!doc && toc.length > 0 && !editing;
                    return (
                        <div
                            aria-hidden={!showToc}
                            className={cx(
                                "no-print shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                                showToc ? "w-60" : "w-0",
                            )}
                        >
                            <nav
                                className={cx(
                                    "h-full w-60 overflow-y-auto border-r border-secondary bg-primary py-5 pr-2 pl-3",
                                    "transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                                    showToc ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0",
                                )}
                            >
                                <p className="px-2.5 pb-2 text-xs font-semibold text-quaternary">Contenido</p>
                                <ul className="flex flex-col gap-px">
                                    {toc.map((entry) => (
                                        <li key={entry.id}>
                                            <a
                                                href={`#${entry.id}`}
                                                tabIndex={showToc ? 0 : -1}
                                                className={cx(
                                                    "block truncate rounded-md py-1 pr-2 text-sm transition-colors duration-100",
                                                    entry.level === 1 && "pl-2.5 font-medium",
                                                    entry.level === 2 && "pl-2.5",
                                                    entry.level === 3 && "pl-6",
                                                    activeId === entry.id
                                                        ? "bg-secondary text-primary"
                                                        : "text-tertiary hover:bg-primary_hover hover:text-secondary",
                                                )}
                                            >
                                                {entry.text}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                        </div>
                    );
                })()}

                {/* ── Documento ──────────────────────────────────────── */}
                {/* `relative` es crítico: los elementos sr-only/VisuallyHidden
                    (checkboxes react-aria, h2 de footnotes) son absolute y sin
                    ancestro posicionado escapan del clip → scroll infinito a
                    nivel de página. */}
                <main ref={scrollRef} className="print-plain relative min-w-0 flex-1 scroll-smooth overflow-y-auto">
                    {/* ── Barra de búsqueda (Cmd+F) ──────────────────── */}
                    {search.open && doc && !editing && (
                        <div className="no-print sticky top-3 z-30 float-right mr-5 flex items-center gap-1 rounded-lg border border-secondary bg-primary p-1.5 shadow-lg">
                            <SearchInput
                                ref={searchInputRef}
                                width="sm"
                                size="sm"
                                autoFocus
                                placeholder="Buscar en el documento…"
                                value={search.query}
                                onChange={search.setQuery}
                                onKeyDown={(e: React.KeyboardEvent) => {
                                    if (e.key === "Enter") search.step(e.shiftKey ? -1 : 1);
                                }}
                            />
                            <span className="min-w-12 text-center text-xs whitespace-nowrap tabular-nums text-quaternary">
                                {search.total > 0 ? `${search.current + 1}/${search.total}` : "0/0"}
                            </span>
                            <ButtonUtility size="xs" color="tertiary" icon={ChevronUp} tooltip="Anterior" onClick={() => search.step(-1)} />
                            <ButtonUtility size="xs" color="tertiary" icon={ChevronDown} tooltip="Siguiente" onClick={() => search.step(1)} />
                            <ButtonUtility size="xs" color="tertiary" icon={CloseX} tooltip="Cerrar (Esc)" onClick={search.close} />
                        </div>
                    )}
                    {doc && editing ? (
                        <Suspense fallback={<div className="mx-auto max-w-[760px] pt-12 text-sm text-quaternary">Cargando editor…</div>}>
                            <EditorView
                                key={doc.path}
                                ref={editorRef}
                                markdown={frontmatter?.body ?? doc.content}
                                dark={dark}
                                onDirty={() => setDirty(true)}
                            />
                        </Suspense>
                    ) : doc ? (
                        <article ref={articleRef} key={doc.path} className="mx-auto max-w-[720px] px-10 pt-12 pb-36 max-sm:px-6">
                            {frontmatter && <FrontmatterProperties data={frontmatter.data} />}
                            <MarkdownRenderer
                                content={frontmatter?.body ?? doc.content}
                                docPath={doc.path}
                                onOpenExternal={(url) => (IS_TAURI ? void openUrl(url) : window.open(url, "_blank"))}
                                onOpenDoc={(path) => void openDoc(path)}
                                toAssetUrl={IS_TAURI ? convertFileSrc : (p) => p}
                                resolveRelative={(rel) => resolvePath(docDir, rel)}
                            />
                        </article>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-7 px-8">
                            <HellomatikLogo className="text-4xl text-primary" />
                            <div className="text-center">
                                <h1 className="text-display-xs text-primary">Markdown Beauty</h1>
                                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-tertiary">
                                    {error ?? "Abre un documento .md o arrástralo a esta ventana para leerlo con calma."}
                                </p>
                            </div>
                            <Button size="md" color="secondary" iconLeading={FolderClosed} onClick={() => void pickFile()}>
                                Abrir documento…
                            </Button>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
