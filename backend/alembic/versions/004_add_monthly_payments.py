"""Add monthly_payments table

Revision ID: 004
Revises: 003
Create Date: 2024-01-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'monthly_payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), server_default='0', nullable=True),
        sa.Column('is_paid', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'year', 'month', name='uq_user_year_month')
    )
    op.create_index(op.f('ix_monthly_payments_id'), 'monthly_payments', ['id'], unique=False)
    op.create_index(op.f('ix_monthly_payments_user_id'), 'monthly_payments', ['user_id'], unique=False)
    op.create_index(op.f('ix_monthly_payments_year'), 'monthly_payments', ['year'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_monthly_payments_year'), table_name='monthly_payments')
    op.drop_index(op.f('ix_monthly_payments_user_id'), table_name='monthly_payments')
    op.drop_index(op.f('ix_monthly_payments_id'), table_name='monthly_payments')
    op.drop_table('monthly_payments')
