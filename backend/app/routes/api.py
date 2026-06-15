from flask import Blueprint, request, jsonify, session
import uuid
import logging
from marshmallow import ValidationError

from app.models import db, FeedbackSession, ItemFeedback
from app.services.ml_service import ml_service
from app import cache, limiter
from app.schemas import (
    NextCardSchema, RecommendSchema, ItemFeedbackSchema, 
    FeedbackSchema, ExploreSchema
)

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__)

@api_bp.route('/next-card', methods=['POST'])
@limiter.limit("600 per hour")
def next_card():
    """
    Adaptive: tentukan kartu berikutnya berdasarkan history swipe.
    ---
    tags:
      - Recommendation
    parameters:
      - in: body
      ...
    """
    try:
        data = NextCardSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    history = data.get('history', [])
    
    # Count liked items in Phase 1
    liked_count = sum(1 for sw in history if sw.get('liked'))
    
    # Careless answer check in Phase 1 (at 20 or 25 questions)
    if len(history) == 20 or len(history) == 25:
        if liked_count == 0 or liked_count == len(history):
            return jsonify({'done': True})

    # Determine limit and phase
    if len(history) < 20:
        limit = 20
        phase1_len = 20
    else:
        liked_tags = []
        disliked_tags = []
        for sw in history[:20]:
            card = ml_service.CARD_MAP.get(sw['id'])
            if card:
                if sw.get('liked'):
                    liked_tags.extend(card.get('tags', []))
                else:
                    disliked_tags.extend(card.get('tags', []))
        
        current_recs = ml_service.get_rekomendasi(liked_tags, disliked_tags=disliked_tags, top_n=3, history=history[:20])
        max_score = max([h['skor'] for h in current_recs]) if current_recs else 0
        
        if max_score < 60:
            if len(history) < 25:
                limit = 25
            else:
                limit = 35
            phase1_len = 25
        else:
            limit = 30
            phase1_len = 20

    if len(history) >= limit:
        return jsonify({'done': True})

    try:
        card = ml_service.build_next_card(history, limit=limit)
    except Exception as e:
        logger.error(f"Error in next_card: {e}")
        return jsonify({'error': 'Internal server error'}), 500

    if not card:
        return jsonify({'done': True})

    response_data = {
        'done':     False,
        'card':     {'id': card['id'], 'text': card['text'], 'tags': card.get('tags', [])},
        'progress': round(min(len(history) / limit, 1.0), 2),
        'count':    len(history) + 1,
        'total':    limit,
    }

    if len(history) == phase1_len:
        top_rumpun_key = ml_service._get_top_rumpun(history)
        rumpun_display = ml_service.RUMPUN_DISPLAY_NAMES.get(top_rumpun_key, "Teknologi & Sains (STEM)")
        response_data['phase_transition'] = True
        response_data['top_rumpun'] = rumpun_display
        
        rumpun_id = top_rumpun_key.lower() if top_rumpun_key not in ['SOSIAL_HUMANIORA', 'PERTANIAN_ALAM', 'SENI_KREATIF'] else {
            'SOSIAL_HUMANIORA': 'sosial',
            'PERTANIAN_ALAM': 'lingkungan',
            'SENI_KREATIF': 'kreatif'
        }.get(top_rumpun_key, 'stem')
        response_data['rumpun_id'] = rumpun_id

    return jsonify(response_data)

