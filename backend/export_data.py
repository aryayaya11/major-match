import os
import sys
import pandas as pd

# Ensure backend path is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import db, FeedbackSession, ItemFeedback

def export_data():
    app = create_app()
    
    with app.app_context():
        print("Mulai menarik data kuis dari database...")
        
        # 1. Ekspor data sesi kuis (feedback_sessions)
        sessions = FeedbackSession.query.all()
        if sessions:
            session_dicts = [s.to_dict() for s in sessions]
            # Karena to_dict berisi list untuk 'hasil' dan list untuk 'swipe_history', 
            # mari kita ratakan (flatten) untuk output CSV yang bersih
            flat_sessions = []
            for s in session_dicts:
                import json
                flat_s = {
                    "id": s["id"],
                    "session_id": s.get("session_id", ""),
                    "nama": s["nama"],
                    "liked_tags": s["liked_tags"],
                    "disliked_tags": s.get("disliked_tags", ""),
                    "hasil_1": s["hasil"][0] if len(s["hasil"]) > 0 else "",
                    "hasil_2": s["hasil"][1] if len(s["hasil"]) > 1 else "",
                    "hasil_3": s["hasil"][2] if len(s["hasil"]) > 2 else "",
                    "rating": s["rating"],
                    "komentar": s["komentar"],
                    "web_rating": s["web_rating"],
                    "web_komentar": s["web_komentar"],
                    "timestamp": s["timestamp"],
                    # Simpan raw JSON string dari swipe_history untuk preprocessing lebih lanjut
                    "swipe_history_raw": json.dumps(s.get("swipe_history", []))
                }
                flat_sessions.append(flat_s)
                
            df_sessions = pd.DataFrame(flat_sessions)
            sessions_csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data_feedback_sessions.csv")
            df_sessions.to_csv(sessions_csv_path, index=False)
            print(f"V Berhasil mengekspor {len(sessions)} data sesi ke: {sessions_csv_path}")
        else:
            print("Warning: Tidak ada data sesi kuis di database untuk diekspor.")
            
        # 2. Ekspor data feedback per item (item_feedback)
        item_feedbacks = ItemFeedback.query.all()
        if item_feedbacks:
            fb_dicts = [f.to_dict() for f in item_feedbacks]
            df_fb = pd.DataFrame(fb_dicts)
            fb_csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data_item_feedbacks.csv")
            df_fb.to_csv(fb_csv_path, index=False)
            print(f"V Berhasil mengekspor {len(item_feedbacks)} data feedback item ke: {fb_csv_path}")
        else:
            print("Warning: Tidak ada data feedback item (likes/dislikes jurusan) di database untuk diekspor.")

        # 3. Hitung Statistik Singkat
        print("\n" + "="*50)
        print("RINGKASAN STATISTIK DATA EXPORT")
        print("="*50)
        if sessions:
            ratings = [s.rating for s in sessions if s.rating is not None]
            web_ratings = [s.web_rating for s in sessions if s.web_rating is not None]
            avg_rating = sum(ratings) / len(ratings) if ratings else 0.0
            avg_web_rating = sum(web_ratings) / len(web_ratings) if web_ratings else 0.0
            print(f"Total Pengguna Kuis      : {len(sessions)}")
            print(f"Rata-rata Rating Kuis    : {avg_rating:.2f} / 5.0 (dari {len(ratings)} ulasan)")
            print(f"Rata-rata Rating Web     : {avg_web_rating:.2f} / 5.0 (dari {len(web_ratings)} ulasan)")
        if item_feedbacks:
            likes = sum(1 for f in item_feedbacks if f.feedback == 'like')
            dislikes = sum(1 for f in item_feedbacks if f.feedback == 'dislike')
            print(f"Total Voting Item        : {len(item_feedbacks)}")
            print(f"  - Likes (Suka)         : {likes}")
            print(f"  - Dislikes (Tidak)     : {dislikes}")
            ratio = (likes / len(item_feedbacks)) * 100 if len(item_feedbacks) > 0 else 0.0
            print(f"Rasio Like Rekomendasi   : {ratio:.1f}%")
        print("="*50)

if __name__ == "__main__":
    export_data()
