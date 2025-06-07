document.addEventListener('DOMContentLoaded', () => {
    const recommendBtn = document.getElementById('recommend-btn');
    const resultsContainer = document.getElementById('results-container');
    let movies = [];

    // Film verilerini yükle
    async function loadMovies() {
        try {
            const response = await fetch('data/movies.json');
            movies = await response.json();
        } catch (error) {
            console.error('Film verileri yüklenirken hata oluştu:', error);
            resultsContainer.innerHTML = '<div class="error-message">Film verileri yüklenemedi. Lütfen sayfayı yenileyin.</div>';
        }
    }

    // Kullanıcının cevaplarını topla
    function collectAnswers() {
        // Not: HTML'deki 'value' değerlerinin buradaki mantıkla eşleştiğinden emin ol.
        return {
            genres: Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(input => input.value),
            mood: document.querySelector('input[name="mood"]:checked')?.value,
            duration: document.querySelector('input[name="duration"]:checked')?.value,
            focus: document.querySelector('input[name="focus"]:checked')?.value,
            company: document.querySelector('input[name="company"]:checked')?.value,
            complexity: document.querySelector('input[name="complexity"]:checked')?.value,
            avoid: Array.from(document.querySelectorAll('input[name="avoid"]:checked')).map(input => input.value),
            favoriteMovie: document.getElementById('favorite-movie').value.trim().toLowerCase()
        };
    }

    // Hata mesajı göster
    function showError(message) {
        resultsContainer.innerHTML = `<div class="error-message"><p>${message}</p></div>`;
    }

    // Film önerilerini al (PUANLAMA SİSTEMİYLE YENİDEN YAZILDI)
    function getRecommendations(answers) {
        // Her film için bir başlangıç puanı (score) oluştur
        movies.forEach(movie => movie.score = 0);

        // Puanlama mantığı
        for (const movie of movies) {
            const movieGenre = movie.genre ? movie.genre.toLowerCase() : '';

            // Soru 1: Seçilen her tür için puan ekle
            for (const userGenre of answers.genres) {
                if (movieGenre.includes(userGenre.toLowerCase())) {
                    movie.score += 40;
                }
            }

            // Soru 2: Ruh hali - tür eşleşmesi
            const moodMap = { happy: 'comedy', thoughtful: 'drama', sad: 'drama', excited: 'action', calm: 'romance', thrilling: 'thriller' };
            if (answers.mood && movieGenre.includes(moodMap[answers.mood])) {
                movie.score += 35;
            }

            // Soru 3: Süre
            const rt = movie.runtime;
            const durationRanges = { short: [0, 89], medium: [90, 110], long: [111, 135], very_long: [136, 500] };
            if (answers.duration && answers.duration !== 'any' && rt) {
                const [min, max] = durationRanges[answers.duration];
                if (rt >= min && rt <= max) {
                    movie.score += 20;
                }
            }
            
            // Soru 4 & 8: Odak ve Karmaşıklık
            const focusMap = { character: 'drama', action: 'action', balanced: 'adventure', mind_bending: 'sci-fi', emotional: 'drama', light: 'comedy'};
            if(answers.focus && movieGenre.includes(focusMap[answers.focus])) movie.score += 25;
            if(answers.complexity && movieGenre.includes(focusMap[answers.complexity])) movie.score += 25;

            // Soru 7: İzleme ortamı
            if (answers.company === 'family' || answers.company === 'children') {
                if (movieGenre.includes('horror') || movieGenre.includes('thriller')) movie.score -= 100; // Uygun değilse puan kır
                if (movieGenre.includes('animation') || movieGenre.includes('family')) movie.score += 40; // Uygunsa puan ekle
            }

            // Soru 9: Kaçınılan türler
            for (const avoidGenre of answers.avoid) {
                if (avoidGenre !== 'none' && movieGenre.includes(avoidGenre.toLowerCase())) {
                    movie.score = -1000; // Kaçınılan türdeyse direkt ele
                }
            }
        }

        // Soru 10: Favori film benzerliği (EN GÜÇLÜ ETKİ)
        if (answers.favoriteMovie) {
            const favorite = movies.find(m => m.title.toLowerCase() === answers.favoriteMovie);
            if (favorite && favorite.similar_movies) {
                // Favori filmin benzerlerine devasa bir bonus puan ver
                favorite.similar_movies.forEach(similarTitle => {
                    const similarMovie = movies.find(m => m.title === similarTitle);
                    if (similarMovie) {
                        similarMovie.score += 200;
                    }
                });
            }
        }

        // Filmleri puana göre büyükten küçüğe sırala ve en iyi 3'ünü al
        return movies.sort((a, b) => b.score - a.score).slice(0, 3);
    }

    // Sonuçları göster
    function displayRecommendations(recommendations) {
        if (!recommendations || recommendations.length === 0) {
            showError('Bu kriterlere uygun film bulunamadı. Lütfen seçimlerinizi değiştirip tekrar deneyin.');
            return;
        }

        const recommendationsHTML = recommendations.map(movie => `
            <div class="movie-card">
                <h3>${movie.title}</h3>
                <div class="movie-details">
                    <p class="rating">⭐ ${movie.imdb_rating}/10</p>
                    <p class="genres">${movie.genre}</p>
                    <p class="description">${movie.description}</p>
                    <p class="runtime">Süre: ${movie.runtime} dakika</p>
                </div>
            </div>
        `).join('');

        resultsContainer.innerHTML = `
            <h2>Size Özel Film Tavsiyeleri</h2>
            <div class="recommendations-grid">${recommendationsHTML}</div>`;
    }

    // Tavsiye butonuna tıklandığında
    recommendBtn.addEventListener('click', () => {
        // Not: validateAnswers fonksiyonunu geçici olarak devredışı bıraktık, istersen tekrar aktif edebilirsin.
        const answers = collectAnswers();
        const recommendations = getRecommendations(answers);
        displayRecommendations(recommendations);
    });

    // Başlangıçta filmleri yükle
    loadMovies();
});