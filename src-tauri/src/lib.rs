use std::sync::Mutex;

use serde::Serialize;
use tauri::{Emitter, Manager, State};

/// Archivo recibido vía asociación de archivos (doble click en Finder)
/// antes de que el frontend esté listo para escucharlo.
struct OpenedFile(Mutex<Option<String>>);

#[derive(Serialize)]
struct MarkdownDoc {
    path: String,
    content: String,
    modified_ms: Option<u64>,
}

/// Consume (take) el archivo pendiente: el frontend sondea durante el
/// arranque y así un valor ya entregado nunca pisa una apertura posterior.
#[tauri::command]
fn get_opened_file(state: State<'_, OpenedFile>) -> Option<String> {
    state.0.lock().ok().and_then(|mut guard| guard.take())
}

/// Exporta el documento renderizado a PDF sin diálogo de impresión:
/// NSPrintOperation sobre el WKWebView con jobDisposition = guardar a
/// archivo. Pagina con los estilos `@media print` de la app.
///
/// `dark` + `page_rgb`: NSPrintInfo deja la banda de márgenes sin pintar
/// (papel blanco), inaceptable en tema oscuro. En oscuro imprimimos a un
/// temporal y componemos cada página sobre un rectángulo del color real
/// del lienzo (CoreGraphics, vectorial — el texto sigue seleccionable).
#[tauri::command]
async fn export_pdf(window: tauri::WebviewWindow, dest: String, dark: Option<bool>, page_rgb: Option<[f64; 3]>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let dark = dark.unwrap_or(false);
        let print_target = if dark { format!("{dest}.print-tmp.pdf") } else { dest.clone() };
        eprintln!("[export_pdf] dest={dest} dark={dark}");
        let _ = std::fs::remove_file(&dest);
        let _ = std::fs::remove_file(&print_target);
        let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
        let dest_for_op = print_target.clone();
        window
            .with_webview(move |webview| {
                let result = unsafe { run_pdf_print_operation(webview.inner() as *mut std::ffi::c_void, &dest_for_op) };
                eprintln!("[export_pdf] print op lanzada: {result:?}");
                let _ = tx.send(result);
            })
            .map_err(|e| e.to_string())?;
        rx.recv_timeout(std::time::Duration::from_secs(30))
            .map_err(|_| "Tiempo de espera agotado lanzando la impresión".to_string())??;

        // La operación corre modal-async en el hilo principal: esperar a que
        // el PDF exista, termine en %%EOF y su tamaño quede estable.
        let wait_path = print_target.clone();
        let completed = tauri::async_runtime::spawn_blocking(move || wait_pdf_complete_sync(&wait_path, 90))
            .await
            .map_err(|e| e.to_string())?;
        if !completed {
            return Err("Tiempo de espera agotado generando el PDF".to_string());
        }

        if dark {
            let rgb = page_rgb.unwrap_or([10.0 / 255.0, 10.0 / 255.0, 10.0 / 255.0]);
            let result = unsafe { composite_pdf_on_color(&print_target, &dest, rgb) };
            let _ = std::fs::remove_file(&print_target);
            result?;
        }
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, dest, dark, page_rgb);
        Err("Exportar PDF solo está soportado en macOS".to_string())
    }
}

/// Espera (bloqueante) a que el PDF exista, su tamaño quede estable y
/// termine en %%EOF. Devuelve false si vence el plazo.
#[cfg(target_os = "macos")]
fn wait_pdf_complete_sync(path: &str, timeout_secs: u64) -> bool {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    let mut last_size: u64 = 0;
    let mut stable_iterations = 0u32;
    loop {
        std::thread::sleep(std::time::Duration::from_millis(300));
        if std::time::Instant::now() > deadline {
            return false;
        }
        let Ok(meta) = std::fs::metadata(path) else { continue };
        let size = meta.len();
        if size == 0 {
            continue;
        }
        if size == last_size {
            stable_iterations += 1;
        } else {
            stable_iterations = 0;
            last_size = size;
        }
        if stable_iterations >= 3 && pdf_looks_complete(path) {
            return true;
        }
    }
}

