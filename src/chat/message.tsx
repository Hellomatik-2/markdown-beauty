/**
 * AI Elements — Message  ·  RÉPLICA VISUAL EXACTA del iChat :5174/:5173
 * (mockup-widget/components/chat/message.tsx). Única adaptación: cn → cx.
 */
import { type HTMLAttributes, type ReactNode, type Ref } from "react";
import { cx } from "@/utils/cx";

export type MessageRole = "user" | "assistant" | "system";

export interface MessageProps extends HTMLAttributes<HTMLDivElement> {
    from: MessageRole;
    children: ReactNode;
    ref?: Ref<HTMLDivElement>;
}

export function Message({ from, className, children, ref, ...rest }: MessageProps) {
    const isUser = from === "user";
    const consecutiveCollapse = isUser ? "[[data-role=user]+&]:-mt-3.5" : "[[data-role=assistant]+&]:-mt-3.5";
    return (
        <div
            ref={ref}
            data-role={from}
            className={cx("group/msg flex w-full", isUser ? "justify-end" : "flex-col gap-1.5", consecutiveCollapse, className)}
            {...rest}
        >
            {isUser ? <div className="flex max-w-[min(85%,42rem)] min-w-0 flex-col items-end gap-1.5">{children}</div> : children}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageContent — burbuja para user, prosa plana para assistant
// ─────────────────────────────────────────────────────────────────────────────

export interface MessageContentProps extends HTMLAttributes<HTMLDivElement> {
    /** "filled" = burbuja. "flat" = sin fondo (default assistant). */
    variant?: "filled" | "flat";
    children: ReactNode;
    ref?: Ref<HTMLDivElement>;
}

export function MessageContent({ variant, className, children, ref, ...rest }: MessageContentProps) {
    return (
        <div
            ref={ref}
            className={cx(
                "min-w-0 max-w-full text-sm break-words [overflow-wrap:anywhere] text-primary",
                variant === "filled" ? "rounded-lg bg-secondary px-3 py-2" : "py-0.5",
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    );
}
