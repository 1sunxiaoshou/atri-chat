#!/usr/bin/env python3
"""检查数据库表结构"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import sqlite3
from core.paths import get_path_manager

def main():
    """检查数据库表"""
    path_manager = get_path_manager()
    db_path = path_manager.data_dir / "app.db"
    
    print(f"数据库路径: {db_path}\n")
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # 获取所有表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = cursor.fetchall()
    
    print(f"共有 {len(tables)} 个表:\n")
    
    for (table_name,) in tables:
        print(f"📋 {table_name}")
        
        # 获取表结构
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        
        for col in columns:
            col_id, name, type_, notnull, default, pk = col
            pk_str = " [PK]" if pk else ""
            null_str = " NOT NULL" if notnull else ""
            default_str = f" DEFAULT {default}" if default else ""
            print(f"  - {name}: {type_}{pk_str}{null_str}{default_str}")
        
        print()
    
    conn.close()

if __name__ == "__main__":
    main()
