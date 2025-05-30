(() => {
  const API_BASE = "http://localhost:8000/api/v1";

  document.addEventListener('DOMContentLoaded', init);
  //ici une tentative de debug sur le modal qui se referme pas
  document.addEventListener('DOMContentLoaded', () => {
  const modalhtml = document.getElementById('movieModal');
  modalhtml.addEventListener('hidden.bs.modal', () => {
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    const modal = bootstrap.Modal.getInstance(modalhtml);
    if (modal) modal.dispose();
    document.body.style.overflow = 'auto';
  });
});

  async function init() {
    try {
      
      const best = await fetchBestFilm();
      console.log("Meilleur film :", best);
      renderBestFilm(best);

      
      const topRated = await fetchTopRated(6);
      displayCards(document.getElementById('rated-grid'), topRated);

     
      await loadCategory('Mystery', 'cat1');
      await loadCategory('Fantasy', 'cat3');

      // Injection statique des catégories “Autres”
      (function populateOtherSelectStatic() {
        const select = document.getElementById('other-select');
        select.innerHTML = '';
        const categories = [
          { value: 'action', label: "Films d'action" },
          { value: 'comedy', label: 'Comédies' },
          { value: 'family', label: 'Famille' },
          { value: 'fantasy', label: 'Films de fantasy' },
          { value: 'horror',  label: "Films d'horreur" },
          { value: 'science fiction', label: 'Science fiction' },
          { value: 'western', label: 'Westerns' },
        ];

        categories.forEach(category => {
          // boucle 
          const option = document.createElement('option');
          option.value = category.value;
          option.textContent = category.label;
          select.appendChild(option);
        });
    })();

    
    document.getElementById('other-load').addEventListener('click', async () => {
      const cat = document.getElementById('other-select').value;
      const container = document.getElementById('other-grid');
      container.innerHTML = '';
      const list = await fetchByCategory(cat, 6);
      displayCards(container, list);
    });

    // Boutons “Voir plus” pour chaque grille
      attachShowMore('rated-show-more', 'rated-grid');
      attachShowMore('cat1-show-more', 'cat1-grid', () => 'Mystery');
      attachShowMore('cat3-show-more', 'cat3-grid', () => 'Fantasy');
      attachShowMore('other-show-more', 'other-grid', () => document.getElementById('other-select').value);

  
  // Gestion d'érreurs.
  } catch (err) {
    console.error('Init error:', err);
    alert('Une erreur est survenue lors du chargement des données.');
  }
}


  async function loadCategory(category, prefix) {
  const grid = document.getElementById(`${prefix}-grid`);
  const list = await fetchByCategory(category, 6);
  displayCards(grid, list);
}

function attachShowMore(buttonId, gridId, category=null) {
  const btn  = document.getElementById(buttonId);
  const grid = document.getElementById(gridId);
  let currentPage = 1;
  let initialHTML = grid.innerHTML;
  let expanded = false;

  if (!btn || !grid) return;

  btn.addEventListener('click', async () => {
  // Gestion du bouton "voir moins".
    if (expanded) {
      grid.innerHTML = initialHTML
      currentPage = 1;
      btn.textContent = 'Voir plus';
      expanded = false;
      return;
    }

    currentPage++;
    try {
      let newMovies;
      if (typeof category === 'function') {
        const cat = category();
        newMovies = await fetchByCategory(cat, 6, currentPage);
      } else if (category) {
        newMovies = await fetchTopRated(6, currentPage);
      } else {
        newMovies = await fetchTopRated(6, currentPage);
      }
      
      

      if (newMovies.length === 0) {
        btn.disabled = true;
        return;
      }

      // implémentation du bouton voir moins si la grille est extended
      grid.classList.add('expanded');
      btn.textContent = 'Voir moins';
      expanded = true
      
      // on transforme les ids en liste
      const existingIds = [...grid.children]
        .map(card => card.dataset.movieId);
        
      //on filtre pour éviter que les mêmes films se retrouvent après un "voir plus"
      const filtered = newMovies.filter(
        movie => !existingIds.includes(String(movie.id)));
        
      
      displayCards(grid, filtered, true);

    } catch (err) {
      console.error('Show more error:', err);
    }
  });
}


  async function fetchBestFilm() {
    const bestfilm = await fetch(`${API_BASE}/titles/?sort_by=-votes,-imdb_score&limit=1`);
    const data = await bestfilm.json();
    const bestid = data.results?.[0]?.id;
      if (!bestid) return null;
      const detailbestfilm = await fetch(`${API_BASE}/titles/${bestid}`);
      return await detailbestfilm.json();
}

  async function fetchTopRated(limit, page = 1, alreadycharged= []) {
  const resp = await fetch(
    `${API_BASE}/titles/?sort_by=-votes,-imdb_score&page=${page}`);
  if (!resp.ok) return alreadycharged;
  const { results } = await resp.json();  

  //On charge les détails via l'id
  const details = await Promise.all(
    results.map(m =>
      fetch(`${API_BASE}/titles/${m.id}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    )
  );

  //on concatène et on filtre toujours 
  const films = alreadycharged.concat(details.filter(Boolean))
                   .filter((f, i, arr) => arr.findIndex(x => x.id === f.id) === i);

  //fix de l'erreur de 5 résultats
  if (films.length >= limit || results.length < 5) {
    return films.slice(0, limit);
  }

  
  return fetchTopRated(limit, page + 1, films);
}


  async function fetchByCategory(category, limit, page = 1, alreadycharged = []) {
    const resp = await fetch(
      `${API_BASE}/titles/?genre_contains=${category}&sort_by=-votes,-imdb_score&page=${page}`);
    if (!resp.ok) return alreadycharged;
    const { results } = await resp.json();   

    //on charge les détails
    const details = await Promise.all(
      results.map(m =>
        fetch(`${API_BASE}/titles/${m.id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    
    const films = alreadycharged
      .concat(details.filter(Boolean))
      .filter((f, i, arr) => arr.findIndex(x => x.id === f.id) === i);

   
    if (films.length >= limit || results.length < 5) {
      return films.slice(0, limit);
    }

    
    return fetchByCategory(category, limit, page + 1, films);
  }



  function renderBestFilm(film) {
    const bestfilmcard = document.getElementById('best-film-card');
    bestfilmcard.innerHTML = '';
    if (!film) {
      bestfilmcard.textContent = "Pas de film disponible.";
      return;
    }

    const content = document.getElementById('best-film-template').content;
    const clone = content.cloneNode(true);

    
    clone.querySelector('img').src = film.image_url;
    clone.querySelector('img').alt = film.original_title;
    clone.querySelector('h3').textContent = film.original_title;
    clone.querySelector('p').textContent = film.long_description || "Description non disponible";

    const btn = clone.querySelector('.btn-details');
    btn.dataset.id = film.id; 
    btn.addEventListener('click', () => showDetails(film.id));
    bestfilmcard.appendChild(clone);
  }



  function displayCards(container, list, append = false) {
  if (!append) container.innerHTML = '';


  const tpl = document.getElementById('rated-card-template').content;

  list.forEach(movie => {
    const clone = tpl.cloneNode(true);

    //On stocke l'id
    const card = clone.querySelector('.rated-card');
    card.dataset.movieId = movie.id;

    
    const img = clone.querySelector('img');    
    img.src = movie.image_url || "Image non disponible";                
    img.alt = movie.original_title;  
    // img.onerror = () => { img.onerror = null; img.src = 'placeholder.png'; };         

    
    const titleEl = clone.querySelector('.title');
    titleEl.textContent = movie.original_title;

    
    const btn = clone.querySelector('button');
    btn.addEventListener('click', () => showDetails(movie.id));

    container.appendChild(clone);
  });
}


  async function showDetails(id) {
    const details = await fetch(`${API_BASE}/titles/${id}`);
    if (!details.ok) return;
    const movie = await details.json();
    fillModal(movie);
  }

  function fillModal(movie) {
    const modalhtml = document.getElementById('movieModal');
    const modal = new bootstrap.Modal(modalhtml);
    modalhtml.querySelector('.modal-title').textContent = movie.original_title;
    modalhtml.querySelector('.modal-body').innerHTML = `
      <img src="${movie.image_url}" class="img-fluid mb-3">
      <p><strong>Genres :</strong> ${movie.genres.join(', ')}</p>
      <p><strong>Date de sortie :</strong> ${movie.date_published}</p>
      <p><strong>Classification :</strong> ${movie.age_certification || "Tout public" } </p>
      <p><strong>Score IMDB :</strong> ${movie.imdb_score}</p>
      <p><strong>Réalisateur :</strong> ${movie.directors}</p>
      <p><strong>Acteurs :</strong> ${movie.actors.join(', ')}</p>
      <p><strong>Durée :</strong> ${movie.duration} min</p>
      <p><strong>Pays :</strong> ${movie.countries}</p>
      <p><strong>Box Office :</strong> $${movie.worldwide_gross_income.toLocaleString()}</p>
      <p>${movie.description}</p>
    `;
    modal.show();
  }
})();
