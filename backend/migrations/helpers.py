# migrations/helpers.py
from __future__ import annotations

from typing import Iterable, Optional, List

from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy import inspect
import sqlalchemy as sa
from alembic import op


def get_conn() -> Connection:
    """Return Alembic's current Connection."""
    return op.get_bind()


def get_inspector(conn: Optional[Connection] = None) -> Inspector:
    """Return SQLAlchemy Inspector for the current connection."""
    conn = conn or get_conn()
    return inspect(conn)


def table_exists(table_name: str, schema: Optional[str] = None) -> bool:
    insp = get_inspector()
    return table_name in insp.get_table_names(schema=schema)


def column_exists(table_name: str, column_name: str, schema: Optional[str] = None) -> bool:
    insp = get_inspector()
    cols = insp.get_columns(table_name, schema=schema)
    return any(c["name"] == column_name for c in cols)


def constraint_exists(
    constraint_name: str,
    table_name: Optional[str] = None,
    schema: Optional[str] = None,
) -> bool:
    """
    Works well for Postgres (and most DBs that expose constraints via inspector).
    Returns False if table doesn't exist yet.
    """
    try:
        insp = get_inspector()
        # check constraints
        for c in insp.get_check_constraints(table_name, schema=schema):
            if c.get("name") == constraint_name:
                return True
        # unique constraints
        for c in insp.get_unique_constraints(table_name, schema=schema):
            if c.get("name") == constraint_name:
                return True
        # foreign keys
        for c in insp.get_foreign_keys(table_name, schema=schema):
            if c.get("name") == constraint_name:
                return True
        # primary key constraint name is not always exposed consistently
        return False
    except Exception:  # noqa
        # Table might not exist yet
        return False



def index_exists(table_name: str, index_name: str, schema: Optional[str] = None) -> bool:
    insp = get_inspector()
    for idx in insp.get_indexes(table_name, schema=schema):
        if idx.get("name") == index_name:
            return True
    return False


def add_column_if_not_exists(table_name: str, column, schema: Optional[str] = None) -> None:
    """
    column should be an sa.Column(...) object.
    """
    if not table_exists(table_name, schema=schema):
        raise RuntimeError(f"Table '{table_name}' does not exist (schema={schema}).")

    if not column_exists(table_name, column.name, schema=schema):
        op.add_column(table_name, column, schema=schema)


def drop_column_if_exists(table_name: str, column_name: str, schema: Optional[str] = None) -> None:
    if table_exists(table_name, schema=schema) and column_exists(table_name, column_name, schema=schema):
        op.drop_column(table_name, column_name, schema=schema)


def create_check_constraint_if_not_exists(
    table_name: str,
    constraint_name: str,
    condition_sql: str,
    schema: Optional[str] = None,
) -> None:
    if not constraint_exists(table_name, constraint_name, schema=schema):
        op.create_check_constraint(
            constraint_name=constraint_name,
            table_name=table_name,
            condition=condition_sql,
            schema=schema,
        )


def drop_constraint_if_exists(
    table_name: str,
    constraint_name: str,
    constraint_type: str,
    schema: Optional[str] = None,
) -> None:
    """
    constraint_type examples: 'check', 'foreignkey', 'unique'
    """
    if table_exists(table_name, schema=schema) and constraint_exists(table_name, constraint_name, schema=schema):
        op.drop_constraint(
            constraint_name=constraint_name,
            table_name=table_name,
            type_=constraint_type,
            schema=schema,
        )


def is_postgres() -> bool:
    """True if the current Alembic bind is PostgreSQL."""
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def get_column_default_expr(
    table: str,
    column: str,
    schema: Optional[str] = None,
) -> Optional[str]:
    """
    Postgres-only: returns the default expression for a column, e.g. 'gen_random_uuid()',
    or None if no default exists.

    If schema is None, uses current_schema().
    """
    if not is_postgres():
        return None

    conn = op.get_bind()
    schema_filter = "n.nspname = :schema" if schema else "n.nspname = current_schema()"

    q = sa.text(
        f"""
        SELECT pg_get_expr(d.adbin, d.adrelid) AS default_expr
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE {schema_filter}
          AND c.relname = :table
          AND a.attname = :column
        """
    )

    params = {"table": table, "column": column}
    if schema:
        params["schema"] = schema

    row = conn.execute(q, params).first()
    return row[0] if row else None


