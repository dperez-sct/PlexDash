"""Add deleted_from_plex field to users table

Revision ID: 006
Revises: 005
Create Date: 2024-01-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('deleted_from_plex', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('users', 'deleted_from_plex')
