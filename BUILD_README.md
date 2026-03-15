# ATRI Chat 打包工具使用指南

## 快速开始

### 方式一：交互式菜单（推荐）

直接运行脚本，按照提示输入版本号及选择模式：

```bash
uv run build.py
```

### 方式二：命令行参数

适用于 CI/CD 或自动化脚本：

```bash
# 执行完整流水线（默认生成安装包和便携版）
uv run build.py --format all

# 指定版本号打包
uv run build.py --format all --app-version 1.1.0

# 仅打包安装程序 (Setup.exe)
uv run build.py --format installer

# 仅打包便携版 (Portable.zip)
uv run build.py --format portable

# 快速更新后端 (仅打包后端并复制到 Sidecar)
uv run build.py --only-backend

# 清理构建缓存及产物
uv run build.py --clean
```

---

## 主要功能说明

### 1. 自动读取版本号
脚本会默认尝试从根目录的 `pyproject.toml` 中读取 `version` 字段。您可以通过命令行 `--app-version` 或菜单交互手动覆盖。

### 2. 后端 Sidecar 打包
- 使用 PyInstaller 将 Python 后端代码极致压缩为单文件。
- 自动处理重命名并放置到 `frontend/src-tauri/binaries/` 下，供 Tauri 调用。

### 3. 便携版 (Portable)
- **命名格式**：`AtriChat_{version}_Portable.zip`
- **特性**：解压即用，所有数据（数据库、离线模型、配置）均存储在程序同级目录，实现真正的一键热迁移。

### 4. 安装程序 (Installer)
- **命名格式**：`AtriChat_{version}_Setup.exe`
- **特性**：标准的 Windows 安装向导，适合在个人电脑上长期安装使用。

---

## 构建产出

打包完成后，所有文件将存放在根目录的 `release_package/` 文件夹中：

| 文件名 | 类型 | 适用场景 |
| :--- | :--- | :--- |
| `AtriChat_1.0.1_Setup.exe` | 安装包 | 快速安装到系统，支持开始菜单、卸载等管理。 |
| `AtriChat_1.0.1_Portable.zip` | 压缩包 | 绿色免安装，适合存放在 U 盘或快速迁移数据。 |

---

## 常见问题

### Q: 打包前需要修改哪些版本号？
A: 虽然 `build.py` 支持指定版本，但为了保持一致性，建议在正式发布前统一修改：
- `pyproject.toml` (后端版本) -> **脚本默认读取此处**
- `frontend/package.json` (前端版本)
- `frontend/src-tauri/tauri.conf.json` (Tauri 定义的版本)

### Q: 后端更新后需要重新打全量包吗？
A: 如果只是后端代码改动，可以运行 `python build.py --only-backend`。这会更新 `Sidecar` 文件。如果您运行的是开发模式，Tauri 会自动调用新的 Sidecar。

### Q: 构建速度慢？
A: 首次构建由于需要下载 Rust 编译环境及 Node 依赖会较慢。后续构建开启了增量编译，速度会有明显提升。建议定期运行 `--clean` 以解决某些由于缓存引起的诡异报错。

A: 
- 只打包后端：1-2 分钟
- 只构建前端：30 秒
- 完整打包：5-10 分钟（首次可能更久）

### Q: 可以在打包过程中中断吗？
A: 可以按 `Ctrl+C` 中断，但建议让它完成。

### Q: 如何更新版本号？
A: 修改以下文件中的版本号：
- `frontend/package.json`
- `frontend/src-tauri/tauri.conf.json`
- `frontend/src-tauri/Cargo.toml`

### Q: 如何减小安装包大小？
A: 
1. 使用 UPX 压缩后端：
```bash
upx --best dist/atri-backend.exe
```
可减小 30-50% 体积

2. 优化前端构建（代码分割、Tree shaking）

---

## 配置说明

### 应用信息

在 `frontend/src-tauri/tauri.conf.json` 中配置：

```json
{
  "productName": "ATRI Chat",
  "version": "1.0.0",
  "identifier": "com.atri.chat"
}
```

### 打包目标

当前使用 NSIS（Windows 安装包）：

```json
{
  "bundle": {
    "targets": ["nsis"]
  }
}
```

如果需要 MSI，改为 `["msi"]`（需要 WiX 工具）。

---

## 分发建议

### GitHub Releases

1. 创建标签：
```bash
git tag v1.0.0
git push origin v1.0.0
```

2. 在 GitHub 创建 Release，上传：
   - `ATRI Chat_1.0.0_x64-setup.exe` (标准版)
   - `ATRI_Chat_v1.0.0_Portable.zip` (便携版)

### 下载页面说明示例

```markdown
## 下载

### 标准版（推荐）
- 文件：ATRI_Chat_v1.0.0_Setup.exe
- 大小：约 100 MB
- 适合：个人电脑长期使用
- 安装后可通过开始菜单启动

### 便携版
- 文件：ATRI_Chat_v1.0.0_Portable.zip
- 大小：约 90 MB
- 适合：U 盘携带、临时使用
- 解压后双击 ATRI Chat.exe 即可运行
```

---

## 打包内容

### 会打包的内容
- ✅ 前端构建产物（HTML/CSS/JS）
- ✅ 后端可执行文件（77MB）
- ✅ 应用图标
- ✅ Tauri 运行时

### 不会打包的内容
- ❌ 源代码
- ❌ `node_modules/`
- ❌ `.venv/`
- ❌ `data/` 数据库（运行时创建）
- ❌ ASR 模型（太大，首次运行时下载）

---

## 手动打包步骤（不推荐）

如果需要手动控制每个步骤：

### 1. 打包后端
```bash
uv run pyinstaller atri-backend.spec
```

### 2. 复制后端到 Tauri
```bash
copy dist\atri-backend.exe frontend\src-tauri\binaries\atri-backend-x86_64-pc-windows-msvc.exe
```

### 3. 构建 Tauri
```bash
cd frontend
npm run tauri:build
```

---

## 需要帮助？

- 查看 [Tauri 官方文档](https://tauri.app/)
- 查看 [PyInstaller 文档](https://pyinstaller.org/)
- 查看 `docs/便携版与标准版说明.md` 了解版本差异
- 查看 `MIGRATION.md` 了解从旧脚本迁移
- 提交 [GitHub Issue](https://github.com/1sunxiaoshou/atri-chat/issues)
