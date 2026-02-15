"""文件命名工具"""
import uuid
import re
from typing import Tuple
from core.logger import get_logger

logger = get_logger(__name__)


def generate_short_uuid() -> str:
    """生成8字符短UUID
    
    Returns:
        8字符的UUID字符串
    """
    return str(uuid.uuid4()).split('-')[0]


def slugify(text: str, max_length: int = 20) -> str:
    """转换为URL友好的slug
    
    Args:
        text: 原始文本（支持中文）
        max_length: 最大长度
        
    Returns:
        slug字符串（小写字母、数字、下划线）
        
    Examples:
        >>> slugify("伊落玛丽")
        'yiluo_mali'
        >>> slugify("Wave Hand!")
        'wave_hand'
    """
    # 尝试使用pypinyin转换中文（如果可用）
    try:
        from pypinyin import lazy_pinyin, Style
        # 转换中文为拼音（不带声调）
        pinyin_list = lazy_pinyin(text, style=Style.NORMAL)
        text = ''.join(pinyin_list)
    except ImportError:
        # 如果没有pypinyin，保留ASCII字符，移除其他字符
        logger.warning("pypinyin未安装，中文将被移除。建议: pip install pypinyin")
        text = text.encode('ascii', 'ignore').decode('ascii')
    
    # 转小写
    text = text.lower()
    # 移除特殊字符，只保留字母、数字、空格、连字符
    text = re.sub(r'[^\w\s-]', '', text)
    # 替换空格和连字符为下划线
    text = re.sub(r'[-\s]+', '_', text)
    # 移除首尾下划线
    text = text.strip('_')
    # 限制长度
    return text[:max_length] if text else 'unnamed'


def generate_vrm_model_filename(name: str) -> Tuple[str, str]:
    """生成VRM模型文件名
    
    Args:
        name: 模型名称
        
    Returns:
        (model_id, filename) 元组
        
    Examples:
        >>> generate_vrm_model_filename("伊落玛丽")
        ('vrm-a3f8b2c1', 'yiluo_mali_a3f8b2c1.vrm')
    """
    name_slug = slugify(name)
    short_id = generate_short_uuid()
    model_id = f"vrm-{short_id}"
    filename = f"{name_slug}_{short_id}.vrm"
    
    logger.debug(
        f"生成VRM模型文件名",
        extra={"name": name, "model_id": model_id, "filename": filename}
    )
    
    return model_id, filename


def generate_vrm_thumbnail_filename(name: str, short_id: str, extension: str) -> str:
    """生成VRM缩略图文件名（与模型文件同名）
    
    Args:
        name: 模型名称
        short_id: 短UUID（与模型文件相同）
        extension: 文件扩展名（包含点号，如 .jpg）
        
    Returns:
        缩略图文件名
        
    Examples:
        >>> generate_vrm_thumbnail_filename("伊落玛丽", "a3f8b2c1", ".jpg")
        'yiluo_mali_a3f8b2c1.jpg'
    """
    name_slug = slugify(name)
    filename = f"{name_slug}_{short_id}{extension}"
    return filename


def generate_animation_filename(name: str, extension: str) -> Tuple[str, str]:
    """生成动作文件名
    
    Args:
        name: 动作名称（英文ID）
        extension: 文件扩展名（包含点号，如 .vrma）
        
    Returns:
        (animation_id, filename) 元组
        
    Examples:
        >>> generate_animation_filename("wave_hand", ".vrma")
        ('anim-b4e9c3d2', 'wave_hand_b4e9c3d2.vrma')
    """
    name_slug = slugify(name)
    short_id = generate_short_uuid()
    animation_id = f"anim-{short_id}"
    filename = f"{name_slug}_{short_id}{extension}"
    
    logger.debug(
        f"生成动作文件名",
        extra={"name": name, "animation_id": animation_id, "filename": filename}
    )
    
    return animation_id, filename


def extract_short_id_from_model_id(model_id: str) -> str:
    """从模型ID提取短UUID
    
    Args:
        model_id: 模型ID（如 vrm-a3f8b2c1）
        
    Returns:
        短UUID（如 a3f8b2c1）
    """
    return model_id.replace('vrm-', '')


def extract_short_id_from_animation_id(animation_id: str) -> str:
    """从动作ID提取短UUID
    
    Args:
        animation_id: 动作ID（如 anim-b4e9c3d2）
        
    Returns:
        短UUID（如 b4e9c3d2）
    """
    return animation_id.replace('anim-', '')
