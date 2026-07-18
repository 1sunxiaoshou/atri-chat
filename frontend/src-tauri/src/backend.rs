use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::Manager;

use crate::runtime_layout::{RuntimeLayout, BACKEND_PORT_ENV};

const BINARIES_DIR_NAME: &str = "binaries";

pub struct BackendProcess(pub Mutex<Option<Child>>);
pub struct BackendPortState(pub u16);

#[derive(Clone, Debug)]
enum BackendLaunch {
    UvProject {
        cwd: PathBuf,
        program: &'static str,
        args: Vec<&'static str>,
    },
    Sidecar(PathBuf),
}

pub fn get_available_port() -> u16 {
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

pub fn start_backend(app: &tauri::AppHandle, layout: &RuntimeLayout, port: u16) -> Option<Child> {
    let backend_launch = resolve_backend_launch(app, layout)?;

    println!("Runtime mode: {}", layout.mode.as_str());
    println!("App root: {:?}", layout.app_root);
    println!("Data root: {:?}", layout.data_root);
    println!("Logs dir: {:?}", layout.logs_dir());
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
        Ok(mut child) => {
            println!("Backend started successfully (PID: {})", child.id());

            if wait_for_backend_ready(port, Duration::from_secs(45)) {
                return Some(child);
            }

            eprintln!(
                "Backend failed to become healthy within the startup timeout on port {}",
                port
            );
            let _ = child.kill();
            None
        }
        Err(err) => {
            eprintln!("Failed to start backend: {}", err);
            None
        }
    }
}

pub fn stop_backend(app_handle: &tauri::AppHandle) {
    if let Some(backend) = app_handle.try_state::<BackendProcess>() {
        if let Ok(mut process) = backend.0.lock() {
            if let Some(mut child) = process.take() {
                let _ = child.kill();
            }
        }
    }
}

fn resolve_backend_launch(app: &tauri::AppHandle, layout: &RuntimeLayout) -> Option<BackendLaunch> {
    if cfg!(debug_assertions) {
        return Some(BackendLaunch::UvProject {
            cwd: layout.app_root.clone(),
            program: "uv",
            args: vec!["run", "python", "main.py"],
        });
    }

    resolve_backend_path(app).map(BackendLaunch::Sidecar)
}

fn resolve_backend_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let backend_name = backend_binary_name();

    if cfg!(debug_assertions) {
        return Some(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join(BINARIES_DIR_NAME)
                .join(backend_name),
        );
    }

    let resource_dir = app.path().resource_dir().ok()?;
    Some(resource_dir.join(BINARIES_DIR_NAME).join(backend_name))
}

fn is_backend_healthy(port: u16) -> bool {
    let mut stream = match TcpStream::connect(("127.0.0.1", port)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };

    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));

    if stream
        .write_all(b"GET /api/v1/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        return false;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }

    response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200")
}

fn wait_for_backend_ready(port: u16, timeout: Duration) -> bool {
    let start = Instant::now();

    while start.elapsed() < timeout {
        if is_backend_healthy(port) {
            println!("Backend health check passed on port {}", port);
            return true;
        }

        std::thread::sleep(Duration::from_millis(250));
    }

    false
}

fn backend_binary_name() -> &'static str {
    if cfg!(windows) {
        "atri-backend-x86_64-pc-windows-msvc.exe"
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "atri-backend-aarch64-apple-darwin"
        } else {
            "atri-backend-x86_64-apple-darwin"
        }
    } else {
        "atri-backend-x86_64-unknown-linux-gnu"
    }
}