/// CoreGraphics (API C): compositor de PDF para el export en oscuro.
#[cfg(target_os = "macos")]
mod cg {
    use std::ffi::c_void;
    pub type CGPDFDocumentRef = *mut c_void;
    pub type CGPDFPageRef = *mut c_void;
    pub type CGContextRef = *mut c_void;
    pub type CFURLRef = *const c_void;
    pub type CFDictionaryRef = *const c_void;
    pub const K_CGPDF_MEDIA_BOX: i32 = 0;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        pub fn CGPDFDocumentCreateWithURL(url: CFURLRef) -> CGPDFDocumentRef;
        pub fn CGPDFDocumentRelease(doc: CGPDFDocumentRef);
        pub fn CGPDFDocumentGetNumberOfPages(doc: CGPDFDocumentRef) -> usize;
        pub fn CGPDFDocumentGetPage(doc: CGPDFDocumentRef, page: usize) -> CGPDFPageRef;
        pub fn CGPDFPageGetBoxRect(page: CGPDFPageRef, box_type: i32) -> objc2_foundation::NSRect;
        pub fn CGPDFContextCreateWithURL(url: CFURLRef, media_box: *const objc2_foundation::NSRect, aux: CFDictionaryRef) -> CGContextRef;
        pub fn CGPDFContextBeginPage(ctx: CGContextRef, page_info: CFDictionaryRef);
        pub fn CGPDFContextEndPage(ctx: CGContextRef);
        pub fn CGPDFContextClose(ctx: CGContextRef);
        pub fn CGContextRelease(ctx: CGContextRef);
        pub fn CGContextSetRGBFillColor(ctx: CGContextRef, r: f64, g: f64, b: f64, a: f64);
        pub fn CGContextFillRect(ctx: CGContextRef, rect: objc2_foundation::NSRect);
        pub fn CGContextDrawPDFPage(ctx: CGContextRef, page: CGPDFPageRef);
    }
}

#[cfg(target_os = "macos")]
unsafe fn ns_file_url(path: &str) -> objc2::rc::Retained<objc2::runtime::AnyObject> {
    use objc2::{class, msg_send, rc::Retained, runtime::AnyObject};
    let s: Retained<AnyObject> =
        msg_send![class!(NSString), stringWithUTF8String: format!("{path}\0").as_ptr() as *const std::os::raw::c_char];
    msg_send![class!(NSURL), fileURLWithPath: &*s]
}

/// Reescribe `src` en `dst` pintando cada página entera (media box, con
/// banda de márgenes incluida) del color del lienzo y dibujando encima la
/// página original. Salida 100% vectorial: el texto sigue seleccionable.
#[cfg(target_os = "macos")]
unsafe fn composite_pdf_on_color(src: &str, dst: &str, rgb: [f64; 3]) -> Result<(), String> {
    use cg::*;
    use objc2::rc::Retained;

    let src_url = ns_file_url(src);
    let dst_url = ns_file_url(dst);

    // NSURL y CFURL son toll-free bridged
    let doc = CGPDFDocumentCreateWithURL(Retained::as_ptr(&src_url) as CFURLRef);
    if doc.is_null() {
        return Err("No se pudo abrir el PDF intermedio".to_string());
    }
    let pages = CGPDFDocumentGetNumberOfPages(doc);
    if pages == 0 {
        CGPDFDocumentRelease(doc);
        return Err("El PDF intermedio no tiene páginas".to_string());
    }

    let first_box = CGPDFPageGetBoxRect(CGPDFDocumentGetPage(doc, 1), K_CGPDF_MEDIA_BOX);
    let ctx = CGPDFContextCreateWithURL(Retained::as_ptr(&dst_url) as CFURLRef, &first_box, std::ptr::null());
    if ctx.is_null() {
        CGPDFDocumentRelease(doc);
        return Err("No se pudo crear el PDF de salida".to_string());
    }

    for i in 1..=pages {
        let page = CGPDFDocumentGetPage(doc, i);
        if page.is_null() {
            continue;
        }
        let media = CGPDFPageGetBoxRect(page, K_CGPDF_MEDIA_BOX);
        CGPDFContextBeginPage(ctx, std::ptr::null());
        CGContextSetRGBFillColor(ctx, rgb[0], rgb[1], rgb[2], 1.0);
        CGContextFillRect(ctx, media);
        CGContextDrawPDFPage(ctx, page);
        CGPDFContextEndPage(ctx);
    }

    CGPDFContextClose(ctx);
    CGContextRelease(ctx);
    CGPDFDocumentRelease(doc);
    Ok(())
}

#[cfg(target_os = "macos")]
fn pdf_looks_complete(path: &str) -> bool {
    use std::io::{Read, Seek, SeekFrom};
    let Ok(mut file) = std::fs::File::open(path) else { return false };
    let Ok(len) = file.seek(SeekFrom::End(0)) else { return false };
    if len < 1024 {
        return false;
    }
    let tail_len = 64.min(len);
    if file.seek(SeekFrom::End(-(tail_len as i64))).is_err() {
        return false;
    }
    let mut tail = Vec::with_capacity(tail_len as usize);
    if file.read_to_end(&mut tail).is_err() {
        return false;
    }
    tail.windows(5).any(|w| w == b"%%EOF")
}

