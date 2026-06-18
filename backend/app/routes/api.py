from flask import Blueprint, request, jsonify, current_app
from functools import wraps
import uuid
import json
import re
import logging
from marshmallow import ValidationError
from sqlalchemy import func

from app.models import (
    db, FeedbackSession, ItemFeedback,
    UserProfile, QuestionResponse, RecommendationResult,
    RecommendationFeedback, SessionEvaluation
)
from app.services.ml_service import ml_service
from app import cache, limiter
from app.schemas import (
    NextCardSchema, RecommendSchema, ItemFeedbackSchema,
    FeedbackSchema, ExploreSchema,
    UserProfileSchema, QuestionResponseSchema, QuestionResponseBatchSchema,
    RecommendationFeedbackSchema, SessionEvaluationSchema
)

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__)


# ══════════════════════════════════════════════════════════════
# UTILITIES
# ══════════════════════════════════════════════════════════════

def sanitize_text(text: str, max_length: int = 500) -> str:
    """Sanitize user-supplied text to prevent XSS and abuse."""
    if not text:
        return ''
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Trim whitespace
    text = text.strip()
    # Enforce max length
    return text[:max_length]


def require_admin_key(f):
    """Decorator to require ADMIN_API_KEY for sensitive endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        admin_key = current_app.config.get('ADMIN_API_KEY', '')
        if not admin_key:
            return jsonify({'error': 'Admin endpoint not configured'}), 503

        provided_key = request.headers.get('X-Admin-Key', '') or request.args.get('key', '')
        if not provided_key or provided_key != admin_key:
            return jsonify({'error': 'Unauthorized — valid admin API key required'}), 401

        return f(*args, **kwargs)
    return decorated_function


def error_response(message: str, status_code: int = 500):
    """Standardized error response format."""
    return jsonify({'error': message}), status_code


# ══════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════

@api_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for deployment monitoring.
    ---
    tags:
      - System
    responses:
      200:
        description: Service is healthy
    """
    try:
        # Verify database connection
        db.session.execute(db.text('SELECT 1'))
        db_status = 'connected'
    except Exception:
        db_status = 'disconnected'

    try:
        ml_service.initialize()
        ml_status = 'loaded'
    except Exception:
        ml_status = 'not_loaded'

    status = 'healthy' if db_status == 'connected' and ml_status == 'loaded' else 'degraded'

    return jsonify({
        'status': status,
        'database': db_status,
        'ml_service': ml_status,
        'version': '2.0.0-beta',
    }), 200 if status == 'healthy' else 503


