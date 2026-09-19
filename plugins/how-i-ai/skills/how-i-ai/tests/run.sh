#!/usr/bin/env bash
# End-to-end test on synthetic data, macOS and Windows layouts. Usage: bash tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
T="${TMPDIR:-/tmp}/how-i-ai-test-$$"; mkdir -p "$T"
for plat in darwin win32; do
  H="$T/$plat"; node tests/make-fake-home.mjs "$H" "$plat" >/dev/null
  export HOW_I_AI_HOME_OVERRIDE="$H" HOW_I_AI_PLATFORM_OVERRIDE="$plat" HOW_I_AI_DIR="$H/how-i-ai" LOCALAPPDATA="$H/AppData/Local" APPDATA="$H/AppData/Roaming" CLAUDE_CONFIG_DIR="$H/.claude" CODEX_HOME="$H/.codex"
  echo "== $plat: collect"; node scripts/collect.mjs --no-codex-cloud --days 30 | sed 's/^/   /'
  node -e "
    const d=require('$H/how-i-ai/sessions.json'); const by={}; for(const s of d.sessions) by[s.source]=(by[s.source]||0)+1;
    const want={'claude-code':9,'claude-desktop':1,'claude-cowork':2,'codex':3,'chatgpt-export':3,'claude-export':2};
    for(const [k,v] of Object.entries(want)) if((by[k]||0)!==v){console.error('FAIL',k,'expected',v,'got',by[k]);process.exit(1)}
    const r=d.sessions.find(s=>s.id.endsWith('aaaa-4')); if(r.mode!=='routine'||r.trigger!=='routine'||r.surface!=='cloud') {console.error('FAIL routine detection',r);process.exit(1)}
    const c=d.sessions.find(s=>s.id.includes('cloud1')); if(!c||c.surface!=='cloud') {console.error('FAIL cloud');process.exit(1)}
    if(d.sessions.some(s=>s.id.includes('bridge1'))) {console.error('FAIL bridge should be skipped');process.exit(1)}
    const a1=d.sessions.find(s=>s.id.endsWith('aaaa-1')); if(!a1.connectors.includes('github')||a1.messages_user!==1||!a1.tools.includes('Edit')) {console.error('FAIL cc parse',a1);process.exit(1)}
    if(!a1.skills.includes('code-review')||!a1.skills.includes('simplify')||!a1.agents.includes('evidence-researcher')) {console.error('FAIL skills/agents',a1.skills,a1.agents);process.exit(1)}
    const a7=d.sessions.find(s=>s.id.endsWith('aaaa-7')); if(!a7||a7.trigger!=='scheduled'||a7.mode!=='routine'||a7.surface!=='desktop'||/scheduled-task|SKILL\.md/.test(a7.first_message)||!a7.agents.includes('general-purpose')) {console.error('FAIL desktop scheduled task',a7);process.exit(1)}
    const a3=d.sessions.find(s=>s.id.endsWith('aaaa-3')); if(a3.trigger!=='human') {console.error('FAIL code-tab state file without scheduledTaskId',a3);process.exit(1)}
    const a9=d.sessions.find(s=>s.id.endsWith('aaaa-9')); if(!d.sessions.some(s=>s.id.endsWith('aaaa-8'))||!a9||!a9.first_message.startsWith('Go with the second')||a9.messages_user!==1||a9.tools.includes('Read')) {console.error('FAIL forked session must be its own session, from its own records',a9);process.exit(1)}
    const a12=d.sessions.find(s=>s.id.endsWith('aaaa-12')); if(d.sessions.some(s=>s.id.endsWith('aaaa-11'))||!a12||a12.messages_user!==2||'firstUuid' in JSON.parse(JSON.stringify(a12))) {console.error('FAIL resume copy should replace the original',a12);process.exit(1)}
    if(d.sessions.some(s=>s.id.endsWith('aaaa-10'))) {console.error('FAIL headless ping counted as a session');process.exit(1)}
    const g3=d.sessions.find(s=>s.id==='s_chatgpt_g3'); if(!g3.tools.includes('python')||g3.model!=='gpt-5') {console.error('FAIL chatgpt parse',g3);process.exit(1)}
    const d2=d.sessions.find(s=>s.id==='s_claude-desktop_d2'); if(!d2||d2.source!=='claude-cowork'||d2.surface!=='cowork'||d2.title!=='Interview synthesis'||d2.messages_user!==1||!d2.tools.includes('Write')||!d2.skills.includes('research-synthesis')||!d2.connectors.includes('Google Drive')||d2.duration_minutes>10) {console.error('FAIL cowork parse',d2);process.exit(1)}
    if(d.sessions.some(s=>s.id.includes('cli-d2'))) {console.error('FAIL cowork transcript counted twice');process.exit(1)}
    const d3=d.sessions.find(s=>s.id==='s_claude-desktop_d3'); if(!d3||d3.source!=='claude-cowork'||d3.messages_user!==1||!d3.first_message.startsWith('Help me plan')||!d3.tools.includes('WebSearch')||d3.tools.includes('SubagentOnlyTool')||d3.model!=='claude-sonnet-4-6') {console.error('FAIL cowork audit-only parse',d3);process.exit(1)}
    if(JSON.stringify(d).includes('never read this')||JSON.stringify(d).includes('test.person@example.com')) {console.error('FAIL read private state-file fields');process.exit(1)}
    const c3=d.sessions.find(s=>s.id==='s_codex_c3'); if(!c3||!c3.first_message.startsWith('Find the meeting notes')||c3.messages_user!==1||c3.surface!=='desktop'||!c3.connectors.includes('notion')||c3.title!=='Open action items'||c3.model!=='gpt-6') {console.error('FAIL codex desktop parse',c3);process.exit(1)}
    const tb=Object.fromEntries(d.sources.map(r=>[r.source,r.sessions_in_window])); if(tb['claude-cowork']!==2||tb['claude-desktop']!==1) {console.error('FAIL source table split',tb);process.exit(1)}
    if(d.sessions.some(s=>s.id.endsWith('aaaa-5')||s.id==='s_chatgpt_g4')) {console.error('FAIL window filter');process.exit(1)}
    const sig=d.signals.find(x=>x.source==='chatgpt-desktop'); if(!sig||!sig.installed){console.error('FAIL chatgpt desktop signal',d.signals);process.exit(1)}
    console.log('   sources ok:',JSON.stringify(by),'signals:',JSON.stringify(d.signals));"
  node scripts/config.mjs --title "Senior Product Designer" --function Design >/dev/null
  node scripts/classify.mjs prep --size 6 | sed 's/^/   /'
  node tests/fake-classify.mjs "$H/how-i-ai/classify" >/dev/null
  node scripts/classify.mjs merge | sed 's/^/   /'
  node scripts/collect.mjs --no-codex-cloud --days 30 >/dev/null
  node -e "const d=require('$H/how-i-ai/sessions.json'); const n=d.sessions.filter(s=>s.classification).length; if(n!==d.sessions.length){console.error('FAIL re-running collect dropped classifications',n,'/',d.sessions.length);process.exit(1)}; console.log('   re-collect kept',n,'classifications')"
  echo '{"headline":"Test headline","summary":"Test summary.","patterns":["p1","p2"],"one_liner":"one liner","signature_move":"move","surprise_why":"because"}' > "$H/how-i-ai/narrative.json"
  node scripts/stats.mjs | sed 's/^/   /'
  for t in profile-wrapped profile-editorial profile-terminal; do [ -f templates/$t.html ] && node scripts/render.mjs --template templates/$t.html --data "$H/how-i-ai/profile.json" --out "$H/how-i-ai/$t.html" | sed 's/^/   /' || true; done
  node scripts/share.mjs preview | head -4 | sed 's/^/   /'
  node -e "const p=require('$H/how-i-ai/share-rows.json'); const cols=Object.keys(p.sessions[0]); for(const bad of ['first_message','title','project_hash','context']) if(cols.includes(bad)){console.error('FAIL leak',bad);process.exit(1)}; if(JSON.stringify(p).includes('/Users/me')){console.error('FAIL path leak');process.exit(1)}; if(!cols.includes('skills')||!cols.includes('agents')){console.error('FAIL skills columns');process.exit(1)}; console.log('   share rows clean:',p.sessions.length,'rows,',cols.length,'columns')"
  node scripts/aggregate.mjs --json "$H/how-i-ai/share-rows.json" --team "Test team" --out "$H/how-i-ai/aggregate.json" | sed 's/^/   /'
  for t in aggregate-boardroom aggregate-exhibit; do [ -f templates/$t.html ] && node scripts/render.mjs --template templates/$t.html --data "$H/how-i-ai/aggregate.json" --out "$H/how-i-ai/$t.html" | sed 's/^/   /' || true; done