#[cfg(target_os = "macos")]
unsafe fn run_pdf_print_operation(wk_webview: *mut std::ffi::c_void, dest: &str) -> Result<(), String> {
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2::{msg_send, class};

    let webview = wk_webview as *mut AnyObject;
    if webview.is_null() {
        return Err("Webview no disponible".to_string());
    }

    // NSPrintInfo con jobDisposition = NSPrintSaveJob → escribe PDF a dest
    let ns_dest: Retained<AnyObject> = ns_file_url(dest);
    let print_info: Retained<AnyObject> = msg_send![class!(NSPrintInfo), sharedPrintInfo];
    let print_info: Retained<AnyObject> = msg_send![&*print_info, copy];

    let dict: Retained<AnyObject> = msg_send![&*print_info, dictionary];
    let save_job: Retained<AnyObject> =
        msg_send![class!(NSString), stringWithUTF8String: b"NSPrintSaveJob\0".as_ptr() as *const std::os::raw::c_char];
    let key_disposition: Retained<AnyObject> =
        msg_send![class!(NSString), stringWithUTF8String: b"NSJobDisposition\0".as_ptr() as *const std::os::raw::c_char];
    let key_saving_url: Retained<AnyObject> =
        msg_send![class!(NSString), stringWithUTF8String: b"NSJobSavingURL\0".as_ptr() as *const std::os::raw::c_char];
    let _: () = msg_send![&*dict, setObject: &*save_job, forKey: &*key_disposition];
    let _: () = msg_send![&*dict, setObject: &*ns_dest, forKey: &*key_saving_url];

    // Márgenes editoriales (~14 mm) — @page no aplica en NSPrintOperation
    let _: () = msg_send![&*print_info, setTopMargin: 40.0f64];
    let _: () = msg_send![&*print_info, setBottomMargin: 40.0f64];
    let _: () = msg_send![&*print_info, setLeftMargin: 40.0f64];
    let _: () = msg_send![&*print_info, setRightMargin: 40.0f64];
    let _: () = msg_send![&*print_info, setHorizontallyCentered: true];
    let _: () = msg_send![&*print_info, setVerticallyCentered: false];

    // WKWebView.printOperationWithPrintInfo: (macOS 11+)
    let op: Retained<AnyObject> = msg_send![&*webview, printOperationWithPrintInfo: &*print_info];
    let _: () = msg_send![&*op, setShowsPrintPanel: false];
    let _: () = msg_send![&*op, setShowsProgressPanel: false];

    // Quirk conocido de WKWebView: el print view nace con frame cero y el
    // PDF sale en blanco/corrupto. Frame = paperSize COMPLETO (los márgenes
    // los aplica NSPrintInfo, no hay que restarlos aquí).
    let view: Retained<AnyObject> = msg_send![&*op, view];
    let paper: objc2_foundation::NSSize = msg_send![&*print_info, paperSize];
    let frame = objc2_foundation::NSRect::new(
        objc2_foundation::NSPoint::new(0.0, 0.0),
        objc2_foundation::NSSize::new(paper.width, paper.height),
    );
    let _: () = msg_send![&*view, setFrame: frame];

    // runOperation síncrono corrompe la salida con WKWebView — la forma
    // soportada es la variante modal (asíncrona) anclada a la ventana.
    let ns_window: *mut AnyObject = msg_send![&*webview, window];
    if ns_window.is_null() {
        return Err("La ventana no está disponible".to_string());
    }
    let nil_obj: *mut AnyObject = std::ptr::null_mut();
    let _: () = msg_send![
        &*op,
        runOperationModalForWindow: &*ns_window,
        delegate: nil_obj,
        didRunSelector: std::ptr::null::<std::ffi::c_void>(),
        contextInfo: std::ptr::null_mut::<std::ffi::c_void>()
    ];
    Ok(())
}

/// Hook de test/automatización: MB_THEME=dark|light|system fuerza el
/// tema al arrancar (para validar el export PDF en cada tema).
#[tauri::command]
fn get_startup_theme() -> Option<String> {
    std::env::var("MB_THEME").ok()
}

const MD_EXTS: [&str; 5] = ["md", "markdown", "mdown", "mkd", "mdx"];
/// Carpetas que nunca contienen documentación del usuario
const SKIP_DIRS: [&str; 6] = ["node_modules", "target", "dist", "build", "vendor", "__pycache__"];
const MAX_MD_FILES: usize = 200;

fn is_markdown(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| MD_EXTS.contains(&e.to_ascii_lowercase().as_str()))
}

fn walk_markdown(dir: &std::path::Path, out: &mut Vec<String>) {
    if out.len() >= MAX_MD_FILES {
        return;
    }
    let Ok(read_dir) = std::fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = read_dir.flatten().collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        if out.len() >= MAX_MD_FILES {
            return;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            if !SKIP_DIRS.contains(&name.as_str()) {
                walk_markdown(&path, out);
            }
        } else if is_markdown(&path) {
            out.push(path.to_string_lossy().to_string());
        }
    }
}