# ══════════════════════════════════════════════════════════════
# EXISTING ENDPOINTS (backward compatible)
# ══════════════════════════════════════════════════════════════

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
        return error_response('Internal server error')

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

        rumpun_id_map = {
            'SOSIAL_HUMANIORA': 'sosial',
            'PERTANIAN_ALAM': 'lingkungan',
            'SENI_KREATIF': 'kreatif',
            'STEM': 'stem',
            'KESEHATAN': 'kesehatan',
            'BISNIS': 'bisnis',
        }
        rumpun_id = rumpun_id_map.get(top_rumpun_key, top_rumpun_key.lower())
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
    """
    try:
        data = RecommendSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    nama = sanitize_text(data.get('nama', 'Kamu'), max_length=100)
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

    # Generate a unique cache key based on sorted liked and disliked tags
    sorted_likes = sorted(list(set(liked_tags)))
    sorted_dislikes = sorted(list(set(disliked_tags)))
    cache_key = f"rec_results:{','.join(sorted_likes)}|{','.join(sorted_dislikes)}"

    # Check cache
    cached_hasil = None
    try:
        cached_hasil = cache.get(cache_key)
    except Exception as e:
        logger.warning(f"Cache read error (non-fatal): {e}")

    if cached_hasil is not None:
        hasil = cached_hasil
    else:
        # Detect extreme answers in Phase 1
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
            try:
                cache.set(cache_key, hasil, timeout=300)
            except Exception as e:
                logger.warning(f"Cache write error (non-fatal): {e}")
        except Exception as e:
            logger.error(f"Error in recommend: {e}")
            return error_response('Internal server error')

    # Use session_id from frontend if available (beta testing), else generate new one
    sid = data.get('session_id')
    if not sid:
        sid = str(uuid.uuid4())

    # Auto-save session details to the database
    try:
        user_agent = sanitize_text(request.headers.get('User-Agent', ''), max_length=500)

        record = FeedbackSession(
            session_id=sid,
            nama=nama,
            liked_tags=', '.join(liked_tags),
            disliked_tags=', '.join(disliked_tags),
            swipe_history=json.dumps(history),
            hasil_1=hasil[0].get('jurusan', '') if len(hasil) > 0 else '',
            hasil_2=hasil[1].get('jurusan', '') if len(hasil) > 1 else '',
            hasil_3=hasil[2].get('jurusan', '') if len(hasil) > 2 else '',
            user_agent=user_agent,
        )
        db.session.add(record)

        # Beta Testing: Auto-save ke RecommendationResult
        for i, h in enumerate(hasil[:3]):
            rec_result = RecommendationResult(
                session_id=sid,
                rank=i + 1,
                jurusan=h.get('jurusan', ''),
                kategori=h.get('kategori', ''),
                confidence_score=h.get('skor', 0),
            )
            db.session.add(rec_result)

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Database error auto-saving feedback session in recommend: {e}")

    return jsonify({'nama': nama, 'hasil': hasil, 'session_id': sid, 'status': 'ok'})

@api_bp.route('/item-feedback', methods=['POST'])
@limiter.limit("120 per hour")
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
        return error_response('Failed to save feedback')

    return jsonify({'message': 'Feedback berhasil disimpan'})

@api_bp.route('/feedback', methods=['POST'])
@limiter.limit("30 per hour")
def feedback():
    """
    Menyimpan rating & komentar dari session user.
    ---
    tags:
      - Feedback
    """
    try:
        data = FeedbackSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    session_id = data.get('session_id')
    rating = data.get('rating')
    komentar = sanitize_text(data.get('komentar', ''), max_length=2000)
    web_rating = data.get('web_rating')
    web_komentar = sanitize_text(data.get('web_komentar', ''), max_length=2000)

    try:
        # Find the record that was created during /recommend
        record = FeedbackSession.query.filter_by(session_id=session_id).first()
        if record:
            record.rating = rating
            record.komentar = komentar
            record.web_rating = web_rating
            record.web_komentar = web_komentar
            db.session.commit()
        else:
            # Record not found — create minimal record (do NOT use Flask session fallback)
            record = FeedbackSession(
                session_id=session_id,
                nama='anonymous',
                liked_tags='',
                hasil_1='',
                hasil_2='',
                hasil_3='',
                rating=rating,
                komentar=komentar,
                web_rating=web_rating,
                web_komentar=web_komentar,
            )
            db.session.add(record)
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Database error in feedback: {e}")
        return error_response('Failed to save feedback')

    return jsonify({'message': 'Feedback tersimpan'})

@api_bp.route('/debug-db', methods=['GET'])
@require_admin_key
def debug_db():
    """Temporary: cek schema PostgreSQL dan jalankan db upgrade."""
    try:
        from sqlalchemy import inspect as sa_inspect, text
        inspector = sa_inspect(db.engine)

        # Cek kolom user_profiles
        try:
            cols = [c['name'] for c in inspector.get_columns('user_profiles')]
        except Exception as e:
            cols = [f'ERROR: {e}']

        # Cek alembic version
        try:
            result = db.session.execute(text('SELECT version_num FROM alembic_version')).fetchall()
            alembic_ver = [r[0] for r in result]
        except Exception as e:
            alembic_ver = [f'ERROR: {e}']

        # Cek semua tabel
        try:
            tables = inspector.get_table_names()
        except Exception as e:
            tables = [f'ERROR: {e}']

        # Coba test insert user_profiles
        test_result = 'not tested'
        try:
            from app.models import UserProfile
            test = UserProfile(
                session_id='debug_test_xyz_999',
                gender='L', kelas='12', jurusan_sma='IPA',
                jurusan_impian='Test', tingkat_keyakinan=3,
                sudah_riset=False, sumber_info='[]'
            )
            db.session.add(test)
            db.session.flush()  # Try insert without commit
            db.session.rollback()  # Rollback test
            test_result = 'INSERT OK (rolled back)'
        except Exception as e:
            db.session.rollback()
            test_result = f'INSERT FAILED: {str(e)}'

        return jsonify({
            'user_profiles_columns': cols,
            'alembic_version': alembic_ver,
            'tables': tables,
            'test_insert': test_result,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/stats', methods=['GET'])
@require_admin_key
def stats():
    """
    Mengambil statistik penggunaan aplikasi. Requires admin API key.
    ---
    tags:
      - Analytics
    parameters:
      - in: header
        name: X-Admin-Key
        required: true
        type: string
    responses:
      200:
        description: Statistik aplikasi
      401:
        description: Unauthorized
    """

    try:
        total = FeedbackSession.query.count()

        # Use SQL aggregation instead of loading all records
        rata_rating = 0
        rata_rating_web = 0
        if total > 0:
            avg_rating_result = db.session.query(
                func.avg(FeedbackSession.rating)
            ).filter(FeedbackSession.rating.isnot(None)).scalar()
            if avg_rating_result:
                rata_rating = round(float(avg_rating_result), 2)

            avg_web_result = db.session.query(
                func.avg(FeedbackSession.web_rating)
            ).filter(FeedbackSession.web_rating.isnot(None)).scalar()
            if avg_web_result:
                rata_rating_web = round(float(avg_web_result), 2)

        # Pseudonymize user names in detail — show only first char + asterisks
        raw_detail = FeedbackSession.query.order_by(
            FeedbackSession.timestamp.desc()
        ).limit(10).all()

        detail = []
        for r in raw_detail:
            d = r.to_dict()
            # Pseudonymize nama
            name = d.get('nama', '')
            if name and len(name) > 1:
                d['nama'] = name[0] + '*' * (len(name) - 1)
            detail.append(d)

        item_likes = ItemFeedback.query.filter_by(feedback='like').count()
        item_dislikes = ItemFeedback.query.filter_by(feedback='dislike').count()
        total_item = item_likes + item_dislikes
        like_ratio = round((item_likes / total_item * 100), 2) if total_item > 0 else 0

        # Beta testing stats (use aggregation)
        beta_stats = {}
        try:
            total_profiles = UserProfile.query.count()
            total_evaluations = SessionEvaluation.query.count()
            total_q_responses = QuestionResponse.query.count()

            avg_kesesuaian = 0
            avg_kepuasan = 0
            avg_nps = 0
            if total_evaluations > 0:
                avg_k = db.session.query(func.avg(SessionEvaluation.rating_kesesuaian)).scalar()
                avg_p = db.session.query(func.avg(SessionEvaluation.rating_kepuasan)).scalar()
                if avg_k:
                    avg_kesesuaian = round(float(avg_k), 2)
                if avg_p:
                    avg_kepuasan = round(float(avg_p), 2)

                # NPS calculation
                nps_vals = [e.nps_score for e in SessionEvaluation.query.with_entities(SessionEvaluation.nps_score).filter(SessionEvaluation.nps_score.isnot(None)).all()]
                if nps_vals:
                    promoters = sum(1 for v in nps_vals if v[0] >= 9)
                    detractors = sum(1 for v in nps_vals if v[0] <= 6)
                    avg_nps = round((promoters - detractors) / len(nps_vals) * 100, 1)

            beta_stats = {
                'total_profiles': total_profiles,
                'total_evaluations': total_evaluations,
                'total_question_responses': total_q_responses,
                'avg_kesesuaian': avg_kesesuaian,
                'avg_kepuasan': avg_kepuasan,
                'nps': avg_nps,
            }
        except Exception as e:
            logger.error(f"Error computing beta stats: {e}")

        return jsonify({
            'total': total,
            'rata_rating': rata_rating,
            'rata_rating_web': rata_rating_web,
            'detail': detail,
            'item_feedback': {
                'total_likes': item_likes,
                'total_dislikes': item_dislikes,
                'like_ratio_percent': like_ratio
            },
            'beta_testing': beta_stats
        })
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return error_response('Failed to fetch stats')

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

        r = row.iloc[0]
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
        return error_response('Internal server error')

@api_bp.route('/explore', methods=['POST'])
@limiter.limit("200 per hour")
def api_explore():
    """
    Explore jurusan berdasarkan query atau liked_tags.
    ---
    tags:
      - Explore
    """
    try:
        data = ExploreSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    liked_tags = data.get('liked_tags', [])
    query = data.get('query', '').strip()
    kategori = data.get('kategori', '')

    try:
        ml_service.initialize()
        df = ml_service.df

        if liked_tags:
            user_text = ' '.join(liked_tags)
            user_vec = ml_service.vectorizer.transform([user_text])
            from sklearn.metrics.pairwise import cosine_similarity
            scores = cosine_similarity(user_vec, ml_service.tfidf_matrix).flatten()
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
        return error_response('Internal server error')

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
        return error_response('Internal server error')


# ══════════════════════════════════════════════════════════════
# BETA TESTING VALIDATION ENDPOINTS
# ══════════════════════════════════════════════════════════════

@api_bp.route('/user-profile', methods=['POST'])
@limiter.limit("60 per hour")
def save_user_profile():
    """
    Menyimpan data demografi + ground truth pre-test pengguna.
    ---
    tags:
      - Beta Testing
    """
    try:
        data = UserProfileSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    try:
        existing = UserProfile.query.filter_by(session_id=data['session_id']).first()
        if existing:
            for key, val in data.items():
                if key == 'sumber_info':
                    setattr(existing, key, json.dumps(val))
                elif key != 'session_id':
                    setattr(existing, key, val)
            db.session.commit()
            return jsonify({'message': 'Profil berhasil diperbarui', 'session_id': data['session_id']})

        profile = UserProfile(
            session_id=data['session_id'],
            gender=data['gender'],
            kelas=data['kelas'],
            jurusan_sma=data['jurusan_sma'],
            provinsi=data.get('provinsi', ''),
            tipe_sekolah=data.get('tipe_sekolah', ''),
            jurusan_impian=data['jurusan_impian'],
            jurusan_diminati_1=data.get('jurusan_diminati_1', ''),
            jurusan_diminati_2=data.get('jurusan_diminati_2', ''),
            jurusan_diminati_3=data.get('jurusan_diminati_3', ''),
            tingkat_keyakinan=data['tingkat_keyakinan'],
            sudah_riset=data.get('sudah_riset', False),
            sumber_info=json.dumps(data.get('sumber_info', [])),
        )
        db.session.add(profile)
        db.session.commit()
        return jsonify({'message': 'Profil berhasil disimpan', 'session_id': data['session_id']})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Database error in save_user_profile: {e}")
        return error_response('Gagal menyimpan profil')


@api_bp.route('/question-response', methods=['POST'])
@limiter.limit("600 per hour")
def save_question_response():
    """
    Menyimpan jawaban per-pertanyaan dengan response time.
    Menerima satu jawaban atau batch jawaban.
    ---
    tags:
      - Beta Testing
    """
    raw = request.get_json() or {}

    # Detect if this is a batch or single response
    if 'responses' in raw:
        # Batch mode
        try:
            data = QuestionResponseBatchSchema().load(raw)
        except ValidationError as err:
            return jsonify(err.messages), 400

        session_id = data['session_id']
        responses_data = data['responses']

        try:
            saved_count = 0
            for r in responses_data:
                # Validate individual response fields
                question_id = r.get('question_id', '')
                response_val = r.get('response', 'skip')
                if not question_id or response_val not in ('like', 'skip'):
                    continue  # Skip invalid entries

                qr = QuestionResponse(
                    session_id=session_id,
                    question_id=question_id,
                    response=response_val,
                    response_time_ms=max(0, int(r.get('response_time_ms', 0))),
                    question_order=max(0, int(r.get('question_order', 0))),
                    phase=r.get('phase', '') if r.get('phase', '') in ('opening', 'exploration', 'detail', '') else '',
                )
                db.session.add(qr)
                saved_count += 1
            db.session.commit()
            return jsonify({'message': f'{saved_count} jawaban berhasil disimpan'})
        except Exception as e:
            db.session.rollback()
            logger.error(f"Database error in save_question_response (batch): {e}")
            return error_response('Gagal menyimpan jawaban')
    else:
        # Single mode
        try:
            data = QuestionResponseSchema().load(raw)
        except ValidationError as err:
            return jsonify(err.messages), 400

        try:
            qr = QuestionResponse(
                session_id=data['session_id'],
                question_id=data['question_id'],
                response=data['response'],
                response_time_ms=data.get('response_time_ms', 0),
                question_order=data.get('question_order', 0),
                phase=data.get('phase', ''),
            )
            db.session.add(qr)
            db.session.commit()
            return jsonify({'message': 'Jawaban berhasil disimpan'})
        except Exception as e:
            db.session.rollback()
            logger.error(f"Database error in save_question_response: {e}")
            return error_response('Gagal menyimpan jawaban')


@api_bp.route('/recommendation-feedback', methods=['POST'])
@limiter.limit("60 per hour")
def save_recommendation_feedback():
    """
    Menyimpan feedback per-jurusan rekomendasi (rating tertarik, pertimbangkan, novelty).
    ---
    tags:
      - Beta Testing
    """
    try:
        data = RecommendationFeedbackSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    session_id = data['session_id']
    feedbacks = data['feedbacks']

    try:
        for fb in feedbacks:
            existing = RecommendationFeedback.query.filter_by(
                session_id=session_id,
                jurusan=fb.get('jurusan', '')
            ).first()

            if existing:
                existing.rating_tertarik = fb.get('rating_tertarik')
                existing.pertimbangkan = fb.get('pertimbangkan')
                existing.sudah_tahu = fb.get('sudah_tahu')
            else:
                rec_fb = RecommendationFeedback(
                    session_id=session_id,
                    jurusan=fb.get('jurusan', ''),
                    rank=fb.get('rank'),
                    rating_tertarik=fb.get('rating_tertarik'),
                    pertimbangkan=fb.get('pertimbangkan'),
                    sudah_tahu=fb.get('sudah_tahu'),
                )
                db.session.add(rec_fb)

        db.session.commit()
        return jsonify({'message': 'Feedback rekomendasi berhasil disimpan'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Database error in save_recommendation_feedback: {e}")
        return error_response('Gagal menyimpan feedback rekomendasi')


@api_bp.route('/session-evaluation', methods=['POST'])
@limiter.limit("60 per hour")
def save_session_evaluation():
    """
    Menyimpan evaluasi keseluruhan sesi (kesesuaian, kepuasan, wawasan, NPS).
    ---
    tags:
      - Beta Testing
    """
    try:
        data = SessionEvaluationSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    session_id = data['session_id']

    try:
        existing = SessionEvaluation.query.filter_by(session_id=session_id).first()
        if existing:
            existing.rating_kesesuaian = data['rating_kesesuaian']
            existing.rating_kepuasan = data['rating_kepuasan']
            existing.rating_wawasan = data['rating_wawasan']
            existing.nps_score = data['nps_score']
            existing.jurusan_seharusnya = sanitize_text(data.get('jurusan_seharusnya', ''), max_length=200)
            existing.komentar = sanitize_text(data.get('komentar', ''), max_length=2000)
            existing.durasi_total_detik = data.get('durasi_total_detik', 0)
            db.session.commit()
            return jsonify({'message': 'Evaluasi berhasil diperbarui'})

        evaluation = SessionEvaluation(
            session_id=session_id,
            rating_kesesuaian=data['rating_kesesuaian'],
            rating_kepuasan=data['rating_kepuasan'],
            rating_wawasan=data['rating_wawasan'],
            nps_score=data['nps_score'],
            jurusan_seharusnya=sanitize_text(data.get('jurusan_seharusnya', ''), max_length=200),
            komentar=sanitize_text(data.get('komentar', ''), max_length=2000),
            durasi_total_detik=data.get('durasi_total_detik', 0),
        )
        db.session.add(evaluation)
        db.session.commit()
        return jsonify({'message': 'Evaluasi berhasil disimpan'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Database error in save_session_evaluation: {e}")
        return error_response('Gagal menyimpan evaluasi')


@api_bp.route('/jurusan-list', methods=['GET'])
@cache.cached(timeout=3600)
def jurusan_list():
    """
    Mendapatkan list semua nama jurusan untuk autocomplete.
    ---
    tags:
      - Beta Testing
    responses:
      200:
        description: List nama jurusan
    """
    try:
        ml_service.initialize()
        jurusan = sorted(ml_service.df['Jurusan'].unique().tolist())
        return jsonify({'jurusan': jurusan})
    except Exception as e:
        logger.error(f"Error fetching jurusan list: {e}")
        return error_response('Internal server error')


@api_bp.route('/export-research', methods=['GET'])
@require_admin_key
def export_research_data():
    """
    Export dataset penelitian lengkap (gabungan semua tabel beta testing).
    Requires admin API key via X-Admin-Key header.
    ---
    tags:
      - Beta Testing
    parameters:
      - in: header
        name: X-Admin-Key
        required: true
        type: string
    responses:
      200:
        description: Dataset penelitian dalam format JSON
      401:
        description: Unauthorized
    """
    try:
        profiles = UserProfile.query.all()
        evaluations = {e.session_id: e for e in SessionEvaluation.query.all()}
        rec_results = {}
        for r in RecommendationResult.query.all():
            rec_results.setdefault(r.session_id, []).append(r)
        rec_feedbacks = {}
        for f in RecommendationFeedback.query.all():
            rec_feedbacks.setdefault(f.session_id, []).append(f)
        q_responses = {}
        for q in QuestionResponse.query.all():
            q_responses.setdefault(q.session_id, []).append(q)

        dataset = []
        for profile in profiles:
            sid = profile.session_id
            row = profile.to_dict()
            # Pseudonymize — remove real name from export
            row.pop('nama', None)

            # Add question responses
            if sid in q_responses:
                for qr in q_responses[sid]:
                    row[f'{qr.question_id}_response'] = 1 if qr.response == 'like' else 0
                    row[f'{qr.question_id}_time_ms'] = qr.response_time_ms
                row['total_questions_answered'] = len(q_responses[sid])
                row['total_liked'] = sum(1 for qr in q_responses[sid] if qr.response == 'like')
                row['total_skipped'] = sum(1 for qr in q_responses[sid] if qr.response == 'skip')
                times = [qr.response_time_ms for qr in q_responses[sid] if qr.response_time_ms and qr.response_time_ms > 0]
                row['avg_response_time_ms'] = round(sum(times) / len(times), 0) if times else 0

            # Add recommendation results
            if sid in rec_results:
                for rr in sorted(rec_results[sid], key=lambda x: x.rank):
                    row[f'hasil_{rr.rank}'] = rr.jurusan
                    row[f'skor_{rr.rank}'] = rr.confidence_score
                    row[f'kategori_{rr.rank}'] = rr.kategori

            # Add recommendation feedback
            if sid in rec_feedbacks:
                for rf in rec_feedbacks[sid]:
                    rank = rf.rank or 0
                    if rank > 0:
                        row[f'rating_tertarik_{rank}'] = rf.rating_tertarik
                        row[f'pertimbangkan_{rank}'] = rf.pertimbangkan
                        row[f'novelty_{rank}'] = not rf.sudah_tahu if rf.sudah_tahu is not None else None

            # Add session evaluation
            if sid in evaluations:
                ev = evaluations[sid]
                row['rating_kesesuaian'] = ev.rating_kesesuaian
                row['rating_kepuasan'] = ev.rating_kepuasan
                row['rating_wawasan'] = ev.rating_wawasan
                row['nps_score'] = ev.nps_score
                row['jurusan_seharusnya'] = ev.jurusan_seharusnya
                row['komentar_evaluasi'] = ev.komentar
                row['durasi_total_detik'] = ev.durasi_total_detik

            # Computed columns
            hasil_list = [row.get(f'hasil_{i}', '') for i in range(1, 4)]
            row['hit_jurusan_impian'] = 1 if profile.jurusan_impian in hasil_list else 0
            diminati = [profile.jurusan_diminati_1, profile.jurusan_diminati_2, profile.jurusan_diminati_3]
            row['hit_top3_diminati'] = 1 if any(d in hasil_list for d in diminati if d) else 0

            dataset.append(row)

        return jsonify({
            'total': len(dataset),
            'dataset': dataset
        })
    except Exception as e:
        logger.error(f"Error exporting research data: {e}")
        return error_response('Gagal mengekspor data penelitian')
