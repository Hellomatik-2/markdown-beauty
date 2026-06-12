import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const MAX_HITS = 1500;

/** Quita los <mark> de una búsqueda anterior dejando el DOM intacto. */
function clearMarks(root: HTMLElement) {
    root.querySelectorAll("mark[data-mb-hit]").forEach((mark) => {
        mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
    });
    root.normalize();
}

/** Envuelve cada coincidencia (case-insensitive) en <mark data-mb-hit>. */
function paintMarks(root: HTMLElement, query: string): HTMLElement[] {
    const q = query.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue?.toLowerCase().includes(q)) return NodeFilter.FILTER_REJECT;
            if (node.parentElement?.closest("mark[data-mb-hit],script,style")) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    const hits: HTMLElement[] = [];
    for (const node of textNodes) {
        if (hits.length >= MAX_HITS) break;
        const text = node.nodeValue ?? "";
        const lower = text.toLowerCase();
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        for (let i = lower.indexOf(q); i !== -1 && hits.length < MAX_HITS; i = lower.indexOf(q, i + q.length)) {
            if (i > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, i)));
            const mark = document.createElement("mark");
            mark.dataset.mbHit = "";
            mark.textContent = text.slice(i, i + q.length);
            fragment.appendChild(mark);
            hits.push(mark);
            cursor = i + q.length;
        }
        if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
        node.replaceWith(fragment);
    }
    return hits;
}

/**
 * Búsqueda en el documento renderizado: pinta <mark> sobre los text nodes
 * del artículo y navega entre coincidencias. Las marcas viven fuera de
 * React (el artículo se re-renderiza solo al cambiar de documento).
 */
export function useDocSearch(articleRef: RefObject<HTMLElement | null>, contentKey: string | null) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [total, setTotal] = useState(0);
    const [current, setCurrent] = useState(0);
    const hitsRef = useRef<HTMLElement[]>([]);

    const focusHit = useCallback((index: number, smooth = true) => {
        const hits = hitsRef.current;
        hits.forEach((h, i) => {
            if (i === index) h.setAttribute("data-current", "true");
            else h.removeAttribute("data-current");
        });
        hits[index]?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    }, []);

    // Re-pintar al cambiar query, documento, o al abrir/cerrar
    useEffect(() => {
        const root = articleRef.current;
        if (!root) return;
        clearMarks(root);
        hitsRef.current = [];
        if (!open || query.trim().length < 2) {
            setTotal(0);
            setCurrent(0);
            return;
        }
        const hits = paintMarks(root, query.trim());
        hitsRef.current = hits;
        setTotal(hits.length);
        setCurrent(0);
        if (hits.length > 0) focusHit(0, false);
    }, [query, open, contentKey, articleRef, focusHit]);

    // Limpiar al desmontar/cambiar de doc con la barra cerrada
    useEffect(() => {
        return () => {
            const root = articleRef.current;
            if (root) clearMarks(root);
        };
    }, [contentKey, articleRef]);

    const step = useCallback(
        (dir: 1 | -1) => {
            const count = hitsRef.current.length;
            if (count === 0) return;
            setCurrent((prev) => {
                const next = (prev + dir + count) % count;
                focusHit(next);
                return next;
            });
        },
        [focusHit],
    );

    const close = useCallback(() => {
        setOpen(false);
        setQuery("");
    }, []);

    return { open, setOpen, query, setQuery, total, current, step, close };
}
