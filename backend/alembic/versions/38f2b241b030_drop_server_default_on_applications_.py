"""drop server default on applications submitted_at

Revision ID: 38f2b241b030
Revises: bbd08d7f2818
Create Date: 2026-09-14 10:46:24.120397

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '38f2b241b030'
down_revision: Union[str, Sequence[str], None] = 'bbd08d7f2818'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Bug found during manual testing of PHASE C draft creation: with the
    # server_default still in place, POST /registrations (which leaves
    # submitted_at unset/None so a draft has no submission timestamp)
    # got a real "now()" timestamp anyway, because SQLAlchemy omits a
    # None-valued column from the INSERT and lets the server_default
    # fill it in — it can't tell "explicitly set to None" apart from
    # "never touched". Dropping the default here and setting
    # submitted_at explicitly in code (both the draft path, which now
    # gets a real NULL, and the legacy POST /applications path, which
    # already set every other column explicitly) removes the ambiguity.
    op.alter_column('applications', 'submitted_at', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('applications', 'submitted_at', server_default=sa.text('now()'))
