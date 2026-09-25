"""add_multi_parent_tasks_and_end_time

Revision ID: e6ae9f8dec1f
Revises: acb9474e0675
Create Date: 2026-09-25 18:34:54.079419

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6ae9f8dec1f'
down_revision: Union[str, Sequence[str], None] = 'acb9474e0675'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('care_tasks', sa.Column('scheduled_end_time', sa.String(length=50), nullable=True))
    op.alter_column('care_tasks', 'parent_profile_id', existing_type=sa.Uuid(), nullable=True)
    op.add_column('task_instances', sa.Column('end_time', sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        'task_parent_assignments',
        sa.Column('task_id', sa.Uuid(), nullable=False),
        sa.Column('parent_profile_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['care_tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_profile_id'], ['parent_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('task_id', 'parent_profile_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('task_parent_assignments')
    op.drop_column('task_instances', 'end_time')
    op.alter_column('care_tasks', 'parent_profile_id', existing_type=sa.Uuid(), nullable=False)
    op.drop_column('care_tasks', 'scheduled_end_time')
