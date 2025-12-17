#!/usr/bin/env python3
"""
检查数据库表结构
"""
import sqlite3
from core.storage import AppStorage

def check_database_schema():
    """检查数据库表结构"""
    storage = AppStorage()
    
    with sqlite3.connect(storage.db_path) as conn:
        # 检查 vrm_animations 表结构
        cursor = conn.execute("PRAGMA table_info(vrm_animations)")
        columns = cursor.fetchall()
        
        print("=== vrm_animations 表结构 ===")
        for col in columns:
            print(f"列名: {col[1]}, 类型: {col[2]}, 非空: {col[3]}, 默认值: {col[4]}, 主键: {col[5]}")
        
        print("\n=== vrm_animations 表数据 ===")
        cursor = conn.execute("SELECT * FROM vrm_animations")
        rows = cursor.fetchall()
        for row in rows:
            print(row)
        
        print("\n=== vrm_model_animations 表数据 ===")
        cursor = conn.execute("SELECT * FROM vrm_model_animations")
        rows = cursor.fetchall()
        for row in rows:
            print(row)

if __name__ == "__main__":
    check_database_schema()