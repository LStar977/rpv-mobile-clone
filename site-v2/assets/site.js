/* Represent site-v2 — progressive enhancement only.
   Every word of content is in the HTML; this adds motion, nothing else. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Theme toggle ────────────────────────────────────────────────── */
  var btn = document.getElementById('theme');
  if (btn) {
    btn.addEventListener('click', function () {
      var cur = document.documentElement.dataset.theme;
      if (!cur) {
        cur = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('rv-theme', next); } catch (e) {}
    });
  }

  /* ── Reveal on scroll ────────────────────────────────────────────── */
  // Position-based rather than observer-only. IntersectionObserver alone
  // silently misses anything the page jumps past — an anchor link, a restored
  // scroll position, a programmatic scroll — and those elements then stay at
  // opacity 0 forever. Content must never be able to get stuck invisible.
  var rises = Array.prototype.slice.call(document.querySelectorAll('.rise'));

  if (reduced) {
    rises.forEach(function (el) { el.classList.add('in'); });
  } else {
    var pending = rises.slice();

    function show(el) {
      var sibs = Array.prototype.slice.call(el.parentNode.children).filter(function (n) {
        return n.classList && n.classList.contains('rise');
      });
      el.style.transitionDelay = Math.min(sibs.indexOf(el), 5) * 70 + 'ms';
      el.classList.add('in');
    }

    function sweep() {
      var limit = window.innerHeight * 0.94;
      pending = pending.filter(function (el) {
        if (el.getBoundingClientRect().top < limit) { show(el); return false; }
        return true;
      });
      if (!pending.length) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    }

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; sweep(); });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    sweep();
  }

  /* ── Hero ledger texture ─────────────────────────────────────────── */
  // Deterministic pseudo-hex so the page looks identical on every load and
  // in every screenshot. Never random.
  function hex(seed, len) {
    var s = '', x = seed * 2654435761;
    for (var i = 0; i < len; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      s += '0123456789abcdef'[(x >> 8) % 16];
    }
    return s;
  }
  var ledger = document.getElementById('ledger');
  if (ledger) {
    var rows = '';
    for (var i = 0; i < 16; i++) {
      rows += '<div><span>0x' + hex(i + 11, 10) + '…' + hex(i + 71, 6) +
              '</span><span>SEALED</span></div>';
    }
    ledger.innerHTML = rows;
  }

  /* ── The threshold demonstration ─────────────────────────────────── */
  // Shows, rather than explains, the one rule that makes the product
  // different: the split is not visible until ten verified people have voted.
  var dotsEl = document.getElementById('dots');
  if (dotsEl) {
    var TOTAL = 10;
    var countEl = document.getElementById('count');
    var sealedEl = document.getElementById('sealedState');
    var pubEl = document.getElementById('publishedState');
    var card = document.getElementById('ruleCard');

    for (var d = 0; d < TOTAL; d++) {
      var s = document.createElement('span');
      s.className = 'dot';
      dotsEl.appendChild(s);
    }
    var dots = dotsEl.querySelectorAll('.dot');

    function setCount(n) {
      dots.forEach(function (el, idx) { el.classList.toggle('on', idx < n); });
      countEl.textContent = n + ' of ' + TOTAL + ' verified ballots';
      var done = n >= TOTAL;
      sealedEl.hidden = done;
      pubEl.hidden = !done;
      card.querySelector('.label').textContent = done ? 'Ballot · published' : 'Ballot · sealed';
    }

    if (reduced) {
      // No animation: land on the published state so the point still reads.
      setCount(TOTAL);
    } else {
      setCount(0);
      var ran = false;
      var runner = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting || ran) return;
          ran = true;
          var n = 0;
          var tick = setInterval(function () {
            n++;
            setCount(n);
            if (n >= TOTAL) clearInterval(tick);
          }, 260);
          runner.disconnect();
        });
      }, { threshold: 0.45 });
      runner.observe(card);
    }
  }
})();
