import pandas as pd
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer

# ── 1. Load data ──────────────────────────────────────────
df = pd.read_csv('data/jurusan_clean.csv')
print(f" Data loaded: {len(df)} jurusan")

# ── 2. Isi nilai kosong ───────────────────────────────────
df['Skills']    = df['Skills'].fillna('')
df['Karier']    = df['Karier'].fillna('')
df['Deskripsi'] = df['Deskripsi'].fillna('')
df['Kategori']  = df['Kategori'].fillna('')
df['URL']       = df['URL'].fillna('')

# ── 3. Gabungkan jadi satu teks per jurusan ───────────────
df['combined'] = (
    df['Jurusan']   + ' ' +
    df['Kategori']  + ' ' +
    df['Skills']    + ' ' +
    df['Karier']    + ' ' +
    df['Deskripsi']
)

# ── 4. TF-IDF vectorizer ──────────────────────────────────
vectorizer = TfidfVectorizer(
    max_features=5000,
    ngram_range=(1, 2),
    min_df=1
)
tfidf_matrix = vectorizer.fit_transform(df['combined'])
print(f" TF-IDF matrix shape: {tfidf_matrix.shape}")

# ── 5. Simpan model ke folder model/ ─────────────────────
with open('model/vectorizer.pkl', 'wb') as f:
    pickle.dump(vectorizer, f)

with open('model/tfidf_matrix.pkl', 'wb') as f:
    pickle.dump(tfidf_matrix, f)

# ── 6. Simpan dataframe yang sudah diproses ───────────────
df.to_csv('data/jurusan_processed.csv', index=False)

print(" Semua file model berhasil disimpan di folder model/")
print(" Data processed disimpan di data/jurusan_processed.csv")