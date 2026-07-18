/* Represent landing page runtime.
 * Plain vanilla JS — no framework. Converted from the Claude Design
 * prototype (landing-page handoff bundle). Handles: theme toggle,
 * countdown, referendum grid render, scroll-reveal bar animation,
 * sticky mobile CTA, and live tally fetch.
 */
(function () {
  'use strict';

  var PORTAL = 'https://representportal.com';
  var REFERENDUM_TARGET = new Date('2026-10-19T07:00:00-06:00'); // polls open, Alberta MDT
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Published proposal IDs (content/civic-desk-2026-06-launch.published.json)
  var Q10_ID = '80b8cec4-4690-4e0c-b92f-9563b8c2fd95';
  var Q10_REMAIN_OPTION = 'Alberta should remain a province of Canada';
  var QUESTIONS = [
    { num: 1, id: '65bc4f40-ed16-4a0e-8851-9b8903f9ec14', title: 'Provincial control over immigration' },
    { num: 2, id: '2a0e78ef-f87f-4051-977b-acbbe071c258', title: 'Program eligibility by immigration status' },
    { num: 3, id: '759945a4-040a-4321-a2f7-45c52fb574d5', title: 'A 12-month residency rule for social supports' },
    { num: 4, id: '0b69ee1d-a4e5-4415-93c8-ad8b3272565a', title: 'Health and education fees for non-permanent residents' },
    { num: 5, id: '64c7abd0-538b-4d41-8bb1-0f055f8cc77f', title: 'Proof of citizenship to vote', citizens: true },
    { num: 6, id: '1497849e-d3c3-4180-8bcf-b7badd85e117', title: 'Provincial selection of superior-court judges' },
    { num: 7, id: '9d2f763c-bf7a-4f39-925b-087129e4e1af', title: 'Abolishing the federal Senate' },
    { num: 8, id: 'daac1ce4-0392-4043-9868-34a2e3a17e74', title: 'Opting out of federal programs, keeping the funding' },
    { num: 9, id: '57576c44-49b2-4336-9839-3460b4e1b3c9', title: 'Provincial law priority in shared jurisdiction' }
  ];

  function fmt(n) { return Number(n).toLocaleString('en-CA'); }

  // ── Theme toggle ──────────────────────────────────────────────────
  var themeBtn = document.getElementById('rv-theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      var next = cur === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('represent_theme', next); } catch (e) {}
    });
  }

  // ── Countdown ─────────────────────────────────────────────────────
  var daysEl = document.getElementById('rv-days');
  var cdEl = document.getElementById('rv-countdown');
  function pad(x) { return String(x).padStart(2, '0'); }
  function tick() {
    var ms = REFERENDUM_TARGET - new Date();
    if (ms < 0) ms = 0;
    var d = Math.floor(ms / 86400000);
    var h = Math.floor((ms % 86400000) / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    if (cdEl) cdEl.textContent = d + ' d · ' + pad(h) + ' h · ' + pad(m) + ' m · ' + pad(s) + ' s until polls open';
    if (daysEl) daysEl.textContent = String(Math.max(0, Math.ceil(ms / 86400000)));
  }
  tick();
  setInterval(tick, 1000);

  // ── Q1–Q9 grid render ─────────────────────────────────────────────
  var grid = document.getElementById('rv-grid');
  if (grid) {
    var html = QUESTIONS.map(function (q) {
      return (
        '<a href="' + PORTAL + '/p/' + q.id + '" class="rv-card-link" style="display: flex; flex-direction: column; gap: 14px; background: var(--lp-card); box-shadow: var(--lp-card-shadow); border: 1px solid var(--lp-hairline); border-radius: 14px; padding: 24px;">' +
          '<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">' +
            '<span style="font-family: \'JetBrains Mono\', ui-monospace, monospace; font-size: 11.5px; font-weight: 600; letter-spacing: 0.12em; color: var(--lp-muted); text-transform: uppercase;">Question ' + q.num + '</span>' +
            (q.citizens ? '<span style="background: var(--lp-gold); color: #000000; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px;">Citizens only</span>' : '') +
          '</div>' +
          '<div style="font-family: Fraunces, Georgia, serif; font-size: 21px; font-weight: 600; line-height: 1.25; letter-spacing: -0.008em; text-wrap: balance; min-height: 2.5em;">' + q.title + '</div>' +
          '<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-family: \'JetBrains Mono\', ui-monospace, monospace; font-size: 13px; font-weight: 500;">' +
            '<span data-q="' + q.id + '" data-field="yes" style="color: var(--lp-text-strong);">Yes —</span>' +
            '<span data-q="' + q.id + '" data-field="no" style="color: var(--lp-muted);">No —</span>' +
          '</div>' +
          '<div style="height: 6px; border-radius: 999px; background: var(--lp-track); overflow: hidden;">' +
            '<div data-q="' + q.id + '" data-field="bar" data-bar-w="0" style="height: 100%; width: 0%; border-radius: 999px; background: var(--lp-bar); transition: width 1000ms cubic-bezier(0.2,0.7,0.2,1);"></div>' +
          '</div>' +
          '<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; color: var(--lp-muted);">' +
            '<span data-q="' + q.id + '" data-field="votes" style="font-family: \'JetBrains Mono\', ui-monospace, monospace; font-size: 12.5px;">Awaiting live tally</span>' +
            '<span aria-hidden="true" style="color: var(--lp-gold-text);">→</span>' +
          '</div>' +
        '</a>'
      );
    }).join('');
    grid.insertAdjacentHTML('beforebegin', html);
    grid.remove();
  }

  // ── Sticky mobile CTA ─────────────────────────────────────────────
  var hero = document.getElementById('rv-hero');
  var sticky = document.getElementById('rv-sticky');
  if (hero && sticky && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      sticky.style.transform = entries[0].isIntersecting ? 'translateY(110%)' : 'translateY(0)';
    }, { threshold: 0 }).observe(hero);
  }

  // ── Bar reveal on scroll ──────────────────────────────────────────
  var barIO = null;
  function observeBars() {
    var bars = Array.prototype.slice.call(document.querySelectorAll('[data-bar-w]'));
    if (reduced || !('IntersectionObserver' in window)) {
      bars.forEach(function (b) { b.style.transition = 'none'; b.style.width = b.dataset.barW + '%'; });
      return;
    }
    if (!barIO) {
      barIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.style.width = e.target.dataset.barW + '%';
          barIO.unobserve(e.target);
        });
      }, { threshold: 0.5 });
    }
    bars.forEach(function (b) { barIO.observe(b); });
  }
  observeBars();

  // ── Live tallies ──────────────────────────────────────────────────
  // GET /api/public/referendum-tallies returns:
  //   { proposals: [ { id, supportVotes, opposeVotes, totalVotes, options? } ] }
  // options (Q10 only) maps option text -> count.
  function setBar(el, pct) {
    if (!el) return;
    el.dataset.barW = String(pct);
    // If already revealed (or reduced motion), update width directly.
    if (reduced || el.style.width !== '0%') el.style.width = pct + '%';
    else if (barIO) barIO.observe(el);
  }

  function q10El(field) { return document.querySelector('[data-q10="' + field + '"]'); }

  function applyTallies(data) {
    if (!data || !Array.isArray(data.proposals)) return;
    var byId = {};
    data.proposals.forEach(function (p) { byId[String(p.id)] = p; });

    // Q1–Q9 yes/no cards
    QUESTIONS.forEach(function (q) {
      var p = byId[q.id];
      if (!p) return;
      var yes = Number(p.supportVotes) || 0;
      var no = Number(p.opposeVotes) || 0;
      var total = Number(p.totalVotes) || (yes + no);
      var yesEl = document.querySelector('[data-q="' + q.id + '"][data-field="yes"]');
      var noEl = document.querySelector('[data-q="' + q.id + '"][data-field="no"]');
      var barEl = document.querySelector('[data-q="' + q.id + '"][data-field="bar"]');
      var votesEl = document.querySelector('[data-q="' + q.id + '"][data-field="votes"]');
      if (total === 0) {
        if (votesEl) votesEl.textContent = 'Be the first verified ballot';
        return;
      }
      // Below the 25-ballot threshold the server withholds the split —
      // show the count only, never a percentage.
      if (p.belowThreshold) {
        if (votesEl) votesEl.textContent = fmt(total) + ' of 25 ballots \u00b7 split publishes at 25';
        return;
      }
      var yesPct = Math.round((yes / total) * 100);
      if (yesEl) yesEl.textContent = 'Yes ' + yesPct + '%';
      if (noEl) noEl.textContent = 'No ' + (100 - yesPct) + '%';
      if (votesEl) votesEl.textContent = fmt(total) + ' verified ballots';
      setBar(barEl, yesPct);
    });

    // Q10 multiple-choice (hero card + feature card)
    var p10 = byId[Q10_ID];
    var status = document.getElementById('rv-q10-status');
    if (p10 && p10.belowThreshold) {
      var totalB = Number(p10.totalVotes) || 0;
      var ballotsElB = q10El('ballots');
      if (ballotsElB) ballotsElB.textContent = fmt(totalB);
      var votesLabelB = q10El('votesLabel');
      if (votesLabelB) votesLabelB.textContent = fmt(totalB) + ' of 25 ballots \u00b7 split publishes at 25';
      if (status) status.textContent = 'Early voting';
    } else if (p10) {
      var remain = 0, begin = 0;
      if (p10.options && typeof p10.options === 'object') {
        Object.keys(p10.options).forEach(function (opt) {
          var count = Number(p10.options[opt]) || 0;
          if (opt === Q10_REMAIN_OPTION) remain += count; else begin += count;
        });
      }
      var total10 = remain + begin;
      if (total10 > 0) {
        var remainPct = Math.round((remain / total10) * 100);
        var beginPct = 100 - remainPct;
        [['remainPct', remainPct + '%'], ['remainPct2', remainPct + '%'], ['beginPct', beginPct + '%'], ['beginPct2', beginPct + '%']].forEach(function (pair) {
          var el = q10El(pair[0]);
          if (el) el.textContent = pair[1];
        });
        var ballotsEl = q10El('ballots');
        if (ballotsEl) ballotsEl.textContent = fmt(total10);
        var votesLabel = q10El('votesLabel');
        if (votesLabel) votesLabel.textContent = fmt(total10) + ' verified ballots';
        setBar(q10El('remainBar'), remainPct);
        setBar(q10El('remainBar2'), remainPct);
        setBar(q10El('beginBar'), beginPct);
        setBar(q10El('beginBar2'), beginPct);
        if (status) status.textContent = 'Live';
      } else {
        var ballotsEl0 = q10El('ballots');
        if (ballotsEl0) ballotsEl0.textContent = '0';
        var votesLabel0 = q10El('votesLabel');
        if (votesLabel0) votesLabel0.textContent = 'Polls are open — be counted first';
        if (status) status.textContent = 'Polls open';
      }
    }
  }

  function loadTallies() {
    fetch(PORTAL + '/api/public/referendum-tallies', { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(applyTallies)
      .catch(function () { /* keep "Awaiting live tally" state */ });
  }
  loadTallies();
  setInterval(loadTallies, 60000);
})();
