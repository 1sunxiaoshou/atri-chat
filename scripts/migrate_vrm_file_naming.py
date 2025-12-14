"""迁移VRM文件命名方案
将旧的UUID命名迁移到新的"名称_短UUID"命名方案
"""
import sqlite3
import shutil
from pathlib import Path
import sys

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.utils.file_naming import (
    slugify,
    extract_short_id_from_model_id,
    extract_short_id_from_animation_id,
)
from core.logger import get_logger

logger = get_logger(__name__, category="MIGRATION")


def migrate_vrm_models():
    """迁移VRM模型文件命名"""
    db_path = Path('data/app.db')
    uploads_dir = Path('data/uploads')
    
    conn = sqlite3.connect(db_path)
    cursor = conn.execute('SELECT vrm_model_id, name, model_path, thumbnail_path FROM vrm_models')
    models = cursor.fetchall()
    
    print(f"\n{'='*60}")
    print(f"开始迁移VRM模型文件命名")
    print(f"{'='*60}")
    print(f"找到 {len(models)} 个模型\n")
    
    migrated_count = 0
    skipped_count = 0
    error_count = 0
    
    for vrm_model_id, name, model_path, thumbnail_path in models:
        print(f"\n处理模型: {name} ({vrm_model_id})")
        
        try:
            # 提取短UUID
            short_id = extract_short_id_from_model_id(vrm_model_id)
            name_slug = slugify(name)
            
            # 新文件名
            new_model_filename = f"{name_slug}_{short_id}.vrm"
            new_model_path = f"/uploads/vrm_models/{new_model_filename}"
            
            # 旧文件路径（Windows路径处理）
            old_model_file = uploads_dir.parent / model_path.lstrip('/').replace('/', '\\')
            new_model_file = uploads_dir / 'vrm_models' / new_model_filename
            
            # 检查旧文件是否存在
            if not old_model_file.exists():
                print(f"  ⚠️  模型文件不存在，跳过: {old_model_file}")
                skipped_count += 1
                continue
            
            # 检查是否已经是新命名格式
            if old_model_file.name == new_model_filename:
                print(f"  ✓ 已经是新格式，跳过")
                skipped_count += 1
                continue
            
            # 重命名模型文件
            print(f"  重命名模型: {old_model_file.name} -> {new_model_filename}")
            shutil.move(str(old_model_file), str(new_model_file))
            
            # 处理缩略图
            new_thumbnail_path = None
            if thumbnail_path:
                old_thumbnail_file = uploads_dir.parent / thumbnail_path.lstrip('/').replace('/', '\\')
                if old_thumbnail_file.exists():
                    thumbnail_ext = old_thumbnail_file.suffix
                    new_thumbnail_filename = f"{name_slug}_{short_id}{thumbnail_ext}"
                    new_thumbnail_file = uploads_dir / 'vrm_thumbnails' / new_thumbnail_filename
                    new_thumbnail_path = f"/uploads/vrm_thumbnails/{new_thumbnail_filename}"
                    
                    # 检查是否已经是新命名格式
                    if old_thumbnail_file.name != new_thumbnail_filename:
                        print(f"  重命名缩略图: {old_thumbnail_file.name} -> {new_thumbnail_filename}")
                        shutil.move(str(old_thumbnail_file), str(new_thumbnail_file))
                    else:
                        new_thumbnail_path = thumbnail_path
                else:
                    print(f"  ⚠️  缩略图文件不存在: {old_thumbnail_file}")
            
            # 更新数据库
            conn.execute(
                "UPDATE vrm_models SET model_path = ?, thumbnail_path = ? WHERE vrm_model_id = ?",
                (new_model_path, new_thumbnail_path, vrm_model_id)
            )
            conn.commit()
            
            print(f"  ✓ 迁移成功")
            migrated_count += 1
            
        except Exception as e:
            print(f"  ✗ 迁移失败: {e}")
            error_count += 1
            logger.error(f"迁移模型失败", extra={"vrm_model_id": vrm_model_id, "error": str(e)}, exc_info=True)
    
    conn.close()
    
    print(f"\n{'='*60}")
    print(f"VRM模型迁移完成")
    print(f"  成功: {migrated_count}")
    print(f"  跳过: {skipped_count}")
    print(f"  失败: {error_count}")
    print(f"{'='*60}\n")
    
    return migrated_count, skipped_count, error_count


