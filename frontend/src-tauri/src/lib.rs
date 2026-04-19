mod runtime;

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::Manager;

use runtime::{resolve_backend_path, resolve_runtime_layout, RuntimeLayout};

struct BackendProcess(Mutex<Option<Child>>);
struct BackendPortState(u16);

const BACKEND_HEALTH_PATH: &str = "/api/v1/health";
const BACKEND_STARTUP_TIMEOUT: Duration = Duration::from_secs(20);
const BACKEND_RETRY_INTERVAL: Duration = Duration::from_millis(250);

#[tauri::command]
fn get_backend_port(state: tauri::State<BackendPortState>) -> u16 {
    state.0
}

fn get_available_port() -> u16 {
    if let Ok(port_str) = std::env::var("ATRI_BACKEND_PORT") {
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

fn stop_backend_child(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

fn start_backend(app: &tauri::AppHandle, layout: &RuntimeLayout, port: u16) -> Option<Child> {
    let backend_path = resolve_backend_path(app)?;
    if !backend_path.exists() {
        eprintln!("Backend binary not found at: {:?}", backend_path);
        return None;
    }

    println!("Starting backend from: {:?}", backend_path);
    println!("Runtime mode: {}", layout.mode.as_str());
    println!("App root: {:?}", layout.app_root);
    println!("Data root: {:?}", layout.data_root);
    println!("Logs root: {:?}", layout.logs_root);
    println!("Allocating backend to port: {}", port);

    match Command::new(&backend_path)
        .env("ATRI_BACKEND_PORT", port.to_string())
        .spawn()
    {
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

fn wait_for_backend_ready(port: u16, child: &mut Child) -> Result<(), String> {
    let deadline = Instant::now() + BACKEND_STARTUP_TIMEOUT;

    while Instant::now() < deadline {
        if let Ok(Some(status)) = child.try_wait() {
            return Err(format!("后端进程提前退出，退出码: {}", status));
        }

        match probe_backend_health(port) {
            Ok(true) => return Ok(()),
            Ok(false) => {}
            Err(err) => {
                eprintln!("Backend health probe failed: {}", err);
            }
        }

        std::thread::sleep(BACKEND_RETRY_INTERVAL);
    }

    Err(format!(
        "后端在 {} 秒内未通过健康检查",
        BACKEND_STARTUP_TIMEOUT.as_secs()
    ))
}

fn probe_backend_health(port: u16) -> Result<bool, String> {
    let addr: SocketAddr = format!("127.0.0.1:{port}")
        .parse()
        .map_err(|err| format!("无法解析健康检查地址: {err}"))?;

    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(500))
        .map_err(|err| format!("无法连接后端: {err}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(1)))
        .map_err(|err| format!("设置读取超时失败: {err}"))?;
    stream
        .set_write_timeout(Some(Duration::from_secs(1)))
        .map_err(|err| format!("设置写入超时失败: {err}"))?;

    let request = format!(
        "GET {} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        BACKEND_HEALTH_PATH, port
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|err| format!("发送健康检查请求失败: {err}"))?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|err| format!("读取健康检查响应失败: {err}"))?;

    Ok(response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200"))
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

            let mut backend_process = start_backend(&app.handle(), &layout, backend_port)
                .ok_or_else(|| "后端进程启动失败".to_string())?;

            if let Err(err) = wait_for_backend_ready(backend_port, &mut backend_process) {
                stop_backend_child(&mut backend_process);
                return Err(err.into());
            }

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
