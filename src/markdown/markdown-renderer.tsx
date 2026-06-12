import { Children, cloneElement, isValidElement, useMemo, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkEmoji from "remark-emoji";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { cx } from "@/utils/cx";
import { Callout, type CalloutKind } from "./callout";
import { CodeBlock } from "./code-block";
import { MarkdownTable } from "./markdown-table";
import { MermaidDiagram } from "./mermaid-diagram";
import { createSlugger, textOf } from "./text-utils";

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

const HEADING_CLASS: Record<number, string> = {
    1: "mt-12 mb-4 text-display-sm text-primary first:mt-0",
    2: "mt-10 mb-3 text-display-xs text-primary first:mt-0",
    3: "mt-8 mb-2.5 text-xl text-primary first:mt-0",
    4: "mt-6 mb-2 text-lg font-semibold text-primary first:mt-0",
    5: "mt-5 mb-1.5 text-md font-semibold text-primary",
    6: "mt-5 mb-1.5 text-sm font-semibold text-secondary",
};

export interface MarkdownRendererProps {
    content: string;
    /** Ruta absoluta del documento — para resolver imágenes y enlaces relativos. */
    docPath?: string;
    /** Abre una URL externa en el navegador del sistema. */
    onOpenExternal: (url: string) => void;
    /** Navega a otro documento markdown relativo. */
    onOpenDoc: (absolutePath: string) => void;
    /** Convierte una ruta absoluta del disco en una URL renderizable (asset:). */
    toAssetUrl: (absolutePath: string) => string;
    resolveRelative: (relative: string) => string;
}

/** Extrae el bloque de código de un `pre` (elemento `code` hijo). */
function extractCode(children: ReactNode): { code: string; lang?: string } | null {
    const el = Children.toArray(children).find((c) => isValidElement(c)) as ReactElement<{ className?: string; children?: ReactNode }> | undefined;
    if (!el) return null;
    const lang = /language-([\w+-]+)/.exec(el.props.className ?? "")?.[1];
    return { code: textOf(el.props.children), lang };
}

/** Detecta `> [!NOTE]` y devuelve tipo + children sin el marcador. */
function parseAlert(children: ReactNode): { kind: CalloutKind; body: ReactNode[] } | null {
    const items = Children.toArray(children);
    const firstIdx = items.findIndex((c) => isValidElement(c));
    if (firstIdx === -1) return null;

    const firstP = items[firstIdx] as ReactElement<{ children?: ReactNode }>;
    const kids = Children.toArray(firstP.props.children);
    const head = kids[0];
    if (typeof head !== "string") return null;

    const match = ALERT_RE.exec(head);
    if (!match) return null;

    const kind = match[1].toLowerCase() as CalloutKind;
    const stripped = head.replace(ALERT_RE, "").replace(/^\n/, "");
    const newKids: ReactNode[] = stripped ? [stripped, ...kids.slice(1)] : kids.slice(1);

    const body = items
        .map((item, i) => {
            if (i !== firstIdx) return item;
            if (newKids.length === 0) return null;
            return cloneElement(firstP, { key: "alert-first" }, ...newKids);
        })
        .filter((item) => item != null && item !== "\n");

    return { kind, body };
}

export function MarkdownRenderer({ content, docPath, onOpenExternal, onOpenDoc, toAssetUrl, resolveRelative }: MarkdownRendererProps) {
    return useMemo(() => {
        const slug = createSlugger();

        const heading = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
            const Tag = `h${level}` as const;
            return ({ children }: { children?: ReactNode }) => {
                const id = slug(textOf(children));
                return (
                    <Tag id={id} className={cx("group relative scroll-mt-24", HEADING_CLASS[level])}>
                        <a
                            href={`#${id}`}
                            aria-label="Enlace a esta sección"
                            className="no-print absolute top-1/2 -left-6 -translate-y-1/2 font-body text-md font-medium text-quaternary opacity-0 transition-opacity duration-100 group-hover:opacity-100 hover:text-tertiary"
                        >
                            #
                        </a>
                        {children}
                    </Tag>
                );
            };
        };

        const components: Components = {
            h1: heading(1),
            h2: heading(2),
            h3: heading(3),
            h4: heading(4),
            h5: heading(5),
            h6: heading(6),

            p: ({ children }) => <p className="my-4 text-md leading-[1.75] text-secondary first:mt-0 last:mb-0">{children}</p>,

            a: ({ href, children, title }) => {
                const onClick = (e: React.MouseEvent) => {
                    if (!href || href.startsWith("#")) return;
                    e.preventDefault();
                    if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) {
                        onOpenExternal(href);
                    } else if (/\.(md|markdown|mdown|mkd|mdx)(#.*)?$/i.test(href)) {
                        onOpenDoc(resolveRelative(decodeURI(href.replace(/#.*$/, ""))));
                    } else {
                        onOpenExternal("file://" + resolveRelative(decodeURI(href)));
                    }
                };
                return (
                    <a
                        href={href}
                        title={title}
                        onClick={onClick}
                        className="font-medium text-primary underline decoration-border-primary underline-offset-3 transition hover:decoration-fg-primary"
                    >
                        {children}
                    </a>
                );
            },

            ul: ({ children, className }) => (
                <ul className={cx("my-4 list-disc space-y-1 pl-6 text-md leading-[1.75] text-secondary marker:text-quaternary", "[&_ul]:my-1 [&_ol]:my-1", className?.includes("contains-task-list") && "list-none pl-1")}>
                    {children}
                </ul>
            ),
            ol: ({ children, start }) => (
                <ol start={start} className="my-4 list-decimal space-y-1 pl-6 text-md leading-[1.75] text-secondary marker:text-quaternary [&_ol]:my-1 [&_ul]:my-1">
                    {children}
                </ol>
            ),
            li: ({ children, className }) => {
                if (className?.includes("task-list-item")) {
                    return <li className="flex items-start gap-2.5 [&>p]:my-0">{children}</li>;
                }
                return <li className="[&>p]:my-1">{children}</li>;
            },

            input: ({ checked, type }) => {
                if (type !== "checkbox") return null;
                return <Checkbox size="sm" isSelected={!!checked} isDisabled className="mt-[5px] opacity-90" />;
            },

            blockquote: ({ children }) => {
                const alert = parseAlert(children);
                if (alert) return <Callout kind={alert.kind}>{alert.body}</Callout>;
                return (
                    <blockquote className="my-5 border-l-[3px] border-fg-primary pl-4 [&>p]:text-md [&>p]:font-medium [&>p]:text-primary">
                        {children}
                    </blockquote>
                );
            },

            pre: ({ children }) => {
                const extracted = extractCode(children);
                if (!extracted) return <pre>{children}</pre>;
                if (extracted.lang === "mermaid") return <MermaidDiagram code={extracted.code} />;
                return <CodeBlock code={extracted.code} lang={extracted.lang} />;
            },

            code: ({ children, className }) => (
                <code className={cx("rounded-md bg-secondary px-[0.35em] py-[0.1em] font-mono text-[0.85em] font-medium text-utility-pink-700", className)}>
                    {children}
                </code>
            ),

            table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,

            img: ({ src, alt, title }) => {
                if (typeof src !== "string" || !src) return null;
                const url = /^(https?:|data:|asset:)/i.test(src) ? src : toAssetUrl(resolveRelative(decodeURI(src)));
                const caption = title || alt;
                return (
                    <figure className="my-6">
                        <img src={url} alt={alt ?? ""} loading="lazy" className="mx-auto max-w-full rounded-xl ring-1 ring-secondary" />
                        {caption && <figcaption className="mt-2.5 text-center text-sm text-quaternary">{caption}</figcaption>}
                    </figure>
                );
            },

            hr: () => <hr className="my-10 border-t border-secondary" />,

            strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
            del: ({ children }) => <del className="text-quaternary line-through">{children}</del>,

            section: ({ children, ...props }) => {
                const isFootnotes = "data-footnotes" in props;
                return (
                    <section
                        {...props}
                        className={cx(isFootnotes && "mt-14 border-t border-secondary pt-5 [&_p]:my-1 [&_p]:text-sm [&_li]:text-sm [&_h2]:sr-only")}
                    >
                        {children}
                    </section>
                );
            },
        };

        return (
            <ReactMarkdown
                remarkPlugins={[remarkFrontmatter, remarkGfm, remarkMath, [remarkEmoji, { emoticon: false }]]}
                rehypePlugins={[rehypeRaw, rehypeKatex]}
                components={components}
            >
                {content}
            </ReactMarkdown>
        );
    }, [content, docPath]);
}
