"""测试角色立绘字段的完整流程"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.db import get_session
from core.db.models import Character, Avatar, VoiceAsset
from core.logger import get_logger

logger = get_logger(__name__)


def test_character_portrait():
    """测试角色立绘字段"""
    session = next(get_session())
    
    try:
        # 1. 检查现有角色的 portrait_url 字段
        print("\n=== 检查现有角色 ===")
        characters = session.query(Character).all()
        print(f"角色总数: {len(characters)}")
        
        for char in characters:
            print(f"\n角色: {char.name}")
            print(f"  ID: {char.id}")
            print(f"  portrait_url: {char.portrait_url}")
            print(f"  avatar_id: {char.avatar_id}")
            print(f"  avatar_name: {char.avatar.name if char.avatar else 'N/A'}")
        
        # 2. 测试更新 portrait_url
        if characters:
            test_char = characters[0]
            print(f"\n=== 测试更新角色 '{test_char.name}' 的 portrait_url ===")
            
            old_portrait = test_char.portrait_url
            test_portrait_url = "https://example.com/test-portrait.png"
            
            test_char.portrait_url = test_portrait_url
            session.commit()
            session.refresh(test_char)
            
            print(f"旧值: {old_portrait}")
            print(f"新值: {test_char.portrait_url}")
            print("✅ 更新成功!")
            
            # 恢复原值
            test_char.portrait_url = old_portrait
            session.commit()
            print(f"已恢复原值: {test_char.portrait_url}")
        
        # 3. 验证数据库字段类型
        print("\n=== 验证数据库字段 ===")
        from sqlalchemy import inspect
        inspector = inspect(session.bind)
        columns = inspector.get_columns('characters')
        
        portrait_col = next((col for col in columns if col['name'] == 'portrait_url'), None)
        if portrait_col:
            print(f"✅ portrait_url 字段存在")
            print(f"   类型: {portrait_col['type']}")
            print(f"   可空: {portrait_col['nullable']}")
        else:
            print("❌ portrait_url 字段不存在")
        
        print("\n=== 测试完成 ===")
        
    except Exception as e:
        logger.error(f"测试失败: {e}", exc_info=True)
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    test_character_portrait()
