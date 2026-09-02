(function () {
  const TRACK = document.getElementById('tickerTrack');
  const BTC = document.getElementById('pxBtc');
  const XMR = document.getElementById('pxXmr');
  if (!TRACK) return;

  const money = (value, digits) =>
    new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);

  const changeHtml = (pct) => {
    if (!Number.isFinite(pct)) return '';
    const up = pct >= 0;
    const sign = up ? '+' : '';
    return `<span class="ticker-chg ${up ? 'up' : 'down'}">${sign}${pct.toFixed(1).replace('.', ',')}%</span>`;
  };

  const escapeHtml = (str) => String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const headline = (item) => {
    const raw = String(item.title || item.excerpt || '').replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!raw) return `Publicación #${item.id}`;
    const cut = raw.length > 88 ? raw.slice(0, 85).replace(/\s+\S*$/, '') + '…' : raw;
    return escapeHtml(cut);
  };

  function paintNews(items) {
    const latest = (items || []).slice(0, 10);
    if (!latest.length) return;
    const row = latest.map(item =>
      `<a class="ticker-item" href="#noticia-${item.id}" data-ticker-id="${item.id}"><span class="ticker-dot"></span>${headline(item)}</a>`
    ).join('');
    TRACK.innerHTML = row + row;
    const seconds = Math.max(36, latest.length * 6);
    TRACK.style.animationDuration = `${seconds}s`;
  }

  function paintPrices(btc, xmr) {
    if (BTC && btc) {
      BTC.innerHTML = `<span class="ticker-px">BTC ${money(btc.eur, 0)} €</span> ${changeHtml(btc.chg)}`;
    }
    if (XMR && xmr) {
      XMR.innerHTML = `<span class="ticker-px">XMR ${money(xmr.eur, 2)} €</span> ${changeHtml(xmr.chg)}`;
    }
  }

  async function loadNews() {
    try {
      const res = await fetch(`data/news.json?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      paintNews(data.articles || data.posts || []);
    } catch (err) {}
  }

  async function loadPrices() {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,monero&vs_currencies=eur&include_24hr_change=true');
      if (!res.ok) throw new Error('coingecko');
      const data = await res.json();
      paintPrices(
        { eur: data.bitcoin?.eur, chg: data.bitcoin?.eur_24h_change },
        { eur: data.monero?.eur, chg: data.monero?.eur_24h_change }
      );
    } catch (err) {
      try {
        const res = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTEUR,XMREUR');
        const data = await res.json();
        const btc = data.result?.XXBTZEUR || data.result?.XBTEUR;
        const xmr = data.result?.XXMRZEUR || data.result?.XMREUR;
        paintPrices(
          { eur: Number(btc?.c?.[0]), chg: NaN },
          { eur: Number(xmr?.c?.[0]), chg: NaN }
        );
      } catch (fallbackErr) {}
    }
  }

  TRACK.addEventListener('click', (e) => {
    const link = e.target.closest('[data-ticker-id]');
    if (!link) return;
    e.preventDefault();
    const id = link.dataset.tickerId;
    const card = document.querySelector(`.news-card[data-id="${id}"]`);
    if (card) {
      card.click();
      return;
    }
    location.hash = `noticia-${id}`;
  });

  loadNews();
  loadPrices();
  window.setInterval(loadPrices, 120000);
})();
