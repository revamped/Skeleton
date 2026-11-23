/*
 * On-device storage. Surveys, photos, the blank template and floor plans live in
 * IndexedDB in this browser only; nothing is uploaded anywhere.
 */
(function () {
  var DB = 'suncor-survey', VER = 1, dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var rq = indexedDB.open(DB, VER);
      rq.onupgradeneeded = function () {
        var db = rq.result;
        db.createObjectStore('surveys', { keyPath: 'id' });
        var ph = db.createObjectStore('photos', { keyPath: 'id' });
        ph.createIndex('sid', 'sid');
        db.createObjectStore('files');
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, mode), st = t.objectStore(store), out;
        var r = fn(st);
        if (r) r.onsuccess = function () { out = r.result; };
        t.oncomplete = function () { res(out); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error || new Error('Storage aborted (device storage may be full).')); };
      });
    });
  }

  var store = {
    surveys: function () { return tx('surveys', 'readonly', function (s) { return s.getAll(); }); },
    survey: function (id) { return tx('surveys', 'readonly', function (s) { return s.get(id); }); },
    saveSurvey: function (sv) { sv.updated = Date.now(); return tx('surveys', 'readwrite', function (s) { return s.put(sv); }); },
    deleteSurvey: function (id) {
      return store.photos(id).then(function (ps) {
        return tx('photos', 'readwrite', function (s) { ps.forEach(function (p) { s.delete(p.id); }); });
      }).then(function () {
        return tx('files', 'readwrite', function (s) { s.delete('plan:' + id); });
      }).then(function () { return tx('surveys', 'readwrite', function (s) { return s.delete(id); }); });
    },
    photos: function (sid) { return tx('photos', 'readonly', function (s) { return s.index('sid').getAll(sid); }); },
    savePhoto: function (p) { return tx('photos', 'readwrite', function (s) { return s.put(p); }); },
    deletePhoto: function (id) { return tx('photos', 'readwrite', function (s) { return s.delete(id); }); },
    getFile: function (k) { return tx('files', 'readonly', function (s) { return s.get(k); }); },
    putFile: function (k, v) { return tx('files', 'readwrite', function (s) { return s.put(v, k); }); },
    delFile: function (k) { return tx('files', 'readwrite', function (s) { return s.delete(k); }); },
    persist: function () {
      try { if (navigator.storage && navigator.storage.persist) return navigator.storage.persist(); } catch (e) { /* ignore */ }
      return Promise.resolve(false);
    },
    estimate: function () {
      try { if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate(); } catch (e) { /* ignore */ }
      return Promise.resolve(null);
    }
  };

  // Small per-device preferences
  store.pref = function (k, v) {
    try {
      if (arguments.length > 1) { localStorage.setItem('suncor.' + k, JSON.stringify(v)); return v; }
      var r = localStorage.getItem('suncor.' + k);
      return r == null ? null : JSON.parse(r);
    } catch (e) { return null; }
  };

  window.STORE = store;
})();
