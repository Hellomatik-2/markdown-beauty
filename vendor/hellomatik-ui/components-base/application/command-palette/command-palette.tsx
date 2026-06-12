"use client";

/**
 * Command Palette — wrapper fino sobre el componente UU `CommandMenu`.
 * Solo se encarga de armar los grupos de datos (acciones, páginas,
 * cuentas, agentes, docs, workflows, conversaciones, recientes) y de
 * cablear la ejecución (router push o callback) cuando el usuario
 * selecciona un item. Cero render custom — toda la UI viene de la base.
 *
 *  Atajo Cmd/Ctrl+K · Escape para cerrar · ↑↓ navegan · Enter ejecuta.
 *
 * Grupos:
 *   · Recientes       — últimas páginas visitadas (persistidas en localStorage)
 *   · Acciones        — globales (nuevo chat, invitar, subir doc…)
 *   · Cuentas         — switcher (solo si user tiene ≥ 2 cuentas)
 *   · Agentes         — switcher dentro de la cuenta actual (≥ 2 agentes)
 *   · Páginas         — top-level
 *   · Configuración   — sub-páginas de cuenta/perfil/billing/settings
 *   · Documentos      — base de conocimiento del agente activo (mock)
 *   · Workflows       — automatizaciones del agente activo (mock)
 *   · Conversaciones  — historial reciente del agente activo (mock)
 */

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Heading as AriaHeading } from "react-aria-components";
import type { Key } from "react-aria-components";
import {
    BarChart01,
    BookOpen01,
    Building07,
    Building08,
    CreditCard02,
    Dataflow03,
    FilePlus01,
    FolderPlus,
    Globe01,
    HomeLine,
    LifeBuoy01,
    Link01,
    Mail01,
    MessageChatCircle,
    Moon01,
    PuzzlePiece01,
    Receipt,
    SearchLg,
    Settings01,
    Shield02,
    Tag01,
    Trash02,
    Type01,
    Upload01,
    User01,
    UserPlus01,
    Users01,
} from "@hm/icons";
import { CommandMenu, type CommandMenuGroupType } from "@/components/application/command-menus/command-menu";
import type { CommandDropdownMenuItemProps } from "@/components/application/command-menus/base-components/command-menu-item";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { useCurrentAccount, useCurrentAgent } from "@/views/_shared/agent-context";
import { useFlash } from "@/views/_shared/use-flash";
import { useRecentPages } from "./use-recent-pages";
import { makeFileIconFC } from "@/views/_shared/doc-icon";
import { SEED_WORKFLOWS } from "@/data/workflows-seed";
import { PLANAS_WEB_DOCS, PLANAS_GMB_DOCS, ESDI_FAQ_DOCS } from "@/data/knowledge-seeds";
import { CONVERSATIONS_SEED } from "@/data/conversations-seed";

// ─────────────────────────────────────────────────────────────────────────────
// Etiquetas legibles para rutas (recientes)
// ─────────────────────────────────────────────────────────────────────────────

type TRecent = ReturnType<typeof useTranslations<"shell.commandPalette.recentPaths">>;