/// Expande una mezcla de rutas (archivos .md y/o carpetas) a la lista
/// plana de markdowns a abrir: las carpetas se recorren recursivamente
/// (orden alfabético, sin ocultos ni node_modules/target/…, tope 200).
#[tauri::command]
fn expand_markdown_paths(paths: Vec<String>) -> Vec<String> {
    eprintln!("[expand_markdown_paths] in={paths:?}");
    let mut out: Vec<String> = Vec::new();
    for p in paths {
        let path = std::path::PathBuf::from(&p);
        if path.is_dir() {
            walk_markdown(&path, &mut out);
        } else if is_markdown(&path) && !out.contains(&p) {
            out.push(p);
        }
    }
    eprintln!("[expand_markdown_paths] out={} archivos", out.len());
    out
}

/// Diálogo de apertura estilo VS Code: un único NSOpenPanel que acepta
/// archivos Markdown Y carpetas (el plugin dialog de Tauri no permite
/// mezclar ambos). Las carpetas se expanden a todos sus .md.
#[tauri::command]
async fn pick_markdown_paths(window: tauri::WebviewWindow) -> Result<Vec<String>, String> {
    #[cfg(target_os = "macos")]
    {
        eprintln!("[pick_markdown_paths] abriendo panel");
        let (tx, rx) = std::sync::mpsc::channel::<Vec<String>>();
        window
            .run_on_main_thread(move || {
                let picked = unsafe { run_open_panel() };
                eprintln!("[pick_markdown_paths] panel devolvió {} rutas", picked.len());
                let _ = tx.send(picked);
            })
            .map_err(|e| e.to_string())?;
        let picked = tauri::async_runtime::spawn_blocking(move || {
            rx.recv_timeout(std::time::Duration::from_secs(600)).unwrap_or_default()
        })
        .await
        .map_err(|e| e.to_string())?;
        Ok(expand_markdown_paths(picked))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window;
        Err("Solo soportado en macOS".to_string())
    }
}

#[cfg(target_os = "macos")]
unsafe fn ns_string(s: &str) -> objc2::rc::Retained<objc2::runtime::AnyObject> {
    use objc2::{class, msg_send};
    msg_send![class!(NSString), stringWithUTF8String: format!("{s}\0").as_ptr() as *const std::os::raw::c_char]
}

#[cfg(target_os = "macos")]
unsafe fn run_open_panel() -> Vec<String> {
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};

    let panel: Retained<AnyObject> = msg_send![class!(NSOpenPanel), openPanel];
    let _: () = msg_send![&*panel, setCanChooseFiles: true];
    let _: () = msg_send![&*panel, setCanChooseDirectories: true];
    let _: () = msg_send![&*panel, setAllowsMultipleSelection: true];
    let _: () = msg_send![&*panel, setResolvesAliases: true];
    let message = ns_string("Elige documentos Markdown o carpetas (se abrirán todos sus .md)");
    let _: () = msg_send![&*panel, setMessage: &*message];
    // allowedFileTypes filtra archivos; las carpetas siguen seleccionables
    let types: Retained<AnyObject> = msg_send![class!(NSMutableArray), array];
    for ext in MD_EXTS {
        let s = ns_string(ext);
        let _: () = msg_send![&*types, addObject: &*s];
    }
    let _: () = msg_send![&*panel, setAllowedFileTypes: &*types];

    let response: isize = msg_send![&*panel, runModal];
    if response != 1 {
        return Vec::new(); // NSModalResponseOK == 1; cancelado
    }
    let urls: Retained<AnyObject> = msg_send![&*panel, URLs];
    let count: usize = msg_send![&*urls, count];
    let mut out = Vec::with_capacity(count);
    for i in 0..count {
        let url: Retained<AnyObject> = msg_send![&*urls, objectAtIndex: i];
        let path: Retained<AnyObject> = msg_send![&*url, path];
        let cstr: *const std::os::raw::c_char = msg_send![&*path, UTF8String];
        if !cstr.is_null() {
            out.push(std::ffi::CStr::from_ptr(cstr).to_string_lossy().to_string());
        }
    }
    out
}

/// Guarda el markdown editado. Escritura atómica: tmp + rename para no
/// dejar el archivo a medias si algo falla.
#[tauri::command]
fn write_markdown(path: String, content: String) -> Result<(), String> {
    let tmp = format!("{path}.mb-tmp");
    std::fs::write(&tmp, &content).map_err(|e| format!("No se pudo escribir «{path}»: {e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("No se pudo escribir «{path}»: {e}")
    })
}

// ═══ AI chat del documento ═══════════════════════════════════════════
// Spawnea el CLI de Claude Code (mismo patrón que el asistente de
// Moptions: -p + stream-json + --resume) pero SANDBOXEADO al documento:
// el contenido viaja embebido en el system prompt, sin herramientas ni
// MCPs. El stream llega al frontend como eventos Tauri "chat-event".

/// session_id de Claude por documento (path → sid). Cada --resume
/// devuelve un sid NUEVO en el evento result: hay que recapturarlo.
struct ChatSessions(Mutex<std::collections::HashMap<String, String>>);

