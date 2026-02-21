#!/usr/bin/env python3
"""初始化数据库脚本"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.db import init_db
from core.logger import get_logger

logger = get_logger(__name__)


def main():
    """初始化数据库"""
    try:
        logger.info("开始初始化数据库...")
        init_db()
        logger.success("✓ 数据库初始化完成！")
        
    except Exception as e:
        logger.error(f"✗ 数据库初始化失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
