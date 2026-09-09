/* Lebanese Arabic expectancy list — feed engine.
   Vertical snap feed + lightweight spaced repetition measured in "cards from now". */

(() => {
  'use strict';

  // Bump when word ids change meaning — old progress would schedule the wrong cards.
  const STORE_KEY = 'leb-expectancy-v2';
  const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;

  /* Cards to wait before a word comes back, indexed by level.
     Level rises on "Got it", resets to 0 on "Again". */
  const INTERVALS = [4, 12, 30, 70, 150, 300];
  const LEARNED_LEVEL = 2;
  const BUFFER = 4;      // cards kept ahead of the one in view
  const MAX_CARDS = 400; // session cap on DOM nodes

  const el = {
    feed: document.getElementById('feed'),
    tpl: document.getElementById('cardTpl'),
    hint: document.getElementById('hint'),
    panel: document.getElementById('panel'),
    settingsBtn: document.getElementById('settingsBtn'),
    resetBtn: document.getElementById('resetBtn'),
    progressFill: document.getElementById('progressFill'),
    progressSeen: document.getElementById('progressSeen'),
    countLearned: document.getElementById('countLearned'),
    countTotal: document.getElementById('countTotal'),
    countSeen: document.getElementById('countSeen'),
    optHarakat: document.getElementById('optHarakat'),
    optEnFirst: document.getElementById('optEnFirst')
  };

  let words = [];
  let byId = new Map();
  let store = load();
  let served = [];       // word ids in feed order
  let hintDismissed = false;

  /* ---------- persistence ---------- */

  function load() {
    const empty = { counter: 0, cards: {}, opts: { harakat: true, enFirst: false } };
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!raw || typeof raw !== 'object') return empty;
      return { ...empty, ...raw, opts: { ...empty.opts, ...(raw.opts || {}) } };
    } catch {
      return empty;
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
  }

  function cardState(id) {
    if (!store.cards[id]) store.cards[id] = { level: 0, dueAt: 0, lapses: 0, seen: false, met: false };
    return store.cards[id];
  }

  /* ---------- scheduler ---------- */

  /* Words already sitting in the feed at or below the current card. They are
     awaiting an answer, so they must not be handed out a second time. */
  function inFlight() {
    const set = new Set();
    const kids = el.feed.children;
    for (let i = Math.max(0, currentIndex()); i < kids.length; i++) {
      const n = kids[i];
      if (n.dataset.id && !n.dataset.graded) set.add(Number(n.dataset.id));
    }
    return set;
  }

  function pickNext() {
    const busy = inFlight();
    const avail = words.filter(w => !busy.has(w.id));
    const unseen = avail.filter(w => !store.cards[w.id] || !store.cards[w.id].seen);
    const due = avail.filter(w => {
      const s = store.cards[w.id];
      return s && s.seen && s.dueAt <= store.counter;
    });

    // Among reviews, a word you just failed gets first claim on the slot —
    // that is the whole point of pressing Again.
    due.sort((a, b) => {
      const sa = store.cards[a.id], sb = store.cards[b.id];
      if ((sa.level === 0) !== (sb.level === 0)) return sa.level === 0 ? -1 : 1;
      return sa.dueAt - sb.dueAt;
    });

    // Alternate new words and reviews. Without this, reviews always win the
    // slot and the list stops moving forward a few words in.
    const reviewSlot = store.counter % 2 === 1;
    if (unseen.length && !(reviewSlot && due.length)) return unseen[0];
    if (due.length) return due[0];
    if (unseen.length) return unseen[0];

    // Nothing new and nothing due: pull the nearest review forward.
    const rest = avail.slice().sort((a, b) => store.cards[a.id].dueAt - store.cards[b.id].dueAt);
    return rest[0] || null;
  }

  function grade(id, verdict) {
    const s = cardState(id);
    // Intervals count from where the card was shown, not from wherever the
    // feed has scrolled to by the time the answer comes in.
    const from = s.servedAt != null ? s.servedAt : store.counter;
    if (verdict === 'again') {
      s.level = 0;
      s.lapses += 1;
      s.dueAt = from + INTERVALS[0];
    } else {
      s.level = Math.min(s.level + 1, INTERVALS.length - 1);
      s.dueAt = from + INTERVALS[s.level];
    }
    save();
    updateProgress();
  }

  function updateProgress() {
    const cards = Object.values(store.cards);
    const seen = cards.filter(s => s.met).length;
    const learned = cards.filter(s => s.met && s.level >= LEARNED_LEVEL).length;
    const total = words.length || 1;
    el.countLearned.textContent = learned;
    el.countTotal.textContent = words.length;
    el.countSeen.textContent = seen ? '· ' + seen + ' met' : '';
    // Two fills: every word you meet moves the dim one, so the bar responds
    // from the first card rather than only once something is mastered.
    el.progressSeen.style.width = (seen / total * 100) + '%';
    el.progressFill.style.width = (learned / total * 100) + '%';
  }

  /* ---------- text helpers ---------- */

  const strip = t => (t || '').replace(HARAKAT, '');
  const shape = t => (store.opts.harakat ? t : strip(t));

  /* ---------- rendering ---------- */

  /* Arabic quoted inside an English sentence needs bidi isolation, or the
     run jumps to the far end of the line. Build it as <bdi> nodes, no innerHTML. */
  function setMixedText(target, text) {
    target.textContent = '';
    const src = text || '';
    // A run of Arabic words, including the spaces *between* them but never a
    // trailing space — a space inside the <bdi> collapses at the direction flip.
    const run = /[؀-ۿ][؀-ۿ.،؟!]*(?:[  ]+[؀-ۿ][؀-ۿ.،؟!]*)*/gu;
    let last = 0, m;
    while ((m = run.exec(src)) !== null) {
      if (m.index > last) target.appendChild(document.createTextNode(src.slice(last, m.index)));
      const b = document.createElement('bdi');
      b.lang = 'ar';
      b.textContent = m[0];
      target.appendChild(b);
      last = m.index + m[0].length;
    }
    if (last < src.length) target.appendChild(document.createTextNode(src.slice(last)));
  }

  function paint(node, w) {
    const enFirst = store.opts.enFirst;
    node.querySelector('.ar').textContent = enFirst ? '' : shape(w.ar);
    node.querySelector('.ar').hidden = enFirst;
    node.querySelector('.en-prompt').textContent = enFirst ? w.en : '';
    node.querySelector('.en-prompt').hidden = !enFirst;

    const main = node.querySelector('.answer-main');
    main.textContent = enFirst ? shape(w.ar) : w.en;
    main.classList.toggle('is-arabic', enFirst);

    node.querySelector('.example-ar').textContent = shape(w.example.ar);
    node.querySelector('.example-en').textContent = w.example.en;
    const pron = node.querySelector('.pron');
    pron.hidden = !w.pron;
    if (w.pron) setMixedText(pron, shape(w.pron));
    const note = node.querySelector('.note');
    note.hidden = !w.note;
    setMixedText(note, shape(w.note));
  }

  function buildCard(w) {
    const node = el.tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = w.id;
    node.querySelector('.rank').textContent = '#' + w.rank;
    node.querySelector('.pos').textContent = w.pos;
    const form = node.querySelector('.form');
    form.hidden = !w.form;
    if (w.form) {
      form.textContent = w.form === 'f' ? 'feminine' : 'masculine';
      form.classList.add(w.form === 'f' ? 'is-f' : 'is-m');
    }
    paint(node, w);

    const inner = node.querySelector('.card-inner');
    const reveal = () => {
      if (node.classList.contains('revealed')) return;
      node.classList.add('revealed');
      cardState(w.id).met = true;
      save();
      updateProgress();
      node.querySelector('.answer').setAttribute('aria-hidden', 'false');
      node.querySelector('.actions').setAttribute('aria-hidden', 'false');
      dismissHint();
    };
    node._reveal = reveal;

    inner.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      reveal();
    });

    node.querySelectorAll('[data-grade]').forEach(btn => {
      btn.addEventListener('click', () => answer(node, w, btn.dataset.grade));
    });

    attachSwipe(node, inner, w, reveal);
    return node;
  }

  function answer(node, w, verdict) {
    if (node.dataset.graded) return;
    node.dataset.graded = verdict;
    grade(w.id, verdict);
    ensureAhead();
    const next = node.nextElementSibling;
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function attachSwipe(node, inner, w, reveal) {
    let x0 = 0, y0 = 0, dx = 0, dy = 0, tracking = false;

    inner.addEventListener('touchstart', e => {
      const t = e.touches[0];
      x0 = t.clientX; y0 = t.clientY; dx = dy = 0; tracking = true;
    }, { passive: true });

    inner.addEventListener('touchmove', e => {
      if (!tracking) return;
      const t = e.touches[0];
      dx = t.clientX - x0;
      dy = t.clientY - y0;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12 && node.classList.contains('revealed')) {
        e.preventDefault();
        inner.style.transform = `translateX(${dx * 0.5}px)`;
        node.classList.toggle('swipe-good', dx > 0);
        node.classList.toggle('swipe-again', dx < 0);
      }
    }, { passive: false });

    inner.addEventListener('touchend', () => {
      if (!tracking) return;
      tracking = false;
      inner.style.transform = '';
      node.classList.remove('swipe-good', 'swipe-again');
      const horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal && Math.abs(dx) > 70 && node.classList.contains('revealed')) {
        answer(node, w, dx > 0 ? 'good' : 'again');
      } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        reveal();
      }
    });
  }

  /* ---------- feed ---------- */

  function appendOne() {
    if (served.length >= MAX_CARDS) return false;
    const w = pickNext();
    if (!w) return false;
    const s = cardState(w.id);
    s.seen = true;
    s.servedAt = store.counter;
    // Provisional slot, in case the card is scrolled past without an answer.
    s.dueAt = store.counter + INTERVALS[Math.min(s.level, INTERVALS.length - 1)];
    store.counter += 1;
    served.push(w.id);
    el.feed.appendChild(buildCard(w));
    save();
    return true;
  }

  function ensureAhead() {
    const cards = el.feed.children;
    const idx = currentIndex();
    while (cards.length - idx - 1 < BUFFER) {
      if (!appendOne()) { markEnd(); break; }
    }
  }

  function currentIndex() {
    const h = el.feed.clientHeight || 1;
    return Math.round(el.feed.scrollTop / h);
  }

  function markEnd() {
    if (el.feed.querySelector('.done')) return;
    const done = document.createElement('div');
    done.className = 'card done';
    done.textContent = 'That’s the whole list for this session. Scroll back up — the words you marked “Again” are already queued to return.';
    el.feed.appendChild(done);
  }

  function dismissHint() {
    if (hintDismissed) return;
    hintDismissed = true;
    el.hint.classList.add('gone');
  }

  function repaintAll() {
    for (const node of el.feed.children) {
      const w = byId.get(Number(node.dataset.id));
      if (w) paint(node, w);
    }
  }

  /* ---------- input ---------- */

  function activeCard() {
    return el.feed.children[currentIndex()] || null;
  }

  document.addEventListener('keydown', e => {
    const node = activeCard();
    if (!node || !node.dataset.id) return;
    const w = byId.get(Number(node.dataset.id));
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (node._reveal) node._reveal();
    } else if (e.key === '1') {
      answer(node, w, 'again');
    } else if (e.key === '2') {
      answer(node, w, 'good');
    }
  });

  el.feed.addEventListener('scroll', () => {
    ensureAhead();
    dismissHint();
  }, { passive: true });

  el.settingsBtn.addEventListener('click', () => {
    const open = el.panel.hidden;
    el.panel.hidden = !open;
    el.settingsBtn.setAttribute('aria-expanded', String(open));
  });

  function bindOpt(input, key, after) {
    input.checked = store.opts[key];
    input.addEventListener('change', () => {
      store.opts[key] = input.checked;
      save();
      if (after) after();
    });
  }

  el.resetBtn.addEventListener('click', () => {
    if (!confirm('Erase all progress and start from word #1?')) return;
    store.counter = 0;
    store.cards = {};
    save();
    served = [];
    el.feed.innerHTML = '';
    el.panel.hidden = true;
    start();
  });

  /* ---------- boot ---------- */

  function start() {
    updateProgress();
    for (let i = 0; i < BUFFER + 1; i++) if (!appendOne()) { markEnd(); break; }
    el.feed.scrollTop = 0;
  }

  fetch('data/words.json', { cache: 'no-cache' })
    .then(r => r.json())
    .then(data => {
      words = data.words.slice().sort((a, b) => a.rank - b.rank);
      byId = new Map(words.map(w => [w.id, w]));
      bindOpt(el.optHarakat, 'harakat', repaintAll);
      bindOpt(el.optEnFirst, 'enFirst', repaintAll);
      start();
    })
    .catch(err => {
      el.feed.innerHTML = '<div class="card done">Could not load the word list.<br>' + err + '</div>';
    });
})();
