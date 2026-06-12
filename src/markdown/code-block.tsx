import { bundledLanguages } from "shiki";
import { CodeSnippet } from "@/components/application/code-snippet/code-snippet";

const LANG_ALIASES: Record<string, string> = {
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    console: "bash",
    shellscript: "bash",
    yml: "yaml",
    py: "python",
    rb: "ruby",
    rs: "rust",
    golang: "go",
    "c++": "cpp",
    cs: "csharp",
    "objective-c": "objc",
    kt: "kotlin",
    plaintext: "text",
    plain: "text",
    txt: "text",
    env: "dotenv",
    dockerfile: "docker",
    vue: "vue",
};

function resolveLang(raw: string | undefined): string {
    const lower = (raw ?? "").toLowerCase();
    const mapped = LANG_ALIASES[lower] ?? lower;
    if (mapped === "" || mapped === "text" || mapped === "ansi") return "text";
    return mapped in bundledLanguages ? mapped : "text";
}

/**
 * Bloque de código markdown → CodeSnippet custom de Hellomatik UI
 * (shiki + botón copiar + line numbers para bloques largos).
 */
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
    const clean = code.replace(/\n$/, "");
    const multiline = clean.includes("\n");

    return (
        <div className="my-5">
            <CodeSnippet code={clean} language={resolveLang(lang)} showLineNumbers={multiline} modern={false} maxHeight={560} />
        </div>
    );
}
