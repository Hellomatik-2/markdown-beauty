"use client";

/**
 * SpotlightOverlay — full-screen scrim with a cut-out around a target element.
 *
 * Technique: SVG `<mask>` with two rects.
 *   - White rect (full screen) reveals the dimmed/blurred layer.
 *   - Black rect (around target) punches a hole — keeping the target sharp.
 *
 * Two stacked fixed layers cover the viewport:
 *   1. `backdrop-blur` layer — blurs whatever the user has behind it.
 *      The cut-out is achieved by clipping this layer with the SVG mask so
 *      blur DOES NOT apply on the target area.
 *   2. Dim layer (`bg-black/45`) — same mask, gives the dimmed look outside
 *      the cut-out.
 *
 * The target element stays visually untouched: nothing is moved, restyled,
 * or re-parented. Only the overlay is rendered. The bbox is animated with
 * motion so transitioning between steps is smooth.
 *
 * Pointer events: overlay captures clicks (blocks the rest of the UI). The
 * tour bubble carries the "Next/Back/Skip" CTAs. v1 is non-interactive
 * (target receives no clicks during the tour); this avoids accidental
 * navigation that would break the step sequence.
 *
 * Accessibility: role="dialog" aria-modal labelledby title id. ESC skips
 * the tour. Honors prefers-reduced-motion via `motion-reduce:transition-none`.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { motionTokens } from "@/utils/motion";

const MASK_ID = "hm-spotlight-mask";

interface Rect {
    x:      number;
    y:      number;
    width:  number;
    height: number;
    radius: number;
}

interface SpotlightOverlayProps {
    /** When true the overlay is mounted. */
    open: boolean;
    /** Rect of the element to spotlight, in viewport coordinates. */
    rect: Rect | null;
    /** Padding around the cut-out (px). Default 8. */
    padding?: number;
    /** Called when the user presses ESC. */
    onEscape?: () => void;
    /** Called when the user clicks the dimmed area (NOT the cut-out). */
    onBackdropClick?: () => void;
    /** Accessible name for the dialog — required by ARIA (a11y rule
     *  `aria-dialog-name`). Default "Tour guiado" si no se especifica. */
    ariaLabel?: string;
    /** Children render INSIDE the portal (the tour bubble lives here). */
    children?: React.ReactNode;
}

