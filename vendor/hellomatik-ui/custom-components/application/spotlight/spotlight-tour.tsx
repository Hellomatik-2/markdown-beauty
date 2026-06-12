"use client";

/**
 * SpotlightTour — sequential tour over SpotlightOverlay.
 *
 * Declarative `steps` array. Each step references a DOM target by CSS
 * selector (`[data-coach="..."]` etc). The tour:
 *
 *   1. Resolves the target's bbox (`useSpotlightRect`).
 *   2. Mounts <SpotlightOverlay> with the bbox.
 *   3. Renders a bubble next to the cut-out with title/body + nav buttons.
 *   4. Auto-advances on "Siguiente"; finishes when index === steps.length.
 *
 * Persistence: when a tour finishes via "Listo" we mark
 * `hm.mockup.spotlight.{id}.done = "1"`. "Saltar" marks
 * `hm.mockup.spotlight.{id}.skipped = "1"`. Both flags prevent the tour
 * from auto-starting again.
 *
 * Bubble positioning: side hint per-step (top/bottom/left/right). Position
 * is computed from the bbox + viewport; if the side is "auto", we pick the
 * cardinal direction with the most free space.
 *
 * Reduced motion: handled by the parent <MotionConfig reducedMotion="user">
 * in app-shell. We don't need extra handling here.
 */

import { useCallback, useEffect, useState, useMemo } from "react";
import { AnimatePresence, m } from "motion/react";
import { X } from "@hm/icons";
import { Button } from "@/components/base/buttons/button";
import { motionTokens } from "@/utils/motion";
import { cx } from "@/utils/cx";
import { SpotlightOverlay, useSpotlightRect, type SpotlightRect } from "./spotlight-overlay";

export type SpotlightSide = "top" | "bottom" | "left" | "right" | "auto";

export interface SpotlightStep {
    /** Stable id of the step (used for analytics / aria). */
    key:      string;
    /** CSS selector for the DOM element to spotlight. */
    selector: string;
    /** Short heading shown in the bubble. */
    title:    string;
    /** One- or two-sentence body. */
    body:     string;
    /** Preferred bubble side. `auto` picks the side with most free space. */
    side?:    SpotlightSide;
    /** Extra padding around the cut-out. Default 8. */
    padding?: number;
    /** Override the cut-out radius (px). Defaults to the target's CSS radius. */
    radius?:  number;
}

interface SpotlightTourProps {
    /** Stable tour id for persistence (`hm.mockup.spotlight.{id}.*`). */
    id:           string;
    /** Whether the tour is currently active (parent controls when to start). */
    open:         boolean;
    steps:        SpotlightStep[];
    onClose:      (reason: "completed" | "skipped" | "dismissed") => void;
    /** Override the default "Saltar" label. */
    skipLabel?:   string;
    nextLabel?:   string;
    backLabel?:   string;
    doneLabel?:   string;
    /** A11y label for the close button. */
    closeLabel?:  string;
    /** Optional step counter format. Default "{current} de {total}". */
    counterLabel?: (current: number, total: number) => string;
}

const FLAG_PREFIX = "hm.mockup.spotlight.";

const setFlag = (id: string, kind: "done" | "skipped") => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(`${FLAG_PREFIX}${id}.${kind}`, "1");
    } catch {
        // ignore
    }
};

export function hasSeenSpotlight(id: string): boolean {
    if (typeof window === "undefined") return true;
    try {
        const done    = window.localStorage.getItem(`${FLAG_PREFIX}${id}.done`)    === "1";
        const skipped = window.localStorage.getItem(`${FLAG_PREFIX}${id}.skipped`) === "1";
        return done || skipped;
    } catch {
        return true;
    }
}

export function resetSpotlight(id: string) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(`${FLAG_PREFIX}${id}.done`);
        window.localStorage.removeItem(`${FLAG_PREFIX}${id}.skipped`);
    } catch {
        // ignore
    }
}