/// La app lanzada desde Finder no hereda el PATH del shell: resolver
/// el binario `claude` una vez vía login shell, con fallbacks típicos.
fn find_claude_bin() -> Option<String> {
    static BIN: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();
    BIN.get_or_init(|| {
        if let Ok(out) = std::process::Command::new("/bin/zsh").args(["-lc", "command -v claude"]).output() {
            if out.status.success() {
                let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !p.is_empty() {
                    return Some(p);
                }
            }
        }
        let home = std::env::var("HOME").unwrap_or_default();
        for cand in [
            format!("{home}/.local/bin/claude"),
            "/opt/homebrew/bin/claude".to_string(),
            "/usr/local/bin/claude".to_string(),
        ] {
            if std::path::Path::new(&cand).exists() {
                return Some(cand);
            }
        }
        None
    })
    .clone()
}

/// Home estable del asistente (Application Support, NO tmp: la ruta no
/// cambia nunca → el "trust this folder" de Claude se acepta UNA vez).
fn chat_home() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    let dir = std::path::PathBuf::from(home).join("Library/Application Support/com.hellomatik.markdown-beauty/chat");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

const CHAT_DOC_LIMIT: usize = 60_000;

#[tauri::command]
async fn chat_send(
    app: tauri::AppHandle,
    state: State<'_, ChatSessions>,
    doc_path: String,
    doc_content: String,
    message: String,
) -> Result<(), String> {
    let claude = find_claude_bin().ok_or("No encuentro el CLI de Claude Code. Instálalo (https://claude.com/claude-code) o añádelo al PATH.")?;
    let resume = state.0.lock().ok().and_then(|m| m.get(&doc_path).cloned());

    let mut content = doc_content;
    if content.len() > CHAT_DOC_LIMIT {
        let mut end = CHAT_DOC_LIMIT;
        while !content.is_char_boundary(end) {
            end -= 1;
        }
        content.truncate(end);
        content.push_str("\n\n[… documento truncado por longitud …]");
    }
    let file_name = doc_path.rsplit('/').next().unwrap_or(&doc_path).to_string();
    let system = format!(
        "Eres el asistente de lectura de Markdown Beauty para el documento «{file_name}». \
         Tu ÚNICO conocimiento es el contenido del documento incluido a continuación (siempre en su versión más reciente). \
         Responde en el idioma del usuario, de forma clara y concisa, citando las secciones relevantes del documento. \
         Si te preguntan por algo ajeno al documento, decláralo con amabilidad y reconduce la conversación al documento. \
         No tienes herramientas: no intentes leer archivos, buscar en la web ni ejecutar nada.\n\n\
         <documento path=\"{doc_path}\">\n{content}\n</documento>"
    );

    let mut cmd = std::process::Command::new(&claude);
    cmd.arg("-p")
        .arg(&message)
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .arg("--include-partial-messages")
        .arg("--append-system-prompt")
        .arg(&system)
        .arg("--disallowedTools")
        .arg("Bash,Edit,Write,Read,Glob,Grep,WebSearch,WebFetch,Task,NotebookEdit,TodoWrite")
        .arg("--strict-mcp-config");
    if let Some(sid) = resume {
        cmd.arg("--resume").arg(sid);
    }
    cmd.current_dir(chat_home())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());

    let mut child = cmd.spawn().map_err(|e| format!("No se pudo lanzar Claude: {e}"))?;
    let stdout = child.stdout.take().ok_or("El proceso de Claude no expone stdout")?;
    let doc_key = doc_path.clone();

    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{BufRead, BufReader};
        use tauri::Emitter;
        let reader = BufReader::new(stdout);
        let mut got_delta = false;
        let mut finished = false;
        for line in reader.lines() {
            let Ok(line) = line else { break };
            let Ok(evt) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
            match evt.get("type").and_then(|t| t.as_str()) {
                Some("stream_event") => {
                    if let Some(text) = evt.pointer("/event/delta/text").and_then(|d| d.as_str()) {
                        got_delta = true;
                        let _ = app.emit("chat-event", serde_json::json!({ "kind": "delta", "docPath": doc_key, "text": text }));
                    }
                }
                Some("system") => {
                    if let Some(sid) = evt.get("session_id").and_then(|s| s.as_str()) {
                        if let Some(st) = app.try_state::<ChatSessions>() {
                            if let Ok(mut m) = st.0.lock() {
                                m.insert(doc_key.clone(), sid.to_string());
                            }
                        }
                    }
                }
                Some("result") => {
                    if let Some(sid) = evt.get("session_id").and_then(|s| s.as_str()) {
                        if let Some(st) = app.try_state::<ChatSessions>() {
                            if let Ok(mut m) = st.0.lock() {
                                m.insert(doc_key.clone(), sid.to_string());
                            }
                        }
                    }
                    let is_error = evt.get("is_error").and_then(|b| b.as_bool()).unwrap_or(false);
                    // Fallback sin deltas parciales: usar el texto final
                    if !got_delta {
                        if let Some(text) = evt.get("result").and_then(|r| r.as_str()) {
                            let _ = app.emit("chat-event", serde_json::json!({ "kind": "delta", "docPath": doc_key, "text": text }));
                        }
                    }
                    finished = true;
                    let _ = app.emit("chat-event", serde_json::json!({ "kind": "done", "docPath": doc_key, "isError": is_error }));
                }
                _ => {}
            }
        }
        let status = child.wait();
        if !finished {
            let detail = match status {
                Ok(s) if !s.success() => format!("Claude terminó con error ({s})."),
                _ => "La respuesta se cortó sin terminar.".to_string(),
            };
            let _ = app.emit("chat-event", serde_json::json!({ "kind": "error", "docPath": doc_key, "message": detail }));
        }
    });
    Ok(())
}

