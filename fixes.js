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
      wrap.querySelector('img').src = extra.image;
      card.classList.remove('is-text');
    }
    const tpl = card.querySelector('template.full-content');
    if (tpl && extra.title) {
      const h = tpl.content.querySelector('h1');
      if (h) h.textContent = extra.title;
      const body = tpl.content.querySelector('.article-body');
      if (body && extra.body) body.innerHTML = extra.body.map(p => '<p>' + p + '</p>').join('');
      const fig = tpl.content.querySelector('.article-hero, .article-figure img');
      if (fig && extra.image) fig.setAttribute('src', extra.image);
    }
  };

  const run = () => {
    Object.keys(OVERRIDES).forEach(id => {
      applyCard(document.querySelector('.news-card[data-id="' + id + '"]'), OVERRIDES[id]);
    });
  };

  const start = () => {
    run();
    const feed = document.getElementById('newsFeed');
    if (!feed || typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(run);
    obs.observe(feed, { childList: true });
    setTimeout(run, 300);
    setTimeout(run, 1200);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