export function SpotlightOverlay({
    open,
    rect,
    padding = 8,
    onEscape,
    onBackdropClick,
    ariaLabel = "Tour guiado",
    children,
}: SpotlightOverlayProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open || !onEscape) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onEscape();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onEscape]);

    if (!mounted || typeof document === "undefined") return null;

    // Hole geometry — padded around the target.
    const holeStyle: CSSProperties = rect
        ? {
              ["--hm-spot-x"]:      `${Math.max(0, rect.x - padding)}px`,
              ["--hm-spot-y"]:      `${Math.max(0, rect.y - padding)}px`,
              ["--hm-spot-w"]:      `${rect.width + padding * 2}px`,
              ["--hm-spot-h"]:      `${rect.height + padding * 2}px`,
              ["--hm-spot-radius"]: `${rect.radius}px`,
          } as CSSProperties
        : {};

    return createPortal(
        <AnimatePresence>
            {open && (
                <m.div
                    key="hm-spotlight"
                    role="dialog"
                    aria-modal="true"
                    aria-label={ariaLabel}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={motionTokens.fluid}
                    style={holeStyle}
                    className="fixed inset-0 z-[200]"
                    onClick={(e) => {
                        // Only react when click is on the scrim, not bubbled
                        // up from the bubble (children). Bubble stops it.
                        if (e.target === e.currentTarget) {
                            onBackdropClick?.();
                        }
                    }}
                >
                    {/* SVG mask shared by both layers below — the mask defines
                        the visible area: full screen MINUS the target rect. */}
                    <svg
                        className="pointer-events-none absolute size-0"
                        aria-hidden="true"
                    >
                        <defs>
                            <mask id={MASK_ID}>
                                <rect
                                    x="0"
                                    y="0"
                                    width="100%"
                                    height="100%"
                                    fill="white"
                                />
                                {rect && (
                                    <m.rect
                                        initial={false}
                                        animate={{
                                            x:      Math.max(0, rect.x - padding),
                                            y:      Math.max(0, rect.y - padding),
                                            width:  rect.width + padding * 2,
                                            height: rect.height + padding * 2,
                                            rx:     rect.radius,
                                            ry:     rect.radius,
                                        }}
                                        transition={motionTokens.fluid}
                                        fill="black"
                                    />
                                )}
                            </mask>
                        </defs>
                    </svg>

                    {/* Layer 1 — backdrop blur. Clipped by the mask so the
                        target area is NOT blurred. */}
                    <div
                        className="absolute inset-0 backdrop-blur-md motion-reduce:backdrop-blur-sm"
                        style={{
                            mask:        `url(#${MASK_ID})`,
                            WebkitMask:  `url(#${MASK_ID})`,
                        }}
                    />

                    {/* Layer 2 — dim. Same mask. Heavier in dark mode where
                        the app chrome is already near-black: blur alone is
                        invisible on flat dark surfaces, so the dim layer
                        carries all of the spotlight contrast. */}
                    <div
                        className="absolute inset-0 bg-black/55 dark:bg-black/72"
                        style={{
                            mask:        `url(#${MASK_ID})`,
                            WebkitMask:  `url(#${MASK_ID})`,
                        }}
                    />

                    {/* Layer 3 — bright ring around the cutout. Drawn as a
                        thin absolutely-positioned div following the cutout
                        rect. Gives the spotlight effect a "lit" perimeter
                        that reads on every theme regardless of dim/blur. */}
                    {rect && (
                        <m.div
                            initial={false}
                            animate={{
                                x:      Math.max(0, rect.x - padding),
                                y:      Math.max(0, rect.y - padding),
                                width:  rect.width  + padding * 2,
                                height: rect.height + padding * 2,
                            }}
                            transition={motionTokens.fluid}
                            style={{
                                position:     "absolute",
                                top:          0,
                                left:         0,
                                borderRadius: rect.radius,
                                // Stacked shadows — readable on dark and
                                // light themes alike:
                                //   1px hairline (defines the edge)
                                //   12px soft glow (immediate halo)
                                //   40px wide bloom (carries the light)
                                // Opacities tuned for dark mode where the
                                // backing surface is already near-black;
                                // light mode accepts the same values because
                                // the inner dim is bg-black/55 (still dark
                                // enough behind the ring to read).
                                boxShadow: [
                                    "0 0 0 1px rgba(255,255,255,0.55)",
                                    "0 0 12px 2px rgba(255,255,255,0.45)",
                                    "0 0 40px 8px rgba(255,255,255,0.28)",
                                ].join(", "),
                            }}
                            className="pointer-events-none"
                            aria-hidden="true"
                        />
                    )}

                    {children}
                </m.div>
            )}
        </AnimatePresence>,
        document.body,
    );
}

/**
 * Measure a target by CSS selector. Recomputes on resize / scroll so the
 * cut-out follows the element if the user scrolls or resizes the window
 * during the tour.
 *
 * Returns `null` until the target is found in the DOM. Use a polling retry
 * with a short backoff because some anchors render after route changes or
 * data fetches.
 */
export function useSpotlightRect(
    selector: string | null,
    active: boolean,
    radiusOverride?: number,
): Rect | null {
    const [rect, setRect] = useState<Rect | null>(null);

    useEffect(() => {
        if (!active || !selector) {
            setRect(null);
            return;
        }

        let cancelled  = false;
        let raf        = 0;
        let retry      = 0;
        const maxRetry = 20;

        const compute = () => {
            const el = document.querySelector<HTMLElement>(selector);
            if (!el) {
                if (retry < maxRetry && !cancelled) {
                    retry += 1;
                    window.setTimeout(() => {
                        if (!cancelled) raf = requestAnimationFrame(compute);
                    }, 100);
                }
                return;
            }
            const r = el.getBoundingClientRect();
            // Read border-radius from CSS so the cut-out matches the actual
            // shape of the element. Fallback to 12 (lg) — most chrome in
            // this app uses rounded-lg/xl. Caller can override.
            const styleRadius = parseFloat(
                window.getComputedStyle(el).borderTopLeftRadius || "0",
            );
            const radius =
                radiusOverride ??
                (Number.isFinite(styleRadius) && styleRadius > 0 ? styleRadius : 12);

            setRect({
                x:      r.left,
                y:      r.top,
                width:  r.width,
                height: r.height,
                radius,
            });
        };

        compute();
        const onChange = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(compute);
        };
        window.addEventListener("resize", onChange);
        window.addEventListener("scroll", onChange, true);
        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onChange);
            window.removeEventListener("scroll", onChange, true);
        };
    }, [selector, active, radiusOverride]);

    return rect;
}

export type { Rect as SpotlightRect };