// ═══ Terminal del documento: ttyd + Claude Code INTERACTIVO ══════════
// Réplica del /terminal de Moptions (main.rs start_ttyd): ttyd sirve
// xterm.js por websocket y cada conexión ejecuta el CLI de claude REAL
// (TUI completa, con su propio autocompletado de comandos). El prompt
// del sistema con el documento activo se regenera en chat_set_doc y se
// inyecta con --append-system-prompt-file; cada nueva sesión lo lee.

static TTYD_CHILD: Mutex<Option<std::process::Child>> = Mutex::new(None);
/// Puerto elegido en runtime (otros ttyd del sistema pueden ocupar los
/// típicos 7681/7682 — NUNCA reutilizar uno ajeno: sería otra terminal).
static TTYD_PORT: std::sync::atomic::AtomicU16 = std::sync::atomic::AtomicU16::new(0);

fn port_free(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
}

fn chat_workspace() -> std::path::PathBuf {
    let dir = chat_home().join("workspace");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn find_ttyd(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("vendor/ttyd/ttyd");
        if p.exists() {
            return Some(p);
        }
    }
    // dev: src-tauri/target/release/<exe> → src-tauri/vendor/ttyd/ttyd
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.ancestors().nth(3) {
            let p = dir.join("vendor/ttyd/ttyd");
            if p.exists() {
                return Some(p);
            }
        }
    }
    None
}