@api_bp.route('/recommend', methods=['POST'])
@limiter.limit("30 per hour")
def recommend():
    """
    Terima liked_tags dari frontend, kembalikan top 3 jurusan.
    ---
    tags:
      - Recommendation
    ...
    """
    try:
        data = RecommendSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    nama = data.get('nama')
    liked_tags = data.get('liked_tags', [])
    disliked_tags = data.get('disliked_tags', [])
    history = data.get('history', [])
    
    if not liked_tags and not disliked_tags:
        for sw in history:
            card = ml_service.CARD_MAP.get(sw['id'])
            if card:
                if sw.get('liked'):
                    liked_tags.extend(card.get('tags', []))
                else:
                    disliked_tags.extend(card.get('tags', []))

    # 1. Deteksi jawaban ekstrem di Fase 1
    if len(history) > 0:
        phase1_len = 20 if len(history) == 30 else (25 if len(history) == 35 else len(history))
        phase1_history = history[:phase1_len]
        
        all_liked = all(sw.get('liked') for sw in phase1_history)
        all_disliked = all(not sw.get('liked') for sw in phase1_history)
        if all_liked:
            return jsonify({
                'nama': nama,
                'status': 'invalid_all_liked',
                'hasil': [],
                'session_id': str(uuid.uuid4())
            })
        elif all_disliked:
            return jsonify({
                'nama': nama,
                'status': 'invalid_all_disliked',
                'hasil': [],
                'session_id': str(uuid.uuid4())
            })

    try:
        hasil = ml_service.get_rekomendasi(liked_tags, disliked_tags=disliked_tags, history=history)
    except Exception as e:
        logger.error(f"Error in recommend: {e}")
        return jsonify({'error': 'Internal server error'}), 500

    sid = str(uuid.uuid4())
    session['last'] = {
        'session_id': sid,
        'nama':       nama,
        'liked_tags': liked_tags,
        'hasil':      hasil,
    }

    return jsonify({'nama': nama, 'hasil': hasil, 'session_id': sid, 'status': 'ok'})

@api_bp.route('/item-feedback', methods=['POST'])
def item_feedback():
    """
    Menyimpan feedback like/dislike untuk sebuah jurusan.
    ---
    tags:
      - Feedback
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            session_id:
              type: string
            rekomendasi_jurusan:
              type: string
            feedback:
              type: string
              enum: [like, dislike]
    responses:
      200:
        description: Feedback berhasil disimpan
    """
    try:
        data = ItemFeedbackSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    session_id = data.get('session_id')
    rekomendasi_jurusan = data.get('rekomendasi_jurusan')
    feedback = data.get('feedback')

    try:
        existing = ItemFeedback.query.filter_by(
            session_id=session_id, 
            rekomendasi_jurusan=rekomendasi_jurusan
        ).first()

        if existing:
            existing.feedback = feedback
        else:
            new_feedback = ItemFeedback(
                session_id=session_id,
                rekomendasi_jurusan=rekomendasi_jurusan,
                feedback=feedback
            )
            db.session.add(new_feedback)
        
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Database error in item_feedback: {e}")
        return jsonify({'error': 'Failed to save feedback'}), 500

    return jsonify({'message': 'Feedback berhasil disimpan'})

