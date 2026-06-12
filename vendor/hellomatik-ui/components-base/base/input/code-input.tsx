"use client";

import type { ComponentPropsWithRef } from "react";
import { createContext, use, useId } from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { HelperText } from "@/components/base/input/helper-text";
import { Label as LabelBase } from "@/components/base/input/label";
import { cx } from "@/utils/cx";

type CodeInputSize = "xxxs" | "xxs" | "xs" | "sm" | "md" | "lg";

type CodeInputContextType = {
    size: CodeInputSize;
    disabled: boolean;
    id: string;
    invalid: boolean;
};

const CodeInputContext = createContext<CodeInputContextType>({
    size: "sm",
    id: "",
    disabled: false,
    invalid: false,
});

export const useCodeInputContext = () => {
    const context = use(CodeInputContext);

    if (!context) {
        throw new Error("The 'useCodeInputContext' hook must be used within a '<CodeInput />'");
    }

    return context;
};

interface RootProps extends ComponentPropsWithRef<"div"> {
    size?: CodeInputSize;
    disabled?: boolean;
    invalid?: boolean;
}

const Root = ({ className, size = "md", disabled = false, invalid = false, ...props }: RootProps) => {
    const id = useId();

    return (
        <CodeInputContext.Provider value={{ size, disabled, id, invalid }}>
            <div role="group" className={cx("flex h-max flex-col gap-1.5", className)} {...props} />
        </CodeInputContext.Provider>
    );
};
Root.displayName = "Root";

const styles = {
    xxxs: { group: "gap-1.5 h-9", slot: "size-9 px-3 py-2 text-sm rounded-lg font-medium text-placeholder/50", caret: "text-sm font-medium" },
    xxs: { group: "gap-2 h-10", slot: "size-10 px-3 py-2 text-md rounded-lg font-medium text-placeholder/50", caret: "text-md font-medium" },
    xs: { group: "gap-2 h-11", slot: "size-11 px-3.5 py-2.5 text-md rounded-lg font-medium text-placeholder/50", caret: "text-md font-medium" },
    sm: { group: "gap-2 h-16.5", slot: "size-16 px-2 py-0.5 text-display-lg font-medium", caret: "text-display-lg font-medium" },
    md: { group: "gap-3 h-20.5", slot: "size-20 px-2 py-2.5 text-display-lg font-medium", caret: "text-display-lg font-medium" },
    lg: { group: "gap-3 h-24.5", slot: "size-24 px-2 py-3 text-display-xl font-medium", caret: "text-display-xl font-medium" },
};

type GroupProps = ComponentPropsWithRef<typeof OTPInput> & {
    width?: number;
    inputClassName?: string;
};

const Group = ({ inputClassName, containerClassName, width, maxLength = 4, ...props }: GroupProps) => {
    const { id, size, disabled } = useCodeInputContext();

    return (
        <OTPInput
            {...props}
            size={width}
            maxLength={maxLength}
            disabled={disabled}
            id={"code-input-" + id}
            aria-label="Enter your pin"
            aria-labelledby={"code-input-label-" + id}
            aria-describedby={"code-input-description-" + id}
            containerClassName={cx("flex flex-row", styles[size].group, containerClassName)}
            className={cx("disabled:cursor-not-allowed", inputClassName)}
        />
    );
};
Group.displayName = "Group";

const Slot = ({ index, className, ...props }: ComponentPropsWithRef<"div"> & { index: number }) => {
    const { size, disabled, invalid } = useCodeInputContext();
    const { slots, isFocused } = use(OTPInputContext);

    const slot = slots[index];

    return (
        <div
            {...props}
            aria-invalid={invalid}
            aria-label={"Enter digit " + (index + 1) + " of " + slots.length}
            className={cx(
                "relative flex items-center justify-center rounded-xl bg-primary text-center text-placeholder/40 shadow-xs ring-1 ring-primary transition-[box-shadow,background-color] duration-100 ease-linear ring-inset",
                styles[size].slot,
                isFocused && slot?.isActive && "ring-2 ring-brand outline-2 outline-offset-2 outline-brand",
                slot?.char && "text-brand-tertiary_alt ring-2 ring-brand",
                disabled && "opacity-50",
                invalid && "text-error-primary ring-error_subtle",
                className,
            )}
        >
            {slot?.char ? slot.char : slot?.hasFakeCaret ? <FakeCaret size={size} /> : 0}
        </div>
    );
};
Slot.displayName = "Slot";

const FakeCaret = ({ size = "md" }: { size?: CodeInputSize }) => {
    return <div className={cx("pointer-events-none h-[1em] w-0.5 animate-caret-blink bg-fg-brand-primary", styles[size].caret)} />;
};

const Separator = (props: ComponentPropsWithRef<"div">) => {
    return (
        <div role="separator" {...props} className={cx("text-center text-display-xl font-medium text-utility-neutral-300", props.className)}>
            -
        </div>
    );
};
Separator.displayName = "Separator";

const Label = (props: ComponentPropsWithRef<typeof LabelBase>) => {
    const { id } = useCodeInputContext();

    return <LabelBase {...props} htmlFor={"code-input-" + id} id={"code-input-label-" + id} />;
};
Label.displayName = "Label";

const Description = (props: ComponentPropsWithRef<typeof HelperText>) => {
    const { id, size } = useCodeInputContext();

    return <HelperText {...props} id={"code-input-description-" + id} role="description" className={cx(size === "xxxs" && "text-xs")} />;
};
Description.displayName = "Description";

const CodeInput = Root as typeof Root & {
    Slot: typeof Slot;
    Label: typeof Label;
    Group: typeof Group;
    Separator: typeof Separator;
    Description: typeof Description;
};
CodeInput.Slot = Slot;
CodeInput.Label = Label;
CodeInput.Group = Group;
CodeInput.Separator = Separator;
CodeInput.Description = Description;

export { CodeInput };
