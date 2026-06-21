import os
import json
import pickle
import random
import logging
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from app.models import db

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════
# CONSTANTS (extracted from magic numbers)
# ══════════════════════════════════════════════════════════════

# Scoring weights
TFIDF_WEIGHT = 0.6
CATEGORY_WEIGHT = 0.4
SCORE_MULTIPLIER = 300
MAX_CONFIDENCE = 95

# Bayesian feedback
BAYESIAN_MIN_VOTES = 5.0    # Minimum votes threshold for Bayesian average
BAYESIAN_MAX_VOTES_CAP = 8  # Cap on vote influence

# Active Learning
EPSILON_EXPLORATION = 0.15  # Probability of random exploration
PHASE2_BOOST = 5.0          # Boost for matching rumpun in Phase 2
PHASE2_PENALTY = -2.0       # Penalty for non-matching rumpun in Phase 2

# Card selection
TOP_CANDIDATES_COUNT = 15   # Number of candidate majors for scoring

# ══════════════════════════════════════════════════════════════
# CATEGORY KEYWORDS — Balanced counts across categories
# ══════════════════════════════════════════════════════════════

CATEGORY_KEYWORDS = {
    'Komputer & Informatika': ['komputer', 'informatika', 'teknologi', 'pemrograman', 'software', 'data', 'keamanan siber', 'jaringan', 'ai', 'robotika'],
    'Matematika & IPA': ['matematika', 'sains', 'fisika', 'kimia', 'biologi', 'statistik', 'analisis data', 'laboratorium', 'penelitian', 'riset'],
    'Ekonomi & Bisnis': ['bisnis', 'ekonomi', 'manajemen', 'keuangan', 'akuntansi', 'pemasaran', 'wirausaha', 'logistik', 'operasional', 'audit'],
    'Ilmu Teknik & Industri': ['teknik', 'manufaktur', 'sistem', 'infrastruktur', 'industri', 'mesin', 'elektro', 'robotika', 'otomasi', 'energi'],
    'Kesehatan & Ilmu Keolahragaan': ['kesehatan', 'medis', 'kedokteran', 'farmasi', 'keperawatan', 'klinis', 'gizi', 'kesehatan masyarakat', 'olahraga', 'terapi'],
    'Ilmu Sosial, Hukum & Politik': ['sosial', 'politik', 'hukum', 'kebijakan', 'pemerintahan', 'administrasi negara', 'ilmu politik', 'komunikasi', 'hubungan masyarakat', 'diplomasi'],
    'Ilmu Pendidikan & Agama Islam': ['pendidikan', 'keguruan', 'pengajaran', 'pgsd', 'bimbingan konseling', 'konseling', 'kurikulum', 'pedagogi', 'didaktik', 'agama'],
    'Seni, Desain & Musik': ['seni', 'desain', 'musik', 'kreatif', 'film', 'broadcasting', 'desain grafis', 'visual', 'ilustrasi', 'pertunjukan'],
    'Sipil & Bangunan': ['teknik sipil', 'arsitektur', 'konstruksi', 'bangunan', 'infrastruktur', 'tata kota', 'perencanaan wilayah', 'struktur', 'geodesi', 'transportasi'],
    'Pertanian': ['pertanian', 'lingkungan', 'ekologi', 'ekosistem', 'agribisnis', 'hortikultura', 'tanaman', 'pangan', 'agroteknologi', 'perkebunan'],
    'Kelautan & Perikanan': ['kelautan', 'perikanan', 'ekosistem laut', 'oseanografi', 'budidaya', 'akuakultur', 'maritim', 'pesisir', 'biota laut', 'navigasi'],
    'Filsafat & Ilmu Budaya': ['filsafat', 'sejarah', 'budaya', 'sastra', 'humaniora', 'teologi', 'ilmu budaya', 'antropologi', 'arkeologi', 'linguistik'],
    'Geografi & Kebumian': ['geografi', 'geologi', 'lingkungan', 'ekologi', 'meteorologi', 'vulkanologi', 'kartografi', 'penginderaan jauh', 'iklim', 'bumi'],
    'Pariwisata & Perhotelan': ['pariwisata', 'perhotelan', 'kuliner', 'hospitality', 'tata boga', 'event', 'destinasi', 'travel', 'akomodasi', 'wisata'],
    'Kehutanan & Peternakan': ['kehutanan', 'peternakan', 'satwa', 'konservasi', 'hewan', 'ternak', 'veteriner', 'hutan', 'kayu', 'fauna'],
    'Kedinasan & Lainnya': ['pemerintahan', 'birokrasi', 'kedinasan', 'administrasi negara', 'militer', 'intelijen', 'kepolisian', 'bea cukai', 'aparatur', 'pelayanan publik']
}