const makePathLabels = (t: TRecent): Array<[RegExp, (path: string) => { label: string; icon: React.FC<{ className?: string }> }]> => [
    [/^\/knowledge$/,                             () => ({ label: t("knowledgeBase"),                                                    icon: BookOpen01         })],
    [/^\/knowledge\/scan-web$/,                  () => ({ label: t("scanWeb"),                                                           icon: Globe01            })],
    [/^\/knowledge\/(.+)$/,                      (p) => ({ label: t("documentPrefix", { name: p.split("/").pop() ?? "" }),               icon: makeFileIconFC("document") })],
    [/^\/automatizaciones$/,                      () => ({ label: t("automations"),                                                       icon: Dataflow03         })],
    [/^\/automatizaciones\/(.+)\/edit$/,          (p) => ({ label: t("automationEditorPrefix", { name: p.split("/")[2] ?? "" }),          icon: Dataflow03         })],
    [/^\/integrations$/,                         () => ({ label: t("integrations"),                                                      icon: PuzzlePiece01      })],
    [/^\/conversaciones$/,                        () => ({ label: t("conversations"),                                                     icon: MessageChatCircle  })],
    [/^\/workspace\/members$/,                    () => ({ label: t("members"),                                                           icon: Users01            })],
    [/^\/workspace\/settings$/,                   () => ({ label: t("companySettings"),                                                   icon: Settings01         })],
    [/^\/me$/,                                    () => ({ label: t("myProfile"),                                                         icon: User01             })],
    [/^\/workspace$/,                             () => ({ label: t("companySettings"),                                                   icon: Building07         })],
    [/^\/workspace\/billing$/,                    () => ({ label: t("planBilling"),                                                       icon: CreditCard02       })],
    [/^\/docs$/,                                 () => ({ label: t("help"),                                                              icon: LifeBuoy01         })],
    [/^\/terms$/,                                () => ({ label: t("terms"),                                                             icon: FilePlus01         })],
    [/^\/agent-settings$/,                       () => ({ label: t("agentSettings"),                                                     icon: Settings01         })],
    [/^\/agent\/settings$/,                      () => ({ label: t("agentSettings"),                                                     icon: Settings01         })],
    [/^\/settings$/,                             () => ({ label: t("agentSettings"),                                                     icon: Settings01         })],
];

type TCp = ReturnType<typeof useTranslations<"shell.commandPalette">>;

const relativeTime = (timestamp: number, t: TCp): string => {
    const diff = Date.now() - timestamp;
    const min = Math.floor(diff / 60_000);
    if (min < 1) return t("timeJustNow");
    if (min < 60) return t("timeMinutes", { min });
    const h = Math.floor(min / 60);
    if (h < 24) return t("timeHours", { h });
    const d = Math.floor(h / 24);
    return d === 1 ? t("timeYesterday") : t("timeDays", { d });
};

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos (acción asociada a un id de item)
// ─────────────────────────────────────────────────────────────────────────────

type Action = { href?: string; run?: () => void };

interface CommandEntry {
    item: CommandDropdownMenuItemProps;
    action: Action;
}

// ─────────────────────────────────────────────────────────────────────────────
// Items estáticos — acciones, páginas, configuración, mocks
// ─────────────────────────────────────────────────────────────────────────────

const makeIconItem = (
    id: string,
    label: string,
    icon: React.FC<{ className?: string }>,
    description?: string,
    shortcutKeys?: string[],
): CommandDropdownMenuItemProps => ({
    id,
    type: "icon",
    label,
    icon,
    description,
    shortcutKeys,
});

const dispatch = (event: string) => () => window.dispatchEvent(new Event(event));

const buildStaticAcciones = (
    t: ReturnType<typeof useTranslations<"shell.commandPalette.actions">>,
    onCopyUrl: () => void,
    onToggleTheme: () => void,
): CommandEntry[] => [
    { item: makeIconItem("new-chat",       t("newChat"),          HomeLine,   t("newChatDesc")          ), action: { href: "/" } },
    { item: makeIconItem("create-space",   t("createAgent"),      Building07, t("createAgentDesc")      ), action: { run: dispatch("hm:open-create-agent") } },
    { item: makeIconItem("create-wf",      t("createAutomation"), Dataflow03, t("createAutomationDesc") ), action: { href: "/automatizaciones" } },
    { item: makeIconItem("upload-doc",     t("uploadDoc"),        Upload01,   t("uploadDocDesc")        ), action: { run: dispatch("hm:open-add-files") } },
    { item: makeIconItem("add-webpage",    t("addWebpage"),       Globe01,    t("addWebpageDesc")       ), action: { run: dispatch("hm:open-add-url") } },
    { item: makeIconItem("create-text",    t("createNote"),       Type01,     t("createNoteDesc")       ), action: { run: dispatch("hm:open-create-text") } },
    { item: makeIconItem("create-folder",  t("createFolder"),     FolderPlus, t("createFolderDesc")     ), action: { run: dispatch("hm:open-create-folder") } },
    { item: makeIconItem("invite",         t("invite"),           UserPlus01, t("inviteDesc")           ), action: { run: dispatch("hm:open-invite") } },
    { item: makeIconItem("create-tag",     t("createTag"),        Tag01,      t("createTagDesc")        ), action: { href: "/conversaciones" } },
    { item: makeIconItem("copy-url",       t("copyUrl"),          Link01,     t("copyUrlDesc")          ), action: { run: onCopyUrl } },
    { item: makeIconItem("toggle-theme",   t("toggleTheme"),      Moon01,     t("toggleThemeDesc")      ), action: { run: onToggleTheme } },
];

