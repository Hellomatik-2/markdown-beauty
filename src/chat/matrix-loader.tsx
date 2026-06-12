/**
 * MatrixLoader — animated 4×4 perimeter comet, used as the "thinking" indicator.
 * RÉPLICA EXACTA del widget :5174 (components/chat/matrix-loader.tsx);
 * única adaptación: cn → cx (mismo clsx+twMerge del kit vendoreado).
 */

import { useEffect, useRef } from "react";
import { cx } from "@/utils/cx";

const GRID = 4;
const CELL = 4;
const GAP = 2;
const RX = 1;
const VIEW = GRID * CELL + (GRID - 1) * GAP; // 22

const TRAIL = [1, 0.5, 0.22];
const TRACK_OPACITY = 0.14;
const STATIC_OPACITY = 0.45;

const xy = (i: number) => i * (CELL + GAP);

const ALL_CELLS = Array.from({ length: GRID * GRID }, (_, k) => ({
    r: Math.floor(k / GRID),
    c: k % GRID,
}));

const PERIMETER: Array<{ r: number; c: number }> = [
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 0, c: 2 },
    { r: 0, c: 3 },
    { r: 1, c: 3 },
    { r: 2, c: 3 },
    { r: 3, c: 3 },
    { r: 3, c: 2 },
    { r: 3, c: 1 },
    { r: 3, c: 0 },
    { r: 2, c: 0 },
    { r: 1, c: 0 },
];

export interface MatrixLoaderProps {
    /** Side length in px (square). Default 22. */
    size?: number;
    /** Frames per second for the comet. Default 16. */
    fps?: number;
    className?: string;
}

export function MatrixLoader({ size = VIEW, fps = 16, className }: MatrixLoaderProps) {
    const cellsRef = useRef<Array<SVGRectElement | null>>([]);

    useEffect(() => {
        const cells = cellsRef.current;
        const n = PERIMETER.length;
        const frameMs = 1000 / fps;
        const mq = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : undefined;

        let raf = 0;
        let head = 0;
        let prev = 0;
        let acc = 0;

        const setStatic = () => {
            cells.forEach((el) => el?.setAttribute("opacity", String(STATIC_OPACITY)));
        };

        const applyComet = () => {
            for (let i = 0; i < n; i++) {
                const dist = (head - i + n) % n;
                const op = dist < TRAIL.length ? TRAIL[dist] : 0;
                cells[i]?.setAttribute("opacity", String(op));
            }
        };

        const tick = (now: number) => {
            if (prev === 0) prev = now;
            acc += now - prev;
            prev = now;
            if (acc >= frameMs) {
                const steps = Math.floor(acc / frameMs);
                head = (head + steps) % n;
                acc -= steps * frameMs;
                applyComet();
            }
            raf = requestAnimationFrame(tick);
        };

        const start = () => {
            cancelAnimationFrame(raf);
            raf = 0;
            if (mq?.matches) {
                setStatic();
                return;
            }
            head = 0;
            prev = 0;
            acc = 0;
            applyComet();
            raf = requestAnimationFrame(tick);
        };

        start();
        mq?.addEventListener?.("change", start);
        return () => {
            cancelAnimationFrame(raf);
            mq?.removeEventListener?.("change", start);
        };
    }, [fps]);

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className={cx("block shrink-0 text-[var(--chat-primary,currentColor)]", className)}
            aria-hidden="true"
            focusable="false"
        >
            <g fill="currentColor" opacity={TRACK_OPACITY}>
                {ALL_CELLS.map(({ r, c }) => (
                    <rect key={`t-${r}-${c}`} x={xy(c)} y={xy(r)} width={CELL} height={CELL} rx={RX} />
                ))}
            </g>
            <g fill="currentColor">
                {PERIMETER.map(({ r, c }, i) => (
                    <rect
                        key={`p-${r}-${c}`}
                        ref={(el) => {
                            cellsRef.current[i] = el;
                        }}
                        x={xy(c)}
                        y={xy(r)}
                        width={CELL}
                        height={CELL}
                        rx={RX}
                        opacity={0}
                    />
                ))}
            </g>
        </svg>
    );
}
