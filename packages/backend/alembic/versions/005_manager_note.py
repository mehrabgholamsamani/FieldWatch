"""Add manager_note to reports

Revision ID: 005
Revises: 004
Create Date: 2026-04-12 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("manager_note", sa.String(5000), nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "manager_note")