type TPages = ReturnType<typeof useTranslations<"shell.commandPalette.pages">>;
type TSettings = ReturnType<typeof useTranslations<"shell.commandPalette.settings">>;

const buildStaticPaginas = (t: TPages): CommandEntry[] => [
    { item: makeIconItem("p-home",      t("home"),          HomeLine                                  ), action: { href: "/" } },
    { item: makeIconItem("p-activity",  t("activity"),      BarChart01,  t("activityDesc")            ), action: { href: "/actividad" } },
    { item: makeIconItem("p-content",   t("knowledgeBase"), BookOpen01                                ), action: { href: "/knowledge" } },
    { item: makeIconItem("p-workflows", t("automations"),   Dataflow03                                ), action: { href: "/automatizaciones" } },
    // Integraciones movida a la sección `config` — es workspace-scoped, no
    // una página del agente. Aparece junto a Ajustes de empresa / Plan / Miembros.
    { item: makeIconItem("p-history",   t("conversations"), MessageChatCircle                         ), action: { href: "/conversaciones" } },
    { item: makeIconItem("p-trash",     t("trash"),         Trash02,     t("trashDesc")               ), action: { href: "/trash" } },
];

const buildStaticConfig = (t: TSettings): CommandEntry[] => [
    { item: makeIconItem("s-profile",  t("myProfile"),       User01,       t("myProfileDesc")       ), action: { href: "/me" } },
    { item: makeIconItem("s-account",  t("companySettings"), Building07,   t("companySettingsDesc") ), action: { href: "/workspace" } },
    { item: makeIconItem("s-integrations", t("integrations"), PuzzlePiece01, t("integrationsDesc")  ), action: { href: "/integrations" } },
    { item: makeIconItem("s-billing",  t("planBilling"),     CreditCard02, t("planBillingDesc")     ), action: { href: "/workspace/billing" } },
    { item: makeIconItem("s-members",  t("teamMembers"),     Users01,      t("teamMembersDesc")     ), action: { href: "/workspace/members" } },
    { item: makeIconItem("s-invoices", t("invoices"),        Receipt                                ), action: { href: "/workspace/billing" } },
    { item: makeIconItem("s-security", t("securitySso"),     Shield02,     t("securitySsoDesc")     ), action: { href: "/workspace?tab=seguridad" } },
    { item: makeIconItem("s-help",     t("help"),            LifeBuoy01                             ), action: { href: "/docs" } },
    { item: makeIconItem("s-agent",    t("agentSettings"),   Settings01,   t("agentSettingsDesc")   ), action: { href: "/agent-settings" } },
    { item: makeIconItem("s-channels", t("agentChannels"),   Mail01,       t("agentChannelsDesc")   ), action: { href: "/agent-settings?tab=channels" } },
];

// ── Dynamic entries derived from seed data (max 8 each) ──────────────────────

const ALL_SEED_DOCS = [...PLANAS_WEB_DOCS, ...PLANAS_GMB_DOCS, ...ESDI_FAQ_DOCS].filter(
    (d) => d.kind !== "memory",
);

const DYNAMIC_DOCS: CommandEntry[] = ALL_SEED_DOCS.slice(0, 8).map((doc) => ({
    item: makeIconItem(
        `d-${doc.id}`,
        doc.name,
        makeFileIconFC(doc.extension),
        `${doc.extension.toUpperCase()}${doc.sizeBytes ? ` · ${doc.size}` : ""} · ${doc.chunks ?? 0} fragmentos`,
    ),
    action: { href: `/knowledge/${doc.id}` },
}));

