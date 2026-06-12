"use client";

import { forwardRef } from "react";
import { SearchLg, XClose } from "@hm/icons";
import { Input, type InputProps } from "./input";
import { cx } from "@/utils/cx";

type SearchInputBaseProps = Omit<InputProps, "icon" | "onChange" | "value" | "type">;

export interface SearchInputProps extends SearchInputBaseProps {
    value: string;
    onChange: (value: string) => void;
    onClear?: () => void;
    /** Predefined widths to standardize. `sm` = w-56 (table-trailing canonical). */
    width?: "sm" | "md" | "lg" | "fill";
    placeholder?: string;
}

const WIDTH_CLASS = {
    sm: "w-56",
    md: "w-72",
    lg: "w-full max-w-xl",
    fill: "w-full",
} as const;

/**
 * Canonical search input: SearchLg leading icon, optional clear "x" button
 * when value is non-empty, standardized widths.
 *
 * `onChange` always receives a string. `onClear` defaults to `onChange("")`.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
    function SearchInput(
        {
            value,
            onChange,
            onClear,
            width = "sm",
            placeholder = "Buscar…",
            size = "sm",
            wrapperClassName,
            inputClassName,
            className,
            ...rest
        },
        ref,
    ) {
        const hasValue = value.length > 0;
        const handleClear = () => (onClear ?? (() => onChange("")))();

        return (
            <div className={cx("relative", WIDTH_CLASS[width], className as string | undefined)}>
                <Input
                    ref={ref}
                    size={size}
                    icon={SearchLg}
                    placeholder={placeholder}
                    value={value}
                    onChange={(v) => onChange(typeof v === "string" ? v : "")}
                    wrapperClassName={wrapperClassName}
                    inputClassName={cx(hasValue && "pr-9", inputClassName)}
                    {...rest}
                />
                {hasValue && (
                    <button
                        type="button"
                        aria-label="Clear search"
                        onClick={handleClear}
                        className="absolute top-1/2 right-3 z-10 flex -translate-y-1/2 cursor-pointer items-center justify-center text-fg-quaternary transition duration-100 ease-linear hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover focus:outline-hidden"
                    >
                        <XClose className="size-4 stroke-[2.25px]" />
                    </button>
                )}
            </div>
        );
    },
);
