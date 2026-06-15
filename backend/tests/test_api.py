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
    # Simulasikan history di mana semua pertanyaan dijawab liked: True (Phase 1 = 20)
    history = [{'id': f'q{i}', 'liked': True} for i in range(1, 21)]
    response = client.post('/api/recommend', json={
        'nama': 'User All Liked',
        'history': history
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'invalid_all_liked'
    assert data['hasil'] == []

def test_recommend_all_disliked(client):
    # Simulasikan history di mana semua pertanyaan dijawab liked: False (Phase 1 = 20)
    history = [{'id': f'q{i}', 'liked': False} for i in range(1, 21)]
    response = client.post('/api/recommend', json={
        'nama': 'User All Disliked',
        'history': history
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'invalid_all_disliked'
    assert data['hasil'] == []

def test_recommend_extension_or_ok(client):
    # Simulasikan history campuran 20 soal
    # Di mana ada beberapa liked dan beberapa disliked
    history = []
    for i in range(1, 21):
        history.append({'id': f'q{i}', 'liked': (i % 2 == 0)})
    response = client.post('/api/recommend', json={
        'nama': 'User Mixed',
        'history': history
    })
    assert response.status_code == 200
    data = response.get_json()
    # Ini harus mengembalikan status 'ok' (karena extend di-handle di next_card)
    assert data['status'] == 'ok'

def test_next_card_phase1_transition(client):
    # Simulasikan history 20 soal dengan jawaban campuran untuk memicu transisi fase atau perpanjangan limit
    history = [{'id': f'q_det{i}', 'liked': (i % 2 == 0)} for i in range(1, 21)]
    response = client.post('/api/next-card', json={'history': history})
    assert response.status_code == 200
    data = response.get_json()
    assert 'done' in data
    assert not data['done']
    assert 'total' in data
    assert data['total'] in [25, 30]
    if data['total'] == 30:
        assert data.get('phase_transition') is True
        assert 'top_rumpun' in data
        assert 'rumpun_id' in data

def test_next_card_careless_detection(client):
    # Jika menyukai semua 20 pertanyaan, next-card harus mengembalikan done=True
    history_all_liked = [{'id': f'q_det{i}', 'liked': True} for i in range(1, 21)]
    response = client.post('/api/next-card', json={'history': history_all_liked})
    assert response.status_code == 200
    data = response.get_json()
    assert data['done'] is True


def test_feedback_and_stats(client):
    # Setup session 'last' in test client context
    with client.session_transaction() as sess:
        sess['last'] = {
            'session_id': 'test-session-123',
            'nama': 'Test User Feedback',
            'liked_tags': ['komputer', 'teknologi'],
            'hasil': [{'jurusan': 'Teknik Informatika', 'skor': 90}, {'jurusan': 'Sistem Informasi', 'skor': 80}]
        }

    # Post feedback
    response = client.post('/api/feedback', json={
        'rating': 4,
        'komentar': 'Bagus sekali rekomendasinya',
        'web_rating': 5,
        'web_komentar': 'Webnya cepat dan responsif'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['message'] == 'Feedback tersimpan'

    # Get stats
    stats_response = client.get('/api/stats')
    assert stats_response.status_code == 200
    stats_data = stats_response.get_json()
    assert stats_data['total'] == 1
    assert stats_data['rata_rating'] == 4.0
    assert stats_data['rata_rating_web'] == 5.0
    assert len(stats_data['detail']) == 1
    assert stats_data['detail'][0]['web_rating'] == 5
    assert stats_data['detail'][0]['web_komentar'] == 'Webnya cepat dan responsif'


