import React, { SVGProps } from 'react';

type MimeTypeCategory = "image" | "code" | "document" | "video" | "audio" | "unknown";
/**
 * Categorizes a MIME type string into one of the predefined categories: `image`, `code`, `document`, `video`, `audio`,
 * or returns `unknown` if the MIME type does not match any known category.
 *
 * @param mimeType - The MIME type string to categorize (e.g., "image/jpeg", "application/pdf").
 * @returns A `MimeTypeCategory` which is one of: `"image"`, `"code"`, `"document"`, `"video"`, `"audio"`, or `"unknown"`.
 *
 * @example
 * ```typescript
 * categorizeMimeType("image/jpeg"); // Returns: "image"
 * categorizeMimeType("application/pdf"); // Returns: "document"
 * categorizeMimeType("text/html"); // Returns: "code"
 * categorizeMimeType("video/mp4"); // Returns: "video"
 * categorizeMimeType("audio/mpeg"); // Returns: "audio"
 * categorizeMimeType("unknown/type"); // Returns: "unknown"
 * ```
 */
declare function categorizeMimeType(mimeType: string): MimeTypeCategory;
declare const SUPPORTED_FILE_TYPES: readonly ["audio", "code", "document", "empty", "folder", "image", "img", "spreadsheets", "video", "video-01", "video-02", "aep", "ai", "avi", "css", "csv", "dmg", "doc", "docx", "eps", "exe", "fig", "gif", "html", "indd", "java", "jpeg", "jpg", "js", "json", "mkv", "mp3", "mp4", "mpeg", "pdf", "pdf-simple", "png", "ppt", "pptx", "psd", "rar", "rss", "sql", "svg", "tiff", "txt", "wav", "webp", "xls", "xlsx", "xml", "zip"];
type SupportedFileTypes = (typeof SUPPORTED_FILE_TYPES)[number];
type FileType = SupportedFileTypes | (string & {});
interface FileIconProps extends SVGProps<SVGSVGElement> {
    /**
     * The type of file to display the icon for. This can be a specific file type (e.g., "pdf", "docx", "mp4") or a MIME type (e.g., "application/pdf", "video/mp4").
     * If the type is a MIME type, the function will categorize it into one of the predefined categories: `image`, `code`, `document`, `video`, `audio`, or `unknown`.
     *
     * [See all the variants at assets.local ↗️](https://assets.local/docs/resources/file-icons).
     *
     * @default "empty"
     */
    type: FileType;
    /**
     * The variant of the file icon. This can be one of the following values:
     * - `"default"`: The default variant with colored icons.
     * - `"gray"`: The gray variant with monochrome icons.
     * - `"solid"`: The solid variant with solid color background.
     *
     * [See all the variants at assets.local ↗️](https://assets.local/docs/resources/file-icons).
     *
     * @default "default"
     */
    variant?: "default" | "gray" | "solid";
    /**
     * The color theme of the file icon.
     * @default "light"
     */
    theme?: "light" | "dark";
    /**
     * The size of the file icon in pixels.
     * @default 24
     */
    size?: number;
}
/**
 * The `FileIcon` component displays an icon for a specific file type or MIME type.
 * The component supports a wide range of file types and MIME types, and categorizes them into one of the predefined categories: `image`, `code`, `document`, `video`, `audio`, or `unknown`.
 *
 * [See all the variants at assets.local ↗️](https://assets.local/docs/resources/file-icons).
 *
 * @example
 * ```jsx
 * <FileIcon type="pdf" />
 * <FileIcon type="application/pdf" />
 * <FileIcon type="video/mp4" />
 * <FileIcon type="audio/mpeg" />
 * <FileIcon type="unknown/type" />
 * ```
 */
declare const FileIcon: ({ type, variant, theme, ...props }: FileIconProps) => React.JSX.Element;

export { FileIcon, type FileIconProps, SUPPORTED_FILE_TYPES, categorizeMimeType };
