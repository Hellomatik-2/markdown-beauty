/**
 * Gap-filler: el kit referencia `helper-text` pero no lo incluye.
 * Equivale al HintText del consumer con el nombre que espera el kit.
 */
import type { ReactNode, Ref } from "react";
import type { TextProps as AriaTextProps } from "react-aria-components";
import { Text as AriaText } from "react-aria-components";
import { cx } from "@/utils/cx";

interface HelperTextProps extends AriaTextProps {
    /** Indicates that the helper text is an error message. */
    isInvalid?: boolean;
    ref?: Ref<HTMLElement>;
    size?: "sm" | "md";
    children: ReactNode;
}

export const HelperText = ({ isInvalid, className, size = "md", ...props }: HelperTextProps) => {
    return (
        <AriaText
            {...props}
            slot={isInvalid ? "errorMessage" : "description"}
            className={cx(
                "text-sm text-tertiary",
                size === "sm" && "text-xs",
                "in-data-[input-size=sm]:text-xs",
                isInvalid && "text-error-primary",
                "group-invalid:text-error-primary",
                className,
            )}
        />
    );
};

HelperText.displayName = "HelperText";
