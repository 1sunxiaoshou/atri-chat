"""测试立绘文件清理功能"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.db import get_session
from core.db.models import Character
from core.paths import get_path_manager
from core.logger import get_logger

logger = get_logger(__name__)


def test_portrait_cleanup():
    """测试立绘文件清理功能"""
    session = next(get_session())
    path_manager = get_path_manager()
    
    try:
        print("\n" + "=" * 60)
        print("立绘文件清理功能测试")
        print("=" * 60)
        
        # 1. 检查现有角色的立绘
        print("\n=== 1. 检查现有角色 ===")
        characters = session.query(Character).all()
        print(f"角色总数: {len(characters)}")
        
        portrait_usage = {}
        for char in characters:
            if char.portrait_url:
                if char.portrait_url not in portrait_usage:
                    portrait_usage[char.portrait_url] = []
                portrait_usage[char.portrait_url].append(char.name)
        
        print(f"\n立绘使用情况:")
        for url, users in portrait_usage.items():
            print(f"  {url}")
            print(f"    使用者: {', '.join(users)} (共 {len(users)} 个)")
        
        # 2. 检查文件系统中的立绘文件
        print("\n=== 2. 检查文件系统 ===")
        avatars_dir = path_manager.avatars_dir
        if avatars_dir.exists():
            files = list(avatars_dir.glob("*"))
            print(f"立绘文件总数: {len(files)}")
            
            # 检查孤儿文件
            orphan_files = []
            for file in files:
                file_url = f"/uploads/avatars/{file.name}"
                if file_url not in portrait_usage:
                    orphan_files.append(file.name)
            
            if orphan_files:
                print(f"\n⚠️  发现 {len(orphan_files)} 个孤儿文件:")
                for filename in orphan_files[:10]:  # 只显示前10个
                    print(f"  - {filename}")
                if len(orphan_files) > 10:
                    print(f"  ... 还有 {len(orphan_files) - 10} 个")
            else:
                print("✅ 没有孤儿文件")
        else:
            print("⚠️  立绘目录不存在")
        
        # 3. 模拟删除场景
        print("\n=== 3. 删除场景模拟 ===")
        if characters:
            test_char = characters[0]
            portrait_url = test_char.portrait_url
            
            if portrait_url:
                # 检查是否有其他角色使用相同的立绘
                other_users = session.query(Character).filter(
                    Character.portrait_url == portrait_url,
                    Character.id != test_char.id
                ).count()
                
                print(f"角色: {test_char.name}")
                print(f"立绘: {portrait_url}")
                print(f"其他使用者: {other_users} 个")
                
                if other_users == 0:
                    print("✅ 删除此角色时,立绘文件会被清理")
                else:
                    print("⚠️  删除此角色时,立绘文件会被保留(被其他角色使用)")
            else:
                print(f"角色 '{test_char.name}' 没有设置立绘")
        
        # 4. 更新场景模拟
        print("\n=== 4. 更新场景模拟 ===")
        if characters:
            test_char = characters[0]
            old_portrait = test_char.portrait_url
            new_portrait = "/uploads/avatars/new-portrait.jpg"
            
            print(f"角色: {test_char.name}")
            print(f"旧立绘: {old_portrait}")
            print(f"新立绘: {new_portrait}")
            
            if old_portrait:
                # 检查是否有其他角色使用相同的立绘
                other_users = session.query(Character).filter(
                    Character.portrait_url == old_portrait,
                    Character.id != test_char.id
                ).count()
                
                if other_users == 0:
                    print("✅ 更新立绘时,旧文件会被清理")
                else:
                    print(f"⚠️  更新立绘时,旧文件会被保留(被 {other_users} 个其他角色使用)")
        
        print("\n" + "=" * 60)
        print("测试完成")
        print("=" * 60)
        
    except Exception as e:
        logger.error(f"测试失败: {e}", exc_info=True)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    test_portrait_cleanup()
