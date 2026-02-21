"""测试应用启动时自动初始化数据库"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from main import app
from core.db import get_session
from sqlalchemy import inspect
from core.logger import get_logger

logger = get_logger(__name__)


def test_auto_init():
    """测试自动初始化"""
    print("\n" + "=" * 60)
    print("测试应用启动时自动初始化数据库")
    print("=" * 60)
    
    # 创建测试客户端(会触发 lifespan)
    with TestClient(app) as client:
        # 检查数据库表
        session = next(get_session())
        inspector = inspect(session.bind)
        tables = inspector.get_table_names()
        session.close()
        
        print(f"\n现有表数量: {len(tables)}")
        print(f"表列表: {tables}")
        
        if len(tables) > 0:
            print("\n✅ 数据库自动初始化成功!")
            
            # 测试一个简单的 API 调用
            response = client.get("/api/v1/health")
            print(f"\n健康检查: {response.status_code}")
            print(f"响应: {response.json()}")
            
            return True
        else:
            print("\n❌ 数据库未自动初始化")
            return False
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    success = test_auto_init()
    sys.exit(0 if success else 1)
