def test_get_kategori(client):
    response = client.get('/api/kategori')
    assert response.status_code == 200
    data = response.get_json()
    assert 'kategori' in data
    assert isinstance(data['kategori'], list)

def test_next_card(client):
    response = client.post('/api/next-card', json={'history': []})
    assert response.status_code == 200
    data = response.get_json()
    assert 'done' in data
    if not data['done']:
        assert 'card' in data

def test_recommend_empty(client):
    response = client.post('/api/recommend', json={'nama': 'Test User', 'liked_tags': [], 'disliked_tags': []})
    assert response.status_code == 200
    data = response.get_json()
    assert 'hasil' in data
    assert len(data['hasil']) <= 3

def test_recommend_rocchio(client):
    # Test bahwa jika kita mengirimkan liked dan disliked tags, tidak terjadi error
    # Dan hasil rekomendasinya berbeda/terhitung
    response = client.post('/api/recommend', json={
        'nama': 'Test Rocchio', 
        'liked_tags': ['komputer', 'teknologi', 'pemrograman'],
        'disliked_tags': ['matematika', 'statistik', 'bisnis']
    })
    assert response.status_code == 200
    data = response.get_json()
    assert 'hasil' in data
    assert len(data['hasil']) > 0

def test_explore(client):
    response = client.post('/api/explore', json={'query': 'teknik'})
    assert response.status_code == 200
    data = response.get_json()
    assert 'jurusan' in data

def test_recommend_all_liked(client):
    # Simulasikan history di mana semua pertanyaan dijawab liked: True
    history = [{'id': f'q{i}', 'liked': True} for i in range(1, 16)]
    response = client.post('/api/recommend', json={
        'nama': 'User All Liked',
        'history': history
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'invalid_all_liked'
    assert data['hasil'] == []

def test_recommend_all_disliked(client):
    # Simulasikan history di mana semua pertanyaan dijawab liked: False
    history = [{'id': f'q{i}', 'liked': False} for i in range(1, 16)]
    response = client.post('/api/recommend', json={
        'nama': 'User All Disliked',
        'history': history
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'invalid_all_disliked'
    assert data['hasil'] == []

def test_recommend_extension_or_ok(client):
    # Simulasikan history campuran 15 soal
    # Di mana ada beberapa liked dan beberapa disliked
    history = []
    for i in range(1, 16):
        history.append({'id': f'q{i}', 'liked': (i % 2 == 0)})
    response = client.post('/api/recommend', json={
        'nama': 'User Mixed',
        'history': history
    })
    assert response.status_code == 200
    data = response.get_json()
    # Ini harus mengembalikan status 'extend' (jika max_score < 60) atau 'ok' (jika >= 60)
    assert data['status'] in ['extend', 'ok']