def migrate_vrm_animations():
    """迁移VRM动作文件命名"""
    db_path = Path('data/app.db')
    uploads_dir = Path('data/uploads')
    
    conn = sqlite3.connect(db_path)
    cursor = conn.execute('SELECT animation_id, name FROM vrm_animations')
    animations = cursor.fetchall()
    
    print(f"\n{'='*60}")
    print(f"开始迁移VRM动作文件命名")
    print(f"{'='*60}")
    print(f"找到 {len(animations)} 个动作\n")
    
    migrated_count = 0
    skipped_count = 0
    error_count = 0
    
    animations_dir = uploads_dir / 'vrm_animations'
    if not animations_dir.exists():
        print("  动作目录不存在，跳过迁移")
        conn.close()
        return 0, 0, 0
    
    for animation_id, name in animations:
        print(f"\n处理动作: {name} ({animation_id})")
        
        try:
            # 提取短UUID
            short_id = extract_short_id_from_animation_id(animation_id)
            name_slug = slugify(name)
            
            # 查找旧文件（可能是 .fbx 或 .bvh）
            old_files = list(animations_dir.glob(f"{name}.*"))
            
            if not old_files:
                print(f"  ⚠️  动作文件不存在，跳过")
                skipped_count += 1
                continue
            
            old_file = old_files[0]
            file_ext = old_file.suffix
            
            # 新文件名
            new_filename = f"{name_slug}_{short_id}{file_ext}"
            new_file = animations_dir / new_filename
            
            # 检查是否已经是新命名格式
            if old_file.name == new_filename:
                print(f"  ✓ 已经是新格式，跳过")
                skipped_count += 1
                continue
            
            # 重命名文件
            print(f"  重命名: {old_file.name} -> {new_filename}")
            shutil.move(str(old_file), str(new_file))
            
            print(f"  ✓ 迁移成功")
            migrated_count += 1
            
        except Exception as e:
            print(f"  ✗ 迁移失败: {e}")
            error_count += 1
            logger.error(f"迁移动作失败", extra={"animation_id": animation_id, "error": str(e)}, exc_info=True)
    
    conn.close()
    
    print(f"\n{'='*60}")
    print(f"VRM动作迁移完成")
    print(f"  成功: {migrated_count}")
    print(f"  跳过: {skipped_count}")
    print(f"  失败: {error_count}")
    print(f"{'='*60}\n")
    
    return migrated_count, skipped_count, error_count


def main():
    """主函数"""
    print("\n" + "="*60)
    print("VRM文件命名迁移工具")
    print("="*60)
    print("\n此工具会将旧的UUID命名迁移到新的'名称_短UUID'格式")
    print("例如: vrm-d934bd8c-1fc4-4ce2-a8cf-cc2dde998f81.vrm")
    print("  -> yiluo_mali_d934bd8c.vrm\n")
    
    response = input("是否继续? (yes/no): ")
    if response.lower() != 'yes':
        print("取消迁移")
        return
    
    # 迁移模型
    model_migrated, model_skipped, model_errors = migrate_vrm_models()
    
    # 迁移动作
    anim_migrated, anim_skipped, anim_errors = migrate_vrm_animations()
    
    # 总结
    print("\n" + "="*60)
    print("迁移总结")
    print("="*60)
    print(f"模型: {model_migrated} 成功, {model_skipped} 跳过, {model_errors} 失败")
    print(f"动作: {anim_migrated} 成功, {anim_skipped} 跳过, {anim_errors} 失败")
    print(f"总计: {model_migrated + anim_migrated} 成功, {model_skipped + anim_skipped} 跳过, {model_errors + anim_errors} 失败")
    print("="*60 + "\n")
    
    if model_errors + anim_errors > 0:
        print("⚠️  部分文件迁移失败，请检查日志")
    else:
        print("✓ 所有文件迁移成功！")


if __name__ == '__main__':
    main()