RUMPUN_MAP = {
    'Komputer & Informatika': 'STEM',
    'Matematika & IPA': 'STEM',
    'Ilmu Teknik & Industri': 'STEM',
    'Sipil & Bangunan': 'STEM',
    'Geografi & Kebumian': 'STEM',
    'Kesehatan & Ilmu Keolahragaan': 'KESEHATAN',
    'Ekonomi & Bisnis': 'BISNIS',
    'Pariwisata & Perhotelan': 'BISNIS',
    'Ilmu Sosial, Hukum & Politik': 'SOSIAL_HUMANIORA',
    'Ilmu Pendidikan & Agama Islam': 'SOSIAL_HUMANIORA',
    'Kedinasan & Lainnya': 'SOSIAL_HUMANIORA',
    'Filsafat & Ilmu Budaya': 'SOSIAL_HUMANIORA',
    'Seni, Desain & Musik': 'SENI_KREATIF',
    'Pertanian': 'PERTANIAN_ALAM',
    'Kelautan & Perikanan': 'PERTANIAN_ALAM',
    'Kehutanan & Peternakan': 'PERTANIAN_ALAM'
}

RUMPUN_DISPLAY_NAMES = {
    'STEM': 'Teknologi & Sains (STEM)',
    'KESEHATAN': 'Kesehatan & Medis',
    'BISNIS': 'Bisnis & Keuangan',
    'SOSIAL_HUMANIORA': 'Sosial & Hukum',
    'SENI_KREATIF': 'Kreatif & Seni',
    'PERTANIAN_ALAM': 'Lingkungan & Alam'
}

OPENING_GROUPS = {
    'q1': 'Kreatif',
    'q2': 'Sains',
    'q3': 'Sosial',
    'q4': 'STEM',
    'q5': 'Kesehatan',
    'q6': 'Sosial',
    'q7': 'Teknik',
    'q8': 'Sosial'
}

