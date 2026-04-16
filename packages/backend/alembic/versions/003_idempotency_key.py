"""Add idempotency_key to reports

Revision ID: 003
Revises: 002
Create Date: 2024-01-01 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reports",
        sa.Column("idempotency_key", sa.String(36), nullable=True),
    )
    op.create_index(
        "ix_reports_idempotency_key", "reports", ["idempotency_key"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_reports_idempotency_key", table_name="reports")
    op.drop_column("reports", "idempotency_key")
