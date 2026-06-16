import os
import sys

# Ensure backend path is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.services.ml_service import ml_service

# Define 10 simulated user personas
PERSONAS = [
    {
        "id": "1",
        "name": "Persona IT (Software Dev)",
        "liked_tags": ["komputer", "teknologi", "pemrograman", "coding", "software", "ai"],
        "disliked_tags": ["seni", "musik", "sejarah", "politik"],
        "expected_categories": ["Komputer & Informatika", "Ilmu Teknik & Industri"]
    },
    {
        "id": "2",
        "name": "Persona Kreatif (Designer)",
        "liked_tags": ["desain", "seni", "kreatif", "visual", "film", "ui/ux"],
        "disliked_tags": ["matematika", "koding", "sains", "fisika"],
        "expected_categories": ["Seni, Desain & Musik", "Komputer & Informatika"]
    },
    {
        "id": "3",
        "name": "Persona Bisnis (Ekonomi)",
        "liked_tags": ["bisnis", "ekonomi", "manajemen", "keuangan", "akuntansi", "wirausaha"],
        "disliked_tags": ["biologi", "kimia", "seni", "desain"],
        "expected_categories": ["Ekonomi & Bisnis", "Pariwisata & Perhotelan"]
    },
    {
        "id": "4",
        "name": "Persona Kesehatan (Medis)",
        "liked_tags": ["kesehatan", "medis", "kedokteran", "klinis", "gizi"],
        "disliked_tags": ["koding", "akuntansi", "mesin", "politik"],
        "expected_categories": ["Kesehatan & Ilmu Keolahragaan"]
    },
    {
        "id": "5",
        "name": "Persona Pendidik (Guru)",
        "liked_tags": ["pendidikan", "pengajaran", "pgsd", "keguruan", "bimbingan konseling"],
        "disliked_tags": ["teknik", "robotika", "keuangan", "saham"],
        "expected_categories": ["Ilmu Pendidikan & Agama Islam"]
    },
    {
        "id": "6",
        "name": "Persona Hukum & Politik",
        "liked_tags": ["hukum", "politik", "kebijakan", "pemerintahan", "sosial"],
        "disliked_tags": ["laboratorium", "sains", "desain", "gambar"],
        "expected_categories": ["Ilmu Sosial, Hukum & Politik", "Kedinasan & Lainnya"]
    },
    {
        "id": "7",
        "name": "Persona Konstruksi (Sipil)",
        "liked_tags": ["teknik sipil", "arsitektur", "konstruksi", "bangunan", "infrastruktur"],
        "disliked_tags": ["musik", "politik", "biologi", "kedokteran"],
        "expected_categories": ["Sipil & Bangunan", "Ilmu Teknik & Industri"]
    },
    {
        "id": "8",
        "name": "Persona Pertanian / Alam",
        "liked_tags": ["pertanian", "lingkungan", "ekologi", "tanaman", "alam"],
        "disliked_tags": ["komputer", "koding", "akuntansi", "hukum"],
        "expected_categories": ["Pertanian", "Kehutanan & Peternakan", "Kelautan & Perikanan"]
    },
    {
        "id": "9",
        "name": "Persona Kelautan / Perikanan",
        "liked_tags": ["kelautan", "perikanan", "ekosistem", "lingkungan", "hewan"],
        "disliked_tags": ["ekonomi", "akuntansi", "politik", "robotika"],
        "expected_categories": ["Kelautan & Perikanan", "Pertanian", "Kehutanan & Peternakan"]
    },
    {
        "id": "10",
        "name": "Persona Sejarah & Budaya",
        "liked_tags": ["budaya", "sejarah", "sastra", "humaniora", "filsafat"],
        "disliked_tags": ["matematika", "kimia", "koding", "teknik"],
        "expected_categories": ["Filsafat & Ilmu Budaya"]
    }
]

def run_evaluation():
    app = create_app()
    
    with app.app_context():
        ml_service.initialize()
        
        print("=" * 105)
        print(f"{'EVALUASI MODEL: SIMULASI AKURASI PERSONA PENGGUNA':^105}")
        print("=" * 105)
        print(f"{'No':<3} | {'Nama Persona':<30} | {'Rekomendasi Teratas (Kategori)':<50} | {'Precision@3':<12}")
        print("-" * 105)
        
        total_precision = 0.0
        
        for idx, persona in enumerate(PERSONAS):
            # Call the ML service recommendation
            recs = ml_service.get_rekomendasi(
                liked_tags=persona["liked_tags"],
                disliked_tags=persona["disliked_tags"],
                top_n=3
            )
            
            matches = 0
            rec_strs = []
            for r in recs:
                cat = r["kategori"]
                jurusan = r["jurusan"]
                is_match = cat in persona["expected_categories"]
                if is_match:
                    matches += 1
                    status_char = "V"
                else:
                    status_char = "X"
                rec_strs.append(f"{jurusan} ({cat}) [{status_char}]")
            
            precision_at_3 = matches / 3.0
            total_precision += precision_at_3
            
            recs_joined = ", ".join(rec_strs[:2]) + "..." if len(rec_strs) > 2 else ", ".join(rec_strs)
            # Shorten if too long
            if len(recs_joined) > 50:
                recs_joined = recs_joined[:47] + "..."
                
            print(f"{idx+1:<3} | {persona['name']:<30} | {recs_joined:<50} | {precision_at_3 * 100:>9.1f}%")
            
        avg_accuracy = (total_precision / len(PERSONAS)) * 100
        print("-" * 105)
        print(f"{'RATA-RATA AKURASI MODEL (Average Precision@3)':<88} | {avg_accuracy:>9.1f}%")
        print("=" * 105)
        
        # Provide explanation for metrics
        print("\nCatatan Keterangan:")
        print("  [V] Rekomendasi sesuai dengan rumpun kategori minat yang diharapkan (Persona Ground Truth).")
        print("  [X] Rekomendasi di luar rumpun kategori minat yang diharapkan.")
        print("  Precision@3 mengukur proporsi hasil rekomendasi relevan dari Top-3 jurusan yang disajikan.")

if __name__ == "__main__":
    run_evaluation()
