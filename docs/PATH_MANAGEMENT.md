# 路径管理说明

## 概述

项目使用统一的路径管理模块 `core/paths.py` 来管理所有文件和目录路径，避免硬编码路径，提高代码可维护性和跨平台兼容性。

## 核心特性

- **集中管理**：所有路径配置集中在一个模块
- **自动创建**：自动创建必要的目录
- **环境变量支持**：可通过 `.env` 文件配置路径
- **跨平台兼容**：自动处理 Windows/Linux 路径差异
- **路径规范化**：统一处理路径格式

## 使用方法

### 1. 获取路径管理器

```python
from core.paths import get_path_manager

path_manager = get_path_manager()
```

### 2. 访问常用目录

```python
# 项目根目录
root = path_manager.root

# 数据目录
data_dir = path_manager.data_dir

# 日志目录
logs_dir = path_manager.logs_dir

# 静态文件目录
static_dir = path_manager.static_dir

# 上传文件目录
uploads_dir = path_manager.uploads_dir

# 头像目录
avatars_dir = path_manager.avatars_dir

# ASR模型目录
asr_models_dir = path_manager.asr_models_dir

# 前端构建目录
frontend_dist = path_manager.frontend_dist
```

### 3. 访问数据库文件路径

```python
# 应用数据库
app_db = path_manager.app_db

# Store数据库
store_db = path_manager.store_db

# Checkpoints数据库
checkpoints_db = path_manager.checkpoints_db
```

### 4. 便捷函数

```python
from core.paths import (
    get_data_dir,
    get_logs_dir,
    get_uploads_dir,
    get_app_db_path,
    get_store_db_path,
    get_checkpoints_db_path
)

# 直接获取路径
data_dir = get_data_dir()
app_db_path = get_app_db_path()  # 返回字符串格式
```

### 5. 工具方法

```python
# 规范化路径（处理Windows反斜杠）
normalized = path_manager.normalize_path(r"C:\Users\path\to\file")

# 解析模型路径（支持相对路径）
model_path = path_manager.resolve_model_path("./asr_models/model_name")

# 获取相对路径
relative = path_manager.get_relative_path(some_absolute_path)
```

## 环境变量配置

在 `.env` 文件中可以自定义路径：

```env
# 路径配置（可选）
DATA_DIR=data
LOGS_DIR=logs
STATIC_DIR=static
UPLOADS_DIR=data/uploads
ASR_MODELS_DIR=asr_models
```

支持相对路径和绝对路径：
- 相对路径：相对于项目根目录
- 绝对路径：直接使用指定的路径

## 迁移指南

### 旧代码
```python
# 硬编码路径
db_path = "data/app.db"
uploads_dir = Path("data/uploads")
static_dir = Path(__file__).parent / "static"
```

### 新代码
```python
# 使用路径管理器
from core.paths import get_app_db_path, get_path_manager

db_path = get_app_db_path()
path_manager = get_path_manager()
uploads_dir = path_manager.uploads_dir
static_dir = path_manager.static_dir
```

## 最佳实践

1. **始终使用路径管理器**：不要在代码中硬编码路径
2. **使用属性访问**：优先使用 `path_manager.xxx_dir` 而不是字符串拼接
3. **数据库路径使用字符串**：数据库连接通常需要字符串格式，使用 `get_xxx_db_path()`
4. **临时文件使用系统临时目录**：使用 `tempfile` 模块，不要在项目目录创建临时文件
5. **配置文件路径**：使用 `path_manager.get_config_file("xxx.yaml")`

## 目录结构

```
project_root/
├── data/              # 数据目录
│   ├── app.db        # 应用数据库
│   ├── store.db      # Store数据库
│   ├── checkpoints.db # Checkpoints数据库
│   └── uploads/      # 上传文件
│       └── avatars/  # 头像文件
├── logs/             # 日志目录
├── static/           # 静态文件
├── asr_models/       # ASR模型
├── config/           # 配置文件
└── frontend/
    └── dist/         # 前端构建产物
```

## 注意事项

1. **循环导入**：`core/logger.py` 使用延迟导入避免循环依赖
2. **路径创建**：目录会在首次访问时自动创建
3. **Windows路径**：自动处理反斜杠，统一使用 `Path` 对象
4. **模型路径**：ASR/TTS模型路径支持相对和绝对路径，使用 `resolve_model_path()` 解析
