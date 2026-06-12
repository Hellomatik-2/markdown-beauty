import { Children, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { Table, TableCard } from "@/components/application/table/table";
import { cx } from "@/utils/cx";
import { textOf } from "./text-utils";

type Align = "left" | "center" | "right";

interface CellData {
    content: ReactNode;
    align: Align;
}

/** Elementos hijos cuyo tag HTML coincide (react-markdown crea los tags
 *  no mapeados como elementos con `type` string). */
function elementsOf(children: ReactNode, ...types: string[]): ReactElement<{ children?: ReactNode }>[] {
    return Children.toArray(children).filter(
        (child): child is ReactElement<{ children?: ReactNode }> => isValidElement(child) && typeof child.type === "string" && types.includes(child.type),
    );
}

function cellAlign(el: ReactElement): Align {
    const props = el.props as { align?: string; style?: CSSProperties };
    const raw = props.style?.textAlign ?? props.align;
    return raw === "center" || raw === "right" ? raw : "left";
}

function rowCells(row: ReactElement<{ children?: ReactNode }>): CellData[] {
    return elementsOf(row.props.children, "th", "td").map((cell) => ({
        content: cell.props.children,
        align: cellAlign(cell),
    }));
}

const ALIGN_CLASS: Record<Align, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
};

/**
 * Tabla markdown → Table de Hellomatik UI (react-aria), envuelta en
 * TableCard para el chrome de card con ring + radius del sistema.
 */
export function MarkdownTable({ children }: { children?: ReactNode }) {
    const head = elementsOf(children, "thead")[0];
    const bodies = elementsOf(children, "tbody");

    const headerRow = head ? elementsOf(head.props.children, "tr")[0] : undefined;
    const headerCells = headerRow ? rowCells(headerRow) : [];
    const bodyRows = bodies.flatMap((body) => elementsOf(body.props.children, "tr")).map(rowCells);

    if (headerCells.length === 0) return null;

    const label = textOf(headerCells[0]?.content) || "Tabla";

    return (
        <TableCard.Root size="sm" className="my-6 shadow-xs">
            <Table aria-label={label} size="sm">
                <Table.Header className="h-auto">
                    {headerCells.map((cell, i) => (
                        <Table.Head key={i} id={`col-${i}`} isRowHeader={i === 0} className={cx("py-2.5", ALIGN_CLASS[cell.align])}>
                            <span className="text-xs font-semibold whitespace-nowrap text-quaternary">{cell.content}</span>
                        </Table.Head>
                    ))}
                </Table.Header>
                <Table.Body>
                    {bodyRows.map((cells, r) => (
                        <Table.Row key={r} id={`row-${r}`} className="h-auto">
                            {headerCells.map((headerCell, c) => (
                                <Table.Cell key={c} className={cx("px-5 py-3 align-top whitespace-normal", ALIGN_CLASS[cells[c]?.align ?? headerCell.align])}>
                                    {cells[c]?.content ?? ""}
                                </Table.Cell>
                            ))}
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        </TableCard.Root>
    );
}