/// Lanza ttyd (idéntico a Moptions: fuente Hack, paleta default_dark de
/// Warp, persistente). El programa de cada sesión es un wrapper zsh que
/// ejecuta claude con el prompt del documento activo.
fn start_ttyd(app: &tauri::AppHandle) {
    // Primer puerto libre del rango propio (lejos del 7681/7682 de otros)
    let Some(port) = (7693u16..7710).find(|p| port_free(*p)) else {
        eprintln!("[ttyd] sin puerto libre");
        return;
    };
    TTYD_PORT.store(port, std::sync::atomic::Ordering::Relaxed);
    let Some(ttyd) = find_ttyd(app) else {
        eprintln!("[ttyd] binario no encontrado");
        return;
    };
    let Some(claude) = find_claude_bin() else {
        eprintln!("[ttyd] claude no encontrado");
        return;
    };
    let ws = chat_workspace();
    let prompt_file = chat_home().join("assistant-prompt.md");
    if !prompt_file.exists() {
        let _ = std::fs::write(
            &prompt_file,
            "Eres el asistente de Markdown Beauty. Aún no hay documento activo: pide al usuario que abra uno.",
        );
    }
    let launcher = chat_home().join("launch-claude.sh");
    let script = format!(
        "#!/bin/zsh\nexec \"{}\" --append-system-prompt-file \"{}\"\n",
        claude,
        prompt_file.display()
    );
    if std::fs::write(&launcher, script).is_err() {
        return;
    }
    let _ = std::process::Command::new("chmod").arg("+x").arg(&launcher).status();

    let mut cmd = std::process::Command::new(&ttyd);
    cmd.current_dir(&ws);
    cmd.arg("--port")
        .arg(port.to_string())
        .arg("--interface")
        .arg("127.0.0.1")
        .arg("--writable");
    cmd.arg("-t").arg("fontFamily=Hack, ui-monospace, monospace");
    cmd.arg("-t").arg("fontSize=13");
    cmd.arg("-t").arg(r##"theme={"background":"#181818","foreground":"#d8d8d8","cursor":"#7cafc2","selectionBackground":"#3a3a3a","black":"#181818","red":"#ab4642","green":"#a1b56c","yellow":"#f7ca88","blue":"#7cafc2","magenta":"#ba8baf","cyan":"#86c1b9","white":"#d8d8d8","brightBlack":"#585858","brightRed":"#ab4642","brightGreen":"#a1b56c","brightYellow":"#f7ca88","brightBlue":"#7cafc2","brightMagenta":"#ba8baf","brightCyan":"#86c1b9","brightWhite":"#f8f8f8"}"##);
    cmd.arg("/bin/zsh").arg(&launcher);
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    match cmd.spawn() {
        Ok(child) => {
            if let Ok(mut guard) = TTYD_CHILD.lock() {
                *guard = Some(child);
            }
        }
        Err(e) => eprintln!("[ttyd] no se pudo lanzar: {e}"),
    }
}

fn stop_ttyd() {
    if let Ok(mut guard) = TTYD_CHILD.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// Regenera el prompt del sistema y la copia local del documento activo.
/// Las sesiones NUEVAS de la terminal nacen scoped a este documento.
#[tauri::command]
fn chat_set_doc(doc_path: String, doc_content: String) -> Result<(), String> {
    let ws = chat_workspace();
    let file_name = doc_path.rsplit('/').next().unwrap_or("documento.md").to_string();
    std::fs::write(ws.join(&file_name), &doc_content).map_err(|e| e.to_string())?;

    let mut content = doc_content;
    if content.len() > CHAT_DOC_LIMIT {
        let mut end = CHAT_DOC_LIMIT;
        while !content.is_char_boundary(end) {
            end -= 1;
        }
        content.truncate(end);
        content.push_str("\n\n[… documento truncado por longitud …]");
    }
    let prompt = format!(
        "Eres el asistente de Markdown Beauty dentro de una terminal Claude Code. \
         Tu ÚNICO foco es el documento «{file_name}» (ruta original: {doc_path}). \
         Hay una copia actualizada en ./{file_name} de este directorio de trabajo. \
         Responde en el idioma del usuario citando las secciones relevantes; si te \
         preguntan por algo ajeno al documento, decláralo con amabilidad y reconduce. \
         Contenido actual del documento:\n\n<documento>\n{content}\n</documento>"
    );
    std::fs::write(chat_home().join("assistant-prompt.md"), prompt).map_err(|e| e.to_string())?;
    Ok(())
}

/// URL de la terminal embebida (puerto elegido en runtime).
#[tauri::command]
fn chat_terminal_url() -> Result<String, String> {
    let port = TTYD_PORT.load(std::sync::atomic::Ordering::Relaxed);
    if port == 0 {
        return Err("La terminal no está disponible (ttyd no arrancó)".to_string());
    }
    Ok(format!("http://127.0.0.1:{port}/"))
}

#[derive(Serialize, Clone)]
struct SlashCommand {
    name: String,
    description: String,
}

/// Descripción del frontmatter YAML de un .md (description: …).
fn md_description(path: &std::path::Path) -> Option<String> {
    let text = std::fs::read_to_string(path).ok()?;
    if !text.starts_with("---") {
        return None;
    }
    for line in text.lines().skip(1).take(40) {
        if line.trim() == "---" {
            break;
        }
        if let Some(rest) = line.trim().strip_prefix("description:") {
            let d: String = rest.trim().trim_matches('"').chars().take(120).collect();
            if !d.is_empty() {
                return Some(d);
            }
        }
    }
    None
}

fn collect_md_commands(dir: &std::path::Path, prefix: &str, out: &mut Vec<SlashCommand>) {
    let Ok(read_dir) = std::fs::read_dir(dir) else { return };
    for entry in read_dir.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_md_commands(&path, &format!("{prefix}{name}:"), out);
        } else if let Some(stem) = name.strip_suffix(".md") {
            out.push(SlashCommand {
                name: format!("{prefix}{stem}"),
                description: md_description(&path).unwrap_or_else(|| "Comando personalizado".to_string()),
            });
        }
    }
}

/// Lista de slash commands para el autocompletado del chat, como en
/// Claude Code: builtins útiles en modo print + comandos custom del
/// usuario (~/.claude/commands) + skills invocables (~/.claude/skills).
#[tauri::command]
fn chat_list_commands() -> Vec<SlashCommand> {
    let mut out: Vec<SlashCommand> = [
        ("compact", "Compacta la conversación conservando lo esencial"),
        ("context", "Visualiza el uso de contexto de la sesión"),
        ("cost", "Coste y duración de la sesión actual"),
        ("status", "Estado de Claude Code (modelo, cuenta, sesión)"),
        ("usage", "Límites de uso del plan actual"),
        ("todos", "Lista las tareas de la sesión"),
        ("release-notes", "Novedades de Claude Code"),
        ("help", "Ayuda y comandos disponibles"),
        ("doctor", "Diagnostica la instalación de Claude Code"),
    ]
    .into_iter()
    .map(|(n, d)| SlashCommand { name: n.to_string(), description: d.to_string() })
    .collect();

    let home = std::env::var("HOME").unwrap_or_default();
    collect_md_commands(std::path::Path::new(&home).join(".claude/commands").as_path(), "", &mut out);

    if let Ok(read_dir) = std::fs::read_dir(std::path::Path::new(&home).join(".claude/skills")) {
        for entry in read_dir.flatten() {
            let skill = entry.path().join("SKILL.md");
            if skill.exists() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') {
                    continue;
                }
                out.push(SlashCommand {
                    name,
                    description: md_description(&skill).unwrap_or_else(|| "Skill del usuario".to_string()),
                });
            }
        }
    }

    out.sort_by(|a, b| a.name.cmp(&b.name));
    out.dedup_by(|a, b| a.name == b.name);
    out
}

