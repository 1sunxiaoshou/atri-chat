"""文件上传路由"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import uuid
import shutil
from core.paths import get_path_manager

router = APIRouter()

# 获取路径管理器
path_manager = get_path_manager()

# 上传目录配置
AVATAR_DIR = path_manager.avatars_dir

# 允许的图片格式
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}


def validate_image(file: UploadFile) -> None:
    """验证图片文件"""
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式。允许的格式: {', '.join(ALLOWED_EXTENSIONS)}"
        )


@router.post("/upload/avatar")
async def upload_avatar(file: UploadFile = File(...)):
    """上传角色头像"""
    try:
        validate_image(file)
        
        # 生成唯一文件名
        ext = Path(file.filename).suffix.lower()
        filename = f"{uuid.uuid4()}{ext}"
        file_path = AVATAR_DIR / filename
        
        # 保存文件
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 返回访问URL
        return {
            "code": 200,
            "message": "上传成功",
            "data": {
                "url": f"/uploads/avatars/{filename}",
                "filename": filename
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.get("/uploads/avatars/{filename}")
async def get_avatar(filename: str):
    """获取头像文件"""
    file_path = AVATAR_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(file_path)


@router.delete("/uploads/avatars/{filename}")
async def delete_avatar(filename: str):
    """删除头像文件"""
    file_path = AVATAR_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        file_path.unlink()
        return {
            "code": 200,
            "message": "删除成功",
            "data": {"filename": filename}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
