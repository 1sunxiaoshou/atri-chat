"""Add turn-scoped message projection fields.

Revision ID: 20260426_0001
Revises:
Create Date: 2026-04-26 00:00:00+00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260426_0001"
down_revision = None
branch_labels = None
depends_on = None


MESSAGE_TABLE = "messages"
INDEX_DEFINITIONS = {
    "ix_messages_turn_id": (False, ["turn_id"]),
    "ix_messages_lc_message_id": (False, ["lc_message_id"]),
    "ix_messages_tool_call_id": (False, ["tool_call_id"]),
    "uq_messages_conversation_lc_message": (
        True,
        ["conversation_id", "lc_message_id"],
    ),
}


def _table_names() -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return set(inspector.get_table_names())


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes(table_name)}
    indexes.update(
        constraint["name"]
        for constraint in inspector.get_unique_constraints(table_name)
        if constraint.get("name")
    )
    return indexes


def upgrade() -> None:
    if MESSAGE_TABLE not in _table_names():
        return

    columns = _column_names(MESSAGE_TABLE)
    columns_to_add = [
        ("turn_id", sa.String(length=36), {"nullable": True}),
        ("lc_message_id", sa.String(length=255), {"nullable": True}),
        ("tool_call_id", sa.String(length=255), {"nullable": True}),
        ("tool_name", sa.String(length=255), {"nullable": True}),
        ("raw_json", sa.JSON(), {"nullable": True}),
    ]
    for column_name, column_type, kwargs in columns_to_add:
        if column_name not in columns:
            op.add_column(MESSAGE_TABLE, sa.Column(column_name, column_type, **kwargs))

    indexes = _index_names(MESSAGE_TABLE)
    for index_name, (unique, index_columns) in INDEX_DEFINITIONS.items():
        if index_name not in indexes:
            op.create_index(index_name, MESSAGE_TABLE, index_columns, unique=unique)


def downgrade() -> None:
    if MESSAGE_TABLE not in _table_names():
        return

    indexes = _index_names(MESSAGE_TABLE)
    for index_name in INDEX_DEFINITIONS:
        if index_name in indexes:
            op.drop_index(index_name, table_name=MESSAGE_TABLE)

    columns = _column_names(MESSAGE_TABLE)
    for column_name in [
        "raw_json",
        "tool_name",
        "tool_call_id",
        "lc_message_id",
        "turn_id",
    ]:
        if column_name in columns:
            op.drop_column(MESSAGE_TABLE, column_name)
