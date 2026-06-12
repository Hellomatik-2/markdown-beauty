"use client";

/**
 * Fluid (animated) variant of NavList.
 *
 * The default `NavList` uses native <details>/<summary> which doesn't animate
 * the expand/collapse. This version mirrors the same visual contract but
 * controls open state with React + Framer Motion so the children expand
 * smoothly using a height tween.
 */

import { useState } from "react";
import { ChevronDown, LinkExternal01 } from "@hm/icons";
import { AnimatePresence, m } from "motion/react";
import { Link as AriaLink } from "react-aria-components";
import { Badge } from "@/components/base/badges/badges";
import type { NavItemDividerType, NavItemType } from "../config";
import { cx, sortCx } from "@/utils/cx";

const styles = sortCx({
    root: "group relative flex min-w-0 max-h-9 w-full cursor-pointer items-center rounded-md bg-primary outline-focus-ring transition duration-100 ease-linear select-none hover:bg-primary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2",
    rootSelected: "bg-secondary hover:bg-secondary_hover",
});

const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.7 } as const;

interface NavListFluidProps {
    /** URL of the currently active item. */
    activeUrl?: string;
    /** Additional CSS classes to apply to the list. */
    className?: string;
    /** List of items to display. */
    items: (NavItemType | NavItemDividerType)[];
    /** Labels of items that should start expanded (matches `item.label`). */
    defaultOpen?: string[];
}

const renderBadge = (badge: NavItemType["badge"]) => {
    if (badge === undefined || badge === null) return null;
    if (typeof badge === "string" || typeof badge === "number") {
        return (
            <Badge className="ml-3" color="gray" type="pill-color" size="sm">
                {badge}
            </Badge>
        );
    }
    return badge;
};

const Icon = ({ icon: IconCmp, current }: { icon?: NavItemType["icon"]; current?: boolean }) =>
    IconCmp ? (
        <IconCmp
            aria-hidden="true"
            className={cx(
                "mr-2 size-4 shrink-0 text-fg-quaternary transition-inherit-all group-hover/item:text-fg-quaternary_hover",
                current && "text-fg-quaternary_hover",
            )}
        />
    ) : null;

const Label = ({ children, current }: { children: React.ReactNode; current?: boolean }) => (
    <span
        className={cx(
            "min-w-0 flex-1 truncate text-sm font-semibold text-secondary transition-inherit-all group-hover/item:text-secondary_hover",
            current && "text-secondary_hover",
        )}
    >
        {children}
    </span>
);

export const NavListFluid = ({ activeUrl, items, className, defaultOpen = [] }: NavListFluidProps) => {
    const [openSet, setOpenSet] = useState<Set<string>>(() => {
        const initial = new Set<string>(defaultOpen);
        // auto-open the parent that contains the active item
        for (const item of items) {
            if (item.divider) continue;
            if (item.items?.some((sub) => sub.href === activeUrl)) initial.add(item.label);
        }
        return initial;
    });

    const toggle = (label: string) =>
        setOpenSet((prev) => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label);
            else next.add(label);
            return next;
        });

    return (
        <ul className={cx("flex flex-col px-4 pt-5", className)}>
            {items.map((item, index) => {
                if (item.divider) {
                    return (
                        <li key={`divider-${index}`} className="w-full px-0.5 py-2">
                            <hr className="h-px w-full border-none bg-border-secondary" />
                        </li>
                    );
                }

                const hasChildren = !!item.items?.length;
                const isOpen = openSet.has(item.label);
                const isExternal = item.href?.startsWith("http");

                if (hasChildren) {
                    return (
                        <li key={item.label} className="py-0.5">
                            {/* Trigger row — same visuals as NavItemBase collapsible */}
                            <button
                                type="button"
                                onClick={() => toggle(item.label)}
                                aria-expanded={isOpen}
                                className={cx("p-2 text-left", styles.root, "group/item")}
                            >
                                <Icon icon={item.icon} />
                                <Label>{item.label}</Label>
                                {renderBadge(item.badge)}
                                <m.span
                                    aria-hidden="true"
                                    animate={{ rotate: isOpen ? 180 : 0 }}
                                    transition={SPRING}
                                    className="ml-3 inline-flex"
                                >
                                    <ChevronDown className="size-4 shrink-0 stroke-[2.5px] text-fg-quaternary" />
                                </m.span>
                            </button>

                            {/* Animated children */}
                            <AnimatePresence initial={false}>
                                {isOpen && (
                                    <m.div
                                        key="children"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={SPRING}
                                        className="overflow-hidden"
                                    >
                                        <ul className="pb-1 pt-0.5">
                                            {item.items!.map((child) => {
                                                const childExternal = child.href?.startsWith("http");
                                                const isCurrent = activeUrl === child.href;
                                                return (
                                                    <li key={child.label} className="py-0.25">
                                                        <AriaLink
                                                            href={child.href}
                                                            target={childExternal ? "_blank" : "_self"}
                                                            rel="noopener noreferrer"
                                                            aria-current={isCurrent ? "page" : undefined}
                                                            className={cx(
                                                                "py-2 pr-3 pl-8",
                                                                styles.root,
                                                                isCurrent && styles.rootSelected,
                                                            )}
                                                        >
                                                            <Label current={isCurrent}>{child.label}</Label>
                                                            {childExternal && (
                                                                <LinkExternal01 className="size-4 stroke-[2.5px] text-fg-quaternary" aria-hidden="true" />
                                                            )}
                                                            {renderBadge(child.badge)}
                                                        </AriaLink>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </m.div>
                                )}
                            </AnimatePresence>
                        </li>
                    );
                }

                // Leaf link
                const isCurrent = activeUrl === item.href;
                return (
                    <li key={item.label} className="py-0.5">
                        <AriaLink
                            href={item.href!}
                            target={isExternal ? "_blank" : "_self"}
                            rel="noopener noreferrer"
                            aria-current={isCurrent ? "page" : undefined}
                            className={cx("group/item p-2", styles.root, isCurrent && styles.rootSelected)}
                        >
                            <Icon icon={item.icon} current={isCurrent} />
                            <Label current={isCurrent}>{item.label}</Label>
                            {isExternal && <LinkExternal01 className="size-4 stroke-[2.5px] text-fg-quaternary" aria-hidden="true" />}
                            {renderBadge(item.badge)}
                        </AriaLink>
                    </li>
                );
            })}
        </ul>
    );
};
