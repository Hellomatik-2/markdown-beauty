/**
 * AI Elements — PromptInput  ·  RÉPLICA EXACTA del iChat :5174/:5173
 * (mockup-widget/components/ai-elements/prompt-input.tsx).
 * Adaptaciones: cn → cx · @untitledui/icons → @hm/icons.
 */

import {
    createContext,
    type ButtonHTMLAttributes,
    type FC,
    type FormEvent,
    type HTMLAttributes,
    type ReactNode,
    type Ref,
    type TextareaHTMLAttributes,
    use,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { ArrowUp, Square } from "@hm/icons";
import { cx } from "@/utils/cx";
import { MatrixLoader } from "./matrix-loader";

export type PromptInputStatus = "idle" | "submitted" | "streaming" | "error";

interface PromptInputContextValue {
    value: string;
    setValue: (v: string) => void;
    submit: () => void;
    status: PromptInputStatus;
    allowEmptySubmit?: boolean;
}

const PromptInputContext = createContext<PromptInputContextValue | null>(null);

const usePromptInput = () => {
    const ctx = use(PromptInputContext);
    if (!ctx) throw new Error("PromptInput primitives must be used within <PromptInput>");
    return ctx;
};

export interface PromptInputProps extends Omit<HTMLAttributes<HTMLFormElement>, "onSubmit"> {
    onSubmit?: (text: string) => void;
    status?: PromptInputStatus;
    children: ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    allowEmptySubmit?: boolean;
    ref?: Ref<HTMLFormElement>;
}

export function PromptInput({ onSubmit, status = "idle", className, children, value: valueProp, onValueChange, allowEmptySubmit, ref, ...rest }: PromptInputProps) {
    const [internalValue, setInternalValue] = useState("");
    const isControlled = valueProp !== undefined;
    const value = isControlled ? valueProp : internalValue;

    const setValue = useCallback(
        (next: string) => {
            if (!isControlled) setInternalValue(next);
            onValueChange?.(next);
        },
        [isControlled, onValueChange],
    );

    const submit = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed && !allowEmptySubmit) return;
        onSubmit?.(trimmed);
        setValue("");
    }, [value, onSubmit, setValue, allowEmptySubmit]);

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        submit();
    };

    return (
        <PromptInputContext.Provider value={{ value, setValue, submit, status, allowEmptySubmit }}>
            <form
                ref={ref}
                onSubmit={handleSubmit}
                className={cx(
                    // EXACTO :5173/:5174 (panel.tsx)
                    "group/input relative flex flex-col gap-3 overflow-hidden rounded-2xl",
                    "border border-secondary bg-primary text-left",
                    "shadow-sm transition-[box-shadow,border-color] duration-150 ease-out",
                    "hover:shadow-md",
                    "focus-within:border-brand focus-within:shadow-lg",
                    className,
                )}
                {...rest}
            >
                {children}
            </form>
        </PromptInputContext.Provider>
    );
}

export interface PromptInputTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    ref?: Ref<HTMLTextAreaElement>;
}

export function PromptInputTextarea({ className, placeholder = "Pregunta lo que necesites…", ref, ...rest }: PromptInputTextareaProps) {
    const { value, setValue, submit, status } = usePromptInput();
    const localRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement);

    useEffect(() => {
        const el = localRef.current;
        if (!el) return;
        el.style.height = "auto";
        if (value) el.style.height = Math.min(el.scrollHeight, 180) + "px";
    }, [value]);

    const prevStatus = useRef(status);
    useEffect(() => {
        if ((prevStatus.current === "streaming" || prevStatus.current === "submitted") && status === "idle") {
            localRef.current?.focus();
        }
        prevStatus.current = status;
    }, [status]);

    return (
        <textarea
            ref={localRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                    return;
                }
                if (e.key === "Escape" && value) {
                    e.stopPropagation();
                    setValue("");
                }
            }}
            placeholder={placeholder}
            rows={1}
            maxLength={4000}
            disabled={status === "streaming" || status === "submitted"}
            className={cx(
                "block w-full resize-none rounded-t-2xl bg-transparent px-4 pt-4 pb-0 text-sm leading-5",
                "text-primary placeholder:text-placeholder",
                "outline-none disabled:opacity-60",
                "max-h-[180px] min-h-[68px]",
                className,
            )}
            {...rest}
        />
    );
}

