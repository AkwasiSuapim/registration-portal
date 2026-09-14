"""add admin fields, registration drafts, clearance claims

Revision ID: bbd08d7f2818
Revises: 396445a00e4f
Create Date: 2026-09-14 08:17:30.497125

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'bbd08d7f2818'
down_revision: Union[str, Sequence[str], None] = '396445a00e4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop leftover table from the abandoned Phase 10 public
    # self-registration direction — the MVP decision is that students and
    # officials never self-register; administrators create every account
    # (see PHASE B). This table was never part of a committed migration
    # (the DB had drifted from git history) and has no code referencing it.
    op.drop_index(op.f('uq_pending_student_registrations_email'), table_name='pending_student_registrations')
    op.drop_index(op.f('uq_pending_student_registrations_setup_token_hash'), table_name='pending_student_registrations')
    op.drop_index(op.f('uq_pending_student_registrations_student_id'), table_name='pending_student_registrations')
    op.drop_index(op.f('uq_pending_student_registrations_verification_token_hash'), table_name='pending_student_registrations')
    op.drop_table('pending_student_registrations')

    # --- Registration drafts (PHASE C) ---
    # server_default backfills existing rows; nullable=False stays enforced
    # for every row going forward.
    op.add_column('applications', sa.Column(
        'section_data', postgresql.JSONB(astext_type=sa.Text()),
        server_default=sa.text("'{}'::jsonb"), nullable=False,
    ))
    # Nullable so POST /registrations can create a draft before any wizard
    # section has been saved; POST /registrations/{id}/submit validates
    # these are all populated before finalizing. The legacy POST
    # /applications path is unaffected — it still supplies all of these
    # at creation time in one call.
    op.alter_column('applications', 'term_code', existing_type=sa.VARCHAR(length=20), nullable=True)
    op.alter_column('applications', 'academic_year', existing_type=sa.VARCHAR(length=9), nullable=True)
    op.alter_column('applications', 'major', existing_type=sa.TEXT(), nullable=True)
    op.alter_column(
        'applications', 'submitted_at',
        existing_type=postgresql.TIMESTAMP(timezone=True),
        nullable=True, existing_server_default=sa.text('now()'),
    )
    op.drop_constraint('ck_applications_overall_status', 'applications', type_='check')
    op.create_check_constraint(
        'ck_applications_overall_status',
        'applications',
        "overall_status IN ('draft', 'in_progress', 'correction_required', 'rejected', "
        "'in_person_required', 'fully_registered')",
    )

    # --- Clearance claiming (PHASE F) ---
    op.add_column('clearances', sa.Column('claimed_by_official_id', sa.UUID(), nullable=True))
    op.add_column('clearances', sa.Column('claimed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        'clearances_claimed_by_official_id_fkey', 'clearances', 'officials',
        ['claimed_by_official_id'], ['id'], ondelete='SET NULL',
    )

    # --- must_change_password (temporary-password / MVP accounts) ---
    op.add_column('users', sa.Column(
        'must_change_password', sa.Boolean(),
        server_default=sa.text('false'), nullable=False,
    ))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'must_change_password')

    op.drop_constraint('clearances_claimed_by_official_id_fkey', 'clearances', type_='foreignkey')
    op.drop_column('clearances', 'claimed_at')
    op.drop_column('clearances', 'claimed_by_official_id')

    op.drop_constraint('ck_applications_overall_status', 'applications', type_='check')
    op.create_check_constraint(
        'ck_applications_overall_status',
        'applications',
        "overall_status IN ('in_progress', 'correction_required', 'rejected', "
        "'in_person_required', 'fully_registered')",
    )
    op.alter_column(
        'applications', 'submitted_at',
        existing_type=postgresql.TIMESTAMP(timezone=True),
        nullable=False, existing_server_default=sa.text('now()'),
    )
    op.alter_column('applications', 'major', existing_type=sa.TEXT(), nullable=False)
    op.alter_column('applications', 'academic_year', existing_type=sa.VARCHAR(length=9), nullable=False)
    op.alter_column('applications', 'term_code', existing_type=sa.VARCHAR(length=20), nullable=False)
    op.drop_column('applications', 'section_data')

    op.create_table('pending_student_registrations',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('student_id', sa.VARCHAR(length=9), autoincrement=False, nullable=False),
    sa.Column('email', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
    sa.Column('first_name', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('last_name', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('major', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('classification', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('residency_type', sa.VARCHAR(), autoincrement=False, nullable=False),
    sa.Column('verification_token_hash', sa.VARCHAR(length=64), autoincrement=False, nullable=False),
    sa.Column('password_setup_token_hash', sa.VARCHAR(length=64), autoincrement=False, nullable=True),
    sa.Column('expires_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=False),
    sa.Column('password_setup_expires_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('verified_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('completed_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.CheckConstraint("email::text = lower(email::text) AND email::text ~~ '%%@student.livingstone.edu'::text", name=op.f('ck_pending_student_registrations_email_domain')),
    sa.CheckConstraint("residency_type::text = ANY (ARRAY['residential'::character varying, 'commuter'::character varying]::text[])", name=op.f('ck_pending_student_registrations_residency_type')),
    sa.CheckConstraint("student_id::text ~ '^100[0-9]{6}$'::text", name=op.f('ck_pending_student_registrations_student_id_format')),
    sa.PrimaryKeyConstraint('id', name=op.f('pending_student_registrations_pkey'))
    )
    op.create_index(op.f('uq_pending_student_registrations_verification_token_hash'), 'pending_student_registrations', ['verification_token_hash'], unique=True)
    op.create_index(op.f('uq_pending_student_registrations_student_id'), 'pending_student_registrations', ['student_id'], unique=True)
    op.create_index(op.f('uq_pending_student_registrations_setup_token_hash'), 'pending_student_registrations', ['password_setup_token_hash'], unique=True)
    op.create_index(op.f('uq_pending_student_registrations_email'), 'pending_student_registrations', ['email'], unique=True)
    # ### end Alembic commands ###
