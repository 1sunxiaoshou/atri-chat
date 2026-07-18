mod backend;
mod runtime_layout;

use std::sync::Mutex;

use backend::{get_available_port, start_backend, stop_backend, BackendPortState, BackendProcess};
use runtime_layout::resolve_runtime_layout;
use tauri::Manager;

#[tauri::command]
fn get_backend_port(state: tauri::State<BackendPortState>) -> u16 {
    state.0
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .setup(|app| {
            let layout = resolve_runtime_layout();
            layout.ensure_data_root()?;

            let backend_port = get_available_port();
            app.manage(BackendPortState(backend_port));

            let backend_process = start_backend(&app.handle(), &layout, backend_port)
                .ok_or_else(|| "后端进程启动失败".to_string())?;

            app.manage(BackendProcess(Mutex::new(Some(backend_process))));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                stop_backend(&window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                stop_backend(app_handle);
            }
            _ => {}
        });
}
