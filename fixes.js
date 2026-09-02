(function () {
  const OVERRIDES = {
    1661: {
      title: 'Caída generalizada de los servicios de Proton',
      excerpt: 'La mayoría de servicios de Proton están caídos para gran parte de sus usuarios desde hace más de veinte minutos.',
      image: 'images/proton-outage.svg',
      body: [
        'La mayoría de servicios de Proton se encuentran caídos en estos momentos para la mayoría de sus usuarios, desde hace más de 20 minutos.',
        'No se trata de un aviso aislado: el propio panel de estado de la compañía es la referencia para ver qué partes de la suite siguen afectadas y cuáles van recuperándose.',
        'Quien dependa del correo, la VPN u otras herramientas de Proton conviene revisar ese estado antes de asumir que el fallo está en su red o en su dispositivo.'
      ]
    }
  };
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  };
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const applyCard = (card, extra) => {
    if (!card || !extra) return;
    const title = card.querySelector('.card-title a, .card-title');
    if (title && extra.title) title.textContent = extra.title;
    const excerpt = card.querySelector('.card-excerpt');
    if (extra.excerpt) {
      if (excerpt) excerpt.textContent = extra.excerpt;
      else {
        const p = document.createElement('p');
        p.className = 'card-excerpt';
        p.textContent = extra.excerpt;
        card.querySelector('.card-meta')?.after(p);
      }
    }
    if (extra.image) {
      let wrap = card.querySelector('.card-image');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'card-image';
        card.insertBefore(wrap, card.firstChild);
      }
      wrap.classList.remove('is-fallback');
      wrap.innerHTML = '<img alt="" loading="lazy" width="400" height="400">';
      const img = wrap.querySelector('img');
      img.src = extra.image;
      img.addEventListener('error', function () {
        wrap.classList.add('is-fallback');
        wrap.innerHTML = '<span class="fallback-letter">' + esc((extra.title || 'P').charAt(0).toUpperCase()) + '</span>';
      });
      card.classList.remove('is-text');
    }
    const tpl = card.querySelector('template.full-content');
    if (tpl && extra.title) {
      const h = tpl.content.querySelector('h1');
      if (h) h.textContent = extra.title;
      const body = tpl.content.querySelector('.article-body');
      if (body && extra.body) body.innerHTML = extra.body.map(p => '<p>' + esc(p) + '</p>').join('');
      const fig = tpl.content.querySelector('.article-hero, .article-figure img');
      if (fig && extra.image) fig.setAttribute('src', extra.image);
    }
  };

  const bindBrokenThumbs = (root) => {
    (root || document).querySelectorAll('.card-image img').forEach(img => {
      if (img.dataset.fixBound) return;
      img.dataset.fixBound = '1';
      const fail = () => {
        const wrap = img.closest('.card-image');
        if (!wrap || wrap.classList.contains('is-fallback')) return;
        const card = img.closest('.news-card');
        const id = card && card.dataset.id;
        if (id && !/images\/thumbs\//.test(img.src)) {
          img.src = 'images/thumbs/' + id + '.jpg';
          return;
        }
        wrap.classList.add('is-fallback');
        const letter = ((card && card.querySelector('.card-title')?.textContent) || 'P').trim().charAt(0).toUpperCase();
        wrap.innerHTML = '<span class="fallback-letter" aria-hidden="true">' + letter + '</span>';
      };
      img.addEventListener('error', fail);
      if (img.complete && img.naturalWidth === 0) fail();
    });
  };

  const injectLatest = async () => {
    const feed = document.getElementById('newsFeed');
    if (!feed) return;
    try {
      const res = await fetch('data/latest.json?t=' + Date.now());
      if (!res.ok) return;
      const data = await res.json();
      const items = data.articles || data.posts || [];
      items.slice().reverse().forEach(item => {
        if (!item || !item.id) return;
        if (document.querySelector('.news-card[data-id="' + item.id + '"]')) {
          applyCard(document.querySelector('.news-card[data-id="' + item.id + '"]'), item);
          return;
        }
        const image = item.youtube_id
          ? ('https://i.ytimg.com/vi/' + item.youtube_id + '/hqdefault.jpg')
          : (item.image || '');
        const art = document.createElement('article');
        art.className = 'news-card' + (item.youtube_id || item.video_url ? ' is-video' : '');
        art.dataset.id = item.id;
        art.id = 'noticia-' + item.id;
        const dateLabel = formatDate(item.date);
        const media = image
          ? '<div class="card-image' + (item.youtube_id || item.video_url ? ' is-video' : '') + '"><img src="' + esc(image) + '" alt="" loading="lazy" width="400" height="400">' + (item.youtube_id || item.video_url ? '<span class="play-badge" aria-hidden="true">▶</span>' : '') + '</div>'
          : '<div class="card-image is-fallback" aria-hidden="true"><span class="fallback-letter">' + esc((item.title || 'P').charAt(0).toUpperCase()) + '</span></div>';
        art.innerHTML = media +
          '<div class="card-body"><div class="card-head"><h2 class="card-title"><a href="#noticia-' + item.id + '" class="open-article">' + esc(item.title) + '</a></h2></div>' +
          '<div class="card-meta"><time datetime="' + esc(item.date || '') + '">' + esc(dateLabel) + '</time></div>' +
          (item.excerpt ? '<p class="card-excerpt">' + esc(item.excerpt) + '</p>' : '') +
          '<div class="card-actions"><p class="byline">Escrito por: <a class="author-link" href="https://x.com/StarkPrivacy" target="_blank" rel="noopener">Stark</a></p><button type="button" class="btn btn-ghost share-btn" data-share>Compartir</button></div></div>' +
          '<template class="full-content"><h1>' + esc(item.title) + '</h1><p class="article-meta"><time datetime="' + esc(item.date || '') + '">' + esc(dateLabel) + '</time></p><p class="article-byline">Escrito por: <a class="author-link" href="https://x.com/StarkPrivacy" target="_blank" rel="noopener">Stark</a></p>' +
          (image ? '<figure class="article-figure"><img src="' + esc(image) + '" alt="" class="article-hero"></figure>' : '') +
          '<div class="article-body">' + (item.body || []).map(p => '<p>' + esc(p) + '</p>').join('') + '</div></template>';
        feed.insertBefore(art, feed.firstChild);
        art.addEventListener('click', function (e) {
          if (e.target.closest('[data-share], .author-link, a[target="_blank"]')) return;
          const modal = document.getElementById('articleModal');
          const modalContent = document.getElementById('modalContent');
          const tpl = art.querySelector('template.full-content');
          if (!modal || !modalContent || !tpl) return;
          e.preventDefault();
          modalContent.innerHTML = '';
          modalContent.appendChild(tpl.content.cloneNode(true));
          modal.hidden = false;
          document.body.classList.add('modal-open');
          modal.classList.add('is-open');
        });
      });
    } catch (err) {
      console.warn('latest.json', err);
    }
  };

  const run = () => {
    Object.keys(OVERRIDES).forEach(id => {
      applyCard(document.querySelector('.news-card[data-id="' + id + '"]'), OVERRIDES[id]);
    });
    bindBrokenThumbs(document);
  };

  const start = () => {
    run();
    injectLatest().then(run);
    const feed = document.getElementById('newsFeed');
    if (feed && typeof MutationObserver !== 'undefined') {
      const obs = new MutationObserver(run);
      obs.observe(feed, { childList: true });
    }
    setTimeout(run, 300);
    setTimeout(run, 1200);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
