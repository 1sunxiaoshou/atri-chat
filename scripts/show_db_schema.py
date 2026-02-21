#!/usr/bin/env python3
"""显示数据库表结构"""
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.db import get_engine
from sqlalchemy import inspect


def main():
    """显示数据库结构"""
    engine = get_engine()
    inspector = inspect(engine)
    
    print("\n" + "=" * 80)
    print("数据库表结构")
    print("=" * 80)
    
    for table_name in sorted(inspector.get_table_names()):
        print(f"\n表名: {table_name}")
        print("-" * 80)
        
        # 列信息
        columns = inspector.get_columns(table_name)
        print("\n字段:")
        for col in columns:
            nullable = "NULL" if col["nullable"] else "NOT NULL"
            col_type = str(col["type"])
            default = f" DEFAULT {col['default']}" if col.get("default") else ""
            pk = " 🔑 PRIMARY KEY" if col.get("primary_key") else ""
            
            print(f"  • {col['name']:30} {col_type:20} {nullable:10}{default}{pk}")
        
        # 外键
        fks = inspector.get_foreign_keys(table_name)
        if fks:
            print("\n外键:")
            for fk in fks:
                constrained = ", ".join(fk["constrained_columns"])
                referred = f"{fk['referred_table']}.{', '.join(fk['referred_columns'])}"
                on_delete = fk.get("ondelete", "NO ACTION")
                print(f"  • {constrained:30} -> {referred:40} ON DELETE {on_delete}")
        
        # 索引
        indexes = inspector.get_indexes(table_name)
        if indexes:
            print("\n索引:")
            for idx in indexes:
                unique = "UNIQUE" if idx["unique"] else "INDEX"
                columns = ", ".join(idx["column_names"])
                print(f"  • {idx['name']:40} {unique:10} ({columns})")
    
    print("\n" + "=" * 80)
    print(f"总计: {len(inspector.get_table_names())} 个表")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
