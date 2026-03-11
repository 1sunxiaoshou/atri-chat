"""文件上传路由 - 重构后版本"""
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from core.config import get_settings, AppSettings
from api.schemas import ResponseModel


router = APIRouter()

# 允许的图片格式 (常量)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}


def validate_image(file: UploadFile) -> None:
    """验证图片文件"""
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式。允许的格式: {', '.join(ALLOWED_EXTENSIONS)}"
        )


@router.post("/upload/portrait", response_model=ResponseModel)
async def upload_portrait(
    file: UploadFile = File(...),
    settings: AppSettings = Depends(get_settings)
):
    """上传角色立绘/头像 (2D图片)"""
    try:
        validate_image(file)
        
        # 1. 动态获取全站唯一的绝对路径
        images_dir = settings.images_dir
        
        # 2. 生成唯一文件名
        ext = Path(file.filename).suffix.lower()
        filename = f"{uuid.uuid4()}{ext}"
        file_path = images_dir / filename
        
        # 3. 保存文件
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 4. 返回访问 URL
        # 注意：前端可以通过 /static/images/{filename} 访问
        return {
            "code": 200,
            "message": "上传成功",
            "data": {
                "url": f"/static/images/{filename}",
                "filename": filename
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")
