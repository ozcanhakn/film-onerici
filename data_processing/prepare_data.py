import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import json

print("--- Akıllı Film Verisi Hazırlama Süreci Başladı (Gerçek Veri Modu) ---")

try:
    # Veriyi, bozuk satırları atlayarak okuyoruz.
    df = pd.read_csv(
        'data_processing/input_data/movies.csv',
        engine='python',
        on_bad_lines='warn'
    )
    print("✅ Adım 1/5: CSV dosyası başarıyla yüklendi.")

except FileNotFoundError:
    print("❌ HATA: 'input_data/movies.csv' dosyası bulunamadı.")
    exit()
except Exception as e:
    print(f"❌ HATA: CSV dosyası okunurken bir sorun oluştu: {e}")
    exit()

# --- DÜZELTME 1: GERÇEK SÜTUN ADLARINI KULLANIYORUZ ---
# Senin dosyan 'year' sütunu içermiyor, bu yüzden onu listeden çıkardık.
gerekli_sutunlar = ['Movie Name', 'Genre', 'Plot', 'Rating', 'Votes']

# Sütunların varlığını kontrol edelim
if not all(col in df.columns for col in gerekli_sutunlar):
    print("❌ HATA: Gerekli sütunlardan bazıları dosyada bulunamadı.")
    print("Dosyadaki Gerçek Sütunlar:", df.columns.tolist())
    exit()

df_temiz = df[gerekli_sutunlar].dropna().copy()

# --- DÜZELTME 2: VERİ TİPLERİNİ DOĞRU SÜTUNLARA GÖRE DÖNÜŞTÜRÜYORUZ ---
# 'Rating' sütununu sayıya çevir
df_temiz['Rating'] = pd.to_numeric(df_temiz['Rating'], errors='coerce')

# 'Votes' sütunundaki virgülleri kaldırıp sayıya çevir
df_temiz['Votes'] = df_temiz['Votes'].astype(str).str.replace(',', '')
df_temiz['Votes'] = pd.to_numeric(df_temiz['Votes'], errors='coerce')

# Boş değerleri temizle
df_temiz.dropna(subset=['Rating', 'Votes'], inplace=True)
df_temiz['Votes'] = df_temiz['Votes'].astype(int)

# Veri setini filtrele
df_temiz = df_temiz[df_temiz['Votes'] >= 1000].sort_values(by='Votes', ascending=False).head(5000).reset_index(drop=True)
print(f"✅ Adım 2/5: Veri temizlendi ve en popüler {len(df_temiz)} film seçildi.")


# 3. AĞIRLIKLI PUAN HESAPLAMA (NUMPY)
C = df_temiz['Rating'].mean()
m = df_temiz['Votes'].quantile(0.90)
v = df_temiz['Votes']
R = df_temiz['Rating']
df_temiz['weighted_rating'] = np.round((v / (v + m)) * R + (m / (v + m)) * C, 2)
print("✅ Adım 3/5: NumPy ile ağırlıklı puanlar (weighted_rating) hesaplandı.")


# 4. KONUYA GÖRE BENZERLİK HESAPLAMA (SCIKIT-LEARN)
# --- DÜZELTME 3: 'Plot' ve 'Movie Name' sütunlarını kullanıyoruz ---
tfidf = TfidfVectorizer(stop_words='english', max_features=5000)
df_temiz['Plot'] = df_temiz['Plot'].fillna('')
tfidf_matrix = tfidf.fit_transform(df_temiz['Plot'])
cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)
print("✅ Adım 4/5: Scikit-learn ile film benzerlik matrisi oluşturuldu.")

indices = pd.Series(df_temiz.index, index=df_temiz['Movie Name']).drop_duplicates()

def get_similar_movies(title, cosine_sim=cosine_sim):
    try:
        # Aynı isimde birden fazla film varsa idx bir Seri dönebilir.
        idx = indices[title]
        
        # --- DÜZELTME: Eğer birden fazla sonuç bulunduysa, sadece ilkini al ---
        if isinstance(idx, pd.Series):
            idx = idx.iloc[0]

        sim_scores = list(enumerate(cosine_sim[idx]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
        sim_scores = sim_scores[1:6]
        movie_indices = [i[0] for i in sim_scores]
        return df_temiz['Movie Name'].iloc[movie_indices].tolist()
    except (KeyError, IndexError):
        return []

df_temiz['similar_movies'] = df_temiz['Movie Name'].apply(get_similar_movies)

# 5. SONUÇLARI JSON'A AKTARMA
# --- DÜZELTME 4: ÇIKTI İÇİN DOĞRU SÜTUNLARI SEÇİYORUZ ---
# Dosyada 'year' olmadığı için onu çıkardık
output_columns = ['Movie Name', 'Genre', 'Plot', 'Rating', 'weighted_rating', 'similar_movies']
sonuc_df = df_temiz[output_columns]

# Sütun adlarını JavaScript tarafının beklediği standart isimlere çeviriyoruz
sonuc_df = sonuc_df.rename(columns={
    'Movie Name': 'title',
    'Genre': 'genre',
    'Plot': 'description',
    'Rating': 'imdb_rating'
})

# 'year' sütunu olmadığı için, JSON'a 'N/A' (Not Available) olarak ekleyelim
sonuc_df['year'] = 'N/A'

json_data = sonuc_df.to_dict(orient='records')

with open('data_processing/output_data/movies.json', 'w', encoding='utf-8') as f:
    json.dump(json_data, f, ensure_ascii=False, indent=4)
    
print("✅ Adım 5/5: Temizlenmiş ve zenginleştirilmiş veri 'output_data/movies.json' dosyasına kaydedildi.")
print("\n--- SÜREÇ BAŞARIYLA TAMAMLANDI! ---")