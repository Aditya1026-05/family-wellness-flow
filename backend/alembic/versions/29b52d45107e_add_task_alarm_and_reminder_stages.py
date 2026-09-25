"""add_task_alarm_and_reminder_stages

Revision ID: 29b52d45107e
Revises: c8ac09f750aa
Create Date: 2026-09-26 02:38:44.086654

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '29b52d45107e'
down_revision: Union[str, Sequence[str], None] = 'c8ac09f750aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('care_tasks', sa.Column('ring_alarm', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('task_instances', sa.Column('reminder_stage', sa.Integer(), nullable=False, server_default=sa.text('0')))
    op.add_column('task_instances', sa.Column('last_reminded_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('parent_profiles', sa.Column('phone', sa.String(length=50), nullable=True))
    op.add_column('escalations', sa.Column('action_type', sa.String(length=50), nullable=True, server_default='call_parent'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('escalations', 'action_type')
    op.drop_column('parent_profiles', 'phone')
    op.drop_column('task_instances', 'last_reminded_at')
    op.drop_column('task_instances', 'reminder_stage')
    op.drop_column('care_tasks', 'ring_alarm')

