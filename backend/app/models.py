from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import json

db = SQLAlchemy()


# ══════════════════════════════════════════════════════════════
# EXISTING MODELS (backward compatible)
# ══════════════════════════════════════════════════════════════

class FeedbackSession(db.Model):
    __tablename__ = 'feedback_sessions'

    id         = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), db.ForeignKey('user_profiles.session_id', ondelete='CASCADE'), unique=True, nullable=False)
    nama       = db.Column(db.String(100), nullable=False)
    rating     = db.Column(db.Integer)
    komentar   = db.Column(db.Text)
    web_rating = db.Column(db.Integer)
    web_komentar = db.Column(db.Text)
    user_agent = db.Column(db.String(500))  # For ML readiness — device/browser tracking
    timestamp  = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Indexes for common queries
    __table_args__ = (
        db.Index('ix_feedback_sessions_timestamp', 'timestamp'),
    )

    def __repr__(self):
        return f'<FeedbackSession {self.session_id}>'

    def to_dict(self):
        return {
            'id':         self.id,
            'session_id': self.session_id,
            'nama':       self.nama,
            'rating':     self.rating,
            'komentar':   self.komentar,
            'web_rating':   self.web_rating,
            'web_komentar': self.web_komentar,
            'timestamp':  self.timestamp.isoformat() if self.timestamp else None
        }

# ══════════════════════════════════════════════════════════════
# BETA TESTING VALIDATION MODELS
# ══════════════════════════════════════════════════════════════

class UserProfile(db.Model):
    """Data demografi + ground truth pre-test (dikumpulkan sebelum kuis dimulai)."""
    __tablename__ = 'user_profiles'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), unique=True, nullable=False, index=True)

    # Demografi
    gender = db.Column(db.String(10))           # L, P, Lainnya
    kelas = db.Column(db.String(10))            # 10, 11, 12, Alumni
    jurusan_sma = db.Column(db.String(20))      # IPA, IPS, Bahasa, Lainnya

    # Ground Truth Pre-Test
    jurusan_impian = db.Column(db.String(200))
    jurusan_diminati_1 = db.Column(db.String(200))
    jurusan_diminati_2 = db.Column(db.String(200))
    jurusan_diminati_3 = db.Column(db.String(200))
    tingkat_keyakinan = db.Column(db.Integer)    # 1-5 Likert
    sudah_riset = db.Column(db.Boolean)
    sumber_info = db.Column(db.Text)             # JSON array

    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<UserProfile {self.session_id}>'

    def to_dict(self):
        sumber = []
        if self.sumber_info:
            try:
                sumber = json.loads(self.sumber_info)
            except (json.JSONDecodeError, TypeError):
                sumber = [self.sumber_info] if self.sumber_info else []
        return {
            'id': self.id,
            'session_id': self.session_id,
            'gender': self.gender,
            'kelas': self.kelas,
            'jurusan_sma': self.jurusan_sma,
            'jurusan_impian': self.jurusan_impian,
            'jurusan_diminati': [self.jurusan_diminati_1, self.jurusan_diminati_2, self.jurusan_diminati_3],
            'tingkat_keyakinan': self.tingkat_keyakinan,
            'sudah_riset': self.sudah_riset,
            'sumber_info': sumber,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
        }


class QuestionResponse(db.Model):
    """Tracking per-pertanyaan dengan response time untuk validasi psikometrik."""
    __tablename__ = 'question_responses'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), db.ForeignKey('user_profiles.session_id', ondelete='CASCADE'), nullable=False, index=True)
    question_id = db.Column(db.String(20), nullable=False, index=True)
    response = db.Column(db.String(10), nullable=False)  # 'like' or 'skip'
    response_time_ms = db.Column(db.Integer)              # Waktu jawab dalam milidetik
    question_order = db.Column(db.Integer)                # Urutan kemunculan
    phase = db.Column(db.String(20))                      # 'opening', 'exploration', 'detail'

    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Composite index for session-question lookups
    __table_args__ = (
        db.Index('ix_question_responses_session_question', 'session_id', 'question_id'),
    )

    def __repr__(self):
        return f'<QuestionResponse {self.session_id}:{self.question_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'question_id': self.question_id,
            'response': self.response,
            'response_time_ms': self.response_time_ms,
            'question_order': self.question_order,
            'phase': self.phase,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
        }


class RecommendationResult(db.Model):
    """Hasil rekomendasi per-jurusan (satu baris per jurusan per sesi)."""
    __tablename__ = 'recommendation_results'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), db.ForeignKey('user_profiles.session_id', ondelete='CASCADE'), nullable=False, index=True)
    rank = db.Column(db.Integer, nullable=False)          # 1, 2, 3
    jurusan = db.Column(db.String(200), nullable=False)
    kategori = db.Column(db.String(100))
    confidence_score = db.Column(db.Float)

    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Index for analytics queries
    __table_args__ = (
        db.Index('ix_recommendation_results_jurusan', 'jurusan'),
    )

    def __repr__(self):
        return f'<RecommendationResult {self.session_id}:#{self.rank}>'

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'rank': self.rank,
            'jurusan': self.jurusan,
            'kategori': self.kategori,
            'confidence_score': self.confidence_score,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
        }


class RecommendationFeedback(db.Model):
    """Feedback per-jurusan rekomendasi (rating ketertarikan, pertimbangan, novelty)."""
    __tablename__ = 'recommendation_feedback'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), db.ForeignKey('user_profiles.session_id', ondelete='CASCADE'), nullable=False, index=True)
    jurusan = db.Column(db.String(200), nullable=False)
    rank = db.Column(db.Integer)

    # Evaluasi per-jurusan
    rating_tertarik = db.Column(db.Integer)       # 1-5 Likert
    pertimbangkan = db.Column(db.Boolean)           # Ya/Tidak
    sudah_tahu = db.Column(db.Boolean)              # Ya/Tidak (novelty)

    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Index for session-jurusan lookups
    __table_args__ = (
        db.Index('ix_recommendation_feedback_session_jurusan', 'session_id', 'jurusan'),
    )

    def __repr__(self):
        return f'<RecommendationFeedback {self.session_id}:{self.jurusan}>'

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'jurusan': self.jurusan,
            'rank': self.rank,
            'rating_tertarik': self.rating_tertarik,
            'pertimbangkan': self.pertimbangkan,
            'sudah_tahu': self.sudah_tahu,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
        }


class SessionEvaluation(db.Model):
    """Evaluasi keseluruhan sesi (kesesuaian, kepuasan, NPS, komentar)."""
    __tablename__ = 'session_evaluations'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), db.ForeignKey('user_profiles.session_id', ondelete='CASCADE'), unique=True, nullable=False, index=True)

    # Evaluasi keseluruhan
    rating_kesesuaian = db.Column(db.Integer)      # 1-5
    rating_kepuasan = db.Column(db.Integer)        # 1-5
    rating_wawasan = db.Column(db.Integer)         # 1-5
    nps_score = db.Column(db.Integer)              # 0-10

    # Jurusan yang seharusnya ada
    jurusan_seharusnya = db.Column(db.String(200))
    komentar = db.Column(db.Text)

    # Metadata
    durasi_total_detik = db.Column(db.Integer)

    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<SessionEvaluation {self.session_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'rating_kesesuaian': self.rating_kesesuaian,
            'rating_kepuasan': self.rating_kepuasan,
            'rating_wawasan': self.rating_wawasan,
            'nps_score': self.nps_score,
            'jurusan_seharusnya': self.jurusan_seharusnya,
            'komentar': self.komentar,
            'durasi_total_detik': self.durasi_total_detik,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
        }