class MLService:
    _instance = None
    RUMPUN_MAP = RUMPUN_MAP
    RUMPUN_DISPLAY_NAMES = RUMPUN_DISPLAY_NAMES

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MLService, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def initialize(self):
        if self.initialized:
            return

        BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        try:
            logger.info("Memuat ML models dan dataset...")
            with open(os.path.join(BASE_DIR, 'model/vectorizer.pkl'), 'rb') as f:
                self.vectorizer = pickle.load(f)
            with open(os.path.join(BASE_DIR, 'model/tfidf_matrix.pkl'), 'rb') as f:
                self.tfidf_matrix = pickle.load(f)
            
            self.df = pd.read_csv(os.path.join(BASE_DIR, 'data/jurusan_processed.csv'))
            self.df = self.df.fillna('')
            
            with open(os.path.join(BASE_DIR, 'data/questions.json'), 'r', encoding='utf-8') as f:
                _q = json.load(f)
            
            self.CARD_MAP = {c['id']: c for c in _q['cards']}
            self.OPENING_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']
            
            self.GAJI_MAP = {
                'Komputer & Informatika':          {'min': 6, 'max': 25, 'currency': 'juta/bulan'},
                'Matematika & IPA':                {'min': 5, 'max': 18, 'currency': 'juta/bulan'},
                'Ekonomi & Bisnis':                {'min': 5, 'max': 20, 'currency': 'juta/bulan'},
                'Ilmu Teknik & Industri':          {'min': 5, 'max': 20, 'currency': 'juta/bulan'},
                'Kesehatan & Ilmu Keolahragaan':   {'min': 5, 'max': 22, 'currency': 'juta/bulan'},
                'Ilmu Sosial, Hukum & Politik':    {'min': 4, 'max': 15, 'currency': 'juta/bulan'},
                'Ilmu Pendidikan & Agama Islam':   {'min': 3, 'max': 12, 'currency': 'juta/bulan'},
                'Seni, Desain & Musik':            {'min': 4, 'max': 18, 'currency': 'juta/bulan'},
                'Sipil & Bangunan':                {'min': 5, 'max': 18, 'currency': 'juta/bulan'},
                'Pertanian':                       {'min': 4, 'max': 14, 'currency': 'juta/bulan'},
                'Kelautan & Perikanan':            {'min': 4, 'max': 15, 'currency': 'juta/bulan'},
                'Filsafat & Ilmu Budaya':          {'min': 3, 'max': 12, 'currency': 'juta/bulan'},
                'Geografi & Kebumian':             {'min': 4, 'max': 16, 'currency': 'juta/bulan'},
                'Pariwisata & Perhotelan':         {'min': 4, 'max': 15, 'currency': 'juta/bulan'},
                'Kehutanan & Peternakan':          {'min': 4, 'max': 13, 'currency': 'juta/bulan'},
                'Kedinasan & Lainnya':             {'min': 4, 'max': 18, 'currency': 'juta/bulan'},
            }
            
            # Try loading a trained ML model if available
            self.trained_model = None
            trained_model_path = os.path.join(BASE_DIR, 'model/trained_model.pkl')
            if os.path.exists(trained_model_path):
                try:
                    logger.info("Menemukan model hasil training. Memuat model...")
                    with open(trained_model_path, 'rb') as f:
                        self.trained_model = pickle.load(f)
                    logger.info("Model hasil training berhasil dimuat.")
                except Exception as e:
                    logger.error(f"Gagal memuat model hasil training: {e}")

            self.initialized = True
            logger.info("ML models dan dataset berhasil dimuat.")
        except Exception as e:
            logger.error(f"Gagal memuat ML models atau data: {str(e)}")
            raise e

    def get_card_rumpuns(self, card: dict) -> set:
        rumpuns = set()
        card_tags = [t.lower() for t in card.get('tags', [])]
        for cat, keywords in CATEGORY_KEYWORDS.items():
            if any(any(kw in tag for kw in keywords) for tag in card_tags):
                rumpun = RUMPUN_MAP.get(cat)
                if rumpun:
                    rumpuns.add(rumpun)
        return rumpuns

    def _get_top_rumpun(self, history: list) -> str:
        liked_tags = []
        disliked_tags = []
        for sw in history:
            card = self.CARD_MAP.get(sw['id'])
            if card:
                if sw.get('liked'):
                    liked_tags.extend(card.get('tags', []))
                else:
                    disliked_tags.extend(card.get('tags', []))

        tag_weights = {}
        for t in liked_tags:
            tag_weights[t] = tag_weights.get(t, 0) + 1.0
        for t in disliked_tags:
            tag_weights[t] = tag_weights.get(t, 0) - 0.5

        rumpun_scores = {r: 0.0 for r in set(RUMPUN_MAP.values())}
        for cat, keywords in CATEGORY_KEYWORDS.items():
            rumpun = RUMPUN_MAP.get(cat)
            if not rumpun:
                continue
            for t, w in tag_weights.items():
                if w > 0 and any(kw in t.lower() for kw in keywords):
                    rumpun_scores[rumpun] += w

        # Explicit zero-check: only return best rumpun if it has a positive score
        best_rumpun = max(rumpun_scores, key=lambda k: rumpun_scores[k])
        if rumpun_scores[best_rumpun] > 0:
            return best_rumpun
        
        # Fallback to recommended major rumpun
        current_recs = self.get_rekomendasi(liked_tags, disliked_tags=disliked_tags, top_n=1)
        if current_recs:
            return RUMPUN_MAP.get(current_recs[0]['kategori'], 'STEM')
        
        return 'STEM'

    def build_next_card(self, history: list, limit: int = 15) -> dict | None:
        self.initialize()
        if len(history) >= limit:
            return None

        shown = {s['id'] for s in history}

        liked_tags = []
        disliked_tags = []
        for sw in history:
            card = self.CARD_MAP.get(sw['id'])
            if card:
                if sw.get('liked'):
                    liked_tags.extend(card.get('tags', []))
                else:
                    disliked_tags.extend(card.get('tags', []))

        # Determine phase boundary based on actual opening card count
        opening_count = len(self.OPENING_IDS)  # 8
        phase1_len = max(limit - 10, opening_count)  # At least cover opening cards
        is_phase2 = len(history) >= phase1_len
        top_rumpun = None
        if is_phase2:
            top_rumpun = self._get_top_rumpun(history[:phase1_len])

        # Cold start: Diversify opening card presentation
        if not is_phase2 and not liked_tags and not disliked_tags:
            remaining_openings = [oid for oid in self.OPENING_IDS if oid not in shown]
            if remaining_openings:
                shown_groups = [OPENING_GROUPS.get(oid) for oid in shown if oid in OPENING_GROUPS]
                remaining_openings.sort(key=lambda oid: shown_groups.count(OPENING_GROUPS.get(oid)) + random.uniform(0, 0.1))
                return self.CARD_MAP.get(remaining_openings[0])

        # ACTIVE LEARNING: Information Gain + Epsilon-Greedy Exploration
        if len(history) > 0 and random.random() < EPSILON_EXPLORATION:
            shown_rumpuns = set()
            for sw in history:
                card = self.CARD_MAP.get(sw['id'])
                if card:
                    shown_rumpuns.update(self.get_card_rumpuns(card))
            
            explorer_candidates = []
            for cid, card in self.CARD_MAP.items():
                if cid in shown:
                    continue
                card_rumpuns = self.get_card_rumpuns(card)
                if card_rumpuns and not (card_rumpuns & shown_rumpuns):
                    explorer_candidates.append(card)
            
            if explorer_candidates:
                logger.info("Epsilon-Greedy: Melakukan eksplorasi kartu dengan memilih rumpun minat baru.")
                return random.choice(explorer_candidates)

        # Information Gain card selection
        current_recs = self.get_rekomendasi(liked_tags, disliked_tags=disliked_tags, top_n=10)
        
        top_contexts = []
        for r in current_recs:
            ctx = f"{r['kategori']} {r['skills']} {r['jurusan']}".lower()
            top_contexts.append(ctx)

        best_card = None
        best_score = -9999.0

        for cid, card in self.CARD_MAP.items():
            if cid in shown:
                continue

            card_tags = [t.lower() for t in card.get('tags', [])]
            
            match_count = 0
            for ctx in top_contexts:
                if any(tag in ctx for tag in card_tags):
                    match_count += 1
            
            p = match_count / max(len(top_contexts), 1)
            
            # Information Gain: maximum when P ≈ 0.5
            info_gain_score = -abs(p - 0.5)
            info_gain_score += random.uniform(0, 0.05)
            
            if match_count == 0:
                info_gain_score -= 1.0

            # Phase 2 boost/penalty (balanced values)
            if is_phase2 and top_rumpun:
                card_rumpuns = self.get_card_rumpuns(card)
                if top_rumpun in card_rumpuns:
                    info_gain_score += PHASE2_BOOST
                else:
                    info_gain_score += PHASE2_PENALTY

            if info_gain_score > best_score:
                best_score = info_gain_score
                best_card = card

        if best_card:
            return best_card

        # Last-resort fallback
        all_ids = list(self.CARD_MAP.keys())
        random.shuffle(all_ids)
        for cid in all_ids:
            if cid not in shown:
                return self.CARD_MAP.get(cid)

        return None

    def _build_alasan(self, jurusan, skills, tags, history=None):
        if not tags:
            return "Sistem merekomendasikan jurusan ini secara acak karena Anda belum memilih preferensi spesifik."
        
        j_text = str(skills).lower() + " " + str(jurusan).lower()
        base_alasan = ""
        
        if history:
            liked_cards_matching = []
            for sw in history:
                if sw.get('liked'):
                    card = self.CARD_MAP.get(sw['id'])
                    if card:
                        card_tags = card.get('tags', [])
                        matching_tags = [t for t in card_tags if t.lower() in j_text]
                        if matching_tags:
                            liked_cards_matching.append((card, matching_tags))
            
            if liked_cards_matching:
                liked_cards_matching.sort(key=lambda x: len(x[1]), reverse=True)
                best_card, matching_tags = liked_cards_matching[0]
                card_text = best_card.get('text', '')
                base_alasan = f"Direkomendasikan karena kamu memilih 'Iya' pada pertanyaan \"{card_text}\" (terkait {', '.join(matching_tags[:2])})."

        if not base_alasan:
            matched = [t for t in tags if t.lower() in j_text]
            if matched:
                base_alasan = f"{jurusan} direkomendasikan karena Anda memiliki minat pada {', '.join(matched[:3])} yang sangat relevan dengan bidang ini."
            else:
                base_alasan = f"{jurusan} direkomendasikan karena keseluruhan profil minat Anda cocok dengan karakteristik jurusan ini."

        # Dynamic Skills Match
        major_skills = [s.strip() for s in str(skills).split(",") if s.strip()]
        matching_skills = []
        for s in major_skills:
            s_lower = s.lower()
            for t in tags:
                t_lower = t.lower()
                if t_lower in s_lower or s_lower in t_lower:
                    matching_skills.append(s)
                    break

        seen = set()
        unique_matching_skills = []
        for s in matching_skills:
            s_title = s.title()
            if s_title not in seen:
                seen.add(s_title)
                unique_matching_skills.append(s_title)

        if unique_matching_skills:
            skills_list_str = ", ".join(unique_matching_skills[:3])
            base_alasan += f"\n\n🎯 Keahlianmu yang sangat cocok: {skills_list_str}."

        return base_alasan

    def _enforce_category_diversity(self, results: list, top_n: int = 3) -> list:
        """Enforce category diversity: at most 2 results from the same category in top-3."""
        if len(results) <= top_n:
            return results

        selected = []
        category_count = {}
        remaining = []

        for r in results:
            cat = r['kategori']
            current_count = category_count.get(cat, 0)
            if len(selected) < top_n and current_count < 2:
                selected.append(r)
                category_count[cat] = current_count + 1
            else:
                remaining.append(r)

        # Fill remaining slots if diversity filter was too strict
        while len(selected) < top_n and remaining:
            selected.append(remaining.pop(0))

        return selected

    def get_rekomendasi(self, liked_tags: list, disliked_tags: list = None, top_n: int = 3, history: list = None) -> list:
        self.initialize()
        
        # If a trained ML model is available, use it
        if getattr(self, 'trained_model', None) is not None:
            try:
                return self._get_rekomendasi_trained(liked_tags, disliked_tags, top_n, history)
            except Exception as e:
                logger.error(f"Gagal menggunakan model hasil training: {e}. Menggunakan fallback TF-IDF default.")
        
        # 1. Fetch community feedback data (cached 60s)
        likes_count = {}
        dislikes_count = {}
        
        from app import cache
        cached_fb = None
        try:
            cached_fb = cache.get("popularity_feedback_counts")
        except Exception as e:
            logger.warning(f"Cache read error for popularity counts (non-fatal): {e}")
            
        if cached_fb is not None:
            likes_count, dislikes_count = cached_fb
        else:
            try:
                # Bayesian feedback boost was previously driven by ItemFeedback.
                # Now disabled as ItemFeedback has been dropped.
                pass
            except Exception as e:
                logger.error(f"Error fetching feedback counts from DB: {e}")

        # If no tags, do random selection (fallback)
        if not liked_tags:
            idx_samples = random.sample(range(len(self.df)), min(top_n, len(self.df)))
            results = []
            for i in idx_samples:
                j_name = self.df['Jurusan'].iloc[i]
                results.append({
                    'jurusan':   j_name,
                    'kategori':  self.df['Kategori'].iloc[i],
                    'skor':      0,
                    'likes':     likes_count.get(j_name, 0),
                    'skills':    self.df['Skills'].iloc[i],
                    'karier':    self.df['Karier'].iloc[i],
                    'deskripsi': str(self.df['Deskripsi'].iloc[i])[:300] + '...',
                    'url':       self.df['URL'].iloc[i],
                    'alasan':    self._build_alasan(j_name, self.df['Skills'].iloc[i], [], history=history)
                })
            
            results.sort(key=lambda x: (-x['skor'], -x['likes'], x['jurusan']))
            return results

        # 2. Net-Weighting for each tag
        tag_weights = {}
        for t in liked_tags:
            tag_weights[t] = tag_weights.get(t, 0) + 1.0
        if disliked_tags:
            for t in disliked_tags:
                tag_weights[t] = tag_weights.get(t, 0) - 0.5

        # 3. Build Rocchio vector from net-weighted tags
        pos_terms = []
        for t, w in tag_weights.items():
            if w > 0:
                pos_terms.extend([t] * int(round(w)))
        pos_text = ' '.join(pos_terms) if pos_terms else 'empty'
        pos_vec = self.vectorizer.transform([pos_text])
        
        neg_terms = []
        for t, w in tag_weights.items():
            if w < 0:
                neg_terms.extend([t] * int(round(abs(w))))
        
        if neg_terms:
            import numpy as np
            from scipy.sparse import csr_matrix
            neg_text = ' '.join(neg_terms)
            neg_vec = self.vectorizer.transform([neg_text])
            user_vec_dense = pos_vec.toarray() - 0.5 * neg_vec.toarray()
            user_vec_dense = np.clip(user_vec_dense, 0, None)
            user_vec = csr_matrix(user_vec_dense)
        else:
            user_vec = pos_vec

        # 4. Cosine Similarity (TF-IDF)
        scores = cosine_similarity(user_vec, self.tfidf_matrix).flatten()
        
        # 5. Category Profiling
        user_cat_profile = {}
        for cat, keywords in CATEGORY_KEYWORDS.items():
            match_score = 0.0
            for t, w in tag_weights.items():
                if w > 0 and any(kw in t.lower() for kw in keywords):
                    match_score += w
            if match_score > 0:
                user_cat_profile[cat] = match_score
        
        # Normalize category profile
        total_cat_weight = sum(user_cat_profile.values())
        if total_cat_weight > 0:
            user_cat_profile = {c: w / total_cat_weight for c, w in user_cat_profile.items()}

        # 6. Combined Score (TF-IDF + Category + Feedback Boost)
        top_idx_candidate = scores.argsort()[-TOP_CANDIDATES_COUNT:][::-1]
        results = []
        
        # Bayesian Average statistics
        total_likes = sum(likes_count.values())
        total_dislikes = sum(dislikes_count.values())
        tot_global = total_likes + total_dislikes
        C = total_likes / tot_global if tot_global > 0 else 0.5

        for idx in top_idx_candidate:
            j_name = self.df['Jurusan'].iloc[idx]
            j_cat = self.df['Kategori'].iloc[idx]
            
            tfidf_score = float(scores[idx])
            cat_score = user_cat_profile.get(j_cat, 0.0)
            
            combined_score = (TFIDF_WEIGHT * tfidf_score) + (CATEGORY_WEIGHT * cat_score)
            confidence = min(int(round(combined_score * SCORE_MULTIPLIER)), MAX_CONFIDENCE)
            
            # Bayesian Average Feedback Boost
            likes = likes_count.get(j_name, 0)
            dislikes = dislikes_count.get(j_name, 0)
            v = likes + dislikes
            if v > 0:
                R = likes / v
                bayesian_ratio = (v / (v + BAYESIAN_MIN_VOTES)) * R + (BAYESIAN_MIN_VOTES / (v + BAYESIAN_MIN_VOTES)) * C
                fb_boost = (bayesian_ratio - 0.5) * min(v, BAYESIAN_MAX_VOTES_CAP)
                confidence = min(max(int(round(confidence + fb_boost)), 0), 99)

            results.append({
                'jurusan':   j_name,
                'kategori':  j_cat,
                'skor':      confidence,
                'likes':     likes,
                'skills':    self.df['Skills'].iloc[idx],
                'karier':    self.df['Karier'].iloc[idx],
                'deskripsi': str(self.df['Deskripsi'].iloc[idx])[:300] + '...',
                'url':       self.df['URL'].iloc[idx],
                'alasan':    self._build_alasan(j_name, self.df['Skills'].iloc[idx], liked_tags, history=history)
            })

        # Sort by combined score
        results.sort(key=lambda x: (-x['skor'], -x['likes'], x['jurusan']))
        
        # Enforce category diversity in top results
        results = self._enforce_category_diversity(results, top_n)
        
        return results[:top_n]

    def _get_rekomendasi_trained(self, liked_tags: list, disliked_tags: list = None, top_n: int = 3, history: list = None) -> list:
        """
        Fungsi inferensi untuk model machine learning hasil training.
        Silakan modifikasi fungsi ini setelah Anda melatih model baru.
        """
        if not hasattr(self.trained_model, 'predict_proba') and not hasattr(self.trained_model, 'predict'):
            raise NotImplementedError("Objek trained_model.pkl terdeteksi tetapi belum di-fit atau tidak memiliki metode predict/predict_proba.")

        return []

ml_service = MLService()
