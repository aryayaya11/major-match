"""add user_agent to feedback_sessions and beta testing tables

Revision ID: a1b2c3d4e5f6
Revises: 10e40813414d
Create Date: 2026-06-21 23:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '10e40813414d'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # ── feedback_sessions: tambah user_agent ──
    if 'feedback_sessions' in existing_tables:
        columns_fs = [c['name'] for c in inspector.get_columns('feedback_sessions')]
        with op.batch_alter_table('feedback_sessions', schema=None) as batch_op:
            if 'user_agent' not in columns_fs:
                batch_op.add_column(sa.Column('user_agent', sa.String(500), nullable=True))
            if 'disliked_tags' not in columns_fs:
                batch_op.add_column(sa.Column('disliked_tags', sa.Text(), nullable=True))
            if 'swipe_history' not in columns_fs:
                batch_op.add_column(sa.Column('swipe_history', sa.Text(), nullable=True))

    # ── user_profiles ──
    if 'user_profiles' not in existing_tables:
        op.create_table(
            'user_profiles',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('session_id', sa.String(64), nullable=False),
            sa.Column('gender', sa.String(10), nullable=True),
            sa.Column('kelas', sa.String(10), nullable=True),
            sa.Column('jurusan_sma', sa.String(20), nullable=True),
            sa.Column('jurusan_impian', sa.String(200), nullable=True),
            sa.Column('jurusan_diminati_1', sa.String(200), nullable=True),
            sa.Column('jurusan_diminati_2', sa.String(200), nullable=True),
            sa.Column('jurusan_diminati_3', sa.String(200), nullable=True),
            sa.Column('tingkat_keyakinan', sa.Integer(), nullable=True),
            sa.Column('sudah_riset', sa.Boolean(), nullable=True),
            sa.Column('sumber_info', sa.Text(), nullable=True),
            sa.Column('timestamp', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('session_id'),
        )
        op.create_index('ix_user_profiles_session_id', 'user_profiles', ['session_id'], unique=True)

    # ── question_responses ──
    if 'question_responses' not in existing_tables:
        op.create_table(
            'question_responses',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('session_id', sa.String(64), nullable=False),
            sa.Column('question_id', sa.String(20), nullable=False),
            sa.Column('response', sa.String(10), nullable=False),
            sa.Column('response_time_ms', sa.Integer(), nullable=True),
            sa.Column('question_order', sa.Integer(), nullable=True),
            sa.Column('phase', sa.String(20), nullable=True),
            sa.Column('timestamp', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_question_responses_session_id', 'question_responses', ['session_id'], unique=False)
        op.create_index('ix_question_responses_question_id', 'question_responses', ['question_id'], unique=False)
        op.create_index('ix_question_responses_session_question', 'question_responses', ['session_id', 'question_id'], unique=False)

    # ── recommendation_results ──
    if 'recommendation_results' not in existing_tables:
        op.create_table(
            'recommendation_results',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('session_id', sa.String(64), nullable=False),
            sa.Column('rank', sa.Integer(), nullable=False),
            sa.Column('jurusan', sa.String(200), nullable=False),
            sa.Column('kategori', sa.String(100), nullable=True),
            sa.Column('confidence_score', sa.Float(), nullable=True),
            sa.Column('timestamp', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_recommendation_results_session_id', 'recommendation_results', ['session_id'], unique=False)
        op.create_index('ix_recommendation_results_jurusan', 'recommendation_results', ['jurusan'], unique=False)

    # ── recommendation_feedback ──
    if 'recommendation_feedback' not in existing_tables:
        op.create_table(
            'recommendation_feedback',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('session_id', sa.String(64), nullable=False),
            sa.Column('jurusan', sa.String(200), nullable=False),
            sa.Column('rank', sa.Integer(), nullable=True),
            sa.Column('rating_tertarik', sa.Integer(), nullable=True),
            sa.Column('pertimbangkan', sa.Boolean(), nullable=True),
            sa.Column('sudah_tahu', sa.Boolean(), nullable=True),
            sa.Column('timestamp', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_recommendation_feedback_session_id', 'recommendation_feedback', ['session_id'], unique=False)
        op.create_index('ix_recommendation_feedback_session_jurusan', 'recommendation_feedback', ['session_id', 'jurusan'], unique=False)

    # ── session_evaluations ──
    if 'session_evaluations' not in existing_tables:
        op.create_table(
            'session_evaluations',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('session_id', sa.String(64), nullable=False),
            sa.Column('rating_kesesuaian', sa.Integer(), nullable=True),
            sa.Column('rating_kepuasan', sa.Integer(), nullable=True),
            sa.Column('rating_wawasan', sa.Integer(), nullable=True),
            sa.Column('nps_score', sa.Integer(), nullable=True),
            sa.Column('jurusan_seharusnya', sa.String(200), nullable=True),
            sa.Column('komentar', sa.Text(), nullable=True),
            sa.Column('durasi_total_detik', sa.Integer(), nullable=True),
            sa.Column('timestamp', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('session_id'),
        )
        op.create_index('ix_session_evaluations_session_id', 'session_evaluations', ['session_id'], unique=True)

    # ── feedback_sessions timestamp index ──
    if 'feedback_sessions' in existing_tables:
        indexes_fs = [idx['name'] for idx in inspector.get_indexes('feedback_sessions')]
        with op.batch_alter_table('feedback_sessions', schema=None) as batch_op:
            if 'ix_feedback_sessions_timestamp' not in indexes_fs:
                batch_op.create_index('ix_feedback_sessions_timestamp', ['timestamp'], unique=False)


def downgrade():
    # Hapus kolom user_agent dari feedback_sessions
    with op.batch_alter_table('feedback_sessions', schema=None) as batch_op:
        batch_op.drop_column('user_agent')

    # Hapus tabel-tabel beta testing
    op.drop_table('session_evaluations')
    op.drop_table('recommendation_feedback')
    op.drop_table('recommendation_results')
    op.drop_table('question_responses')
    op.drop_table('user_profiles')
