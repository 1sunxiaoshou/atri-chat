use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use tauri::Manager;

const APP_DIR_NAME: &str = "ATRI-Chat";
const PORTABLE_MARKER: &str = "portable.mode";
const BINARIES_DIR_NAME: &str = "binaries";
const RESOURCES_DIR_NAME: &str = "resources";

#[derive(Clone, Copy, Debug)]
pub enum RuntimeMode {
    Development,
    Installed,
    Portable,
}

impl RuntimeMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Development => "development",
            Self::Installed => "installed",
            Self::Portable => "portable",
        }
    }
}

#[derive(Clone, Debug)]
pub struct RuntimeLayout {
    pub mode: RuntimeMode,
    pub app_root: PathBuf,
    pub data_root: PathBuf,
    pub logs_root: PathBuf,
}

impl RuntimeLayout {
    pub fn ensure_directories(&self) -> io::Result<()> {
        fs::create_dir_all(&self.data_root)?;
        fs::create_dir_all(&self.logs_root)?;
        Ok(())
    }
}

pub fn resolve_runtime_layout() -> RuntimeLayout {
    if cfg!(debug_assertions) {
        let app_root = development_app_root();
        return RuntimeLayout {
            mode: RuntimeMode::Development,
            data_root: app_root.join("data"),
            logs_root: app_root.join("data").join("logs"),
            app_root,
        };
    }

    let app_root = packaged_app_root();
    let mode = detect_packaged_mode(&app_root);
    let local_data_root = local_appdata_root()
        .unwrap_or_else(|| app_root.clone())
        .join(APP_DIR_NAME);

    match mode {
        RuntimeMode::Installed => RuntimeLayout {
            mode,
            data_root: local_data_root.join("data"),
            logs_root: local_data_root.join("logs"),
            app_root,
        },
        RuntimeMode::Portable => RuntimeLayout {
            mode,
            data_root: app_root.join("data"),
            logs_root: app_root.join("data").join("logs"),
            app_root,
        },
        RuntimeMode::Development => RuntimeLayout {
            mode,
            data_root: app_root.join("data"),
            logs_root: app_root.join("data").join("logs"),
            app_root,
        },
    }
}

pub fn resolve_backend_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let backend_name = backend_binary_name();

    if cfg!(debug_assertions) {
        return Some(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries").join(backend_name));
    }

    let resource_dir = app.path().resource_dir().ok()?;
    Some(resource_dir.join("binaries").join(backend_name))
}

fn detect_packaged_mode(app_root: &Path) -> RuntimeMode {
    if app_root.join(PORTABLE_MARKER).exists() {
        RuntimeMode::Portable
    } else {
        RuntimeMode::Installed
    }
}

fn development_app_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join(".."))
}

fn packaged_app_root() -> PathBuf {
    env::current_exe()
        .ok()
        .map(|path| resolve_app_root_from_executable(&path))
        .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn resolve_app_root_from_executable(executable: &Path) -> PathBuf {
    let exe_dir = executable
        .parent()
        .map(|dir| dir.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));

    if exe_dir.file_name().and_then(|name| name.to_str()) != Some(BINARIES_DIR_NAME) {
        return exe_dir;
    }

    let parent = exe_dir.parent().map(|dir| dir.to_path_buf()).unwrap_or(exe_dir);
    if parent.file_name().and_then(|name| name.to_str()) == Some(RESOURCES_DIR_NAME) {
        return parent.parent().map(|dir| dir.to_path_buf()).unwrap_or(parent);
    }

    parent
}

fn local_appdata_root() -> Option<PathBuf> {
    env::var_os("LOCALAPPDATA").map(PathBuf::from)
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