/// Hook de test genérico: lee variables de entorno MB_* (solo MB_).
#[tauri::command]
fn get_test_env(name: String) -> Option<String> {
    if !name.starts_with("MB_") {
        return None;
    }
    std::env::var(name).ok()
}

/// Hooks de test: MB_CHAT_TEST envía esa pregunta al abrir el chat;
/// MB_CHAT_TEST2 envía una segunda al terminar (valida el --resume).
#[tauri::command]
fn get_chat_test() -> (Option<String>, Option<String>) {
    (std::env::var("MB_CHAT_TEST").ok(), std::env::var("MB_CHAT_TEST2").ok())
}

/// Empezar de cero la conversación de un documento.
#[tauri::command]
fn chat_reset(state: State<'_, ChatSessions>, doc_path: String) {
    if let Ok(mut m) = state.0.lock() {
        m.remove(&doc_path);
    }
}

#[tauri::command]
fn read_markdown(path: String) -> Result<MarkdownDoc, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| format!("No se pudo leer «{path}»: {e}"))?;
    let modified_ms = std::fs::metadata(&path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);

    Ok(MarkdownDoc { path, content, modified_ms })
}

fn url_to_path(url: &tauri::Url) -> Option<String> {
    if url.scheme() == "file" {
        url.to_file_path().ok().map(|p| p.to_string_lossy().to_string())
    } else {
        None
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(OpenedFile(Mutex::new(
            // Hook de test/automatización: MB_OPEN=/ruta/doc.md
            std::env::var("MB_OPEN").ok(),
        )))
        .manage(ChatSessions(Mutex::new(std::collections::HashMap::new())))
        .setup(|app| {
            // Terminal del documento (ttyd + Claude Code interactivo)
            start_ttyd(app.handle());
            // Hook de test/automatización: MB_EXPORT_PDF=/ruta/salida.pdf
            // exporta el documento activo a PDF a los 6s de arrancar.
            // Con MB_THEME=dark replica el flujo oscuro completo
            // (temporal + composición del color de lienzo).
            if let Ok(dest) = std::env::var("MB_EXPORT_PDF") {
                let handle = app.handle().clone();
                let dark = std::env::var("MB_THEME").is_ok_and(|t| t == "dark");
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(6));
                    let print_target = if dark { format!("{dest}.print-tmp.pdf") } else { dest.clone() };
                    if let Some(window) = handle.get_webview_window("main") {
                        let d = print_target.clone();
                        let _ = window.with_webview(move |webview| {
                            let result = unsafe { run_pdf_print_operation(webview.inner() as *mut std::ffi::c_void, &d) };
                            eprintln!("[MB_EXPORT_PDF] print op: {result:?}");
                        });
                    }
                    if dark {
                        if wait_pdf_complete_sync(&print_target, 90) {
                            let result = unsafe { composite_pdf_on_color(&print_target, &dest, [10.0 / 255.0, 10.0 / 255.0, 10.0 / 255.0]) };
                            let _ = std::fs::remove_file(&print_target);
                            eprintln!("[MB_EXPORT_PDF] composite: {result:?}");
                        } else {
                            eprintln!("[MB_EXPORT_PDF] timeout esperando el PDF intermedio");
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_opened_file,
            read_markdown,
            write_markdown,
            export_pdf,
            get_startup_theme,
            expand_markdown_paths,
            pick_markdown_paths,
            chat_send,
            chat_reset,
            chat_list_commands,
            chat_set_doc,
            chat_terminal_url,
            get_chat_test,
            get_test_env
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // El sidecar ttyd muere con la app
            if let tauri::RunEvent::Exit = event {
                stop_ttyd();
            }
            // macOS: el Finder entrega los archivos asociados con un
            // AppleEvent que Tauri expone como RunEvent::Opened. Puede
            // llegar ANTES de que la webview monte (lanzamiento por doble
            // click) o DESPUÉS (app ya abierta): cubrimos ambos casos.
            if let tauri::RunEvent::Opened { urls } = event {
                if let Some(path) = urls.iter().find_map(url_to_path) {
                    if let Some(state) = app.try_state::<OpenedFile>() {
                        if let Ok(mut guard) = state.0.lock() {
                            *guard = Some(path.clone());
                        }
                    }
                    let _ = app.emit("open-file", path);
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.set_focus();
                    }
                }
            }
        });
}
