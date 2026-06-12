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
#[tauri::command]
async fn export_pdf(window: tauri::WebviewWindow, dest: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        eprintln!("[export_pdf] dest={dest}");
        let _ = std::fs::remove_file(&dest);
        let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
        let dest_for_op = dest.clone();
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
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(90);
        let mut last_size: u64 = 0;
        let mut stable_iterations = 0u32;
        loop {
            tokio_sleep(std::time::Duration::from_millis(300)).await;
            if std::time::Instant::now() > deadline {
                return Err("Tiempo de espera agotado generando el PDF".to_string());
            }
            let Ok(meta) = std::fs::metadata(&dest) else { continue };
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
            if stable_iterations >= 3 && pdf_looks_complete(&dest) {
                return Ok(());
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, dest);
        Err("Exportar PDF solo está soportado en macOS".to_string())
    }
}

#[cfg(target_os = "macos")]
async fn tokio_sleep(duration: std::time::Duration) {
    // tauri re-exporta tokio como runtime async de los commands
    tauri::async_runtime::spawn_blocking(move || std::thread::sleep(duration))
        .await
        .ok();
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
    let ns_dest: Retained<AnyObject> = {
        let s: Retained<AnyObject> = msg_send![class!(NSString), stringWithUTF8String: format!("{dest}\0").as_ptr() as *const std::os::raw::c_char];
        msg_send![class!(NSURL), fileURLWithPath: &*s]
    };
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
            if let Ok(dest) = std::env::var("MB_EXPORT_PDF") {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(6));
                    if let Some(window) = handle.get_webview_window("main") {
                        let d = dest.clone();
                        let _ = window.with_webview(move |webview| {
                            let result = unsafe { run_pdf_print_operation(webview.inner() as *mut std::ffi::c_void, &d) };
                            eprintln!("[MB_EXPORT_PDF] {result:?}");
                        });
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_opened_file, read_markdown, export_pdf])
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