export function SpotlightTour({
    id,
    open,
    steps,
    onClose,
    skipLabel    = "Saltar",
    nextLabel    = "Siguiente",
    backLabel    = "Atrás",
    doneLabel    = "Listo",
    closeLabel   = "Cerrar tour",
    counterLabel = (c, t) => `${c} de ${t}`,
}: SpotlightTourProps) {
    const [index, setIndex] = useState(0);

    // Reset to the first step every time the tour opens. Without this, a
    // user who closed mid-tour and re-opens it from the help menu would
    // resume at the last step — surprising.
    useEffect(() => {
        if (open) setIndex(0);
    }, [open]);

    const step = open ? steps[index] : null;
    const rect = useSpotlightRect(step?.selector ?? null, open, step?.radius);

    const finish = useCallback(
        (reason: "completed" | "skipped" | "dismissed") => {
            if (reason === "completed") setFlag(id, "done");
            if (reason === "skipped")   setFlag(id, "skipped");
            onClose(reason);
        },
        [id, onClose],
    );

    const goNext = useCallback(() => {
        if (index >= steps.length - 1) {
            finish("completed");
        } else {
            setIndex((i) => i + 1);
        }
    }, [index, steps.length, finish]);

    const goBack = useCallback(() => {
        setIndex((i) => Math.max(0, i - 1));
    }, []);

    const onSkip = useCallback(() => finish("skipped"), [finish]);

    // Keyboard nav inside the tour: → / Enter advances, ← goes back.
    // ESC is handled by SpotlightOverlay (calls onEscape).
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === "Enter") {
                e.preventDefault();
                goNext();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                goBack();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, goNext, goBack]);

    const isFirst = index === 0;
    const isLast  = index === steps.length - 1;

    return (
        <SpotlightOverlay
            open={open && step !== null}
            rect={rect}
            padding={step?.padding ?? 8}
            onEscape={onSkip}
            ariaLabel={step?.title ?? "Tour guiado"}
        >
            <AnimatePresence mode="wait">
                {step && rect && (
                    <SpotlightBubble
                        key={step.key}
                        rect={rect}
                        side={step.side ?? "auto"}
                        title={step.title}
                        body={step.body}
                        counter={counterLabel(index + 1, steps.length)}
                        isFirst={isFirst}
                        isLast={isLast}
                        skipLabel={skipLabel}
                        nextLabel={nextLabel}
                        backLabel={backLabel}
                        doneLabel={doneLabel}
                        closeLabel={closeLabel}
                        onNext={goNext}
                        onBack={goBack}
                        onSkip={onSkip}
                    />
                )}
            </AnimatePresence>
        </SpotlightOverlay>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bubble — positioned next to the cut-out.
// ─────────────────────────────────────────────────────────────────────────────

const BUBBLE_WIDTH = 320;
const BUBBLE_GAP   = 16;

interface SpotlightBubbleProps {
    rect:       SpotlightRect;
    side:       SpotlightSide;
    title:      string;
    body:       string;
    counter:    string;
    isFirst:    boolean;
    isLast:     boolean;
    skipLabel:  string;
    nextLabel:  string;
    backLabel:  string;
    doneLabel:  string;
    closeLabel: string;
    onNext:     () => void;
    onBack:     () => void;
    onSkip:     () => void;
}

function SpotlightBubble({
    rect,
    side,
    title,
    body,
    counter,
    isFirst,
    isLast,
    skipLabel,
    nextLabel,
    backLabel,
    doneLabel,
    closeLabel,
    onNext,
    onBack,
    onSkip,
}: SpotlightBubbleProps) {
    const placement = useMemo(() => resolvePlacement(rect, side), [rect, side]);

    return (
        <m.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={motionTokens.fluid}
            // Stop propagation so clicks inside the bubble don't bubble up
            // to the overlay scrim (which would otherwise trigger
            // onBackdropClick).
            onClick={(e) => e.stopPropagation()}
            style={{
                position: "fixed",
                top:      placement.top,
                left:     placement.left,
                width:    BUBBLE_WIDTH,
            }}
            className={cx(
                "z-[201] flex flex-col gap-3 rounded-xl bg-primary p-4 shadow-xl ring-1 ring-secondary",
                "outline-hidden",
            )}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-tertiary">{counter}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{title}</p>
                </div>
                <button
                    type="button"
                    onClick={onSkip}
                    aria-label={closeLabel}
                    className="-mr-1 -mt-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-tertiary outline-focus-ring transition-colors duration-150 hover:bg-primary_hover hover:text-secondary"
                >
                    <X className="size-4" aria-hidden="true" />
                </button>
            </div>

            <p className="text-sm leading-relaxed text-tertiary">{body}</p>

            <div className="mt-1 flex items-center justify-between gap-2">
                <Button
                    size="sm"
                    color="link-gray"
                    onClick={onSkip}
                >
                    {skipLabel}
                </Button>
                <div className="flex items-center gap-2">
                    {!isFirst && (
                        <Button
                            size="sm"
                            color="secondary"
                            onClick={onBack}
                        >
                            {backLabel}
                        </Button>
                    )}
                    <Button size="sm" color="primary" onClick={onNext}>
                        {isLast ? doneLabel : nextLabel}
                    </Button>
                </div>
            </div>
        </m.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Placement: choose a side for the bubble around the cut-out, then clamp to
// viewport. `auto` picks the cardinal direction with the most free space.
// ─────────────────────────────────────────────────────────────────────────────

function resolvePlacement(rect: SpotlightRect, side: SpotlightSide): { top: number; left: number } {
    if (typeof window === "undefined") return { top: 0, left: 0 };

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Approximate bubble height. We don't measure (it varies with copy length);
    // 180px is a safe over-estimate for our default copy length and lets the
    // clamp keep the bubble in-bounds without flicker.
    const bh = 180;

    const space = {
        top:    rect.y,
        bottom: vh - (rect.y + rect.height),
        left:   rect.x,
        right:  vw - (rect.x + rect.width),
    };

    const chosen =
        side !== "auto"
            ? side
            : (Object.entries(space)
                  .sort((a, b) => b[1] - a[1])[0]?.[0] as SpotlightSide) ?? "bottom";

    let top:  number;
    let left: number;
    switch (chosen) {
        case "top":
            top  = rect.y - bh - BUBBLE_GAP;
            left = rect.x + rect.width / 2 - BUBBLE_WIDTH / 2;
            break;
        case "bottom":
            top  = rect.y + rect.height + BUBBLE_GAP;
            left = rect.x + rect.width / 2 - BUBBLE_WIDTH / 2;
            break;
        case "left":
            top  = rect.y + rect.height / 2 - bh / 2;
            left = rect.x - BUBBLE_WIDTH - BUBBLE_GAP;
            break;
        case "right":
        default:
            top  = rect.y + rect.height / 2 - bh / 2;
            left = rect.x + rect.width + BUBBLE_GAP;
    }

    // Clamp to viewport with 16px gutters.
    const gutter = 16;
    top  = Math.min(Math.max(gutter, top),  vh - bh - gutter);
    left = Math.min(Math.max(gutter, left), vw - BUBBLE_WIDTH - gutter);

    return { top, left };
}