def get_fk_constraints_for_column(
    table: str,
    column: str,
    schema: Optional[str] = None,
) -> List[str]:
    """
    Return FK constraint names on (schema.table) that involve the given column.
    Postgres implementation via pg_catalog.
    """
    conn = op.get_bind()
    schema_filter = "n.nspname = :schema" if schema else "n.nspname = current_schema()"

    q = sa.text(
        f"""
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE {schema_filter}
          AND t.relname = :table
          AND c.contype = 'f'
          AND EXISTS (
            SELECT 1
            FROM unnest(c.conkey) AS u(attnum)
            JOIN pg_attribute a
              ON a.attrelid = t.oid
             AND a.attnum = u.attnum
            WHERE a.attname = :column
          )
        """
    )

    params = {"table": table, "column": column}
    if schema:
        params["schema"] = schema

    rows = conn.execute(q, params).fetchall()
    return [r[0] for r in rows]


def get_unique_constraints_for_column(
    table: str,
    column: str,
    schema: Optional[str] = None,
) -> List[str]:
    """
    Return UNIQUE constraint names on (schema.table) that involve the given column.
    Postgres implementation via pg_catalog.
    """
    conn = op.get_bind()
    schema_filter = "n.nspname = :schema" if schema else "n.nspname = current_schema()"

    q = sa.text(
        f"""
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE {schema_filter}
          AND t.relname = :table
          AND c.contype = 'u'
          AND EXISTS (
            SELECT 1
            FROM unnest(c.conkey) AS u(attnum)
            JOIN pg_attribute a
              ON a.attrelid = t.oid
             AND a.attnum = u.attnum
            WHERE a.attname = :column
          )
        """
    )

    params = {"table": table, "column": column}
    if schema:
        params["schema"] = schema

    rows = conn.execute(q, params).fetchall()
    return [r[0] for r in rows]


def _q_ident(name: str) -> str:
    """Very small identifier-quoting helper for Postgres identifiers."""
    return '"' + name.replace('"', '""') + '"'


def _create_pg_enum_if_not_exists(enum_name: str, values: list[str]) -> None:
    """
    Create a Postgres ENUM type if it doesn't already exist.
    IMPORTANT: asyncpg cannot bind parameters inside DO $$ ... $$.
    """
    if not is_postgres():
        return

    enum_ident = _q_ident(enum_name)
    enum_name_lit = enum_name.replace("'", "''")  # safe for string literal

    # quote enum values as string literals
    vals = ", ".join("'" + v.replace("'", "''") + "'" for v in values)

    op.execute(
        sa.text(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = '{enum_name_lit}'
                ) THEN
                    CREATE TYPE {enum_ident} AS ENUM ({vals});
                END IF;
            END$$;
            """
        )
    )


def _drop_pg_enum_if_exists(enum_name: str) -> None:
    if not is_postgres():
        return
    enum_ident = _q_ident(enum_name)
    op.execute(sa.text(f"DROP TYPE IF EXISTS {enum_ident};"))

def create_foreign_key_if_not_exists(
    constraint_name: str,
    source_table: str,
    referent_table: str,
    local_cols: list[str],
    remote_cols: list[str],
    ondelete: Optional[str] = None,
    schema: Optional[str] = None,
    referent_schema: Optional[str] = None,
) -> None:
    if not constraint_exists(constraint_name, source_table, schema=schema):
        op.create_foreign_key(
            constraint_name=constraint_name,
            source_table=source_table,
            referent_table=referent_table,
            local_cols=local_cols,
            remote_cols=remote_cols,
            ondelete=ondelete,
            source_schema=schema,
            referent_schema=referent_schema,
        )