interface PromptInputToolbarProps extends HTMLAttributes<HTMLDivElement> {
    ref?: Ref<HTMLDivElement>;
}

export function PromptInputToolbar({ className, children, ref, ...rest }: PromptInputToolbarProps) {
    return (
        <div ref={ref} className={cx("flex items-center justify-between gap-2 px-3 pb-1.5", className)} {...rest}>
            {children}
        </div>
    );
}

interface PromptInputToolsProps extends HTMLAttributes<HTMLDivElement> {
    ref?: Ref<HTMLDivElement>;
}

export function PromptInputTools({ className, children, ref, ...rest }: PromptInputToolsProps) {
    return (
        <div ref={ref} className={cx("flex items-center gap-1.5", className)} {...rest}>
            {children}
        </div>
    );
}

export interface PromptInputButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: FC<{ className?: string }>;
    ref?: Ref<HTMLButtonElement>;
}

export function PromptInputButton({ icon: Icon, className, children, ref, ...rest }: PromptInputButtonProps) {
    const iconOnly = !children;
    return (
        <button
            ref={ref}
            type="button"
            className={cx(
                "inline-flex items-center justify-center transition-colors duration-150 outline-focus-ring",
                "text-tertiary hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-tertiary",
                iconOnly ? "size-8 rounded-full" : "h-8 gap-1.5 rounded-md px-2 text-sm font-medium",
                className,
            )}
            {...rest}
        >
            {Icon && <Icon aria-hidden="true" className={iconOnly ? "size-5 shrink-0" : "size-4 shrink-0"} />}
            {children}
        </button>
    );
}

export interface PromptInputSubmitProps extends HTMLAttributes<HTMLButtonElement> {
    disabled?: boolean;
    onStop?: () => void;
    ref?: Ref<HTMLButtonElement>;
}

export function PromptInputSubmit({ className, disabled, onStop, ref, ...rest }: PromptInputSubmitProps) {
    const { value, status, submit, allowEmptySubmit } = usePromptInput();
    const isStreaming = status === "streaming" || status === "submitted";
    const canInterrupt = isStreaming && !!onStop;
    // Sin stop disponible, la espera se comunica DENTRO del botón: la flecha
    // se funde a un MatrixLoader (el mismo lenguaje que el "Pensando…").
    const showLoader = isStreaming && !onStop;
    const Icon = canInterrupt ? Square : ArrowUp;
    const canSend = isStreaming || value.trim().length > 0 || !!allowEmptySubmit;
    const effectivelyDisabled = disabled || !canSend || (isStreaming && !onStop);

    return (
        <button
            ref={ref}
            type="submit"
            aria-label={canInterrupt ? "Detener generación" : showLoader ? "Enviando mensaje" : "Enviar"}
            aria-busy={showLoader || undefined}
            disabled={effectivelyDisabled}
            onClick={(e) => {
                e.preventDefault();
                if (canInterrupt) {
                    onStop?.();
                } else if (!isStreaming) {
                    submit();
                }
            }}
            className={cx(
                "group/send inline-flex size-11 items-center justify-center rounded-full",
                "transition-opacity duration-200 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default",
                className,
            )}
            {...rest}
        >
            <span
                className={cx(
                    "flex size-8 items-center justify-center rounded-full transition-[background-color,opacity] duration-200",
                    canSend ? "bg-brand-solid text-white shadow-sm hover:opacity-90" : "bg-tertiary text-fg-quaternary opacity-60",
                )}
            >
                {showLoader ? (
                    <span key="loader" className="hm-fade-swap inline-flex" aria-hidden="true">
                        <MatrixLoader size={16} className="text-current" />
                    </span>
                ) : (
                    <span key="icon" className="hm-fade-swap inline-flex" aria-hidden="true">
                        <Icon className="size-4" strokeWidth={2.5} />
                    </span>
                )}
            </span>
        </button>
    );
}
