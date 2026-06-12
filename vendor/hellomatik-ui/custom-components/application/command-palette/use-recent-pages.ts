"use client";

/**
 * useRecentPages — trackea las últimas N páginas visitadas en localStorage.
 *
 * Se usa para alimentar el grupo "Recientes" del CommandPalette. Cada vez
 * que el pathname cambia, lo empuja al inicio de la cola (deduplicada) y
 * persiste. El componente lee la cola sincrónicamente al montar y queda
 * suscrito a los cambios del pathname.
 *
 * Pattern Linear/Vercel: recents reales > recents inventados. Ver lo que
 * realmente has tocado en los últimos 5 clicks aporta más valor que una
 * lista estática hardcoded.
 */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "hm.mockup.cmdk.recent";
const MAX_RECENTS = 6;

/** Rutas que NO queremos guardar como recientes (ruido/redirects). */
const EXCLUDE = new Set<string>(["/", "/login", "/onboarding"]);

export interface RecentPage {
    pathname: string;
    /** Última visita (timestamp UNIX). */
    visitedAt: number;
}

const readRecents = (): RecentPage[] => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as RecentPage[]) : [];
    } catch {
        return [];
    }
};

const writeRecents = (recents: RecentPage[]) => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
    } catch {
        // ignore
    }
};

/**
 * Devuelve los recientes (sin la ruta actual). El componente decide cómo
 * mostrarlos. La actualización del store la hace `useTrackPageVisit`
 * (separado para que el palette no necesite cargar este efecto al abrirse).
 */
export function useRecentPages(): RecentPage[] {
    const [recents, setRecents] = useState<RecentPage[]>([]);
    const pathname = usePathname();

    useEffect(() => {
        // Re-lee cuando cambia el pathname — el otro hook puede haber
        // actualizado el storage.
        setRecents(readRecents().filter((r) => r.pathname !== pathname));
    }, [pathname]);

    return recents;
}

/**
 * Hook side-effect: monta una vez en el shell de la app y registra cada
 * navegación en localStorage. NO devuelve nada — se usa solo por su efecto.
 *
 * Lo monto en `app/layout.tsx` o en el primer client wrapper (AIAssistantShell)
 * para que trackee toda la navegación sin requerir consumirlo en cada página.
 */
export function useTrackPageVisit() {
    const pathname = usePathname();

    useEffect(() => {
        if (!pathname) return;
        if (EXCLUDE.has(pathname)) return;

        const current = readRecents();
        // Quitamos la ruta actual si ya estaba (la vamos a poner al frente).
        const deduped = current.filter((r) => r.pathname !== pathname);
        const next: RecentPage[] = [
            { pathname, visitedAt: Date.now() },
            ...deduped,
        ].slice(0, MAX_RECENTS);

        writeRecents(next);
    }, [pathname]);
}
