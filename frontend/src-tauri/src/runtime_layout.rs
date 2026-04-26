use std::env;
use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const APP_DIR_NAME: &str = "ATRI-Chat";
const PORTABLE_MARKER: &str = "portable.mode";
const BINARIES_DIR_NAME: &str = "binaries";
const RESOURCES_DIR_NAME: &str = "resources";
pub const BACKEND_PORT_ENV: &str = "ATRI_BACKEND_PORT";
pub const RUNTIME_MODE_ENV: &str = "ATRI_RUNTIME_MODE";
pub const APP_ROOT_ENV: &str = "ATRI_APP_ROOT";
pub const DATA_ROOT_ENV: &str = "ATRI_DATA_ROOT";

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
}

impl RuntimeLayout {
    pub fn new(mode: RuntimeMode, app_root: PathBuf, data_root: PathBuf) -> Self {
        Self {
            mode,
            app_root: normalize_windows_path(app_root),
            data_root: normalize_windows_path(data_root),
        }
    }

    pub fn logs_dir(&self) -> PathBuf {
        self.data_root.join("logs")
    }

    pub fn ensure_data_root(&self) -> io::Result<()> {
        fs::create_dir_all(&self.data_root)
    }

    pub fn backend_environment(&self, port: u16) -> Vec<(&'static str, OsString)> {
        vec![
            (BACKEND_PORT_ENV, port.to_string().into()),
            (RUNTIME_MODE_ENV, self.mode.as_str().into()),
            (APP_ROOT_ENV, self.app_root.clone().into_os_string()),
            (DATA_ROOT_ENV, self.data_root.clone().into_os_string()),
        ]
    }
}

fn normalize_windows_path(path: PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        let raw = path.to_string_lossy();
        if let Some(stripped) = raw.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{}", stripped));
        }
        if let Some(stripped) = raw.strip_prefix(r"\\?\") {
            return PathBuf::from(stripped);
        }
    }

    path
}

pub fn resolve_runtime_layout() -> RuntimeLayout {
    if cfg!(debug_assertions) {
        let app_root = development_app_root();
        return RuntimeLayout::new(
            RuntimeMode::Development,
            app_root.clone(),
            app_root.join("data"),
        );
    }

    let app_root = packaged_app_root();
    let mode = detect_packaged_mode(&app_root);
    let local_data_root = local_appdata_root()
        .unwrap_or_else(|| app_root.clone())
        .join(APP_DIR_NAME);

    match mode {
        RuntimeMode::Installed => RuntimeLayout::new(mode, app_root, local_data_root.join("data")),
        RuntimeMode::Portable | RuntimeMode::Development => {
            RuntimeLayout::new(mode, app_root.clone(), app_root.join("data"))
        }
    }
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
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("..")
        })
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

    let parent = exe_dir
        .parent()
        .map(|dir| dir.to_path_buf())
        .unwrap_or(exe_dir);
    if parent.file_name().and_then(|name| name.to_str()) == Some(RESOURCES_DIR_NAME) {
        return parent
            .parent()
            .map(|dir| dir.to_path_buf())
            .unwrap_or(parent);
    }

    parent
}

fn local_appdata_root() -> Option<PathBuf> {
    env::var_os("LOCALAPPDATA").map(PathBuf::from)
}
