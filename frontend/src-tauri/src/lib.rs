mod runtime;

use std::net::TcpListener;
use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::Manager;

use runtime::{resolve_backend_launch, resolve_runtime_layout, BackendLaunch, RuntimeLayout, BACKEND_PORT_ENV};

struct BackendProcess(Mutex<Option<Child>>);
struct BackendPortState(u16);

#[tauri::command]
fn get_backend_port(state: tauri::State<BackendPortState>) -> u16 {
    state.0
}

fn get_available_port() -> u16 {
    if let Ok(port_str) = std::env::var(BACKEND_PORT_ENV) {
        if let Ok(port) = port_str.parse::<u16>() {
            if TcpListener::bind(("127.0.0.1", port)).is_ok() {
                return port;
            }
            println!("Port {} is occupied, resolving a random one...", port);
        }
    }

    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

fn stop_backend(app_handle: &tauri::AppHandle) {
    if let Some(backend) = app_handle.try_state::<BackendProcess>() {
        if let Ok(mut process) = backend.0.lock() {
            if let Some(mut child) = process.take() {
                let _ = child.kill();
            }
        }
    }
}

fn start_backend(app: &tauri::AppHandle, layout: &RuntimeLayout, port: u16) -> Option<Child> {
    let backend_launch = resolve_backend_launch(app, layout)?;

    println!("Runtime mode: {}", layout.mode.as_str());
    println!("App root: {:?}", layout.app_root);
    println!("Data root: {:?}", layout.data_root);
    println!("Logs root: {:?}", layout.logs_root);
    println!("Allocating backend to port: {}", port);

    let mut command = match backend_launch {
        BackendLaunch::UvProject { cwd, program, args } => {
            println!("Starting backend command: {} {}", program, args.join(" "));
            let mut command = Command::new(program);
            command.current_dir(cwd);
            command.args(args);
            command
        }
        BackendLaunch::Sidecar(path) => {
            if !path.exists() {
                eprintln!("Backend binary not found at: {:?}", path);
                return None;
            }
            println!("Starting backend from: {:?}", path);
            Command::new(path)
        }
    };

    for (key, value) in layout.backend_environment(port) {
        command.env(key, value);
    }

    match command.spawn() {
        Ok(child) => {
            println!("Backend started successfully (PID: {})", child.id());
            Some(child)
        }
        Err(err) => {
            eprintln!("Failed to start backend: {}", err);
            None
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .setup(|app| {
            let layout = resolve_runtime_layout();
            layout.ensure_directories()?;

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
