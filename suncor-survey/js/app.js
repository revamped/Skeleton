/*
 * Suncor site survey field app: guided capture on the phone, photos named at capture,
 * live gap checking, and one-tap export of the filled Word survey + photo folder.
 */
(function () {
  var S = window.SURVEY, M = window.MODEL, ST = window.STORE;
  var app = document.getElementById('app');
  var sv = null, photos = [], thumbs = {}, saveTimer = null;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function toast(msg, ms) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { ST.saveSurvey(sv).catch(function (e) { toast('Save failed: ' + e.message, 5000); }); }, 300);
  }
  function saveNow() { clearTimeout(saveTimer); return sv ? ST.saveSurvey(sv) : Promise.resolve(); }
  function names() { return M.namePhotos(sv, photos); }
  function siteLabel(s) { return M.clean(s.site.siteId) || 'New site'; }
  function bag(ent) {
    if (ent === 'site') return sv.site;
    if (ent === 'feas') return sv.feas.ans;
    if (ent === 'sign') return sv.signoff;
    return (sv.ans[ent] = sv.ans[ent] || {});
  }
  function fmtDate(ts) { var d = new Date(ts); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  function loadSurvey(id) {
    if (sv && sv.id === id) return Promise.resolve();
    Object.keys(thumbs).forEach(function (k) { URL.revokeObjectURL(thumbs[k]); });
    thumbs = {};
    return ST.survey(id).then(function (s) {
      if (!s) throw new Error('Survey not found');
      sv = s;
      return ST.photos(id);
    }).then(function (ps) { photos = ps; });
  }
  function thumb(p) {
    if (!thumbs[p.id]) thumbs[p.id] = URL.createObjectURL(p.thumb || p.blob);
    return thumbs[p.id];
  }

  /* ---------- progress ---------- */
  function entProgress(ent) {
    var nm = names(), K = S.KINDS[ent.kind], a = sv.ans[ent.key] || {};
    var f = K.fields.filter(function (x) { return !x.ui && x.type !== 'idline' && x.type !== 'photos' && M.applies(x, a); });
    var done = f.filter(function (x) { var v = M.value(sv, nm, ent.key, x); return x.type === 'choicetext' ? v.choice : (v.text || v.choice); }).length;
    var req = K.shots.filter(function (s) { return s.req; });
    var got = req.filter(function (s) { return nm.list.some(function (r) { return r.zone === ent.key && r.shot === s.k; }) || sv.skips[ent.key + '|' + s.k]; }).length;
    var errs = M.entityIssues(sv, nm, ent).filter(function (i) { return i.sev === 'err'; }).length;
    return { done: done, total: f.length, got: got, req: req.length, errs: errs };
  }
  function bar(n, d) { var p = d ? Math.round(100 * n / d) : 100; return '<span class="bar"><i style="width:' + p + '%"></i></span>'; }

  /* ---------- top bar ---------- */
  function top(title, back, right) {
    return '<header class="top">' + (back ? '<a class="back" href="' + back + '" aria-label="Back">&#8249;</a>' : '<span class="logo">SS</span>') +
      '<h1>' + esc(title) + '</h1>' + (right || '') + '</header>';
  }

  /* ---------- home ---------- */
  function home() {
    return Promise.all([ST.surveys(), ST.getFile('template')]).then(function (r) {
      var list = r[0].sort(function (a, b) { return b.updated - a.updated; }), tpl = r[1];
      var h = top('Suncor Site Survey', null, '<a class="icon-btn" href="#/settings" aria-label="Settings">&#9881;</a>');
      h += '<main>';
      if (!tpl) h += '<div class="banner warn">Load the blank <b>Suncor_Site_Survey_v1.1.docx</b> once in <a href="#/settings">Settings</a>, so the app can produce the filled report. You can survey without it.</div>';
      h += '<button class="btn primary wide" data-act="new">+ New site survey</button>';
      if (!list.length) h += '<p class="muted center">No surveys yet.</p>';
      list.forEach(function (s) {
        h += '<a class="card link" href="#/s/' + s.id + '"><div class="row"><b>' + esc(siteLabel(s)) + '</b><span class="muted">' + esc(s.site.date || '') + '</span></div>' +
          '<div class="muted small">' + esc(s.site.address || 'No address yet') + '</div>' +
          '<div class="muted small">' + s.ents.map(function (e) { return e.key; }).join(' · ') + ' · edited ' + fmtDate(s.updated) + '</div></a>';
      });
      h += '<p class="muted small center">Everything is stored on this device only. Export each finished survey as a ZIP.</p></main>';
      app.innerHTML = h;
    });
  }

  /* ---------- overview ---------- */
  function overview() {
    var nm = names(), iss = M.allIssues(sv, nm);
    var errs = iss.filter(function (i) { return i.sev === 'err'; }).length, warns = iss.length - errs;
    var h = top(siteLabel(sv), '#/', '<a class="icon-btn" href="#/s/' + sv.id + '/review">Review</a>');
    h += '<main>';
    var siteErr = M.siteIssues(sv, nm).filter(function (i) { return i.sev === 'err' && i.ent === 'Site'; }).length;
    h += card('#/s/' + sv.id + '/site', 'Site information', 'Site ID, address, contact, exterior photos', siteErr ? siteErr + ' to do' : 'Done', !siteErr);
    h += card('#/s/' + sv.id + '/plan', 'Floor plan', sv.hasPlan ? Object.keys(sv.pins).length + ' IDs marked' : 'Load the plan and tap to mark IDs', sv.hasPlan ? 'Loaded' : 'Not loaded', sv.hasPlan);
    ['display', 'cash', 'endcap', 'room'].forEach(function (kind) {
      var K = S.KINDS[kind];
      h += '<h2 class="sec">' + esc(K.name) + (kind === 'display' ? 's' : kind === 'room' ? 's' : 's') + '</h2>';
      M.entsOf(sv, kind).forEach(function (e) {
        var p = entProgress(e), a = sv.ans[e.key] || {};
        h += '<a class="card link" href="#/s/' + sv.id + '/e/' + e.key + '"><div class="row"><b>' + e.key + '</b><span class="muted small">' + esc(a.area || '') + '</span>' +
          '<span class="pill ' + (p.errs ? '' : 'ok') + '">' + (p.errs ? p.errs + ' to do' : 'Complete') + '</span></div>' +
          '<div class="small muted">Fields ' + p.done + '/' + p.total + ' ' + bar(p.done, p.total) + ' Photos ' + p.got + '/' + p.req + ' ' + bar(p.got, p.req) + '</div></a>';
      });
      h += '<button class="btn ghost" data-act="add" data-kind="' + kind + '">+ Add ' + K.prefix + ' (' + esc(K.name.toLowerCase()) + ')</button>';
    });
    h += '<h2 class="sec">Report</h2>';
    var fe = M.feasIssues(sv, nm).filter(function (i) { return i.sev === 'err'; }).length;
    h += card('#/s/' + sv.id + '/feas', '5 · Display-to-zone comparison', 'Rows are drafted from your answers', fe ? fe + ' to do' : 'Done', !fe);
    var se = M.signoffIssues(sv).filter(function (i) { return i.sev === 'err'; }).length;
    h += card('#/s/' + sv.id + '/sign', '6 · Photo checklist & sign-off', 'Checklist and quality checks fill themselves', se ? se + ' to do' : 'Done', !se);
    h += card('#/s/' + sv.id + '/review', 'Review & export', errs + ' gaps · ' + warns + ' warnings · ' + photos.length + ' photos', errs ? 'Check' : 'Ready', !errs);
    h += '<button class="btn danger ghost" data-act="del-survey">Delete this survey</button></main>';
    app.innerHTML = h;
  }
  function card(href, title, sub, pill, ok) {
    return '<a class="card link" href="' + href + '"><div class="row"><b>' + esc(title) + '</b><span class="pill ' + (ok ? 'ok' : '') + '">' + esc(pill) + '</span></div><div class="small muted">' + esc(sub) + '</div></a>';
  }

  /* ---------- fields ---------- */
  function fieldHTML(ent, f, nm) {
    var b = bag(ent), id = 'fld-' + f.id;
    var h = '<div class="field" id="' + id + '">';
    var lbl = f.relabel ? f.label.replace(f.relabel + '__', (M.entsOf(sv, { D: 'display', C: 'cash', E: 'endcap' }[f.relabel]).map(function (e) { return e.key; }).join(', ') || f.relabel + '__')) : f.label;
    h += '<label>' + esc(lbl) + (f.unit ? ' <span class="u">units</span>' : '') + '</label>';
    var attrs = ' data-ent="' + ent + '" data-f="' + f.id + '"';
    if (ent !== 'site' && ent !== 'feas' && ent !== 'sign' && !M.applies(f, b)) return h + '<div class="auto">N/A (does not apply)</div></div>';
    switch (f.type) {
      case 'text': case 'area': case 'date':
        h += '<input type="' + (f.type === 'date' ? 'date' : 'text') + '"' + attrs + ' value="' + esc(b[f.id] || '') + '" placeholder="' + esc(f.placeholder || '') + '" autocomplete="off">';
        break;
      case 'long':
        h += '<textarea rows="3"' + attrs + ' placeholder="' + esc(f.placeholder || '') + '">' + esc(b[f.id] || '') + '</textarea>';
        break;
      case 'parts':
        h += '<div class="parts">' + f.parts.map(function (p) {
          return '<input type="' + (p.input === 'number' ? 'text' : (p.input || 'text')) + '"' + (p.input === 'number' ? ' inputmode="decimal"' : '') + attrs + ' data-p="' + p.k + '" placeholder="' + esc(p.label) + '" aria-label="' + esc(p.label) + '" value="' + esc((b[f.id] || {})[p.k] || '') + '">';
        }).join('') + '</div>';
        break;
      case 'displays':
        var d = b.displays || {};
        h += '<div class="parts"><input inputmode="numeric"' + attrs + ' data-p="onsite" placeholder="Displays on site" value="' + esc(d.onsite || '') + '">' +
          '<input' + attrs + ' data-p="reason" placeholder="Why any were not surveyed" value="' + esc(d.reason || '') + '"></div>' +
          '<div class="auto">' + esc(M.siteValue(sv, f) || '—') + '</div>';
        break;
      case 'choice': case 'choicetext':
        var cur = b[f.id] || {};
        h += '<div class="choices">' + f.opts.map(function (o) {
          return '<button type="button" class="ch' + (cur.v === o ? ' on' : '') + '"' + attrs + ' data-v="' + esc(o) + '">' + esc(o) + '</button>';
        }).join('') + '</div>';
        if (cur.v && (M.needsNote(f, cur.v) || cur.note)) {
          h += '<input class="note' + (M.needsNote(f, cur.v) && !cur.note ? ' need' : '') + '"' + attrs + ' data-note="1" value="' + esc(cur.note || '') + '" placeholder="' + (cur.v === 'Other' ? 'Specify' : 'Reason (required)') + '">';
        } else if (cur.v) {
          h += '<button type="button" class="link small" data-act="addnote"' + attrs + '>+ add detail</button>';
        }
        if (f.type === 'choicetext') {
          var pp = b[f.id + '__parts'] || {};
          h += '<div class="parts">' + f.parts.map(function (p) {
            return '<input' + (p.input === 'number' ? ' inputmode="decimal"' : '') + attrs + ' data-pp="' + p.k + '" placeholder="' + esc(p.label) + '" value="' + esc(pp[p.k] || '') + '">';
          }).join('') + '</div>';
        }
        break;
      case 'idline': case 'photos':
        var v = M.value(sv, nm, ent, f);
        h += '<div class="auto">' + (v.text ? esc(v.text) : '<i>Fills from photos you take above</i>') + '</div>';
        break;
    }
    if (f.unit && f.type !== 'choice') h += '<button type="button" class="tog' + (b[f.id + '__approx'] ? ' on' : '') + '"' + attrs + ' data-act="approx">≈ approx.</button>';
    if (f.photos && f.type !== 'photos') {
      var ids = M.photoIds(nm, ent, f.photos);
      h += '<div class="small muted">+ Photo IDs added automatically: ' + (ids.length ? esc(ids.join(', ')) : '<i>none yet</i>') + '</div>';
    }
    if (f.hint) h += '<div class="hint">' + esc(f.hint) + '</div>';
    return h + '</div>';
  }

  function shotsHTML(zone, kind) {
    var nm = names(), shots = M.shotsFor(zone, kind);
    var h = '<section class="shots"><h2 class="sec">Photos <span class="muted small">named automatically: ' + esc(M.safeId(sv.site.siteId) || 'SITE') + '_' + zone + '_NN_…</span></h2>';
    shots.forEach(function (sh) {
      var mine = photos.filter(function (p) { return p.ent === zone && p.shot === sh.k; }).sort(function (a, b) { return a.ts - b.ts; });
      var skip = sv.skips[zone + '|' + sh.k];
      var state = mine.length ? 'ok' : skip ? 'skip' : sh.req ? 'need' : '';
      h += '<div class="shot ' + state + '" id="shot-' + sh.k + '"><div class="row"><b>' + esc(sh.label) + (sh.req ? ' <span class="req">*</span>' : '') + '</b>' +
        '<span class="cnt">' + (mine.length || (skip ? 'n/a' : '0')) + '</span></div>';
      if (mine.length) {
        h += '<div class="thumbs">' + mine.map(function (p) {
          var r = nm.byId[p.id];
          return '<button type="button" class="th" data-act="view" data-id="' + p.id + '" title="' + esc(r ? r.name : '') + '"><img src="' + thumb(p) + '" alt=""><span>' + esc(r ? r.name.split('_').slice(-2).join('_').replace('.jpg', '') : '') + '</span></button>';
        }).join('') + '</div>';
      }
      if (skip) h += '<div class="small muted">Not captured: ' + esc(skip) + ' <button class="link small" data-act="unskip" data-zone="' + zone + '" data-shot="' + sh.k + '">undo</button></div>';
      h += '<div class="shot-btns"><label class="btn small primary">Camera<input type="file" accept="image/*" capture="environment" hidden data-act="cam" data-zone="' + zone + '" data-shot="' + sh.k + '"></label>' +
        '<label class="btn small">Library<input type="file" accept="image/*" multiple hidden data-act="cam" data-zone="' + zone + '" data-shot="' + sh.k + '"></label>' +
        (sh.req && !mine.length && !skip ? '<button type="button" class="link skipl" data-act="skip" data-zone="' + zone + '" data-shot="' + sh.k + '">Can\'t capture this?</button>' : '') + '</div></div>';
    });
    return h + '</section>';
  }

  function flowOrder() {
    return ['site'].concat(sv.ents.map(function (e) { return 'e/' + e.key; }), ['plan', 'feas', 'sign', 'review']);
  }
  function navHTML(curPath) {
    var o = flowOrder(), i = o.indexOf(curPath);
    var lbl = function (p) { return p.indexOf('e/') === 0 ? p.slice(2) : { site: 'Site info', plan: 'Floor plan', feas: 'Section 5', sign: 'Sign-off', review: 'Review & export' }[p]; };
    var h = '<nav class="flow">';
    if (i > 0) h += '<a class="btn" href="#/s/' + sv.id + '/' + o[i - 1] + '">&#8249; ' + esc(lbl(o[i - 1])) + '</a>'; else h += '<span></span>';
    if (i >= 0 && i < o.length - 1) h += '<a class="btn primary" href="#/s/' + sv.id + '/' + o[i + 1] + '">' + esc(lbl(o[i + 1])) + ' &#8250;</a>';
    return h + '</nav>';
  }

  function sitePage() {
    var nm = names();
    var h = top('Site information', '#/s/' + sv.id) + '<main>';
    S.SITE_FIELDS.forEach(function (f) { h += fieldHTML('site', f, nm); });
    h += shotsHTML('Site', 'site') + navHTML('site') + '</main>';
    app.innerHTML = h;
  }

  function entPage(key) {
    var ent = sv.ents.filter(function (e) { return e.key === key; })[0];
    if (!ent) return go('#/s/' + sv.id);
    var K = S.KINDS[ent.kind], nm = names();
    var h = top(key + ' · ' + K.name, '#/s/' + sv.id) + '<main>';
    if (!M.clean(sv.site.siteId)) h += '<div class="banner warn">Set the Site ID first (<a href="#/s/' + sv.id + '/site">Site info</a>) so photo names are right. Photos taken now are renamed automatically later.</div>';
    h += fieldHTML(key, K.fields.filter(function (f) { return f.id === 'area'; })[0], nm);
    h += shotsHTML(key, ent.kind);
    var lastPart = 0;
    K.fields.forEach(function (f) {
      if (f.ui) return;
      if (f.part !== lastPart && K.headings.length > 1) { h += '<h2 class="sec">' + esc(K.headings[f.part - 1].replace(/^\d \| /, '')) + '</h2>'; lastPart = f.part; }
      h += fieldHTML(key, f, nm);
    });
    h += navHTML('e/' + key);
    h += '<button class="btn danger ghost" data-act="del-ent" data-key="' + key + '">Remove ' + key + '</button></main>';
    app.innerHTML = h;
  }

  function feasPage() {
    var nm = names(), rows = M.feasRows(sv, nm);
    var h = top('5 · Display-to-zone comparison', '#/s/' + sv.id) + '<main>';
    h += '<p class="small muted">One row per display and zone pairing, with the current position as the baseline. Text is drafted from your answers. Edit it into your own words; the "draft" tag clears once you do.</p>';
    if (!rows.length) h += '<div class="banner">No existing displays recorded, so the table will be left empty.</div>';
    rows.forEach(function (r) {
      h += '<div class="card"><div class="row"><b>' + esc(r.d) + ' → ' + esc(r.cand) + '</b>' + (r.edited ? '' : '<span class="pill">draft</span>') + '</div>' +
        '<label class="small">Fit / visibility evidence</label><textarea rows="3" data-row="' + r.key + '" data-rk="ev">' + esc(r.ev) + '</textarea>' +
        '<label class="small">Work / restriction / photo ref</label><textarea rows="2" data-row="' + r.key + '" data-rk="work">' + esc(r.work) + '</textarea>' +
        (r.edited ? '<button class="link small" data-act="row-reset" data-row="' + r.key + '">Redraft from answers</button>' : '<button class="link small" data-act="row-ok" data-row="' + r.key + '">Looks right, keep it</button>') + '</div>';
    });
    S.FEAS.forEach(function (f) { h += fieldHTML('feas', f, nm); });
    h += navHTML('feas') + '</main>';
    app.innerHTML = h;
  }

  function signPage() {
    var nm = names(), so = M.signoffValues(sv, nm);
    var h = top('6 · Checklist & sign-off', '#/s/' + sv.id) + '<main>';
    h += '<h2 class="sec">Required photographic evidence <span class="muted small">(automatic)</span></h2><div class="card">';
    S.CHECKLIST.forEach(function (c) { var v = so.evidence[c.cat]; h += '<div class="row"><span>' + esc(c.label) + '</span><span class="pill ' + (v === 'Captured' ? 'ok' : v === 'N/A' ? '' : 'bad') + '">' + v + '</span></div>'; });
    h += '</div><div class="field"><label>Photo folder / marked plan filename / missing IDs and reason</label><div class="auto">' + esc(so.folder) + '</div></div>';
    h += '<h2 class="sec">Quality / coverage check <span class="muted small">(automatic)</span></h2><div class="card">';
    [['qcDisplays', 'All displays recorded, IDs on marked plan'], ['qcCash', 'Cash zone assessed'], ['qcEnd', 'End-cap zone assessed'], ['qcBoth', 'Both alternative zones assessed'], ['qcRoom', 'Room + photo evidence documented']].forEach(function (q) {
      var v = so.qc[q[0]]; h += '<div class="row"><span>' + q[1] + '</span><span class="pill ' + (v === 'Yes' ? 'ok' : 'bad') + '">' + v + '</span></div>';
    });
    h += '</div>';
    h += fieldHTML('sign', { id: 'outstanding', label: 'Outstanding verification items / affected IDs / next action', type: 'long' }, nm);
    h += '<button class="btn small" data-act="insert-unable">Insert every "Unable to verify" + missing photo</button>';
    h += fieldHTML('sign', { id: 'observations', label: 'Overall site observations and installation obstacles', type: 'long' }, nm);
    h += '<div class="field"><label>Technician name / signature (typed accepted) / date</label><div class="auto">' + esc(so.signature || '—') + '</div></div>';
    h += navHTML('sign') + '</main>';
    app.innerHTML = h;
  }

  /* ---------- floor plan ---------- */
  var planSel = null;
  function planPage() {
    return ST.getFile('plan:' + sv.id).then(function (blob) {
      var h = top('Floor plan', '#/s/' + sv.id) + '<main>';
      h += '<p class="small muted">Load the plan Memofix sent (a screenshot or photo of it works; for a PDF, take a screenshot). Pick an ID, then tap where it is.</p>';
      h += '<label class="btn">' + (blob ? 'Replace plan image' : 'Load plan image') + '<input type="file" accept="image/*" hidden data-act="plan-load"></label>';
      if (blob) {
        var ids = ['ENT'].concat(sv.ents.map(function (e) { return e.key; }));
        if (!planSel) planSel = ids.filter(function (k) { return !sv.pins[k]; })[0] || ids[1];
        h += '<div class="chips">' + ids.map(function (k) {
          return '<button class="chip' + (k === planSel ? ' on' : '') + (sv.pins[k] ? ' done' : '') + '" data-act="pin-sel" data-k="' + k + '">' + (k === 'ENT' ? 'Entrance' : k) + (sv.pins[k] ? ' ✓' : '') + '</button>';
        }).join('') + '</div>';
        h += '<div class="plan" id="plan"><img id="plan-img" src="' + URL.createObjectURL(blob) + '" alt="Floor plan">' +
          Object.keys(sv.pins).map(function (k) { var p = sv.pins[k]; return '<span class="pin ' + (k === 'ENT' ? 'ent' : k.replace(/\d+/, '')) + '" style="left:' + (p.x * 100) + '%;top:' + (p.y * 100) + '%">' + (k === 'ENT' ? 'ENT' : k) + '</span>'; }).join('') + '</div>';
        h += '<div class="row"><button class="btn small ghost" data-act="pin-clear">Remove ' + esc(planSel) + ' pin</button><button class="btn small" data-act="plan-png">Preview marked plan</button></div>';
      }
      h += navHTML('plan') + '</main>';
      app.innerHTML = h;
    });
  }
  function markedPlan() {
    return ST.getFile('plan:' + sv.id).then(function (blob) {
      if (!blob) return null;
      return createImageBitmap(blob).then(function (img) {
        var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        var g = c.getContext('2d'); g.drawImage(img, 0, 0);
        var r = Math.max(14, Math.round(img.width / 70));
        var colors = { D: '#c0392b', C: '#1f6fb2', E: '#1e8449', ER: '#7d3c98', ENT: '#111' };
        Object.keys(sv.pins).forEach(function (k) {
          var p = sv.pins[k], x = p.x * img.width, y = p.y * img.height, label = k === 'ENT' ? 'ENTRANCE' : k;
          var col = colors[k === 'ENT' ? 'ENT' : k.replace(/\d+/, '')] || '#000';
          g.font = 'bold ' + Math.round(r * 1.1) + 'px sans-serif';
          var w = g.measureText(label).width + r;
          g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, r / 6);
          g.beginPath(); g.arc(x, y, r / 2.2, 0, Math.PI * 2); g.fill(); g.stroke();
          g.fillRect(x + r * 0.6, y - r * 0.75, w, r * 1.5); g.strokeRect(x + r * 0.6, y - r * 0.75, w, r * 1.5);
          g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(label, x + r * 1.1, y + 1);
        });
        var site = M.safeId(sv.site.siteId) || 'SITE';
        g.font = 'bold ' + Math.round(r * 1.2) + 'px sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)';
        var cap = site + ' – marked floor plan – ' + (sv.site.date || '');
        g.fillRect(0, img.height - r * 2.2, g.measureText(cap).width + r * 2, r * 2.2); g.fillStyle = '#000'; g.fillText(cap, r, img.height - r * 1.1);
        return new Promise(function (res) { c.toBlob(res, 'image/png'); });
      });
    });
  }

  /* ---------- review & export ---------- */
  function reviewPage() {
    return ST.getFile('template').then(function (tpl) {
      var nm = names(), iss = M.allIssues(sv, nm);
      var errs = iss.filter(function (i) { return i.sev === 'err'; }), warns = iss.filter(function (i) { return i.sev !== 'err'; });
      var h = top('Review & export', '#/s/' + sv.id) + '<main>';
      h += '<div class="card"><div class="row"><b>' + errs.length + ' gaps</b><b>' + warns.length + ' warnings</b><b>' + photos.length + ' photos</b></div>' +
        '<div class="small muted">Gaps are blank answers or missing required photos; they stay blank in the report. Warnings are things to double-check.</div></div>';
      function list(arr, cls) {
        var by = {};
        arr.forEach(function (i) { (by[i.ent] = by[i.ent] || []).push(i); });
        return Object.keys(by).map(function (ent) {
          var path = ent === 'Site' ? 'site' : ent === 'Plan' ? 'plan' : ent === 'Feas' ? 'feas' : ent === 'Signoff' ? 'sign' : 'e/' + ent;
          var title = esc(ent === 'Feas' ? 'Section 5' : ent === 'Signoff' ? 'Sign-off' : ent);
          return '<details class="card ' + cls + '"' + (by[ent].length <= 4 ? ' open' : '') + '><summary>' + title + ' <span class="muted">(' + by[ent].length + ')</span></summary><ul>' + by[ent].map(function (i) {
            var anchor = i.f ? 'fld-' + i.f : i.shot ? 'shot-' + i.shot : '';
            return '<li><a href="#/s/' + sv.id + '/' + path + (anchor ? '?' + anchor : '') + '">' + esc(i.msg) + '</a></li>';
          }).join('') + '</ul></details>';
        }).join('');
      }
      if (errs.length) h += '<h2 class="sec">Gaps</h2>' + list(errs, 'bad');
      if (warns.length) h += '<h2 class="sec">Warnings</h2>' + list(warns, 'warnc');
      h += '<h2 class="sec">Export</h2>';
      if (!tpl) h += '<div class="banner warn">The blank survey template isn\'t loaded, so the ZIP will have photos, the plan and data but no Word report. Load it in <a href="#/settings">Settings</a>.</div>';
      h += '<button class="btn primary wide" data-act="export">Build export ZIP</button><div id="exp"></div>';
      h += '<h2 class="sec">Optional AI check</h2><p class="small muted">Copies a prompt and your answers (text only: no photos, phone or email) for an AI assistant to proofread for contradictions and vague wording. Apply any changes here yourself.</p>' +
        '<button class="btn" data-act="ai">Copy AI review prompt</button>';
      h += navHTML('review') + '</main>';
      app.innerHTML = h;
    });
  }

  function csv(rows) {
    return rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
  }

  function doExport() {
    var out = $('#exp');
    out.innerHTML = '<p class="muted">Building…</p>';
    return saveNow().then(function () { return Promise.all([ST.photos(sv.id), ST.getFile('template'), markedPlan()]); }).then(function (r) {
      photos = r[0];
      var tpl = r[1], plan = r[2];
      var R = M.resolve(sv, photos), site = M.safeId(sv.site.siteId) || 'SITE', date = sv.site.date || '';
      var root = site + '_Suncor_Survey_' + date + '/';
      var zip = new JSZip();
      var byId = {}; photos.forEach(function (p) { byId[p.id] = p; });
      R.names.list.forEach(function (n) { zip.file(root + site + '_Photos/' + n.zone + '/' + n.name, byId[n.id].blob, { compression: 'STORE' }); });
      if (plan) zip.file(root + site + '_FloorPlan_Marked.png', plan, { compression: 'STORE' });
      zip.file(root + site + '_Photo_Register.csv', csv([['Photo ID / filename', 'Zone', 'Subject', 'Captured', 'Note', 'Original file']].concat(
        R.names.list.map(function (n) { return [n.name, n.zone, n.shotLabel, new Date(n.ts).toISOString(), n.note, n.src]; }))));
      var iss = M.allIssues(sv, R.names);
      zip.file(root + 'Open_Items.txt', iss.length ? iss.map(function (i) { return (i.sev === 'err' ? 'GAP  ' : 'WARN ') + i.ent + ': ' + i.msg; }).join('\r\n') : 'No open items.');
      var data = { app: 'suncor-survey', template: S.version, exported: new Date().toISOString(), survey: sv, resolved: { site: R.site, ents: R.ents, feas: R.feas, rows: R.rows, signoff: R.signoff }, photos: R.names.list };
      zip.file(root + 'site_data.json', JSON.stringify(data, null, 2));
      var docxP = tpl ? DOCX.fill(tpl, R) : Promise.resolve(null);
      return docxP.then(function (d) {
        var docName = 'Suncor_Site_Survey_' + site + '_' + date + '.docx';
        if (d) {
          zip.file(root + docName, d.blob);
          if (d.log.length) zip.file(root + 'Fill_Log.txt', d.log.join('\r\n'));
        }
        return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(function (blob) {
          var zipName = site + '_Suncor_Survey_' + date + '.zip';
          var h = '<div class="card ok-card"><b>Ready: ' + esc(zipName) + '</b><div class="small muted">' + (blob.size / 1048576).toFixed(1) + ' MB · ' + R.names.list.length + ' photos' + (d ? ' · Word report included' : ' · no Word report (template not loaded)') + '</div>';
          if (d && d.log.length) h += '<div class="banner warn">Some answers could not be placed in the Word file. See Fill_Log.txt:<br>' + d.log.map(esc).join('<br>') + '</div>';
          h += '<div class="row wrap"><a class="btn primary" download="' + esc(zipName) + '" href="' + URL.createObjectURL(blob) + '">Download ZIP</a>';
          if (d) h += '<a class="btn" download="' + esc(docName) + '" href="' + URL.createObjectURL(d.blob) + '">Word report only</a>';
          h += '<button class="btn" data-act="share" id="share-btn">Share…</button></div></div>';
          out.innerHTML = h;
          doExport.last = new File([blob], zipName, { type: 'application/zip' });
        });
      });
    }).catch(function (e) { out.innerHTML = '<div class="banner bad">Export failed: ' + esc(e.message) + '</div>'; });
  }

  function aiPrompt() {
    var R = M.resolve(sv, photos);
    var site = JSON.parse(JSON.stringify(R.site)); site.contact = '(removed)';
    var text = 'You are QA-reviewing a technician\'s field survey for a Suncor (Petro-Canada) dealer location, template ' + S.version + '.\n' +
      'The technician records observed facts only; "Unable to verify" must carry a reason; estimates are marked (approx.); unused fields are N/A.\n' +
      'Reference facts from the CDM install guide: cash-zone screens ~82 in floor-to-bottom aligned with security monitors; end-cap screens ~6 in above merchandise; ' +
      'CDM connects to Port 5 of the Suncor Meraki MX67; nothing may go in the Suncor rack; minimum internet 25 Mbps down / 5 up.\n\n' +
      'Do NOT invent measurements or facts. Return:\n' +
      '1. Contradictions between answers (quote field + zone ID).\n' +
      '2. Answers that are vague, missing units, or would confuse the client, with a clearer rewording that keeps the same facts.\n' +
      '3. A tightened draft of "Overall site observations and installation obstacles" and the Section 5 evidence/work text, using only the facts given.\n' +
      '4. Anything a reviewer at CRI is likely to ask that the survey does not answer.\n\n' +
      'SURVEY DATA (JSON):\n' + JSON.stringify({ site: site, zones: R.ents.map(function (e) {
        var o = { id: e.key, type: S.KINDS[e.kind].name };
        S.KINDS[e.kind].fields.forEach(function (f) { var v = e.vals[f.id]; if (v && (v.text || v.choice)) o[f.label] = [v.choice, v.note, v.text].filter(Boolean).join(' | '); });
        return o;
      }), section5: { rows: R.rows.map(function (r) { return { display: r.d, zone: r.cand, evidence: r.ev, work: r.work }; }), answers: R.feas }, signoff: R.signoff }, null, 1);
    var done = function () { toast('Prompt copied. Paste it into your AI assistant.'); };
    try { navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); }); } catch (e) { fallbackCopy(text); done(); }
  }
  function fallbackCopy(t) { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } a.remove(); }

  /* ---------- settings ---------- */
  function settings() {
    return Promise.all([ST.getFile('template'), ST.getFile('templateName'), ST.estimate()]).then(function (r) {
      var h = top('Settings', '#/') + '<main>';
      h += '<div class="field"><label>Technician name (default for new surveys)</label><input data-pref="tech" value="' + esc(ST.pref('tech') || '') + '"></div>';
      var q = ST.pref('photoMax') || 2560;
      h += '<div class="field"><label>Photo size</label><div class="choices">' + [[1920, 'Small'], [2560, 'Standard'], [3840, 'High'], [0, 'Original']].map(function (o) {
        return '<button class="ch' + (q === o[0] ? ' on' : '') + '" data-act="photomax" data-v="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div><div class="hint">Standard (2560 px) keeps serial labels readable at about 0.5–1 MB per photo. Original keeps the camera file as-is.</div></div>';
      h += '<div class="field"><label>Blank survey template (.docx)</label><div class="auto">' + (r[0] ? 'Loaded: ' + esc(r[1] || 'template.docx') : 'Not loaded') + '</div>' +
        '<label class="btn">' + (r[0] ? 'Replace template' : 'Load template') + '<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden data-act="tpl"></label>' +
        '<div class="hint">Load the blank Suncor_Site_Survey_v1.1.docx from Memofix/CRI once. It stays on this device and is checked against every field the app fills.</div><div id="tplmsg"></div></div>';
      if (r[2]) h += '<p class="small muted">Storage used on this device: ' + (r[2].usage / 1048576).toFixed(0) + ' MB of ' + (r[2].quota / 1048576).toFixed(0) + ' MB available.</p>';
      h += '<p class="small muted">Install: open this page in Safari/Chrome and choose "Add to Home Screen". It then works offline, which helps in back rooms without signal.</p></main>';
      app.innerHTML = h;
    });
  }

  /* ---------- photo capture ---------- */
  function processImage(file) {
    var max = ST.pref('photoMax');
    if (max == null) max = 2560;
    function thumbFrom(bmp) {
      var s = Math.min(1, 320 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
      c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.7); });
    }
    if (typeof createImageBitmap !== 'function') return Promise.resolve({ blob: file, thumb: null });
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file); }).then(function (bmp) {
      return thumbFrom(bmp).then(function (th) {
        var big = Math.max(bmp.width, bmp.height);
        if (!max || big <= max) return { blob: file, thumb: th };
        var s = max / big, c = document.createElement('canvas');
        c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        return new Promise(function (res) { c.toBlob(function (b) { res({ blob: b || file, thumb: th }); }, 'image/jpeg', 0.88); });
      });
    }).catch(function () { return { blob: file, thumb: null }; });
  }
  function addPhotos(zone, shot, files) {
    files = Array.prototype.slice.call(files);
    if (!files.length) return;
    toast('Saving ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + '…', 8000);
    var base = Date.now();
    return files.reduce(function (p, f, i) {
      return p.then(function () {
        return processImage(f).then(function (r) {
          var rec = { id: 'p' + base.toString(36) + i + Math.random().toString(36).slice(2, 6), sid: sv.id, ent: zone, shot: shot, ts: f.lastModified && files.length > 1 ? f.lastModified : base + i, blob: r.blob, thumb: r.thumb, note: '', src: f.name || '' };
          return ST.savePhoto(rec).then(function () { photos.push(rec); });
        });
      });
    }, Promise.resolve()).then(function () {
      delete sv.skips[zone + '|' + shot];
      return saveNow();
    }).then(function () { toast('Saved.'); rerender(); })
      .catch(function (e) { toast('Could not save photo: ' + e.message, 6000); });
  }

  function viewPhoto(id) {
    var p = photos.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var nm = names().byId[id];
    var url = URL.createObjectURL(p.blob);
    var d = document.createElement('div'); d.className = 'modal';
    d.innerHTML = '<div class="modal-in"><img src="' + url + '" alt=""><div class="small"><b>' + esc(nm ? nm.name : '') + '</b><br>' + esc(fmtDate(p.ts)) + (p.src ? ' · from ' + esc(p.src) : '') + '</div>' +
      '<input id="ph-note" placeholder="Note / caption (goes in the photo register)" value="' + esc(p.note || '') + '">' +
      '<div class="row"><button class="btn danger" id="ph-del">Delete</button><button class="btn primary" id="ph-close">Done</button></div></div>';
    document.body.appendChild(d);
    function close() {
      var n = $('#ph-note', d).value;
      URL.revokeObjectURL(url); d.remove();
      if (n !== (p.note || '')) { p.note = n; ST.savePhoto(p).then(rerender); }
    }
    $('#ph-close', d).onclick = close;
    d.addEventListener('click', function (e) { if (e.target === d) close(); });
    $('#ph-del', d).onclick = function () {
      if (!confirm('Delete this photo? Later photos in this zone are renumbered.')) return;
      ST.deletePhoto(id).then(function () {
        photos = photos.filter(function (x) { return x.id !== id; });
        if (thumbs[id]) { URL.revokeObjectURL(thumbs[id]); delete thumbs[id]; }
        URL.revokeObjectURL(url); d.remove(); rerender();
      });
    };
  }

  /* ---------- events ---------- */
  var renderedPath = '';
  function rerender() { var y = window.scrollY; route(true).then(function () { window.scrollTo(0, y); }); }

  app.addEventListener('input', function (e) {
    var t = e.target, ent = t.dataset.ent, f = t.dataset.f;
    if (t.dataset.pref) { ST.pref(t.dataset.pref, t.value); return; }
    if (t.dataset.row) {
      var r = sv.feas.rows[t.dataset.row] = sv.feas.rows[t.dataset.row] || {};
      var cur = M.feasRows(sv, names()).filter(function (x) { return x.key === t.dataset.row; })[0];
      if (r.ev == null) r.ev = cur.ev; if (r.work == null) r.work = cur.work;
      r[t.dataset.rk] = t.value; save(); return;
    }
    if (!ent || !f) return;
    var b = bag(ent);
    if (t.dataset.note) { b[f] = b[f] || {}; b[f].note = t.value; t.classList.toggle('need', !t.value); }
    else if (t.dataset.pp) { var pp = b[f + '__parts'] = b[f + '__parts'] || {}; pp[t.dataset.pp] = t.value; }
    else if (t.dataset.p) { var o = b[f] = (b[f] && typeof b[f] === 'object') ? b[f] : {}; o[t.dataset.p] = t.value; }
    else b[f] = t.value;
    if (f === 'area' || t.dataset.p === 'onsite' || t.dataset.p === 'reason') liveAuto(ent);
    save();
  });
  app.addEventListener('change', function (e) {
    var t = e.target, act = t.dataset.act;
    if (act === 'cam') { addPhotos(t.dataset.zone, t.dataset.shot, t.files); t.value = ''; }
    else if (act === 'plan-load' && t.files[0]) {
      processImage(t.files[0]).then(function (r) { return ST.putFile('plan:' + sv.id, r.blob); }).then(function () { sv.hasPlan = true; return saveNow(); }).then(rerender);
    } else if (act === 'tpl' && t.files[0]) {
      var file = t.files[0], msg = $('#tplmsg');
      file.arrayBuffer().then(function (buf) {
        return DOCX.check(buf).then(function (c) {
          if (!c.ok) { msg.innerHTML = '<div class="banner bad">This file doesn\'t match ' + S.version + '. Not found: ' + c.missing.slice(0, 6).map(esc).join('; ') + (c.missing.length > 6 ? '…' : '') + '</div>'; return; }
          return ST.putFile('template', buf).then(function () { return ST.putFile('templateName', file.name); }).then(function () { toast('Template loaded and checked.'); rerender(); });
        });
      }).catch(function (err) { msg.innerHTML = '<div class="banner bad">' + esc(err.message) + '</div>'; });
    }
  });
  // Keep the auto-built lines on screen in step with typing, without re-rendering the page.
  function liveAuto(ent) {
    var nm = names();
    if (ent === 'site') {
      var f = S.SITE_FIELDS.filter(function (x) { return x.id === 'displays'; })[0], el = $('#fld-displays .auto');
      if (el) el.textContent = M.siteValue(sv, f) || '—';
      return;
    }
    var kind = M.kindOf(sv, ent);
    if (!kind || kind === 'site') return;
    S.KINDS[kind].fields.forEach(function (f) {
      if (f.type !== 'idline') return;
      var el = $('#fld-' + f.id + ' .auto');
      if (el) el.textContent = M.value(sv, nm, ent, f).text;
    });
  }
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act], .ch, .pin-target, #plan'), act = t && t.dataset.act;
    if (!t) return;
    if (t.classList.contains('ch') && t.dataset.ent) {
      var b = bag(t.dataset.ent), f = t.dataset.f, v = t.dataset.v;
      b[f] = b[f] && b[f].v === v ? {} : { v: v, note: (b[f] && b[f].note) || '' };
      save(); rerender();
      return;
    }
    if (t.id === 'plan' && !act) {
      var img = $('#plan-img'), rc = img.getBoundingClientRect();
      var x = (e.clientX - rc.left) / rc.width, y = (e.clientY - rc.top) / rc.height;
      if (x < 0 || y < 0 || x > 1 || y > 1 || !planSel) return;
      sv.pins[planSel] = { x: x, y: y };
      var ids = ['ENT'].concat(sv.ents.map(function (en) { return en.key; }));
      planSel = ids.filter(function (k) { return !sv.pins[k]; })[0] || planSel;
      save(); rerender(); return;
    }
    switch (act) {
      case 'new':
        var s = M.newSurvey(ST.pref('tech') || '');
        ST.persist();
        ST.saveSurvey(s).then(function () { go('#/s/' + s.id + '/site'); });
        break;
      case 'add':
        var k = M.nextKey(sv, t.dataset.kind);
        sv.ents.push({ key: k, kind: t.dataset.kind }); M.sortEnts(sv);
        saveNow().then(function () { go('#/s/' + sv.id + '/e/' + k); });
        break;
      case 'del-ent':
        var key = t.dataset.key, n = photos.filter(function (p) { return p.ent === key; }).length;
        var kind = M.kindOf(sv, key);
        if (kind !== 'display' && M.entsOf(sv, kind).length < 2) { toast('At least one ' + S.KINDS[kind].name.toLowerCase() + ' is required.'); break; }
        if (!confirm('Remove ' + key + ' and its ' + n + ' photo(s)? Other IDs keep their numbers.')) break;
        sv.ents = sv.ents.filter(function (x) { return x.key !== key; }); delete sv.ans[key]; delete sv.pins[key];
        Promise.all(photos.filter(function (p) { return p.ent === key; }).map(function (p) { return ST.deletePhoto(p.id); })).then(function () {
          photos = photos.filter(function (p) { return p.ent !== key; });
          return saveNow();
        }).then(function () { go('#/s/' + sv.id); });
        break;
      case 'del-survey':
        if (!confirm('Delete ' + siteLabel(sv) + ' and all ' + photos.length + ' photos from this device? Export first if you need them.')) break;
        ST.deleteSurvey(sv.id).then(function () { sv = null; go('#/'); });
        break;
      case 'view': viewPhoto(t.dataset.id); break;
      case 'skip':
        var why = prompt('Why can\'t this photo be taken? (goes in the report)');
        if (why) { sv.skips[t.dataset.zone + '|' + t.dataset.shot] = why; save(); rerender(); }
        break;
      case 'unskip': delete sv.skips[t.dataset.zone + '|' + t.dataset.shot]; save(); rerender(); break;
      case 'approx':
        var bb = bag(t.dataset.ent); bb[t.dataset.f + '__approx'] = !bb[t.dataset.f + '__approx']; save(); rerender(); break;
      case 'addnote':
        var bn = bag(t.dataset.ent); bn[t.dataset.f].note = bn[t.dataset.f].note || ' '; rerender();
        setTimeout(function () { var i = $('#fld-' + t.dataset.f + ' input.note'); if (i) { i.value = ''; i.focus(); } }, 50);
        break;
      case 'row-reset': delete sv.feas.rows[t.dataset.row]; save(); rerender(); break;
      case 'row-ok':
        var cur = M.feasRows(sv, names()).filter(function (x) { return x.key === t.dataset.row; })[0];
        sv.feas.rows[t.dataset.row] = { ev: cur.ev, work: cur.work }; save(); rerender(); break;
      case 'insert-unable':
        var lines = M.unableList(sv, names());
        sv.signoff.outstanding = (M.clean(sv.signoff.outstanding) ? sv.signoff.outstanding + '\n' : '') + (lines.length ? lines.join('\n') : 'None');
        save(); rerender(); break;
      case 'pin-sel': planSel = t.dataset.k; rerender(); break;
      case 'pin-clear': delete sv.pins[planSel]; save(); rerender(); break;
      case 'plan-png':
        markedPlan().then(function (b) { if (b) window.open(URL.createObjectURL(b), '_blank'); });
        break;
      case 'export': doExport(); break;
      case 'share':
        var file = doExport.last;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: file.name }).catch(function () { /* cancelled */ });
        else toast('Sharing files isn\'t supported here. Use Download.');
        break;
      case 'ai': aiPrompt(); break;
      case 'photomax': ST.pref('photoMax', parseInt(t.dataset.v, 10)); rerender(); break;
    }
  });

  /* ---------- router ---------- */
  function route(keep) {
    var hash = location.hash.replace(/^#/, '') || '/';
    var q = hash.split('?'), path = q[0], anchor = q[1];
    var m = path.match(/^\/s\/([^/]+)(?:\/(.+))?$/);
    var p;
    if (path === '/settings') p = settings();
    else if (m) {
      p = loadSurvey(m[1]).then(function () {
        var sub = m[2] || '';
        if (!sub) return overview();
        if (sub === 'site') return sitePage();
        if (sub === 'plan') return planPage();
        if (sub === 'feas') return feasPage();
        if (sub === 'sign') return signPage();
        if (sub === 'review') return reviewPage();
        if (sub.indexOf('e/') === 0) return entPage(sub.slice(2));
        return overview();
      }).catch(function (e) { app.innerHTML = top('Not found', '#/') + '<main><p>' + esc(e.message) + '</p></main>'; });
    } else p = home();
    return Promise.resolve(p).then(function () {
      if (!keep && renderedPath !== hash) {
        var el = anchor && document.getElementById(anchor);
        if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } else window.scrollTo(0, 0);
      }
      renderedPath = hash;
    });
  }
  window.addEventListener('hashchange', function () { route(); });
  window.addEventListener('pagehide', function () { if (sv) saveNow(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && sv) saveNow(); });
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ });
  }
})();
