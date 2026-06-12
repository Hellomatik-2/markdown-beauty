import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/mantine/style.css";

export interface EditorHandle {
    /** Serializa el documento del editor a Markdown (GFM). */
    getMarkdown: () => Promise<string>;
}

interface EditorViewProps {
    /** Cuerpo markdown SIN frontmatter (se preserva fuera del editor). */
    markdown: string;
    dark: boolean;
    onDirty: () => void;
}

/** Edición WYSIWYG sobre el documento renderizado (BlockNote/ProseMirror):
 *  cada bloque tiene su asidero a la izquierda (mover/añadir) y "/" abre
 *  el menú con todos los componentes. Al guardar se serializa a Markdown
 *  real — la vista bonita y el archivo siempre cuentan la misma historia. */
export const EditorView = forwardRef<EditorHandle, EditorViewProps>(function EditorView({ markdown, dark, onDirty }, ref) {
    const editor = useCreateBlockNote();

    // Cargar el markdown UNA vez por montaje (el componente se monta con
    // key=doc.path: cambiar de pestaña crea un editor nuevo). La carga
    // inicial dispara onChange — solo cuenta como "dirty" lo posterior.
    const loadedRef = useRef(false);
    useEffect(() => {
        const blocks = editor.tryParseMarkdownToBlocks(markdown);
        editor.replaceBlocks(editor.document, blocks);
        requestAnimationFrame(() => {
            loadedRef.current = true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor]);

    useImperativeHandle(
        ref,
        () => ({
            getMarkdown: () => Promise.resolve(editor.blocksToMarkdownLossy()),
        }),
        [editor],
    );

    return (
        <div className="mb-editor mx-auto max-w-[760px] pt-10 pb-36">
            <BlockNoteView
                editor={editor}
                theme={dark ? "dark" : "light"}
                onChange={() => {
                    if (loadedRef.current) onDirty();
                }}
            />
        </div>
    );
});
