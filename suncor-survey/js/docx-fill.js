/*
 * Fills the blank Suncor_Site_Survey_v1.1 .docx with resolved answers (MODEL.resolve).
 *
 * Works on the document XML directly so every run keeps the template's fonts and
 * colours: answers replace only the underscore run, and ticked boxes become ☒ in bold.
 * Extra displays / cash zones / end caps / rooms get real copies of their template
 * pages (not an appendix dump), and a photo register page is added after Section 6.
 * Returns { blob, log } where log lists every label that could not be found.
 */
(function () {
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var XMLNS = 'http://www.w3.org/XML/1998/namespace';
  var ANSWER_COLOR = '1F4E79';
  // Schema order of w:rPr children (Word rejects some out-of-order runs).
  var RPR_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss',
    'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight',
    'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'];
  var S = window.SURVEY;

  function norm(s) { return String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim(); }
  function kids(el, name) { var out = []; for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.namespaceURI === W && c.localName === name) out.push(c); return out; }
  function all(el, name) { return Array.prototype.slice.call(el.getElementsByTagNameNS(W, name)); }
  function ptext(p) { return all(p, 't').map(function (t) { return t.textContent; }).join(''); }
  function isPageBreak(el) { return el.localName === 'p' && all(el, 'br').some(function (b) { return b.getAttributeNS(W, 'type') === 'page'; }); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function mk(doc, name) { return doc.createElementNS(W, 'w:' + name); }
  function setT(doc, t, text) { t.textContent = text; t.setAttributeNS(XMLNS, 'xml:space', 'preserve'); }

  // Run with the given text, copying formatting from `like`.
  function makeRun(doc, like, text, opts) {
    var r = mk(doc, 'r');
    var rp = like && kids(like, 'rPr')[0];
    if (rp) r.appendChild(rp.cloneNode(true));
    opts = opts || {};
    if (opts.color || opts.bold != null || opts.italic) {
      var rPr = kids(r, 'rPr')[0] || r.insertBefore(mk(doc, 'rPr'), r.firstChild);
      var set = function (tag, attrs) {
        var e = kids(rPr, tag)[0];
        if (!e) {
          e = mk(doc, tag);
          var at = RPR_ORDER.indexOf(tag), before = null;
          for (var c = rPr.firstElementChild; c; c = c.nextElementSibling) {
            var ci = RPR_ORDER.indexOf(c.localName);
            if (ci > at) { before = c; break; }
          }
          rPr.insertBefore(e, before);
        }
        Array.prototype.slice.call(e.attributes).forEach(function (a) { e.removeAttributeNode(a); });
        Object.keys(attrs || {}).forEach(function (k) { e.setAttributeNS(W, 'w:' + k, attrs[k]); });
      };
      if (opts.bold === true) set('b');
      if (opts.bold === false) set('b', { val: '0' });
      if (opts.italic) set('i');
      if (opts.color) set('color', { val: opts.color });
    }
    var lines = String(text).split(/\r?\n/);
    lines.forEach(function (line, i) {
      if (i) r.appendChild(mk(doc, 'br'));
      var t = mk(doc, 't'); setT(doc, t, line); r.appendChild(t);
    });
    return r;
  }

  // Merge all runs' text into one run (template choice lines are a single run already).
  function singleRun(doc, p) {
    var runs = kids(p, 'r').filter(function (r) { return kids(r, 't').length; });
    if (!runs.length) return null;
    if (runs.length > 1 || kids(runs[0], 't').length > 1) {
      var txt = ptext(p), r0 = makeRun(doc, runs[0], txt);
      p.insertBefore(r0, runs[0]);
      runs.forEach(function (r) { p.removeChild(r); });
      return r0;
    }
    return runs[0];
  }
  function runText(r) { return kids(r, 't').map(function (t) { return t.textContent; }).join(''); }

  // Replace characters [i, j) of a single-text run with `text` in its own run.
  function spliceRun(doc, r, i, j, text, opts) {
    var full = runText(r), p = r.parentNode;
    var before = full.slice(0, i), after = full.slice(j);
    var mid = makeRun(doc, r, text, opts);
    if (before) p.insertBefore(makeRun(doc, r, before), r);
    p.insertBefore(mid, r);
    if (after) p.insertBefore(makeRun(doc, r, after), r);
    p.removeChild(r);
    return mid;
  }

  function fillBlank(doc, p, value) {
    if (!value) return false;
    var runs = kids(p, 'r');
    for (var k = runs.length - 1; k >= 0; k--) {
      if (kids(runs[k], 't').length > 1) continue;
      var m = /_{3,}/.exec(runText(runs[k]));
      if (m) { spliceRun(doc, runs[k], m.index, m.index + m[0].length, value, { color: ANSWER_COLOR }); return true; }
    }
    // No underscores (e.g. empty table cell): append.
    var like = runs[runs.length - 1] || null;
    p.appendChild(makeRun(doc, like, value, { color: ANSWER_COLOR }));
    return true;
  }

  function markChoice(doc, p, opts, choice, note) {
    if (!choice) return true;
    var r = singleRun(doc, p);
    if (!r) return false;
    var txt = runText(r);
    var re = new RegExp('☐(\\s*)' + esc(choice) + '(?=\\s{2,}|\\s*$|\\s+Port)');
    var m = re.exec(txt);
    if (!m) return false;
    var mid = spliceRun(doc, r, m.index, m.index + m[0].length, '☒' + m[1] + choice, { bold: true, color: ANSWER_COLOR });
    if (note) {
      // The reason goes after the option list, but before a "Port / method / results:" trailer.
      var noteRun = makeRun(doc, mid, '   — ' + note, { italic: true, bold: false, color: ANSWER_COLOR });
      var last = kids(p, 'r').slice(-1)[0];
      var lt = runText(last), tr = /\s{2,}Port \/ method/.exec(lt);
      if (tr && last !== mid) {
        p.insertBefore(makeRun(doc, last, lt.slice(0, tr.index)), last);
        p.insertBefore(noteRun, last);
        p.insertBefore(makeRun(doc, last, lt.slice(tr.index)), last);
        p.removeChild(last);
      } else p.appendChild(noteRun);
    }
    return true;
  }

  function appendToHeading(doc, p, suffix) {
    var runs = kids(p, 'r').filter(function (r) { return kids(r, 't').length; });
    var last = runs[runs.length - 1];
    if (last) p.appendChild(makeRun(doc, last, suffix));
  }

  function setCell(doc, tc, text, keepFormat) {
    var p = all(tc, 'p')[0];
    if (!p) return;
    var runs = kids(p, 'r').filter(function (r) { return kids(r, 't').length; });
    if (runs.length && keepFormat) {
      setT(doc, kids(runs[0], 't')[0], text);
      kids(runs[0], 't').slice(1).forEach(function (t) { t.parentNode.removeChild(t); });
      runs.slice(1).forEach(function (r) { p.removeChild(r); });
      return;
    }
    // Blank template cells hold a run of empty line breaks: replace it, keeping its formatting.
    var allRuns = kids(p, 'r');
    var like = allRuns.filter(function (r) { return kids(r, 'rPr').length; })[0];
    if (!like) {
      like = makeRun(doc, null, '');
      var rPr = mk(doc, 'rPr');
      var f = mk(doc, 'rFonts'); f.setAttributeNS(W, 'w:ascii', 'Aptos'); f.setAttributeNS(W, 'w:hAnsi', 'Aptos'); rPr.appendChild(f);
      var sz = mk(doc, 'sz'); sz.setAttributeNS(W, 'w:val', '16'); rPr.appendChild(sz);
      like.insertBefore(rPr, like.firstChild);
    }
    allRuns.forEach(function (r) { p.removeChild(r); });
    if (text) p.appendChild(makeRun(doc, like, text, { color: ANSWER_COLOR }));
  }

  /* ---------- blocks (one per template page) ---------- */
  function blocks(body) {
    var els = [], out = [], cur = null;
    for (var c = body.firstElementChild; c; c = c.nextElementSibling) els.push(c);
    els.forEach(function (el) {
      if (el.localName === 'sectPr') return;
      if (isPageBreak(el) || !cur) { cur = { els: [], heading: '', headP: null }; out.push(cur); }
      cur.els.push(el);
      if (!cur.heading && el.localName === 'p' && norm(ptext(el))) { cur.heading = norm(ptext(el)); cur.headP = el; }
    });
    return out;
  }
  function paras(block) {
    var out = [];
    block.els.forEach(function (el) { if (el.localName === 'p') out.push(el); });
    return out;
  }
  function findPara(ps, from, label, contains) {
    var L = norm(label);
    for (var i = from; i < ps.length; i++) {
      var t = norm(ptext(ps[i]));
      if (contains ? t.indexOf(L) >= 0 : t.indexOf(L) === 0) return i;
    }
    return -1;
  }

  // Fill one field whose label paragraph is ps[i]. Returns false if the layout didn't match.
  function fillField(doc, ps, i, f, v, ids) {
    var p = ps[i];
    if (f.relabel) {
      var lr = kids(p, 'r')[0];
      var list = ids[f.relabel] || [];
      if (lr && list.length) {
        var t = kids(lr, 't')[0];
        setT(doc, t, t.textContent.replace(f.relabel + '__', list.join(', ')));
      }
    }
    switch (f.type) {
      case 'choice':
        return ps[i + 1] && ptext(ps[i + 1]).indexOf('☐') >= 0 ? markChoice(doc, ps[i + 1], f.opts, v.choice, v.note) : false;
      case 'choicetext':
        if (!ps[i + 1] || ptext(ps[i + 1]).indexOf('☐') < 0) return false;
        var ok = markChoice(doc, ps[i + 1], f.opts, v.choice, v.note);
        if (v.text) fillBlank(doc, ps[i + 1], v.text);
        return ok;
      case 'long':
        var lines = [];
        for (var k = i + 1; k < ps.length && /^_{10,}$/.test(norm(ptext(ps[k]))); k++) lines.push(ps[k]);
        if (!lines.length) return false;
        if (v.text) {
          fillBlank(doc, lines[0], v.text);
          lines.slice(1).forEach(function (lp) { kids(lp, 'r').forEach(function (r) { lp.removeChild(r); }); });
        }
        return true;
      default:
        return v.text ? fillBlank(doc, p, v.text) : true;
    }
  }

  function fillBlock(doc, block, fields, vals, ids, tag, log, where) {
    var ps = paras(block), cur = 0;
    if (tag && block.headP) appendToHeading(doc, block.headP, '  ·  ' + tag);
    fields.forEach(function (f) {
      if (f.ui) return;
      var i = findPara(ps, cur, f.label, f.contains);
      if (i < 0) { log.push(where + ': label not found – ' + f.label); return; }
      if (!fillField(doc, ps, i, f, vals[f.id] || {}, ids)) log.push(where + ': could not fill – ' + f.label);
      cur = i + 1;
    });
  }

  function cloneAfter(group, copies) {
    var last = group[group.length - 1].els.slice(-1)[0];
    var ref = last.nextSibling, parent = last.parentNode;
    for (var n = 0; n < copies; n++) {
      group.forEach(function (b) { b.els.forEach(function (el) { parent.insertBefore(el.cloneNode(true), ref); }); });
    }
  }

  function groupOf(bl, headings) {
    return bl.filter(function (b) { return headings.some(function (h) { return b.heading.indexOf(norm(h)) === 0; }); });
  }

  /* ---------- main ---------- */
  function fill(templateBuf, R) {
    return JSZip.loadAsync(templateBuf).then(function (zip) {
      return zip.file('word/document.xml').async('string').then(function (xml) {
        var doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) throw new Error('Template document.xml could not be read.');
        var body = all(doc, 'body')[0];
        var log = [];
        var bl = blocks(body);

        // Check this is the right template before touching anything.
        var missingHeads = [];
        Object.keys(S.KINDS).forEach(function (k) { S.KINDS[k].headings.forEach(function (h) { if (!groupOf(bl, [h]).length) missingHeads.push(h); }); });
        [S.HEADINGS.feas, S.HEADINGS.signoff].forEach(function (h) { if (!groupOf(bl, [h]).length) missingHeads.push(h); });
        if (missingHeads.length) throw new Error('This does not look like ' + S.version + ' (missing: ' + missingHeads.join('; ') + ').');

        // Keep pristine copies for the photo register before filling.
        var feasBlock = groupOf(bl, [S.HEADINGS.feas])[0];
        var signBlock = groupOf(bl, [S.HEADINGS.signoff])[0];
        var regTable = feasBlock.els.filter(function (e) { return e.localName === 'tbl'; })[0];
        var regTpl = regTable && regTable.cloneNode(true);
        var regBreak = signBlock.els[0].cloneNode(true);
        var regHead = signBlock.headP.cloneNode(true);
        var regSub = paras(signBlock)[2] && paras(signBlock)[2].cloneNode(true);

        // Duplicate template pages for 2nd+ display / zone / room.
        Object.keys(S.KINDS).forEach(function (kind) {
          var n = R.ents.filter(function (e) { return e.kind === kind; }).length;
          if (n > 1) cloneAfter(groupOf(bl, S.KINDS[kind].headings), n - 1);
        });
        bl = blocks(body);

        // Sections 1–4
        Object.keys(S.KINDS).forEach(function (kind) {
          var K = S.KINDS[kind];
          var ents = R.ents.filter(function (e) { return e.kind === kind; });
          if (!ents.length) {
            var na = {};
            K.fields.forEach(function (f) { na[f.id] = f.type === 'choice' || f.type === 'choicetext' ? {} : { text: 'N/A' }; });
            na.idline = { text: (R.site.siteId || '') + ' / N/A – no existing displays on site' };
            ents = [{ key: 'N/A', vals: na }];
          }
          K.headings.forEach(function (h, partIdx) {
            var bs = groupOf(bl, [h]);
            var fields = K.fields.filter(function (f) { return f.part === partIdx + 1; });
            ents.forEach(function (e, i) {
              if (!bs[i]) { log.push(e.key + ': template page missing for ' + h); return; }
              fillBlock(doc, bs[i], fields, e.vals, R.ids, e.key === 'N/A' ? '' : e.key, log, e.key + ' p' + (partIdx + 1));
            });
          });
        });

        // Site information table
        var siteTbl = all(body, 'tbl')[0];
        S.SITE_FIELDS.forEach(function (f) {
          var row = all(siteTbl, 'tr').filter(function (tr) { var c = kids(tr, 'tc'); return c[0] && norm(ptext(c[0])).indexOf(norm(f.row)) === 0; })[0];
          if (!row) { log.push('Site info: row not found – ' + f.row); return; }
          var p = all(kids(row, 'tc')[1], 'p')[0];
          if (R.site[f.id]) fillBlank(doc, p, R.site[f.id]);
        });

        // Section 5: comparison table + questions
        var fb = groupOf(bl, [S.HEADINGS.feas])[0];
        var tbl = fb.els.filter(function (e) { return e.localName === 'tbl'; })[0];
        if (tbl) {
          var trs = kids(tbl, 'tr');
          var tplRow = trs[trs.length - 1];
          R.rows.forEach(function (row, i) {
            var tr = kids(tbl, 'tr')[i + 1];
            if (!tr) { tr = tplRow.cloneNode(true); tbl.appendChild(tr); }
            var cells = kids(tr, 'tc');
            [row.d, row.current, row.cand, row.ev, row.work].forEach(function (v, c) { if (cells[c]) setCell(doc, cells[c], v || ''); });
          });
        } else log.push('Section 5: comparison table not found');
        fillBlock(doc, fb, S.FEAS, R.feas, R.ids, '', log, 'Section 5');

        // Section 6: photo checklist, quality checks, sign-off
        var sb = groupOf(bl, [S.HEADINGS.signoff])[0];
        var sps = paras(sb);
        S.CHECKLIST.forEach(function (c) {
          var i = findPara(sps, 0, c.text, true);
          if (i < 0) { log.push('Section 6: checklist row not found – ' + c.text); return; }
          if (!markChoice(doc, sps[i], ['Captured', 'Missing', 'N/A'], R.signoff.evidence[c.cat])) log.push('Section 6: could not tick – ' + c.text);
        });
        var sv = R.signoff, qc = sv.qc;
        var vals = {
          folder: { text: sv.folder }, qcDisplays: { choice: qc.qcDisplays }, qcCash: { choice: qc.qcCash }, qcEnd: { choice: qc.qcEnd },
          qcBoth: { choice: qc.qcBoth }, qcRoom: { choice: qc.qcRoom }, outstanding: { text: sv.outstanding },
          observations: { text: sv.observations }, signature: { text: sv.signature }
        };
        var signFields = S.SIGNOFF.map(function (f) {
          var t = f.id.indexOf('qc') === 0 ? 'choice' : (f.id === 'outstanding' || f.id === 'observations') ? 'long' : 'text';
          return { id: f.id, label: f.label, type: t, opts: ['Yes', 'No', 'Unable to verify'] };
        });
        if (qc.qcDisplays === 'Unable to verify') vals.qcDisplays.note = 'floor plan not supplied';
        fillBlock(doc, sb, signFields, vals, R.ids, '', log, 'Section 6');

        // Photo register page after Section 6
        if (regTpl && R.names.list.length) {
          var after = sb.els[sb.els.length - 1];
          var ref = after.nextSibling, parent = after.parentNode;
          var hr = regHead, hruns = kids(hr, 'r').filter(function (r) { return kids(r, 't').length; });
          setT(doc, kids(hruns[0], 't')[0], 'Photo Register');
          hruns.slice(1).forEach(function (r) { hr.removeChild(r); });
          parent.insertBefore(regBreak, ref);
          parent.insertBefore(hr, ref);
          if (regSub) {
            var sruns = kids(regSub, 'r').filter(function (r) { return kids(r, 't').length; });
            if (sruns[0]) {
              setT(doc, kids(sruns[0], 't')[0], 'Every photo delivered in the ' + (R.site.siteId || 'SITE') + '_Photos folder (' + R.names.list.length + ' files), grouped by survey ID.');
              sruns.slice(1).forEach(function (r) { regSub.removeChild(r); });
            }
            parent.insertBefore(regSub, ref);
          }
          var rtrs = kids(regTpl, 'tr');
          var head = rtrs[0], rowTpl = rtrs[1];
          rtrs.slice(1).forEach(function (tr) { regTpl.removeChild(tr); });
          // Compact rows: one paragraph per cell, no fixed row height.
          all(rowTpl, 'trHeight').forEach(function (h) { h.parentNode.removeChild(h); });
          kids(rowTpl, 'tc').forEach(function (tc) { kids(tc, 'p').slice(1).forEach(function (p) { tc.removeChild(p); }); });
          ['Zone', 'Subject', 'Captured', 'Photo ID / filename', 'Note'].forEach(function (h, c) { setCell(doc, kids(head, 'tc')[c], h, true); });
          R.names.list.forEach(function (ph) {
            var tr = rowTpl.cloneNode(true);
            var d = new Date(ph.ts);
            var when = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + ' ' +
              ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
            [ph.zone, ph.shotLabel, when, ph.name, ph.note].forEach(function (v, c) { setCell(doc, kids(tr, 'tc')[c], v || ''); });
            regTpl.appendChild(tr);
          });
          parent.insertBefore(regTpl, ref);
        }

        var out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
        zip.file('word/document.xml', out);
        return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
          .then(function (blob) { return { blob: blob, log: log }; });
      });
    });
  }

  // Quick check run when the template is loaded in Settings.
  function check(templateBuf) {
    return JSZip.loadAsync(templateBuf).then(function (zip) {
      var f = zip.file('word/document.xml');
      if (!f) throw new Error('Not a Word .docx file.');
      return f.async('string').then(function (xml) {
        var doc = new DOMParser().parseFromString(xml, 'application/xml');
        var bl = blocks(all(doc, 'body')[0]);
        var missing = [];
        Object.keys(S.KINDS).forEach(function (k) {
          var K = S.KINDS[k];
          K.headings.forEach(function (h, i) {
            var b = groupOf(bl, [h])[0];
            if (!b) { missing.push(h); return; }
            var ps = paras(b), cur = 0;
            K.fields.filter(function (f) { return f.part === i + 1 && !f.ui; }).forEach(function (f) {
              var j = findPara(ps, cur, f.label);
              if (j < 0) missing.push(K.prefix + ': ' + f.label); else cur = j + 1;
            });
          });
        });
        return { ok: !missing.length, missing: missing };
      });
    });
  }

  window.DOCX = { fill: fill, check: check };
})();
