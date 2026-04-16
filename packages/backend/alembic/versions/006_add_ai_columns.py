"""Add AI category and keywords columns to reports

Revision ID: 006
Revises: 005
Create Date: 2026-04-16 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("ai_category", sa.String(100), nullable=True))
    op.add_column("reports", sa.Column("ai_keywords", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "ai_keywords")
    op.drop_column("reports", "ai_category")