@api_bp.route('/feedback', methods=['POST'])
@limiter.limit("30 per hour")
def feedback():
    """
    Menyimpan rating & komentar dari session user.
    ---
    tags:
      - Feedback
    ...
    """
    try:
        data = FeedbackSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    rating = data.get('rating')
    komentar = data.get('komentar', '')
    web_rating = data.get('web_rating')
    web_komentar = data.get('web_komentar', '')

    last = session.get('last', {})
    hasil = last.get('hasil', [{}, {}, {}])

    try:
        record = FeedbackSession(
            session_id = last.get('session_id', str(uuid.uuid4())),
            nama       = last.get('nama', 'anonymous'),
            liked_tags = ', '.join(last.get('liked_tags', [])),
            hasil_1    = hasil[0].get('jurusan', '') if len(hasil) > 0 else '',
            hasil_2    = hasil[1].get('jurusan', '') if len(hasil) > 1 else '',
            hasil_3    = hasil[2].get('jurusan', '') if len(hasil) > 2 else '',
            rating     = rating,
            komentar   = komentar,
            web_rating = web_rating,
            web_komentar = web_komentar,
        )
        db.session.add(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Database error in feedback: {e}")
        return jsonify({'error': 'Failed to save feedback'}), 500

    return jsonify({'message': 'Feedback tersimpan'})

@api_bp.route('/stats', methods=['GET'])
def stats():
    """
    Mengambil statistik penggunaan aplikasi.
    ---
    tags:
      - Analytics
    responses:
      200:
        description: Statistik aplikasi
    """
    try:
        total = FeedbackSession.query.count()
        rata_rating = 0
        rata_rating_web = 0
        if total > 0:
            ratings     = [r.rating for r in FeedbackSession.query.all() if r.rating is not None]
            if ratings:
                rata_rating = round(sum(ratings) / len(ratings), 2)
            web_ratings = [r.web_rating for r in FeedbackSession.query.all() if r.web_rating is not None]
            if web_ratings:
                rata_rating_web = round(sum(web_ratings) / len(web_ratings), 2)
            
        detail = [r.to_dict() for r in FeedbackSession.query.order_by(
                       FeedbackSession.timestamp.desc()).limit(10).all()]
                       
        item_likes = ItemFeedback.query.filter_by(feedback='like').count()
        item_dislikes = ItemFeedback.query.filter_by(feedback='dislike').count()
        total_item = item_likes + item_dislikes
        like_ratio = round((item_likes / total_item * 100), 2) if total_item > 0 else 0

        return jsonify({
            'total': total, 
            'rata_rating': rata_rating, 
            'rata_rating_web': rata_rating_web,
            'detail': detail,
            'item_feedback': {
                'total_likes': item_likes,
                'total_dislikes': item_dislikes,
                'like_ratio_percent': like_ratio
            }
        })
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return jsonify({'error': 'Failed to fetch stats'}), 500

@api_bp.route('/detail/<path:nama_jurusan>', methods=['GET'])
@cache.cached(timeout=3600)
def api_detail(nama_jurusan):
    """
    Mendapatkan detail dari sebuah jurusan.
    ---
    tags:
      - Explore
    parameters:
      - in: path
        name: nama_jurusan
        required: true
        type: string
    responses:
      200:
        description: Detail jurusan
    """
    try:
        ml_service.initialize()
        df = ml_service.df
        row = df[df['Jurusan'] == nama_jurusan]
        if row.empty:
            return jsonify({'error': 'Jurusan tidak ditemukan'}), 404
        
        r    = row.iloc[0]
        gaji = ml_service.GAJI_MAP.get(r['Kategori'], {'min': 4, 'max': 15, 'currency': 'juta/bulan'})
        return jsonify({
            'jurusan':  r['Jurusan'],
            'kategori': r['Kategori'],
            'deskripsi': r['Deskripsi'],
            'skills':   r['Skills'],
            'karier':   r['Karier'],
            'url':      r['URL'],
            'gaji':     gaji,
        })
    except Exception as e:
        logger.error(f"Error fetching detail for {nama_jurusan}: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@api_bp.route('/explore', methods=['POST'])
@limiter.limit("200 per hour")
def api_explore():
    """
    Explore jurusan berdasarkan query atau liked_tags.
    ---
    tags:
      - Explore
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            liked_tags:
              type: array
              items:
                type: string
            query:
              type: string
            kategori:
              type: string
    responses:
      200:
        description: Hasil explore
    """
    try:
        data = ExploreSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    liked_tags = data.get('liked_tags', [])
    query      = data.get('query', '').strip()
    kategori   = data.get('kategori', '')

    try:
        ml_service.initialize()
        df = ml_service.df

        if liked_tags:
            user_text = ' '.join(liked_tags)
            user_vec  = ml_service.vectorizer.transform([user_text])
            from sklearn.metrics.pairwise import cosine_similarity
            scores    = cosine_similarity(user_vec, ml_service.tfidf_matrix).flatten()
        else:
            scores = [0.0] * len(df)

        result = []
        for idx in range(len(df)):
            j = df['Jurusan'].iloc[idx]
            k = df['Kategori'].iloc[idx]
            kar = df['Karier'].iloc[idx]
            if kategori and kategori != 'Semua' and k != kategori:
                continue
            if query and query.lower() not in j.lower() and query.lower() not in k.lower() and query.lower() not in kar.lower():
                continue
            result.append({
                'jurusan':  j,
                'kategori': k,
                'karier':   kar,
                'skor':     round(float(scores[idx]), 4),
            })

        result.sort(key=lambda x: x['skor'], reverse=True)
        return jsonify({'jurusan': result})
    except Exception as e:
        logger.error(f"Error in explore: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@api_bp.route('/kategori', methods=['GET'])
@cache.cached(timeout=3600)
def api_kategori():
    """
    Mendapatkan list semua kategori jurusan.
    ---
    tags:
      - Explore
    responses:
      200:
        description: List kategori
    """
    try:
        ml_service.initialize()
        cats = sorted(ml_service.df['Kategori'].unique().tolist())
        return jsonify({'kategori': cats})
    except Exception as e:
        logger.error(f"Error fetching categories: {e}")
        return jsonify({'error': 'Internal server error'}), 500
