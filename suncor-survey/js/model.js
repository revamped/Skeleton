/*
 * Survey model: turns stored answers + photos into the exact values that go in the
 * Word survey, names photos, and lists gaps / inconsistencies for the review screen.
 * Pure functions, no DOM, so docx-fill.js and the UI share one source of truth.
 */
(function () {
  var S = window.SURVEY;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clean(s) { return String(s == null ? '' : s).trim(); }
  function safeId(s) { return clean(s).replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''); }
  function camel(s) {
    return clean(s).replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).slice(0, 4)
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join('').slice(0, 24);
  }

  function newSurvey(tech) {
    var today = new Date();
    var iso = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    return {
      id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      created: Date.now(), updated: Date.now(),
      site: { tech: tech || '', siteId: '', address: '', date: iso, contact: {}, displays: {} },
      ents: [{ key: 'D01', kind: 'display' }, { key: 'C01', kind: 'cash' }, { key: 'E01', kind: 'endcap' }, { key: 'ER01', kind: 'room' }],
      ans: {}, skips: {}, feas: { ans: {}, rows: {} }, signoff: {}, pins: {}, hasPlan: false
    };
  }

  function entsOf(s, kind) { return s.ents.filter(function (e) { return e.kind === kind; }); }
  function nextKey(s, kind) {
    var p = S.KINDS[kind].prefix, n = 1;
    var used = s.ents.map(function (e) { return e.key; });
    while (used.indexOf(p + pad(n)) >= 0) n++;
    return p + pad(n);
  }
  function sortEnts(s) {
    var order = { display: 0, cash: 1, endcap: 2, room: 3 };
    s.ents.sort(function (a, b) { return order[a.kind] - order[b.kind] || (a.key < b.key ? -1 : 1); });
  }
  function shotsFor(entKey, kind) { return entKey === 'Site' ? S.SITE_SHOTS : S.KINDS[kind].shots; }
  function kindOf(s, key) {
    if (key === 'Site') return 'site';
    var e = s.ents.filter(function (x) { return x.key === key; })[0];
    return e ? e.kind : null;
  }

  /* ---------- photo naming ---------- */
  // SiteID_ZoneID_NN_Description.jpg, numbered per zone in checklist order then capture time,
  // so the numbering never has gaps even after deleting or retaking a photo.
  function namePhotos(s, photos) {
    var site = safeId(s.site.siteId) || 'SITE';
    var zones = ['Site'].concat(s.ents.map(function (e) { return e.key; }));
    var out = { byId: {}, list: [] };
    zones.forEach(function (z) {
      var kind = kindOf(s, z);
      var shots = shotsFor(z, kind);
      var mine = photos.filter(function (p) { return p.ent === z; });
      mine.sort(function (a, b) {
        var ia = shots.map(function (x) { return x.k; }).indexOf(a.shot), ib = shots.map(function (x) { return x.k; }).indexOf(b.shot);
        return ia - ib || a.ts - b.ts;
      });
      mine.forEach(function (p, i) {
        var shot = shots.filter(function (x) { return x.k === p.shot; })[0] || { d: 'Photo', label: p.shot };
        var desc = shot.d;
        if (p.shot === 'Other' && p.note) desc = camel(p.note) || 'Other';
        var name = site + '_' + z + '_' + pad(i + 1) + '_' + desc + '.jpg';
        var row = { id: p.id, name: name, zone: z, shot: p.shot, shotLabel: shot.label, ts: p.ts, note: p.note || '', src: p.src || '' };
        out.byId[p.id] = row;
        out.list.push(row);
      });
    });
    return out;
  }
  function photoIds(names, zone, shotKeys) {
    return names.list.filter(function (r) {
      return r.zone === zone && (shotKeys === '*' || shotKeys.indexOf(r.shot) >= 0);
    }).map(function (r) { return r.name.replace(/\.jpg$/, ''); });
  }

  /* ---------- answer composition ---------- */
  function applies(f, a) { return !f.when || f.when(a); }
  function needsNote(f, v) { return (f.note || S.NOTE_DEFAULT).indexOf(v) >= 0; }

  function composeParts(f, val) {
    val = val || {};
    var bits = f.parts.map(function (p) {
      var v = clean(val[p.k]);
      return v ? (f.bare ? v : p.label + ': ' + v) : '';
    }).filter(Boolean);
    return bits.join(' / ');
  }

  // Returns { text?, choice?, note? } for a field of an entity.
  function value(s, names, entKey, f) {
    var a = (s.ans[entKey] = s.ans[entKey] || {});
    var site = clean(s.site.siteId);
    if (!applies(f, a)) return { text: 'N/A', auto: true };
    var text = '';
    switch (f.type) {
      case 'idline':
        text = [site || '(Site ID)', entKey].concat(f.area ? [clean(a.area)] : []).filter(Boolean).join(' / ');
        return { text: text, auto: true };
      case 'photos':
        var ids = photoIds(names, entKey, f.photos);
        return { text: ids.join(', '), auto: true };
      case 'choice':
        return a[f.id] && a[f.id].v ? { choice: a[f.id].v, note: clean(a[f.id].note) } : {};
      case 'choicetext':
        var r = {};
        if (a[f.id] && a[f.id].v) { r.choice = a[f.id].v; r.note = clean(a[f.id].note); }
        var det = composeParts(f, a[f.id + '__parts']);
        if (det && clean((a[f.id + '__parts'] || {}).down)) det = det.replace(/Down Mbps: ([^/]+) \/ Up Mbps: ([^/]+)/, 'Speed: $1↓ / $2↑ Mbps');
        if (f.photos) { var pi = photoIds(names, entKey, f.photos); if (pi.length) det = (det ? det + '; ' : '') + 'Photo: ' + pi.join(', '); }
        r.text = det;
        return r;
      case 'parts':
        text = composeParts(f, a[f.id]);
        break;
      default:
        text = clean(a[f.id]);
    }
    if (text && f.unit && a[f.id + '__approx']) text += ' (approx.)';
    if (f.photos && f.type !== 'photos') {
      var p = photoIds(names, entKey, f.photos);
      if (p.length) text = (text ? text + '; ' : '') + 'Photo: ' + p.join(', ');
    }
    return { text: text };
  }

  function siteValue(s, f) {
    var st = s.site;
    if (f.id === 'contact') return composeParts(f, st.contact);
    if (f.id === 'displays') {
      var n = entsOf(s, 'display').length, on = clean(st.displays.onsite);
      if (on === '') return '';
      var not = Math.max(0, (parseInt(on, 10) || 0) - n);
      var t = on + ' on site / ' + n + ' surveyed / ' + not + ' not surveyed';
      if (not && clean(st.displays.reason)) t += ' (' + clean(st.displays.reason) + ')';
      return t;
    }
    return clean(st[f.id]);
  }

  /* ---------- section 5 suggestions ---------- */
  function pick(s, names, key, kind, id) {
    var f = S.KINDS[kind].fields.filter(function (x) { return x.id === id; })[0];
    var v = value(s, names, key, f);
    return v.choice || v.text || '';
  }
  function pairings(s) {
    var out = [];
    entsOf(s, 'display').forEach(function (d) {
      out.push({ d: d.key, z: d.key, zk: 'display' });
      entsOf(s, 'cash').forEach(function (c) { out.push({ d: d.key, z: c.key, zk: 'cash' }); });
      entsOf(s, 'endcap').forEach(function (e) { out.push({ d: d.key, z: e.key, zk: 'endcap' }); });
    });
    return out;
  }
  function suggest(s, names, p) {
    function g(key, kind, id) { return pick(s, names, key, kind, id); }
    var size = g(p.d, 'display', 'size') || 'size ?';
    var ev, work, ph;
    if (p.zk === 'display') {
      ev = 'Baseline (current position). ' + size + '; view: ' + (g(p.d, 'display', 'view') || '?') +
        '; powered: ' + (g(p.d, 'display', 'powered') || '?') + '; HDMI: ' + (g(p.d, 'display', 'hdmiPorts') || '?');
      work = g(p.d, 'display', 'followup');
      ph = photoIds(names, p.d, ['Wide', 'Sightline']);
    } else if (p.zk === 'cash') {
      ev = size + ' vs max usable ' + (g(p.z, 'cash', 'maxSize') || '?') + '; fits: ' + (g(p.z, 'cash', 'fits') || '?') +
        '; sightlines: ' + (g(p.z, 'cash', 'align') || '?') + '; viability: ' + (g(p.z, 'cash', 'viability') || '?');
      work = [g(p.z, 'cash', 'mountWork'), g(p.z, 'cash', 'secSolution')].filter(function (x) { return x && x !== 'N/A'; }).join('; ');
      ph = photoIds(names, p.z, ['EntranceView', 'CounterFront']);
    } else {
      ev = size + ' vs usable ' + (g(p.z, 'endcap', 'usable') || '?') + '; view: ' + (g(p.z, 'endcap', 'view') || '?') +
        '; viability: ' + (g(p.z, 'endcap', 'viability') || '?');
      work = g(p.z, 'endcap', 'challenges');
      ph = photoIds(names, p.z, ['EntranceView', 'FixtureFront']);
    }
    if (ph.length) work = (work ? work + '; ' : '') + 'Photo: ' + ph.join(', ');
    return { ev: ev, work: work };
  }
  function feasRows(s, names) {
    return pairings(s).map(function (p) {
      var k = p.d + '>' + p.z, st = s.feas.rows[k] || {}, sug = suggest(s, names, p);
      var area = clean((s.ans[p.d] || {}).area);
      return {
        key: k, d: p.d, z: p.z, zk: p.zk,
        current: p.d + (area ? ' – ' + area : ''),
        cand: p.zk === 'display' ? p.d + ' (current, baseline)' : p.z,
        ev: st.ev != null ? st.ev : sug.ev, work: st.work != null ? st.work : sug.work,
        sugEv: sug.ev, sugWork: sug.work, edited: st.ev != null || st.work != null
      };
    });
  }

  /* ---------- completeness / photo checks ---------- */
  function shotStatus(s, names) {
    var rows = [];
    ['Site'].concat(s.ents.map(function (e) { return e.key; })).forEach(function (z) {
      var kind = kindOf(s, z);
      shotsFor(z, kind).forEach(function (sh) {
        var n = names.list.filter(function (r) { return r.zone === z && r.shot === sh.k; }).length;
        rows.push({ zone: z, kind: kind, shot: sh, count: n, skip: s.skips[z + '|' + sh.k] });
      });
    });
    return rows;
  }
  function photoEvidence(s, names) {
    var st = shotStatus(s, names), out = {};
    S.CHECKLIST.forEach(function (c) {
      var req = st.filter(function (r) { return r.shot.cat === c.cat && r.shot.req; });
      var missing = req.filter(function (r) { return !r.count; });
      if (c.cat === 'site' && !s.hasPlan) missing.push({ zone: 'Site', shot: { label: 'Marked floor plan' }, skip: 'floor plan not marked' });
      out[c.cat] = !req.length ? 'N/A' : missing.length ? 'Missing' : 'Captured';
    });
    return out;
  }
  function missingPhotos(s, names) {
    var m = shotStatus(s, names).filter(function (r) { return r.shot.req && !r.count; });
    return m;
  }

  function isBlank(v) { return !v || (!v.text && !v.choice); }

  function entityIssues(s, names, ent) {
    var kind = ent.kind, a = s.ans[ent.key] || {}, iss = [];
    var K = S.KINDS[kind];
    K.fields.forEach(function (f) {
      if (f.type === 'idline' || f.type === 'photos' || f.ui) return;
      if (!applies(f, a)) return;
      var v = value(s, names, ent.key, f);
      if (f.type === 'choicetext' ? !v.choice : isBlank(v)) iss.push({ sev: 'err', ent: ent.key, f: f.id, msg: 'Not answered: ' + f.label });
      else if (v.choice && needsNote(f, v.choice) && !v.note) iss.push({ sev: 'err', ent: ent.key, f: f.id, msg: '"' + v.choice + '" needs a reason: ' + f.label });
      if (f.unit) {
        var raw = f.type === 'parts' ? Object.keys(a[f.id] || {}).map(function (k) { return a[f.id][k]; }) : [a[f.id]];
        raw.forEach(function (r) {
          r = clean(r).replace(/\b(D|C|E|ER)\d{2}\b/g, '');
          if (r && /\d/.test(r) && !/(\d\s*(in|inch|inches|ft|feet|foot|cm|mm|m|U)\b|\d\s*["'″′])/i.test(r))
            iss.push({ sev: 'warn', ent: ent.key, f: f.id, msg: 'No unit on "' + r + '": ' + f.label });
        });
      }
    });
    a = s.ans[ent.key] || {};
    function v(id) { return a[id] && a[id].v; }
    if (kind === 'display') {
      if (v('constant') === 'Yes' && v('outlet') === 'No') iss.push({ sev: 'warn', ent: ent.key, f: 'constant', msg: 'Constant power is "Yes" but no outlet at the display.' });
      var hp = a.hdmiPorts || {};
      var t = parseInt(hp.total, 10), sum = ['free', 'occupied', 'inacc'].reduce(function (x, k) { return x + (parseInt(hp[k], 10) || 0); }, 0);
      if (!isNaN(t) && sum && t !== sum) iss.push({ sev: 'warn', ent: ent.key, f: 'hdmiPorts', msg: 'HDMI ports: free + occupied + inaccessible (' + sum + ') ≠ total (' + t + ').' });
      if (v('hdmi') === 'No' && t > 0) iss.push({ sev: 'warn', ent: ent.key, f: 'hdmi', msg: 'HDMI marked "No" but HDMI port count is ' + t + '.' });
      var ft = /(\d+(?:\.\d+)?)\s*(ft|feet|')/i.exec(a.routeDetail || '');
      if (v('route100') === 'Yes' && ft && parseFloat(ft[1]) > 100) iss.push({ sev: 'warn', ent: ent.key, f: 'route100', msg: 'Route ≤100 ft is "Yes" but the pathway length says ' + ft[0] + '.' });
    }
    if (kind === 'cash' || kind === 'endcap') {
      if (v('viability') === 'Viable' && v('restrict') === 'Yes') iss.push({ sev: 'warn', ent: ent.key, f: 'viability', msg: 'Marked "Viable" although mounting restrictions were found. Should it be "Viable with work"?' });
    }
    if (kind === 'room') {
      if (v('mx67') === 'No' && v('port5') && v('port5') !== 'N/A') iss.push({ sev: 'warn', ent: ent.key, f: 'port5', msg: 'No MX67 found, so Port 5 should be N/A.' });
      var tp = a.test__parts || {};
      if (v('test') === 'Pass' && (parseFloat(tp.down) < 25 || parseFloat(tp.up) < 5)) iss.push({ sev: 'warn', ent: ent.key, f: 'test', msg: 'Internet test "Pass" but below the CDM minimum of 25 down / 5 up Mbps.' });
      if ((v('test') === 'Pass' || v('test') === 'Fail') && !clean(tp.method) && !clean(tp.port)) iss.push({ sev: 'warn', ent: ent.key, f: 'test', msg: 'Record the port / method used for the internet test.' });
    }
    shotsFor(ent.key, kind).forEach(function (sh) {
      if (!sh.req) return;
      var n = names.list.filter(function (r) { return r.zone === ent.key && r.shot === sh.k; }).length;
      var skip = s.skips[ent.key + '|' + sh.k];
      if (!n) iss.push({ sev: skip ? 'warn' : 'err', ent: ent.key, shot: sh.k, msg: 'Photo missing: ' + sh.label + (skip ? ' (reason: ' + skip + ')' : '') });
    });
    if (s.hasPlan && !s.pins[ent.key]) iss.push({ sev: 'warn', ent: ent.key, plan: true, msg: ent.key + ' is not marked on the floor plan.' });
    return iss;
  }

  function siteIssues(s, names) {
    var iss = [], st = s.site;
    S.SITE_FIELDS.forEach(function (f) { if (!siteValue(s, f)) iss.push({ sev: 'err', ent: 'Site', f: f.id, msg: 'Not answered: ' + f.label }); });
    if (st.siteId && safeId(st.siteId) !== clean(st.siteId)) iss.push({ sev: 'warn', ent: 'Site', f: 'siteId', msg: 'Site ID has spaces/symbols; filenames will use "' + safeId(st.siteId) + '".' });
    S.SITE_SHOTS.forEach(function (sh) {
      if (!sh.req) return;
      var n = names.list.filter(function (r) { return r.zone === 'Site' && r.shot === sh.k; }).length;
      var skip = s.skips['Site|' + sh.k];
      if (!n) iss.push({ sev: skip ? 'warn' : 'err', ent: 'Site', shot: sh.k, msg: 'Photo missing: ' + sh.label + (skip ? ' (reason: ' + skip + ')' : '') });
    });
    if (!s.hasPlan) iss.push({ sev: 'warn', ent: 'Plan', msg: 'No floor plan marked yet (needed with the survey).' });
    ['display', 'cash', 'endcap', 'room'].forEach(function (k) {
      if (k !== 'display' && !entsOf(s, k).length) iss.push({ sev: 'err', ent: 'Site', msg: 'At least one ' + S.KINDS[k].name.toLowerCase() + ' is mandatory.' });
    });
    return iss;
  }

  function feasIssues(s, names) {
    var iss = [], a = s.feas.ans;
    S.FEAS.forEach(function (f) {
      var v = f.type === 'choice' ? (a[f.id] && a[f.id].v) : clean(a[f.id]);
      if (!v) iss.push({ sev: 'err', ent: 'Feas', f: f.id, msg: 'Not answered: ' + f.label });
      else if (f.type === 'choice' && needsNote(f, v) && !clean(a[f.id].note)) iss.push({ sev: 'err', ent: 'Feas', f: f.id, msg: '"' + v + '" needs a reason: ' + f.label });
    });
    var unedited = feasRows(s, names).filter(function (r) { return !r.edited; }).length;
    if (unedited) iss.push({ sev: 'warn', ent: 'Feas', msg: unedited + ' comparison row(s) still show the auto-drafted text. Review and confirm them.' });
    return iss;
  }

  function signoffIssues(s) {
    var iss = [];
    if (!clean(s.signoff.observations)) iss.push({ sev: 'err', ent: 'Signoff', f: 'observations', msg: 'Not answered: Overall site observations and installation obstacles' });
    if (!clean(s.signoff.outstanding)) iss.push({ sev: 'warn', ent: 'Signoff', f: 'outstanding', msg: 'Outstanding verification items is empty (write "None" if nothing is outstanding).' });
    return iss;
  }

  function allIssues(s, names) {
    var out = siteIssues(s, names);
    s.ents.forEach(function (e) { out = out.concat(entityIssues(s, names, e)); });
    return out.concat(feasIssues(s, names), signoffIssues(s));
  }

  // Every "Unable to verify" answer, for the outstanding-items field.
  function unableList(s, names) {
    var lines = [];
    s.ents.forEach(function (e) {
      S.KINDS[e.kind].fields.forEach(function (f) {
        if (f.type !== 'choice' && f.type !== 'choicetext') return;
        var v = value(s, names, e.key, f);
        if (v.choice === 'Unable to verify' || v.choice === 'Not tested') lines.push(e.key + ' – ' + f.label.replace(/\?$/, '') + ': ' + v.choice + (v.note ? ' (' + v.note + ')' : ''));
      });
    });
    missingPhotos(s, names).forEach(function (r) { lines.push(r.zone + ' – photo missing: ' + r.shot.label + (r.skip ? ' (' + r.skip + ')' : '')); });
    return lines;
  }

  function signoffValues(s, names) {
    var site = safeId(s.site.siteId) || 'SITE';
    var ev = photoEvidence(s, names);
    var miss = missingPhotos(s, names).map(function (r) { return r.zone + ' ' + r.shot.label + (r.skip ? ' – ' + r.skip : ''); });
    if (!s.hasPlan) miss.push('Marked floor plan – not supplied');
    var folder = site + '_Photos (' + names.list.length + ' photos)' + (s.hasPlan ? ' / ' + site + '_FloorPlan_Marked.png' : '') +
      ' / Missing: ' + (miss.length ? miss.join('; ') : 'none');
    function done(kind) {
      var es = entsOf(s, kind);
      if (!es.length) return kind === 'display' ? 'Yes' : 'No';
      return es.every(function (e) { return !entityIssues(s, names, e).some(function (i) { return i.sev === 'err' || i.plan; }); }) ? 'Yes' : 'No';
    }
    var qc = { qcDisplays: done('display'), qcCash: done('cash'), qcEnd: done('endcap'), qcRoom: done('room') };
    if (qc.qcDisplays === 'Yes' && !s.hasPlan && entsOf(s, 'display').length) qc.qcDisplays = 'Unable to verify';
    qc.qcBoth = qc.qcCash === 'Yes' && qc.qcEnd === 'Yes' ? 'Yes' : 'No';
    return {
      evidence: ev, folder: folder, qc: qc,
      outstanding: clean(s.signoff.outstanding), observations: clean(s.signoff.observations),
      signature: [clean(s.site.tech), clean(s.site.date)].filter(Boolean).join(' (typed) / ')
    };
  }

  // Everything the Word filler needs, resolved to final strings.
  function resolve(s, photos) {
    var names = namePhotos(s, photos);
    var ents = s.ents.map(function (e) {
      var vals = {};
      S.KINDS[e.kind].fields.forEach(function (f) { if (!f.ui) vals[f.id] = value(s, names, e.key, f); });
      return { key: e.key, kind: e.kind, vals: vals };
    });
    var site = {};
    S.SITE_FIELDS.forEach(function (f) { site[f.id] = siteValue(s, f); });
    var feas = {};
    S.FEAS.forEach(function (f) {
      var a = s.feas.ans[f.id];
      feas[f.id] = f.type === 'choice' ? (a && a.v ? { choice: a.v, note: clean(a.note) } : {}) : { text: clean(a) };
    });
    var ids = { D: entsOf(s, 'display').map(function (e) { return e.key; }), C: entsOf(s, 'cash').map(function (e) { return e.key; }),
      E: entsOf(s, 'endcap').map(function (e) { return e.key; }) };
    return { site: site, ents: ents, feas: feas, rows: feasRows(s, names), signoff: signoffValues(s, names), names: names, ids: ids };
  }

  window.MODEL = {
    pad: pad, clean: clean, safeId: safeId, newSurvey: newSurvey, entsOf: entsOf, nextKey: nextKey, sortEnts: sortEnts,
    shotsFor: shotsFor, kindOf: kindOf, namePhotos: namePhotos, photoIds: photoIds, value: value, siteValue: siteValue,
    applies: applies, needsNote: needsNote, feasRows: feasRows, shotStatus: shotStatus, photoEvidence: photoEvidence,
    entityIssues: entityIssues, siteIssues: siteIssues, feasIssues: feasIssues, signoffIssues: signoffIssues, allIssues: allIssues,
    unableList: unableList, signoffValues: signoffValues, resolve: resolve
  };
})();
