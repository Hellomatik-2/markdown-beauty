"use client";

/**
 * AIOrb — Brand orb. Single source of truth.
 *
 * Port verbatim de `packages/shared/components/atomic/ai/AIOrb.tsx`
 * (rama feature/isaac2). Genera la paleta a partir de `--hm-primary`
 * usando las mismas relaciones cromáticas que la orbe de Clínica Planas:
 *   c1: primary shifted warm (+145° hue) — "bloom"
 *   c2: primary cool variant (+5°)       — "depth"
 *   c3: primary desaturated bridge (+80°)— "neutral"
 *   bg: primary tinted ivory             — fondo cálido
 *
 * Si `--hm-primary` no está definido en el documento, cae en la paleta
 * por defecto generada a partir de #7F56D9 (violeta marca Hellomatik).
 */

import React, { useEffect, useMemo, useState } from "react";

export type OrbState = "idle" | "hover" | "active";

export interface AIOrbProps {
    size?: number;
    state?: OrbState;
    className?: string;
}

// ── Color math ──────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
    h = ((h % 360) + 360) % 360;
    const sn = s / 100,
        ln = l / 100;
    const a = sn * Math.min(ln, 1 - ln);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(color * 255)
            .toString(16)
            .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function resolveHmPrimary(el: HTMLElement): string | null {
    const style = getComputedStyle(el);
    const raw = style.getPropertyValue("--hm-primary").trim();
    if (!raw) return null;
    const temp = document.createElement("div");
    temp.style.color = raw;
    temp.style.display = "none";
    document.body.appendChild(temp);
    const computed = getComputedStyle(temp).color;
    document.body.removeChild(temp);
    const m = computed.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    const toHex = (n: string) => parseInt(n).toString(16).padStart(2, "0");
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
}

interface OrbPalette {
    bg: string;
    c1: string;
    c2: string;
    c3: string;
}

function generatePalette(hex: string, isDark: boolean): OrbPalette {
    const [h] = hexToHsl(hex);

    if (isDark) {
        return {
            bg: hslToHex(h, 15, 12),
            c1: hslToHex((h + 145) % 360, 50, 68),
            c2: hslToHex((h + 5) % 360, 45, 62),
            c3: hslToHex((h + 80) % 360, 18, 70),
        };
    }

    return {
        bg: hslToHex(h, 20, 85),
        c1: hslToHex((h + 145) % 360, 40, 55),
        c2: hslToHex((h + 5) % 360, 38, 56),
        c3: hslToHex((h + 80) % 360, 10, 52),
    };
}

// ── CSS registration ────────────────────────────────────────────────

function registerAngle() {
    if (typeof CSS === "undefined" || !(CSS as { registerProperty?: unknown }).registerProperty) return;
    try {
        (CSS as { registerProperty: (o: object) => void }).registerProperty({
            name: "--hm-orb-angle",
            syntax: "<angle>",
            inherits: false,
            initialValue: "0deg",
        });
    } catch {
        /* */
    }
}

// ── Component ───────────────────────────────────────────────────────

const RENDER = 192;
// Default brand: Hellomatik violet (#7F56D9). Fallback used when
// `--hm-primary` is not defined on the document.
const FALLBACK_LIGHT = generatePalette("#7F56D9", false);
const FALLBACK_DARK = generatePalette("#7F56D9", true);

