from marshmallow import Schema, fields, validate

# ══════════════════════════════════════════════════════════════
# EXISTING SCHEMAS (backward compatible)
# ══════════════════════════════════════════════════════════════



class FeedbackSchema(Schema):
    session_id = fields.String(required=True, validate=validate.Length(min=1, max=64))
    rating = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    komentar = fields.String(load_default='', validate=validate.Length(max=2000))
    web_rating = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    web_komentar = fields.String(load_default='', validate=validate.Length(max=2000))

class NextCardSchema(Schema):
    history = fields.List(fields.Dict(), load_default=[])
    liked_tags = fields.List(fields.String(), load_default=[])
    disliked_tags = fields.List(fields.String(), load_default=[])
    limit = fields.Integer(load_default=15)

class RecommendSchema(Schema):
    session_id = fields.String(load_default='', validate=validate.Length(max=64))
    nama = fields.String(load_default='Kamu', validate=validate.Length(max=100))
    liked_tags = fields.List(fields.String(), load_default=[])
    disliked_tags = fields.List(fields.String(), load_default=[])
    history = fields.List(fields.Dict(), load_default=[])

class ExploreSchema(Schema):
    liked_tags = fields.List(fields.String(), load_default=[])
    query = fields.String(load_default='', validate=validate.Length(max=200))
    kategori = fields.String(load_default='', validate=validate.Length(max=100))

# ══════════════════════════════════════════════════════════════
# BETA TESTING VALIDATION SCHEMAS
# ══════════════════════════════════════════════════════════════

class UserProfileSchema(Schema):
    """Validasi data demografi + ground truth pre-test."""
    session_id = fields.String(required=True, validate=validate.Length(min=1, max=64))

    # Demografi (wajib)
    gender = fields.String(required=True, validate=validate.OneOf(['L', 'P', 'Lainnya']))
    kelas = fields.String(required=True, validate=validate.OneOf(['10', '11', '12', 'Alumni']))
    jurusan_sma = fields.String(required=True, validate=validate.OneOf(['IPA', 'IPS', 'Bahasa', 'Lainnya']))

    # Ground Truth Pre-Test
    jurusan_impian = fields.String(required=True, validate=validate.Length(min=1, max=200))
    jurusan_diminati_1 = fields.String(load_default='', validate=validate.Length(max=200))
    jurusan_diminati_2 = fields.String(load_default='', validate=validate.Length(max=200))
    jurusan_diminati_3 = fields.String(load_default='', validate=validate.Length(max=200))
    tingkat_keyakinan = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    sudah_riset = fields.Boolean(load_default=False)
    sumber_info = fields.List(fields.String(validate=validate.Length(max=50)), load_default=[])


class QuestionResponseItemSchema(Schema):
    """Validasi satu item jawaban dalam batch."""
    question_id = fields.String(required=True, validate=validate.Length(min=1, max=20))
    response = fields.String(required=True, validate=validate.OneOf(['like', 'skip']))
    response_time_ms = fields.Integer(load_default=0, validate=validate.Range(min=0, max=300000))
    question_order = fields.Integer(load_default=0, validate=validate.Range(min=0, max=100))
    phase = fields.String(load_default='', validate=validate.OneOf(['opening', 'exploration', 'detail', '']))


class QuestionResponseSchema(Schema):
    """Validasi data jawaban per-pertanyaan (single)."""
    session_id = fields.String(required=True, validate=validate.Length(min=1, max=64))
    question_id = fields.String(required=True, validate=validate.Length(min=1, max=20))
    response = fields.String(required=True, validate=validate.OneOf(['like', 'skip']))
    response_time_ms = fields.Integer(load_default=0, validate=validate.Range(min=0, max=300000))
    question_order = fields.Integer(load_default=0, validate=validate.Range(min=0, max=100))
    phase = fields.String(load_default='', validate=validate.OneOf(['opening', 'exploration', 'detail', '']))


class QuestionResponseBatchSchema(Schema):
    """Validasi batch jawaban pertanyaan (kirim banyak sekaligus)."""
    session_id = fields.String(required=True, validate=validate.Length(min=1, max=64))
    responses = fields.List(
        fields.Nested(QuestionResponseItemSchema),
        required=True,
        validate=validate.Length(min=1, max=50)
    )


class RecommendationFeedbackItemSchema(Schema):
    """Validasi satu item feedback rekomendasi."""
    jurusan = fields.String(required=True, validate=validate.Length(min=1, max=200))
    rank = fields.Integer(load_default=0, validate=validate.Range(min=0, max=10))
    rating_tertarik = fields.Integer(load_default=None, validate=validate.Range(min=1, max=5))
    pertimbangkan = fields.Boolean(load_default=None)
    sudah_tahu = fields.Boolean(load_default=None)


class RecommendationFeedbackSchema(Schema):
    """Validasi feedback per-jurusan rekomendasi."""
    session_id = fields.String(required=True, validate=validate.Length(min=1, max=64))
    feedbacks = fields.List(
        fields.Nested(RecommendationFeedbackItemSchema),
        required=True,
        validate=validate.Length(min=1, max=5)
    )


class SessionEvaluationSchema(Schema):
    """Validasi evaluasi keseluruhan sesi."""
    session_id = fields.String(required=True, validate=validate.Length(min=1, max=64))

    # Evaluasi keseluruhan (wajib)
    rating_kesesuaian = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    rating_kepuasan = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    rating_wawasan = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    nps_score = fields.Integer(required=True, validate=validate.Range(min=0, max=10))

    # Opsional
    jurusan_seharusnya = fields.String(load_default='', validate=validate.Length(max=200))
    komentar = fields.String(load_default='', validate=validate.Length(max=2000))
    durasi_total_detik = fields.Integer(load_default=0, validate=validate.Range(min=0, max=86400))
