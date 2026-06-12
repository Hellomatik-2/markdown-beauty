"use client";

/**
 * UserMenu — desplegable de usuario inspirado en el panel de ElevenLabs:
 *
 *   ┌────────────────────────────────┐
 *   │ Saldo card  (anillo + Mejorar) │
 *   │ Total · Exceso                 │
 *   ├────────────────────────────────┤
 *   │ Empresa actual                 │
 *   │   Hellomatik · Plan Enterprise │
 *   ├────────────────────────────────┤
 *   │ Mi perfil                      │
 *   │ Empresa                        │
 *   │ Plan y facturación             │
 *   │ Tema                       › │
 *   ├────────────────────────────────┤
 *   │ Análisis de uso                │
 *   │ Documentación                  │
 *   │ Términos y privacidad          │
 *   ├────────────────────────────────┤
 *   │ ⏻ Cerrar sesión                │
 *   └────────────────────────────────┘
 *
 * Construido con DesignSystem Dropdown / Avatar / Button + react-aria-components.
 * El trigger es el avatar con anillo de progreso (reutilizado del sidebar).
 *
 * Nota: a nivel de modelo, una EMPRESA contiene múltiples AGENTES. La empresa
 * es la cuenta cliente (admin); los agentes son los círculos del rail.
 */

import {
    Building07,
    ChevronDown,
    ChevronRight,
    Contrast01,
    CreditCard02,
    Globe01,
    LogOut01,
    Mail01,
    MarkerPin01,
    Moon01,
    PlayCircle,
    Plus,
    PuzzlePiece01,
    Trash02,
    User01,
    UsersPlus,
    Users01,
} from "@hm/icons";
import { Button as AriaButton, Header as AriaHeader } from "react-aria-components";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocale as setLocaleAction } from "@/i18n/locale-actions";
import { useTheme } from "next-themes";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/base/avatar/avatar";

// Lazy: galería de plantillas de email — solo se monta cuando el usuario
// lo abre desde la sección Demo del UserMenu.
const EmailTemplatesModal = lazy(() =>
    import("@/views/_shared/email-templates/email-templates-modal").then((m) => ({
        default: m.EmailTemplatesModal,
    })),
);
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { useCurrentAccount } from "@/views/_shared/agent-context";
import { AccountAvatar } from "@/views/_shared/account-switcher";
import { groupAccounts, type Account as AccountType } from "@/data/accounts-catalog";
import { useFlash } from "@/views/_shared/use-flash";
import { ConfirmDestructiveModal } from "@/views/_shared/confirm-destructive-modal";
import { AppearanceSettingsModal } from "@/views/_shared/appearance-settings-modal";
import { COACH_REPLAY_EVENT } from "@/views/_shared/coach-marks";
import { resetAllCoachmarks } from "@/hooks/use-coachmark";
import { replayWorkspaceTour } from "@/views/_shared/workspace-spotlight-tour";
import { useFormat } from "@/hooks/use-locale-format";
import { cx } from "@/utils/cx";

interface UserMenuProps {
    name: string;
    email: string;
    initials: string;
    /** Etiqueta de cuenta. Ej: "Hellomatik · Enterprise". */
    accountLabel?: string;
    /** Nombre de la empresa actual. Default: "Hellomatik". */
    companyName?: string;
    /** Plan de la empresa. Default: "Plan Enterprise". */
    companyPlan?: string;
    /** 0–100. % de plan consumido. */
    usagePct?: number;
    /** Total de créditos del plan. Default: 500.000. */
    creditsTotal?: number;
    /** Créditos en exceso (overage). Default: 0. */
    creditsOverage?: number;
    avatarUrl?: string;
    onAction?: (action: UserMenuAction) => void;
}

export type UserMenuAction =
    | "upgrade"
    | "my-profile"
    | "invite-members"
    | "company-settings"
    | "company-integrations"
    | "subscription"
    | "trash"
    | "theme"
    | "logout"
    | "restart-onboarding"
    | "replay-coach-marks";

