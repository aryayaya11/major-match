from marshmallow import Schema, fields, validate

class ItemFeedbackSchema(Schema):
    session_id = fields.String(required=True, validate=validate.Length(min=1))
    rekomendasi_jurusan = fields.String(required=True, validate=validate.Length(min=1))
    feedback = fields.String(required=True, validate=validate.OneOf(['like', 'dislike']))

class FeedbackSchema(Schema):
    rating = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    komentar = fields.String(load_default='')

class NextCardSchema(Schema):
    history = fields.List(fields.Dict(), load_default=[])
    liked_tags = fields.List(fields.String(), load_default=[])
    disliked_tags = fields.List(fields.String(), load_default=[])
    limit = fields.Integer(load_default=15)

class RecommendSchema(Schema):
    nama = fields.String(load_default='Kamu')
    liked_tags = fields.List(fields.String(), load_default=[])
    disliked_tags = fields.List(fields.String(), load_default=[])
    history = fields.List(fields.Dict(), load_default=[])

class ExploreSchema(Schema):
    liked_tags = fields.List(fields.String(), load_default=[])
    query = fields.String(load_default='')
    kategori = fields.String(load_default='')
