from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class FeedbackSession(db.Model):
    __tablename__ = 'feedback_sessions'

    id         = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), unique=True, nullable=False)
    nama       = db.Column(db.String(100), nullable=False)
    liked_tags = db.Column(db.Text)
    hasil_1    = db.Column(db.String(200))
    hasil_2    = db.Column(db.String(200))
    hasil_3    = db.Column(db.String(200))
    rating     = db.Column(db.Integer)
    komentar   = db.Column(db.Text)
    web_rating = db.Column(db.Integer)
    web_komentar = db.Column(db.Text)
    timestamp  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'nama':       self.nama,
            'liked_tags': self.liked_tags,
            'hasil':      [self.hasil_1, self.hasil_2, self.hasil_3],
            'rating':     self.rating,
            'komentar':   self.komentar,
            'web_rating':   self.web_rating,
            'web_komentar': self.web_komentar,
            'timestamp':  self.timestamp.isoformat() if self.timestamp else None
        }

class ItemFeedback(db.Model):
    __tablename__ = 'item_feedback'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), nullable=False, index=True)
    rekomendasi_jurusan = db.Column(db.String(200), nullable=False)
    feedback = db.Column(db.String(10), nullable=False, index=True) # 'like' atau 'dislike'
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'rekomendasi_jurusan': self.rekomendasi_jurusan,
            'feedback': self.feedback,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }
