/**
 * how-i-ai team sheet endpoint.
 *
 * POST  {participant:{...}, sessions:[{...}], key?}  → upserts that participant (deletes their old rows, appends new)
 * GET   ?action=dump[&key=…]                          → {participants:[...], sessions:[...]} as JSON
 * GET   ?action=ping                                  → {ok:true, participants:n, sessions:n}
 *
 * Deploy: Extensions → Apps Script → paste this file → Deploy → New deployment → Web app,
 * Execute as: Me, Who has access: Anyone. Copy the /exec URL into team.json share_url.
 * Optional: Project settings → Script properties → SHARE_KEY=<random string>, and put the
 * same value in team.json share_key. Requests without the key are then refused.
 */

var PARTICIPANT_COLUMNS = ['participant_id', 'function', 'title', 'window_days', 'window_start', 'window_end', 'sessions_total', 'sources', 'submitted_at', 'schema_version'];
var SESSION_COLUMNS = ['participant_id', 'function', 'source', 'surface', 'date', 'week_start', 'weekday', 'hour', 'mode', 'trigger', 'category', 'subcategory', 'assist_type', 'paraphrase', 'surprise', 'messages_user', 'messages_assistant', 'duration_minutes', 'tools', 'connectors', 'skills', 'agents', 'model', 'submitted_at', 'schema_version'];

function sheet_(name, columns) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); }
  if (sh.getLastRow() === 0) { sh.appendRow(columns); sh.setFrozenRows(1); }
  return sh;
}

function keyOk_(key) {
  var want = PropertiesService.getScriptProperties().getProperty('SHARE_KEY');
  return !want || want === key;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (!keyOk_(body.key)) return json_({ ok: false, error: 'bad key' });
    var p = body.participant || {};
    var sessions = body.sessions || [];
    if (!p.participant_id || !/^p_[0-9a-f]{6,}$/.test(p.participant_id)) return json_({ ok: false, error: 'participant_id missing' });
    if (sessions.length > 5000) return json_({ ok: false, error: 'too many rows' });
    var ps = sheet_('participants', PARTICIPANT_COLUMNS);
    var ss = sheet_('sessions', SESSION_COLUMNS);
    var removed = deleteRowsFor_(ps, p.participant_id) + deleteRowsFor_(ss, p.participant_id);
    ps.appendRow(PARTICIPANT_COLUMNS.map(function (c) { return clean_(p[c]); }));
    if (sessions.length) {
      var rows = sessions.map(function (s) { return SESSION_COLUMNS.map(function (c) { return clean_(s[c]); }); });
      ss.getRange(ss.getLastRow() + 1, 1, rows.length, SESSION_COLUMNS.length).setValues(rows);
    }
    return json_({ ok: true, inserted: sessions.length + 1, replaced: removed });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var action = (e.parameter.action || 'ping');
  var ps = sheet_('participants', PARTICIPANT_COLUMNS);
  var ss = sheet_('sessions', SESSION_COLUMNS);
  if (action === 'ping') return json_({ ok: true, participants: Math.max(0, ps.getLastRow() - 1), sessions: Math.max(0, ss.getLastRow() - 1) });
  if (action === 'dump') {
    if (!keyOk_(e.parameter.key)) return json_({ ok: false, error: 'bad key' });
    return json_({ participants: rowsOf_(ps, PARTICIPANT_COLUMNS), sessions: rowsOf_(ss, SESSION_COLUMNS) });
  }
  return json_({ ok: false, error: 'unknown action' });
}

function rowsOf_(sh, columns) {
  var n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  var values = sh.getRange(2, 1, n, columns.length).getValues();
  return values.map(function (r) { var o = {}; columns.forEach(function (c, i) { o[c] = r[i]; }); return o; });
}

function deleteRowsFor_(sh, participantId) {
  var n = sh.getLastRow() - 1;
  if (n <= 0) return 0;
  var ids = sh.getRange(2, 1, n, 1).getValues();
  var removed = 0;
  for (var i = ids.length - 1; i >= 0; i--) {
    if (ids[i][0] === participantId) { sh.deleteRow(i + 2); removed++; }
  }
  return removed;
}

// Keep cells inert: strings only, no formulas, bounded length.
function clean_(v) {
  if (v === undefined || v === null) return '';
  var s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s.length > 500 ? s.slice(0, 500) : s;
}
