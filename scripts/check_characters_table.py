#!/usr/bin/env python3
"""检查 characters 表结构"""
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.db import get_engine
from sqlalchemy import inspect


def main():
    engine = get_engine()
    inspector = inspect(engine)
    
    print("\ncharacters 表字段:")
    print("-" * 80)
    
    cols = inspector.get_columns('characters')
    for col in cols:
        nullable = "NULL" if col["nullable"] else "NOT NULL"
        col_type = str(col["type"])
        print(f"  {col['name']:25} {col_type:20} {nullable}")
    
    print("\n外键:")
    print("-" * 80)
    fks = inspector.get_foreign_keys('characters')
    for fk in fks:
        constrained = ", ".join(fk["constrained_columns"])
        referred = f"{fk['referred_table']}.{', '.join(fk['referred_columns'])}"
        print(f"  {constrained:25} -> {referred}")


if __name__ == "__main__":
    main()