export const AIOrb: React.FC<AIOrbProps> = ({ size = 56, state = "idle", className }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [palette, setPalette] = useState<OrbPalette>(FALLBACK_LIGHT);

    useEffect(() => {
        registerAngle();
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const update = () => {
            const hex = resolveHmPrimary(el);
            const isDark = document.documentElement.classList.contains("dark");
            if (hex) setPalette(generatePalette(hex, isDark));
            else setPalette(isDark ? FALLBACK_DARK : FALLBACK_LIGHT);
        };

        update();
        const observer = new MutationObserver(update);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
        return () => observer.disconnect();
    }, []);

    const scale = size / RENDER;

    const stateOpacity = state === "active" ? 1 : state === "hover" ? 0.9 : 0.75;
    const stateBrightness = state === "active" ? 1.15 : state === "hover" ? 1.08 : 1;
    const stateHighlight = state === "active" ? 0.35 : state === "hover" ? 0.28 : 0.18;

    const orbStyle = useMemo(
        () =>
            ({
                width: RENDER,
                height: RENDER,
                "--orb-bg": palette.bg,
                "--orb-c1": palette.c1,
                "--orb-c2": palette.c2,
                "--orb-c3": palette.c3,
                "--orb-state-opacity": stateOpacity,
                "--orb-state-brightness": stateBrightness,
                "--orb-state-highlight": stateHighlight,
            }) as React.CSSProperties,
        [palette, stateOpacity, stateBrightness, stateHighlight],
    );

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", position: "relative", pointerEvents: "none" }}
            aria-hidden="true"
        >
            <div style={{ width: size, height: size, overflow: "hidden", borderRadius: "50%", position: "relative" }}>
                <div
                    style={{
                        position: "absolute",
                        width: RENDER,
                        height: RENDER,
                        top: "50%",
                        left: "50%",
                        transform: `translate(-50%, -50%) scale(${scale})`,
                    }}
                >
                    <div className={`hm-orb${state === "active" ? " hm-orb--active" : ""}`} style={orbStyle} />
                </div>
            </div>

            <style>{`
        @property --hm-orb-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }

        .hm-orb {
          display: grid;
          grid-template-areas: "stack";
          overflow: hidden;
          border-radius: 50%;
          position: relative;
          background-color: var(--orb-bg);
          box-shadow:
            inset 0 0 20px rgba(248,216,168,0.12),
            inset 0 0 7px rgba(255,255,255,0.06),
            inset 0 1px 0 rgba(255,255,255,0.15);
        }

        .hm-orb::before,
        .hm-orb::after {
          content: "";
          display: block;
          grid-area: stack;
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }

        .hm-orb::before {
          background:
            radial-gradient(ellipse 60% 50% at 50% 60%, var(--orb-c1), transparent),
            radial-gradient(ellipse 45% 40% at 70% 30%, var(--orb-c3), transparent),
            radial-gradient(ellipse 40% 35% at 25% 70%, var(--orb-c2), transparent),
            conic-gradient(
              from var(--hm-orb-angle) at 50% 50%,
              var(--orb-c3) 0%,
              transparent 15%,
              var(--orb-c1) 33%,
              transparent 48%,
              var(--orb-c2) 66%,
              transparent 81%,
              var(--orb-c3) 100%
            );
          filter: blur(3px) contrast(1.4) brightness(var(--orb-state-brightness, 1));
          opacity: var(--orb-state-opacity, 0.75);
          animation:
            hm-orb-drift 8s linear infinite,
            hm-orb-breathe 3s ease-in-out infinite;
          transition: opacity 0.6s ease, filter 0.6s ease;
        }

        .hm-orb::after {
          background: radial-gradient(
            ellipse 70% 50% at 35% 25%,
            rgba(255,255,255, var(--orb-state-highlight, 0.18)) 0%,
            rgba(255,255,255, calc(var(--orb-state-highlight, 0.18) * 0.25)) 40%,
            transparent 70%
          );
          pointer-events: none;
          transition: opacity 0.4s ease;
        }

        @keyframes hm-orb-drift {
          to { --hm-orb-angle: 360deg; }
        }

        @keyframes hm-orb-drift-fast {
          to { --hm-orb-angle: 360deg; }
        }

        @keyframes hm-orb-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }

        @keyframes hm-orb-breathe-fast {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }

        .hm-orb--active::before {
          animation:
            hm-orb-drift-fast 3s linear infinite,
            hm-orb-breathe-fast 1.2s ease-in-out infinite;
          filter: blur(3px) contrast(1.6) brightness(1.15) saturate(1.3);
        }

        @media (prefers-reduced-motion: reduce) {
          .hm-orb::before,
          .hm-orb::after {
            animation: none;
          }
        }
      `}</style>
        </div>
    );
};

export default AIOrb;
