// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::{Command, Child};
use std::sync::Mutex;
use std::path::PathBuf;
use std::fs;

struct BackendProcess(Mutex<Option<Child>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            // 开发和生产模式都自动启动后端
            let backend_process = start_backend(app);
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 检测是否为便携模式
/// 便携模式：可执行文件同目录下存在 portable.txt 文件
fn is_portable_mode() -> bool {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let portable_marker = exe_dir.join("portable.txt");
            return portable_marker.exists();
        }
    }
    false
}

/// 获取数据目录路径
fn get_data_directory(app: &tauri::App) -> PathBuf {
    if is_portable_mode() {
        // 便携模式：使用可执行文件同目录
        println!("Running in PORTABLE mode");
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let data_dir = exe_dir.join("data");
                // 确保目录存在
                let _ = fs::create_dir_all(&data_dir);
                return data_dir;
            }
        }
        // 降级方案
        PathBuf::from("./data")
    } else {
        // 标准模式：使用系统 AppData 目录
        println!("Running in STANDARD mode");
        match app.path().app_data_dir() {
            Ok(app_data) => {
                let data_dir = app_data.join("data");
                // 确保目录存在
                let _ = fs::create_dir_all(&data_dir);
                data_dir
            }
            Err(e) => {
                eprintln!("Failed to get app data directory: {}", e);
                PathBuf::from("./data")
            }
        }
    }
}

fn start_backend(app: &tauri::App) -> Option<Child> {
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
    
    // 检查文件是否存在
    if !backend_path.exists() {
        eprintln!("Backend binary not found at: {:?}", backend_path);
        eprintln!("Please run: uv run python build_and_copy_backend.py");
        return None;
    }
    
    // 获取数据目录
    let data_dir = get_data_directory(app);
    let logs_dir = data_dir.parent().unwrap_or(&data_dir).join("logs");
    
    // 确保日志目录存在
    let _ = fs::create_dir_all(&logs_dir);
    
    println!("Data directory: {:?}", data_dir);
    println!("Logs directory: {:?}", logs_dir);
    
    // 启动后端进程，传递数据目录路径
    match Command::new(&backend_path)
        .env("DATA_DIR", data_dir.to_str().unwrap_or("data"))
        .env("LOGS_DIR", logs_dir.to_str().unwrap_or("logs"))
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
