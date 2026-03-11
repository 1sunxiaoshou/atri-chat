// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::{Command, Child};
use std::sync::Mutex;
use std::path::PathBuf;
use std::fs;
use std::net::TcpListener;

struct BackendProcess(Mutex<Option<Child>>);

// 动态获取可用端口
fn get_available_port() -> u16 {
    // 首先尝试读取环境变量（如果有配置文件或手动注入）
    if let Ok(port_str) = std::env::var("BACKEND_PORT") {
        if let Ok(port) = port_str.parse::<u16>() {
            // 测试端口是否被占用
            if TcpListener::bind(("127.0.0.1", port)).is_ok() {
                return port;
            }
            println!("Port {} is occupied, resolving a random one...", port);
        }
    }
    
    // 如果没有指定或端口被占用，拿一个随机的空闲端口
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        // 定义可由前端调用的获取端口和基址的方法
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .setup(|app| {
            // 开机自动拿到一个端口并启动后端
            let backend_port = get_available_port();
            app.manage(BackendPortState(backend_port));

            let backend_process = start_backend(app, backend_port);
            app.manage(BackendProcess(Mutex::new(backend_process)));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // 关闭窗口时停止后端进程
                if let Some(backend) = window.app_handle().try_state::<BackendProcess>() {
                    if let Ok(mut process) = backend.0.lock() {
                        if let Some(mut child) = process.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            // 应用关闭或请求退出时，最后一次强制清理
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                if let Some(backend) = app_handle.try_state::<BackendProcess>() {
                    if let Ok(mut process) = backend.0.lock() {
                        if let Some(mut child) = process.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
            _ => {}
        });
}

struct BackendPortState(u16);

#[tauri::command]
fn get_backend_port(state: tauri::State<BackendPortState>) -> u16 {
    state.0
}

/// 强制使用可执行文件所在目录作为数据根目录
fn get_app_root_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.to_path_buf();
        }
    }
    // 降级方案
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn start_backend(app: &tauri::App, port: u16) -> Option<Child> {
    // 构建后端可执行文件名
    let backend_name = if cfg!(windows) {
        "atri-backend-x86_64-pc-windows-msvc.exe"
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "atri-backend-aarch64-apple-darwin"
        } else {
            "atri-backend-x86_64-apple-darwin"
        }
    } else {
        "atri-backend-x86_64-unknown-linux-gnu"
    };
    
    // 开发模式：从 src-tauri/binaries/ 读取
    // 生产模式：从资源目录读取
    let backend_path = if cfg!(debug_assertions) {
        // 开发模式
        let current_dir = std::env::current_dir().unwrap();
        current_dir.join("binaries").join(backend_name)
    } else {
        // 生产模式
        let resource_dir = match app.path().resource_dir() {
            Ok(path) => path,
            Err(e) => {
                eprintln!("Failed to get resource directory: {}", e);
                return None;
            }
        };
        resource_dir.join("binaries").join(backend_name)
    };
    
    println!("Starting backend from: {:?}", backend_path);
    
    if !backend_path.exists() {
        eprintln!("Backend binary not found at: {:?}", backend_path);
        return None;
    }
    
    // 获取同级应用数据目录
    let app_root = get_app_root_dir();
    let data_dir = app_root.join("data");
    let logs_dir = app_root.join("logs");
    
    // 确保目录存在
    let _ = fs::create_dir_all(&data_dir);
    let _ = fs::create_dir_all(&logs_dir);
    
    println!("Data directory: {:?}", data_dir);
    println!("Logs directory: {:?}", logs_dir);
    println!("Allocating backend to port: {}", port);
    
    // 启动后端进程，传递严格参数
    match Command::new(&backend_path)
        .env("BACKEND_PORT", port.to_string())
        .env("BASE_DIR", app_root.to_str().unwrap_or("."))
        .env("ENV", "production") // Tauri 打包的必然是生产环境行为
        .spawn()
    {
        Ok(child) => {
            println!("Backend started successfully (PID: {})", child.id());
            Some(child)
        }
        Err(e) => {
            eprintln!("Failed to start backend: {}", e);
            None
        }
    }
}