done
# Merged ChatGPT/Codex macOS app (bundle com.openai.codex): Chromium profile only, no conversation cache.
M="$T/darwin-merged"; mkdir -p "$M/Library/Application Support/Codex/Default"; echo '{}' > "$M/Library/Application Support/Codex/Local State"
# Its thread catalog (sqlite) lists ChatGPT conversations by title; only the count and last update may be read.
HAS_SQLITE=$(node -e "console.log(typeof process.getBuiltinModule==='function'&&process.getBuiltinModule('node:sqlite')?1:0)" 2>/dev/null)
if [ "$HAS_SQLITE" = "1" ]; then mkdir -p "$M/.codex/sqlite"; node -e "
  const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('$M/.codex/sqlite/codex-dev.db');
  db.exec('CREATE TABLE local_thread_catalog (host_id TEXT, thread_id TEXT, display_title TEXT, source_created_at REAL, source_updated_at REAL, cwd TEXT, source_kind TEXT)');
  const ins = db.prepare('INSERT INTO local_thread_catalog VALUES (?,?,?,?,?,?,?)'); const now = Date.now() / 1000;
  ins.run('h1', 't1', 'SECRET TITLE ONE', now - 9000, now - 8000, null, 'chatgpt'); ins.run('h1', 't2', 'SECRET TITLE TWO', now - 500, now - 400, null, 'chatgpt'); ins.run('h2', 't3', 'local codex thread', now - 300, now - 200, '/x', 'vscode'); db.close();" 2>/dev/null; fi
HOW_I_AI_HOME_OVERRIDE="$M" HOW_I_AI_PLATFORM_OVERRIDE=darwin CODEX_HOME="$M/.codex" HAS_SQLITE="$HAS_SQLITE" node --input-type=module -e "
  import { chatgptDesktop } from './scripts/lib/sources.mjs'; const r=chatgptDesktop();
  const wantCount = process.env.HAS_SQLITE === '1' ? 2 : null;
  if(!r.found||!r.signal.installed||r.signal.layout!=='chromium-profile'||r.signal.cached_conversations!==wantCount||!r.signal.last_activity||JSON.stringify(r).includes('SECRET')){console.error('FAIL merged chatgpt app signal',r);process.exit(1)}
  console.log('== darwin-merged: chatgpt signal ok', JSON.stringify(r.signal));"
echo "ALL OK ($T)"
