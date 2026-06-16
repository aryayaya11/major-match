import os
import json
import pickle
import random
import logging
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from app.models import ItemFeedback, db

logger = logging.getLogger(__name__)

CATEGORY_KEYWORDS = {
    'Komputer & Informatika': ['komputer', 'informatika', 'teknologi', 'pemrograman', 'software', 'data', 'keamanan siber', 'jaringan', 'ai', 'robotika', 'algoritma'],
    'Matematika & IPA': ['matematika', 'sains', 'fisika', 'kimia', 'biologi', 'statistik', 'analisis data', 'laboratorium', 'penelitian', 'riset'],
    'Ekonomi & Bisnis': ['bisnis', 'ekonomi', 'manajemen', 'keuangan', 'akuntansi', 'pemasaran', 'wirausaha', 'logistik', 'operasional', 'audit'],
    'Ilmu Teknik & Industri': ['teknik', 'manufaktur', 'sistem', 'infrastruktur', 'industri', 'mesin', 'elektro', 'robotika'],
    'Kesehatan & Ilmu Keolahragaan': ['kesehatan', 'medis', 'kedokteran', 'farmasi', 'keperawatan', 'klinis', 'gizi', 'kesehatan masyarakat', 'olahraga'],
    'Ilmu Sosial, Hukum & Politik': ['sosial', 'politik', 'hukum', 'kebijakan', 'pemerintahan', 'administrasi negara', 'ilmu politik', 'komunikasi', 'hubungan masyarakat'],
    'Ilmu Pendidikan & Agama Islam': ['pendidikan', 'keguruan', 'pengajaran', 'pgsd', 'bimbingan konseling', 'konseling'],
    'Seni, Desain & Musik': ['seni', 'desain', 'musik', 'kreatif', 'film', 'broadcasting', 'desain grafis', 'ui/ux', 'visual', 'ilustrasi', '3d', 'seni rupa', 'seni musik', 'seni pertunjukan', 'desain komunikasi visual'],
    'Sipil & Bangunan': ['teknik sipil', 'arsitektur', 'konstruksi', 'bangunan', 'infrastruktur'],
    'Pertanian': ['pertanian', 'lingkungan', 'ekologi', 'ekosistem'],
    'Kelautan & Perikanan': ['kelautan', 'perikanan', 'ekosistem', 'lingkungan'],
    'Filsafat & Ilmu Budaya': ['filsafat', 'sejarah', 'budaya', 'sastra', 'humaniora', 'teologi', 'ilmu budaya'],
    'Geografi & Kebumian': ['geografi', 'geologi', 'lingkungan', 'ekologi'],
    'Pariwisata & Perhotelan': ['pariwisata', 'perhotelan', 'kuliner', 'hospitality', 'tata boga', 'hubungan masyarakat', 'event'],
    'Kehutanan & Peternakan': ['kehutanan', 'peternakan', 'lingkungan', 'ekologi', 'hewan'],
    'Kedinasan & Lainnya': ['pemerintahan', 'birokrasi', 'kedinasan', 'administrasi negara']
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
            
            # Coba memuat model terlatih baru jika ada di folder model/
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

        rumpun_scores = {r: 0.0 for r in RUMPUN_MAP.values()}
        for cat, keywords in CATEGORY_KEYWORDS.items():
            rumpun = RUMPUN_MAP.get(cat)
            if not rumpun:
                continue
            for t, w in tag_weights.items():
                if w > 0 and any(kw in t.lower() for kw in keywords):
                    rumpun_scores[rumpun] += w

        best_rumpun = max(rumpun_scores, key=rumpun_scores.get)
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

        phase1_len = limit - 10
        is_phase2 = len(history) >= phase1_len
        top_rumpun = None
        if is_phase2:
            top_rumpun = self._get_top_rumpun(history[:phase1_len])

        # Cold start: Diversifikasi penyajian kartu pembuka
        if not is_phase2 and not liked_tags and not disliked_tags:
            remaining_openings = [oid for oid in self.OPENING_IDS if oid not in shown]
            if remaining_openings:
                shown_groups = [OPENING_GROUPS.get(oid) for oid in shown if oid in OPENING_GROUPS]
                # Urutkan berdasarkan kemunculan grup terkecil + noise acak kecil agar dinamis
                remaining_openings.sort(key=lambda oid: shown_groups.count(OPENING_GROUPS.get(oid)) + random.uniform(0, 0.1))
                return self.CARD_MAP.get(remaining_openings[0])

        # MACHINE LEARNING MODE: Active Learning (Information Gain) + Epsilon-Greedy Exploration
        # 15% kesempatan (epsilon = 0.15) untuk melakukan eksplorasi rumpun minat baru yang belum ditanyakan
        epsilon = 0.15
        if len(history) > 0 and random.random() < epsilon:
            # Cari rumpun minat yang sudah pernah ditampilkan
            shown_rumpuns = set()
            for sw in history:
                card = self.CARD_MAP.get(sw['id'])
                if card:
                    shown_rumpuns.update(self.get_card_rumpuns(card))
            
            # Cari kartu kuis tersisa yang memuat rumpun minat yang BELUM pernah ditampilkan
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

        # 1. Dapatkan top 10 prediksi jurusan saat ini
        current_recs = self.get_rekomendasi(liked_tags, disliked_tags=disliked_tags, top_n=10)
        
        # 2. Ambil konteks skills dan kategori dari ke-10 jurusan terbaik
        top_contexts = []
        for r in current_recs:
            ctx = f"{r['kategori']} {r['skills']} {r['jurusan']}".lower()
            top_contexts.append(ctx)

        best_card = None
        best_score = -9999.0

        # 3. Evaluasi setiap kartu yang belum dimunculkan
        for cid, card in self.CARD_MAP.items():
            if cid in shown:
                continue

            card_tags = [t.lower() for t in card.get('tags', [])]
            
            # Hitung berapa banyak jurusan dari top 10 yang mengandung setidaknya satu tag dari kartu ini
            match_count = 0
            for ctx in top_contexts:
                if any(tag in ctx for tag in card_tags):
                    match_count += 1
            
            # P = Probabilitas kartu ini cocok dengan sekumpulan top rekomendasi (dari 0.0 sampai 1.0)
            p = match_count / max(len(top_contexts), 1)
            
            # Information Gain maksimal jika P mendekati 0.5 (membelah pilihan menjadi dua)
            # Kita gunakan negative absolute error dari 0.5. Skor terbaik adalah 0 (saat P=0.5).
            info_gain_score = -abs(p - 0.5)
            
            # Berikan sedikit variasi acak agar tidak monoton jika skor seri
            info_gain_score += random.uniform(0, 0.05)
            
            # Jika P = 0 (tidak relevan sama sekali dengan top 10), beri penalti berat
            if match_count == 0:
                info_gain_score -= 1.0

            # Boost / Penalty based on Phase 2 top rumpun
            if is_phase2 and top_rumpun:
                card_rumpuns = self.get_card_rumpuns(card)
                if top_rumpun in card_rumpuns:
                    info_gain_score += 10.0
                else:
                    info_gain_score -= 5.0

            if info_gain_score > best_score:
                best_score = info_gain_score
                best_card = card

        if best_card:
            return best_card

        # Fallback terakhir
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
        
        # Coba cari kartu yang disukai dari history yang relevan dengan jurusan/skills ini
        if history:
            liked_cards_matching = []
            for sw in history:
                if sw.get('liked'):
                    card = self.CARD_MAP.get(sw['id'])
                    if card:
                        card_tags = card.get('tags', [])
                        # Cari tag kartu yang ada di teks jurusan/skills
                        matching_tags = [t for t in card_tags if t.lower() in j_text]
                        if matching_tags:
                            liked_cards_matching.append((card, matching_tags))
            
            if liked_cards_matching:
                # Pilih kartu dengan kecocokan terbanyak
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

        # Remove duplicates preserving order
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

    def get_rekomendasi(self, liked_tags: list, disliked_tags: list = None, top_n: int = 3, history: list = None) -> list:
        self.initialize()
        
        # Jika model terlatih hasil training tersedia, gunakan model tersebut!
        if getattr(self, 'trained_model', None) is not None:
            try:
                return self._get_rekomendasi_trained(liked_tags, disliked_tags, top_n, history)
            except Exception as e:
                logger.error(f"Gagal menggunakan model hasil training: {e}. Menggunakan fallback TF-IDF default.")
        
        # 1. Ambil data feedback lengkap dari Database (Like & Dislike)
        likes_count = {}
        dislikes_count = {}
        try:
            res_likes = db.session.query(
                ItemFeedback.rekomendasi_jurusan,
                db.func.count(ItemFeedback.id)
            ).filter(ItemFeedback.feedback == 'like').group_by(ItemFeedback.rekomendasi_jurusan).all()
            for row in res_likes:
                likes_count[row[0]] = row[1]
                
            res_dis = db.session.query(
                ItemFeedback.rekomendasi_jurusan,
                db.func.count(ItemFeedback.id)
            ).filter(ItemFeedback.feedback == 'dislike').group_by(ItemFeedback.rekomendasi_jurusan).all()
            for row in res_dis:
                dislikes_count[row[0]] = row[1]
        except Exception as e:
            logger.error(f"Error fetching feedback counts: {e}")

        # Jika tidak ada tag, lakukan random selection (fallback)
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

        # 2. Hitung Net-Weighting untuk setiap tag
        tag_weights = {}
        for t in liked_tags:
            tag_weights[t] = tag_weights.get(t, 0) + 1.0
        if disliked_tags:
            for t in disliked_tags:
                tag_weights[t] = tag_weights.get(t, 0) - 0.5

        # 3. Bangun Vektor dengan Rocchio bersumber dari pembobotan bersih
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

        # 4. Hitung Cosine Similarity TF-IDF
        from sklearn.metrics.pairwise import cosine_similarity
        scores = cosine_similarity(user_vec, self.tfidf_matrix).flatten()
        
        # 5. Hitung Profil Kategori Pengguna (Category Profiling)
        user_cat_profile = {}
        for cat, keywords in CATEGORY_KEYWORDS.items():
            match_score = 0.0
            for t, w in tag_weights.items():
                if w > 0 and any(kw in t.lower() for kw in keywords):
                    match_score += w
            if match_score > 0:
                user_cat_profile[cat] = match_score
        
        # Normalisasi profil kategori
        total_cat_weight = sum(user_cat_profile.values())
        if total_cat_weight > 0:
            user_cat_profile = {c: w / total_cat_weight for c, w in user_cat_profile.items()}

        # 6. Kalkulasi Skor Gabungan (TF-IDF + Kategori + Feedback Boost)
        top_idx_candidate = scores.argsort()[-15:][::-1]
        results = []
        
        # Hitung statistik popularitas global untuk Bayesian Average
        total_likes = sum(likes_count.values())
        total_dislikes = sum(dislikes_count.values())
        tot_global = total_likes + total_dislikes
        C = total_likes / tot_global if tot_global > 0 else 0.5
        m_votes = 5.0 # batas minimal jumlah voting untuk bisa dipercaya

        for idx in top_idx_candidate:
            j_name = self.df['Jurusan'].iloc[idx]
            j_cat = self.df['Kategori'].iloc[idx]
            
            # Skor TF-IDF
            tfidf_score = float(scores[idx])
            
            # Skor kesesuaian kategori
            cat_score = user_cat_profile.get(j_cat, 0.0)
            
            # Kombinasi (TF-IDF 60%, Kategori 40%)
            combined_score = (0.6 * tfidf_score) + (0.4 * cat_score)
            
            # Konversi ke skala 0-99
            confidence = min(int(round(combined_score * 300)), 95)
            
            # Tambahkan Feedback Popularity Boost (Bayesian Average)
            likes = likes_count.get(j_name, 0)
            dislikes = dislikes_count.get(j_name, 0)
            v = likes + dislikes
            if v > 0:
                R = likes / v
                # Rumus Bayesian Average
                bayesian_ratio = (v / (v + m_votes)) * R + (m_votes / (v + m_votes)) * C
                fb_boost = (bayesian_ratio - 0.5) * min(v, 8)
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

        # Urutkan berdasarkan gabungan skor
        results.sort(key=lambda x: (-x['skor'], -x['likes'], x['jurusan']))
        return results[:top_n]

    def _get_rekomendasi_trained(self, liked_tags: list, disliked_tags: list = None, top_n: int = 3, history: list = None) -> list:
        """
        Fungsi inferensi untuk model machine learning hasil training.
        Silakan modifikasi fungsi ini setelah Anda melatih model baru.
        """
        # Validasi sederhana agar memicu fallback jika model belum di-fit secara benar
        if not hasattr(self.trained_model, 'predict_proba') and not hasattr(self.trained_model, 'predict'):
            raise NotImplementedError("Objek trained_model.pkl terdeteksi tetapi belum di-fit atau tidak memiliki metode predict/predict_proba.")

        # SKELETON CONTOH IMPLEMENTASI:
        # 1. Transformasikan tags menjadi representasi vector fitur
        # user_text = ' '.join(liked_tags)
        # user_features = self.vectorizer.transform([user_text])
        #
        # 2. Lakukan prediksi dengan model Anda
        # probabilities = self.trained_model.predict_proba(user_features)
        # ...
        #
        # 3. Urutkan dan ambil top_n rekomendasi jurusan teratas
        # return list_rekomendasi_terpilih
        
        return []

ml_service = MLService()