const DYNAMIC_WORKFLOWS: CommandEntry[] = SEED_WORKFLOWS.slice(0, 8).map((wf) => ({
    item: makeIconItem(
        `w-${wf.id}`,
        wf.name,
        Dataflow03,
        `${wf.kind === "trigger" ? "Trigger" : wf.kind === "scheduled" ? "Programado" : "Manual"} · ${wf.enabled !== false ? "activo" : "pausado"}`,
    ),
    action: { href: `/automatizaciones/${wf.id}` },
}));

const DYNAMIC_CONVS: CommandEntry[] = CONVERSATIONS_SEED.slice(0, 8).map((conv) => ({
    item: makeIconItem(
        `c-${conv.id}`,
        `#${conv.number} · ${conv.subject}`,
        MessageChatCircle,
        `${conv.user.name} · ${conv.channel}`,
    ),
    action: { href: `/conversaciones/${conv.id}` },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
    const { push } = useRouter();
    const flash = useFlash();
    const recents = useRecentPages();
    const { accounts, currentAccount, setCurrentAccountId } = useCurrentAccount();
    const { agents, currentAgent, setCurrentAgentId } = useCurrentAgent();
    const { resolvedTheme, setTheme } = useTheme();
    const t = useTranslations("shell.commandPalette");
    const tActions = useTranslations("shell.commandPalette.actions");
    const tPages = useTranslations("shell.commandPalette.pages");
    const tSettings = useTranslations("shell.commandPalette.settings");
    const tRecent = useTranslations("shell.commandPalette.recentPaths");

    const pathLabels = useMemo(() => makePathLabels(tRecent), [tRecent]);

    const labelForPath = (pathname: string) => {
        for (const [re, fn] of pathLabels) {
            if (re.test(pathname)) return fn(pathname);
        }
        return { label: pathname, icon: HomeLine };
    };

    const handleCopyUrl = () => {
        const url = typeof window !== "undefined" ? window.location.href : "";
        navigator.clipboard?.writeText(url).then(
            () => flash(t("copiedUrl"), "success"),
            () => flash(t("copyUrlFailed"), "error"),
        );
    };

    const handleToggleTheme = () => {
        const next = resolvedTheme === "dark" ? "light" : "dark";
        setTheme(next);
        flash(next === "dark" ? t("themeDarkActivated") : t("themeLightActivated"), "success");
    };

    const staticAcciones = useMemo(
        () => buildStaticAcciones(tActions, handleCopyUrl, handleToggleTheme),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [resolvedTheme, tActions],
    );

    const staticPaginas = useMemo(() => buildStaticPaginas(tPages), [tPages]);
    const staticConfig = useMemo(() => buildStaticConfig(tSettings), [tSettings]);

    // ── Entries dinámicos: cuentas, agentes, recientes ────────────────────
    const dynamicEntries = useMemo(() => {
        const cuentas: CommandEntry[] = [];
        const agentesGrp: CommandEntry[] = [];
        const recientes: CommandEntry[] = [];

        if (accounts.length >= 2) {
            for (const acc of accounts) {
                if (acc.id === currentAccount.id) continue;
                cuentas.push({
                    item: makeIconItem(
                        `acc-${acc.id}`,
                        t("switchToCompany", { name: acc.name }),
                        Building07,
                        `${acc.plan}${acc.agencyName ? ` · ${acc.agencyName}` : ""} · ${acc.agents.length} ${acc.agents.length === 1 ? t("memberSingular") : t("memberPlural")}`,
                    ),
                    action: {
                        run: () => {
                            setCurrentAccountId(acc.id);
                            flash(t("switchedTo", { name: acc.name }), "success");
                        },
                    },
                });
            }
        }

        if (agents.length >= 2) {
            for (const agent of agents) {
                if (agent.id === currentAgent.id) continue;
                agentesGrp.push({
                    item: makeIconItem(
                        `agent-${agent.id}`,
                        t("switchToAgent", { name: agent.name }),
                        Building08,
                        t("agentMeta", {
                            members: agent.members,
                            memberLabel: agent.members === 1 ? t("memberSingular") : t("memberPlural"),
                            docs: agent.stats.documents,
                        }),
                    ),
                    action: {
                        run: () => {
                            setCurrentAgentId(agent.id);
                            flash(t("switchedTo", { name: agent.name }), "success");
                        },
                    },
                });
            }
        }

        for (const r of recents.slice(0, 6)) {
            const meta = labelForPath(r.pathname);
            recientes.push({
                item: makeIconItem(`recent-${r.pathname}`, meta.label, meta.icon, relativeTime(r.visitedAt, t)),
                action: { href: r.pathname },
            });
        }

        return { cuentas, agentesGrp, recientes };
    }, [accounts, currentAccount.id, agents, currentAgent.id, recents, flash, setCurrentAccountId, setCurrentAgentId, t, pathLabels]);

    // ── Grupos en orden canónico ──────────────────────────────────────────
    const { groups, actionMap } = useMemo(() => {
        const blocks: Array<{ id: string; title: string; entries: CommandEntry[] }> = [
            { id: "recientes",      title: t("groupRecents"),       entries: dynamicEntries.recientes },
            { id: "acciones",       title: t("groupActions"),       entries: staticAcciones },
            { id: "cuentas",        title: t("groupCompanies"),     entries: dynamicEntries.cuentas },
            { id: "agentes",        title: t("groupAgents"),        entries: dynamicEntries.agentesGrp },
            { id: "paginas",        title: t("groupPages"),         entries: staticPaginas },
            { id: "configuracion",  title: t("groupSettings"),      entries: staticConfig },
            { id: "documentos",     title: t("groupDocuments"),     entries: DYNAMIC_DOCS },
            { id: "automatizaciones", title: t("groupAutomations"), entries: DYNAMIC_WORKFLOWS },
            { id: "conversaciones", title: t("groupConversations"), entries: DYNAMIC_CONVS },
        ];

        const groups: CommandMenuGroupType[] = blocks
            .filter((b) => b.entries.length > 0)
            .map((b) => ({
                id: b.id,
                title: b.title,
                items: b.entries.map((e) => e.item),
            }));

        const actionMap = new Map<string, Action>();
        for (const b of blocks) {
            for (const e of b.entries) actionMap.set(e.item.id, e.action);
        }

        return { groups, actionMap };
    }, [dynamicEntries, staticAcciones, staticPaginas, staticConfig, t]);

    const handleSelectionChange = (keys: Iterable<Key> | "all") => {
        if (keys === "all") return;
        const id = Array.from(keys).at(0);
        if (!id) return;
        const action = actionMap.get(String(id));
        onOpenChange(false);
        if (action?.run) {
            action.run();
            return;
        }
        if (action?.href) {
            push(action.href);
        }
    };

    return (
        <CommandMenu
            isOpen={open}
            onOpenChange={onOpenChange}
            items={groups}
            placeholder={t("placeholder")}
            shortcut={null}
            onSelectionChange={handleSelectionChange}
            emptyState={
                <EmptyState size="sm" className="overflow-hidden p-6 pb-10">
                    <EmptyState.Header pattern="none">
                        <EmptyState.SpotlightIcon icon={SearchLg} color="gray" />
                    </EmptyState.Header>
                    <EmptyState.Content className="mb-0">
                        <EmptyState.Title>{t("emptyTitle")}</EmptyState.Title>
                        <EmptyState.Description>
                            {t("emptyDescription")}
                        </EmptyState.Description>
                    </EmptyState.Content>
                </EmptyState>
            }
        >
            <AriaHeading slot="title" className="sr-only">
                {t("srTitle")}
            </AriaHeading>
            <CommandMenu.Group>
                <CommandMenu.List>
                    {(group) => (
                        <CommandMenu.Section {...group}>
                            {(item) => <CommandMenu.Item key={item.id} {...item} />}
                        </CommandMenu.Section>
                    )}
                </CommandMenu.List>
            </CommandMenu.Group>
            <CommandMenu.Footer />
        </CommandMenu>
    );
}

/** Hook que registra el atajo Cmd/Ctrl+K para abrir el command palette. */
export function useCommandPaletteShortcut(setOpen: (v: boolean | ((p: boolean) => boolean)) => void) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [setOpen]);
}