// ─────────────────────────────────────────────────────────────────────────────
// Anillo de progreso reutilizable (trigger + saldo card)
// ─────────────────────────────────────────────────────────────────────────────

const ProgressRing = ({
    pct,
    size = 36,
    stroke = 2,
    children,
}: {
    pct: number;
    size?: number;
    stroke?: number;
    children?: React.ReactNode;
}) => {
    const r = (size - stroke * 2) / 2;
    return (
        <span
            className="relative inline-flex shrink-0 items-center justify-center"
            style={{ width: size, height: size }}
        >
            <svg
                viewBox={`0 0 ${size} ${size}`}
                className="absolute inset-0 size-full -rotate-90"
                aria-hidden="true"
            >
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="var(--color-border-secondary)"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="var(--color-fg-brand-primary)"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={100}
                    strokeDashoffset={100 - Math.max(0, Math.min(100, pct))}
                    className="transition-[stroke-dashoffset] duration-300 ease-out"
                />
            </svg>
            <span className="relative inline-flex items-center justify-center">
                {children}
            </span>
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Theme submenu inline — clic cicla light → dark → system
// ─────────────────────────────────────────────────────────────────────────────

const useThemeLabel = (t: ReturnType<typeof useTranslations<"shell.userMenu">>) => {
    const { resolvedTheme, setTheme, theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return { label: t("themeLabel"), cycle: () => {} };
    const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";
    const cycle = () => setTheme(isDark ? "light" : "dark");
    return { label: isDark ? t("themeDark") : t("themeLight"), cycle };
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

// Mapeo de acciones a rutas internas (mocks navegables).
//
// Modelo mental aplicado:
//  · Yo (perfil)            → /me
//  · Mi empresa (org/admin) → /workspace
//  · Plan y facturación     → /workspace/billing  (página dedicada, no anchor en /workspace)
//  · Mi agente actual       → cambiar desde el rail izquierdo del sidebar
const ACTION_ROUTES: Partial<Record<UserMenuAction, string>> = {
    "my-profile": "/me",
    "company-settings": "/workspace",
    "company-integrations": "/integrations",
    subscription: "/workspace/billing",
    upgrade: "/workspace/billing",
    trash: "/trash",
};

export function UserMenu({
    name,
    email,
    initials,
    accountLabel,
    companyName = "Hellomatik",
    companyPlan = "Plan Enterprise",
    usagePct = 0,
    creditsTotal = 500_000,
    creditsOverage = 0,
    avatarUrl,
    onAction,
}: UserMenuProps) {
    const t = useTranslations("shell.userMenu");
    const fmt = useFormat();
    const pct = Math.max(0, Math.min(100, usagePct));
    const usageLabel = t("usagePlatformLabel", { pct: pct.toFixed(0) });
    const used = Math.round((pct / 100) * creditsTotal);
    const remaining = Math.max(0, creditsTotal - used);
    const theme = useThemeLabel(t);
    const currentLocale = useLocale();
    const localeLabel = currentLocale === "es" ? t("languageEs") : t("languageEn");
    const cycleLocale = () => {
        const next = currentLocale === "es" ? "en" : "es";
        // AIOrb overlay (mounted globally en `AppShell`) — el revalidatePath
        // del server action refresca el árbol con las traducciones nuevas
        // dentro de la ventana visible del overlay (1.4s), evitando el flash
        // de mezcla de idiomas.
        window.dispatchEvent(
            new CustomEvent("hm:locale-switching", { detail: { target: next } }),
        );
        setLocaleAction(next);
    };
    const { push } = useRouter();
    const flash = useFlash();
    const { accounts, demoSingleAccount, setDemoSingleAccount } = useCurrentAccount();
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [appearanceOpen, setAppearanceOpen] = useState(false);
    const [emailTemplatesOpen, setEmailTemplatesOpen] = useState(false);
    const handleAction = (action: UserMenuAction) => {
        onAction?.(action);
        const route = ACTION_ROUTES[action];
        if (route) {
            push(route);
            return;
        }
        // Invitar miembros no navega — abre el modal global en sitio para
        // no sacar al usuario del contexto donde estaba (Apple-style:
        // ephemeral actions stay in place).
        if (action === "invite-members") {
            window.dispatchEvent(new CustomEvent("hm:open-invite", {
                detail: { defaultAgentId: undefined },
            }));
            return;
        }
        // Acciones sin ruta: feedback con flash.
        if (action === "logout") {
            setLogoutOpen(true);
            return;
        }
        if (action === "theme") {
            // El cambio de tema ya se aplica vía theme.cycle(); este handler
            // sólo se usa cuando onAction se llama explícitamente.
            return;
        }
        if (action === "restart-onboarding") {
            // Modo demo: limpia el state persistido del onboarding (state
            // conversacional, dismiss del checklist, snooze/skip de tareas
            // y la sessionStorage que evita el redirect a la home por
            // defecto) y navega a `/onboarding` para verlo desde cero.
            // Útil para enseñar el flujo en demos sin tener que crear
            // cuenta nueva o manipular DevTools a mano.
            if (typeof window !== "undefined") {
                try {
                    const ls = window.localStorage;
                    // Borra todas las claves cuyo prefijo es del onboarding —
                    // cubre `hm.mockup.onboarding.v1`, `hm.mockup.onboarding.dismissed.*`,
                    // `hm.mockup.onboarding.task-state` y la sessionStorage del default-redirect.
                    const keys: string[] = [];
                    for (let i = 0; i < ls.length; i++) {
                        const k = ls.key(i);
                        if (k && k.startsWith("hm.mockup.onboarding")) keys.push(k);
                    }
                    keys.forEach((k) => ls.removeItem(k));
                    // Limpia TODAS las claves de coach marks (hm.mockup.coach.<id>.shown)
                    const coachKeys: string[] = [];
                    for (let i = 0; i < ls.length; i++) {
                        const k = ls.key(i);
                        if (k && k.startsWith("hm.mockup.coach.")) coachKeys.push(k);
                    }
                    coachKeys.forEach((k) => ls.removeItem(k));
                    // Limpia flags del spotlight tour del workspace
                    // (hm.mockup.spotlight.<id>.{done,skipped}). Sin esto,
                    // restart-onboarding no devuelve el tour spotlight.
                    const spotlightKeys: string[] = [];
                    for (let i = 0; i < ls.length; i++) {
                        const k = ls.key(i);
                        if (k && k.startsWith("hm.mockup.spotlight.")) spotlightKeys.push(k);
                    }
                    spotlightKeys.forEach((k) => ls.removeItem(k));
                    resetAllCoachmarks();
                    window.sessionStorage.removeItem("hm:default-redirect-done");
                } catch {
                    // localStorage puede fallar (private mode); la navegación sigue.
                }
            }
            flash(t("onboardingResetFlash"), "neutral");
            push("/onboarding");
            return;
        }
        if (action === "replay-coach-marks") {
            // Modo demo: limpia SOLO las flags de coach marks y dispara el
            // evento de replay → las instancias montadas reinician su tour
            // sin reload ni navegación.
            if (typeof window !== "undefined") {
                try {
                    const ls = window.localStorage;
                    const coachKeys: string[] = [];
                    for (let i = 0; i < ls.length; i++) {
                        const k = ls.key(i);
                        if (k && k.startsWith("hm.mockup.coach.")) coachKeys.push(k);
                    }
                    coachKeys.forEach((k) => ls.removeItem(k));
                    resetAllCoachmarks();
                    window.dispatchEvent(new Event(COACH_REPLAY_EVENT));
                    // El spotlight tour del workspace es el reemplazo del
                    // CoachMarks "home". Si el usuario está reactivando el
                    // tour de la app, también queremos volver a mostrar el
                    // tour spotlight del workspace.
                    replayWorkspaceTour();
                } catch {
                    // ignore
                }
            }
            flash({
                title: t("coachMarksFlashTitle"),
                description: t("coachMarksFlashDesc"),
                tone: "info",
            });
            return;
        }
    };

    return (
        <>
        <Dropdown.Root>
            <AriaButton
                // A11y (iter 9, WCAG SC 2.5.3 Label in Name): el botón
                // muestra `initials` visualmente (e.g. "IC"). Voice control
                // users dirán "click IC" y el accessible name debe contener
                // ese texto literal. El aria-label empieza con `initials`
                // para satisfacer la regla, seguido del nombre completo
                // y el contexto de uso. Lighthouse `label-content-name-
                // mismatch` valida exactly esto.
                aria-label={t("triggerAriaLabel", { initials, name, usageLabel })}
                className={({ isFocusVisible, isHovered }) =>
                    cx(
                        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-transform duration-150 outline-focus-ring",
                        isHovered && "scale-[1.04]",
                        isFocusVisible && "outline-2 outline-offset-2",
                    )
                }
            >
                <ProgressRing pct={pct} size={36} stroke={2}>
                    <Avatar size="xs" initials={initials} src={avatarUrl} alt={name} />
                </ProgressRing>
            </AriaButton>

            <Dropdown.Popover className="w-72" placement="bottom end">
                {/* ── Saldo card ─────────────────────────────────────────── */}
                <div className="px-2 pt-2 pb-1">
                    <div className="rounded-lg border border-secondary bg-secondary/40 px-3 py-2.5">
                        {/* Header row */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <ProgressRing pct={pct} size={22} stroke={3}>
                                    <span aria-hidden="true" className="block size-2.5 rounded-full bg-brand-primary/40" />
                                </ProgressRing>
                                <span className="text-sm font-semibold text-primary">{t("balance")}</span>
                            </div>
                            <Button
                                size="sm"
                                color="primary"
                                onClick={() => handleAction("upgrade")}
                                className="!h-6 !px-2 !text-xs"
                            >
                                {t("upgrade")}
                            </Button>
                        </div>
                        {/* Stats */}
                        <dl className="mt-2.5 flex flex-col gap-1 text-xs">
                            <div className="flex items-center justify-between">
                                <dt className="text-tertiary">{t("creditsTotal")}</dt>
                                <dd className="font-semibold tabular-nums text-primary">
                                    {fmt.number(creditsTotal)} {t("creditsUnit")}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-tertiary">{t("creditsRemaining")}</dt>
                                <dd className="font-semibold tabular-nums text-primary">
                                    {fmt.number(remaining)}
                                </dd>
                            </div>
                            {creditsOverage > 0 && (
                                <div className="flex items-center justify-between">
                                    <dt className="text-tertiary">{t("creditsOverage")}</dt>
                                    <dd className="font-semibold tabular-nums text-warning-primary">
                                        {fmt.number(creditsOverage)}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>
                </div>

                <Dropdown.Menu>
                    {/* ── Mi cuenta — sólo cosas mías como usuario ──────────
                         Ya no precedido por la card duplicada de avatar+
                         nombre+plan: ese bloque vivía aquí pero era ruido,
                         porque el header del popover (arriba, con créditos)
                         y el `CurrentAccountBlock` ya muestran identidad y
                         empresa con más detalle. */}
                    <SectionLabel>{t("sectionMyAccount")}</SectionLabel>
                    <Dropdown.Item
                        icon={User01}
                        label={t("myProfile")}
                        onAction={() => handleAction("my-profile")}
                    />

                    <Dropdown.Separator />

                    {/* ── Empresa — admin/owner: cosas de la organización ── */}
                    <SectionLabel>{t("sectionCompany")}</SectionLabel>
                    <Dropdown.Item
                        icon={Building07}
                        label={t("companySettings")}
                        onAction={() => handleAction("company-settings")}
                    />
                    <Dropdown.Item
                        icon={PuzzlePiece01}
                        label={t("companyIntegrations")}
                        onAction={() => handleAction("company-integrations")}
                    />
                    <Dropdown.Item
                        icon={UsersPlus}
                        label={t("inviteMembers")}
                        onAction={() => handleAction("invite-members")}
                    />
                    <Dropdown.Item
                        icon={CreditCard02}
                        label={t("planBilling")}
                        onAction={() => handleAction("subscription")}
                    />

                    <Dropdown.Separator />

                    {/* ── Preferencias ─────────────────────────────────── */}
                    <SectionLabel>{t("sectionPreferences")}</SectionLabel>
                    <Dropdown.Item
                        icon={Trash02}
                        label={t("trash")}
                        onAction={() => handleAction("trash")}
                    />
                    <Dropdown.Item
                        icon={Contrast01}
                        label={t("appearance")}
                        onAction={() => setAppearanceOpen(true)}
                    />
                    <Dropdown.Item
                        icon={Globe01}
                        label={localeLabel}
                        onAction={cycleLocale}
                    />
                    {/* Modal de apariencia montado al final del componente. */}

                    <Dropdown.Separator />

                    {/* ── Demo — sólo visible en mockup ──────────────────── */}
                    <SectionLabel>{t("sectionDemo")}</SectionLabel>
                    <Dropdown.Item
                        icon={Mail01}
                        label={t("emailTemplates")}
                        onAction={() => setEmailTemplatesOpen(true)}
                    />
                    <Dropdown.Item
                        icon={PlayCircle}
                        label={t("restartOnboarding")}
                        onAction={() => handleAction("restart-onboarding")}
                    />
                    <Dropdown.Item
                        icon={MarkerPin01}
                        label={t("showCoachMarks")}
                        onAction={() => handleAction("replay-coach-marks")}
                    />

                    <Dropdown.Separator />

                    {/* ── Logout ─────────────────────────────────────────── */}
                    <Dropdown.Item
                        icon={LogOut01}
                        label={t("signOut")}
                        onAction={() => handleAction("logout")}
                    />
                </Dropdown.Menu>

            </Dropdown.Popover>
        </Dropdown.Root>

        <ConfirmDestructiveModal
            open={logoutOpen}
            onOpenChange={setLogoutOpen}
            title={t("logoutTitle")}
            description={t("logoutDescription")}
            confirmLabel={t("logoutConfirm")}
            onConfirm={() => {
                setLogoutOpen(false);
                flash(t("logoutFlash"), "neutral");
                push("/login");
            }}
        />

        <AppearanceSettingsModal
            open={appearanceOpen}
            onOpenChange={setAppearanceOpen}
        />

        {/* Galería de plantillas de email — lazy, solo en la sección Demo.
            (El modal de crear empresa vive en AccountSwitcher del sidebar —
            UN solo lugar para todo lo de empresa.) */}
        {emailTemplatesOpen && (
            <Suspense fallback={null}>
                <EmailTemplatesModal
                    open={emailTemplatesOpen}
                    onOpenChange={setEmailTemplatesOpen}
                />
            </Suspense>
        )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────────

const ThemeRow = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2">
        <Moon01 aria-hidden="true" className="size-4 shrink-0 stroke-[2.25px] text-fg-quaternary" />
        <span className="grow text-sm font-semibold text-secondary">Tema</span>
        <span className="text-xs text-quaternary">{label}</span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 stroke-[2.25px] text-fg-quaternary" />
    </div>
);

// Encabezado de sección: "MI CUENTA", "EMPRESA", "RECURSOS"... — pequeño,
// uppercase, no clicable. Da estructura visual para que se entienda qué
// items son del usuario, cuáles de la empresa y cuáles de la app.
//
// Usa react-aria-components <Header> porque Menu sólo acepta MenuItem,
// MenuSection y Separator dentro de su collection — un <p> suelto se
// silencia (de hecho rompe la lista entera).
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <AriaHeader className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-quaternary">
        {children}
    </AriaHeader>
);

// ─────────────────────────────────────────────────────────────────────────────
// DEAD CODE removed: CurrentAccountBlock + AccountOption.
// La sección "Empresa actual" del UserMenu fue eliminada por petición —
// el cambio de cuenta vive en el AccountSwitcher del rail (cuando hay ≥2).
// Si se necesita reintroducir, ver git history.
// ─────────────────────────────────────────────────────────────────────────────


