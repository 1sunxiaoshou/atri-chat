# ATRI Chat 打包工具使用指南

## 快速开始

### 方式一：交互式菜单（推荐）

```bash
uv run build.py
```

然后根据菜单选择需要的操作。

### 方式二：命令行参数

```bash
# 打包完整版（标准版 + 便携版）
uv run build.py --all

# 只打包标准版（安装包）
uv run build.py --installer

# 只打包便携版
uv run build.py --portable

# 只打包后端
uv run build.py --backend

# 只构建前端
uv run build.py --frontend

# 清理构建文件
uv run build.py --clean

# 检查环境
uv run build.py --check
```

---

## 菜单选项说明

### 1. 只打包后端
- 使用 PyInstaller 打包 Python 后端
- 生成 `dist/atri-backend.exe`
- 自动复制到 `frontend/src-tauri/binaries/`
- 耗时：约 1-2 分钟

### 2. 只构建前端
- 使用 Vite 构建 React 前端
- 生成 `frontend/dist/`
- 耗时：约 30 秒

### 3. 打包标准版（安装包）
- 完整流程：后端 → 前端 → Tauri 安装包
- 生成 NSIS 安装程序
- 数据存储在系统 AppData 目录
- 耗时：约 5-10 分钟

### 4. 打包便携版
- 完整流程：后端 → 前端 → Tauri → 便携版打包
- 生成 ZIP 压缩包和文件夹
- 数据存储在应用程序目录
- 耗时：约 5-10 分钟

### 5. 打包完整版（标准版 + 便携版）
- 同时生成标准版和便携版
- 推荐用于正式发布
- 耗时：约 5-10 分钟

### 6. 清理构建文件
- 删除所有构建产物
- 包括：build/、dist/、portable_release/ 等
- 用于重新开始干净的构建

### 7. 检查环境
- 检查所需工具是否安装
- Python、uv、Node.js、npm、Rust

---

## 生成的文件

### 标准版
```
frontend/src-tauri/target/release/bundle/nsis/
└── ATRI Chat_1.0.0_x64-setup.exe  (约 100-120 MB)
```
- 数据位置：`%APPDATA%\com.atri.chat\data`
- 安装方式：标准 Windows 安装程序
- 适合：个人电脑长期使用

### 便携版
```
portable_release/                   (文件夹，可直接使用)
├── ATRI Chat.exe
├── binaries/
│   └── atri-backend-*.exe
├── portable.txt
└── README.txt

ATRI_Chat_v1.0.0_Portable.zip      (压缩包，约 90 MB)
```
- 数据位置：`.\data`（应用程序目录）
- 使用方式：解压即用
- 适合：U 盘携带、临时使用

---

## 开发模式

### 启动开发环境

```bash
cd frontend
npm run tauri:dev
```

- ✅ 自动启动前端开发服务器
- ✅ 自动启动 Tauri 窗口
- ✅ 自动启动后端进程
- ✅ 支持热重载

---

## 环境要求

### 开发环境
- Windows 10/11
- Python 3.12+
- Node.js 18+
- Rust 1.77+
- uv (Python 包管理器)

### 检查环境
```bash
uv run build.py --check
```

---

## 常见问题

### Q: 打包失败怎么办？
A: 
1. 先运行 `uv run build.py --check` 检查环境
2. 运行 `uv run build.py --clean` 清理旧文件
3. 重新打包

### Q: 如何只更新后端？
A: 
```bash
uv run build.py --backend
```

### Q: 标准版和便携版有什么区别？
A: 
- 标准版：安装到系统，数据在 `%APPDATA%`
- 便携版：解压即用，数据在应用程序目录

详见 `docs/便携版与标准版说明.md`

### Q: 打包需要多长时间？
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
