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
        .manage(OpenedFile(Mutex::new(
            // Hook de test/automatización: MB_OPEN=/ruta/doc.md
            std::env::var("MB_OPEN").ok(),
        )))
        .setup(|app| {
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
            pick_markdown_paths
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
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
