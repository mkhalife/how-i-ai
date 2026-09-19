#!/usr/bin/env bash
# End-to-end test on synthetic data, macOS and Windows layouts. Usage: bash tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
T="${TMPDIR:-/tmp}/how-i-ai-test-$$"; mkdir -p "$T"
for plat in darwin win32; do
  H="$T/$plat"; node tests/make-fake-home.mjs "$H" "$plat" >/dev/null
  unset HOW_I_AI_DIR HOW_I_AI_APP CLAUDE_CODE_ENTRYPOINT; export HOW_I_AI_HOME_OVERRIDE="$H" HOW_I_AI_PLATFORM_OVERRIDE="$plat" LOCALAPPDATA="$H/AppData/Local" APPDATA="$H/AppData/Roaming" CLAUDE_CONFIG_DIR="$H/.claude" CODEX_HOME="$H/.codex"
  echo "== $plat: collect"; node scripts/collect.mjs --no-codex-cloud --days 30 | sed 's/^/   /'
  # The bundled codex binary is found without PATH; on the win32 pass only the lookup can be checked (no .exe to run).
  node --input-type=module -e "
    import { codexBinaries, codexCloud } from './scripts/lib/sources.mjs';
    const bins = codexBinaries().filter((b) => b.includes('how-i-ai-test-')); if (bins.length !== 1) { console.error('FAIL bundled codex lookup', codexBinaries()); process.exit(1); }
    if ('$plat' === 'darwin') { process.env.HOW_I_AI_CODEX_BIN = bins[0]; const r = codexCloud(); if (!r.found || r.sessions.length !== 1 || r.sessions[0].surface !== 'cloud' || r.sessions[0].id !== 's_codex-cloud_task_cloud1' || r.sessions[0].duration_minutes !== null || r.sessions[0].messages_user !== null || r.sessions[0].messages_assistant !== null) { console.error('FAIL codex cloud via bundled binary', r); process.exit(1); } }
    console.log('   bundled codex binary ok');" 
  node -e "
    const d=require('$H/how-i-ai/sessions.json'); const by={}; for(const s of d.sessions) by[s.source]=(by[s.source]||0)+1;
    const want={'claude-code':9,'claude-desktop':1,'claude-cowork':2,'claude-export':2,'claude-chat':1,'codex':0,'chatgpt-export':0,'chatgpt-app':0};
    for(const [k,v] of Object.entries(want)) if((by[k]||0)!==v){console.error('FAIL',k,'expected',v,'got',by[k]);process.exit(1)}
    const r=d.sessions.find(s=>s.id.endsWith('aaaa-4')); if(r.mode!=='routine'||r.trigger!=='routine'||r.surface!=='cloud') {console.error('FAIL routine detection',r);process.exit(1)}
    const c=d.sessions.find(s=>s.id.includes('cloud1')); if(!c||c.surface!=='cloud') {console.error('FAIL cloud');process.exit(1)}
    if(c.duration_minutes!==null||c.messages_user!==null||c.messages_assistant!==null) {console.error('FAIL a title-only cloud session has no duration and no message counts',c);process.exit(1)}
    if(!c.context.includes('all checks green')||!c.context.includes('Opened a pull request')||!c.context.includes('only the title and a status summary')||c.model!=='claude-opus-4-1') {console.error('FAIL cloud context comes from post_turn_summary',c);process.exit(1)}
    const cc=d.sessions.filter(s=>s.source==='claude-chat')[0]; if(!cc||cc.id!=='s_claude-export_0b5f7c1e-3d2a-4e61-9a77-5c1d2e3f4a5b'||cc.surface!=='chat'||cc.messages_user!==null||cc.messages_assistant!==null||cc.duration_minutes!==null||cc.model!==null||cc.title!=='Pricing page critique'||!cc.first_message.startsWith('The person asked for a critique')||!cc.context.includes('Summary written by Claude')||cc.started_at!==cc.ended_at) {console.error('FAIL claude-chat parse',cc);process.exit(1)}
    const k1=d.sessions.find(s=>s.id==='s_claude-export_k1'); if(!k1||k1.source!=='claude-export'||k1.messages_user!==1) {console.error('FAIL export should win over the chat listing for the same chat',k1);process.exit(1)}
    if(!d.sources.some(r=>r.source==='claude-chat'&&r.found)) {console.error('FAIL claude-chat row missing from the source table');process.exit(1)}
    if(d.sessions.filter(s=>s.source==='claude-export').some(s=>s.duration_minutes!==null)) {console.error('FAIL export duration must be null');process.exit(1)}
    if(d.sessions.some(s=>s.id.includes('bridge1'))) {console.error('FAIL bridge should be skipped');process.exit(1)}
    const a1=d.sessions.find(s=>s.id.endsWith('aaaa-1')); if(!a1.connectors.includes('github')||a1.messages_user!==1||!a1.tools.includes('Edit')) {console.error('FAIL cc parse',a1);process.exit(1)}
    if(!a1.skills.includes('code-review')||!a1.skills.includes('simplify')||!a1.agents.includes('evidence-researcher')) {console.error('FAIL skills/agents',a1.skills,a1.agents);process.exit(1)}
    const a7=d.sessions.find(s=>s.id.endsWith('aaaa-7')); if(!a7||a7.trigger!=='scheduled'||a7.mode!=='routine'||a7.surface!=='desktop'||/scheduled-task|SKILL\.md/.test(a7.first_message)||!a7.agents.includes('general-purpose')) {console.error('FAIL desktop scheduled task',a7);process.exit(1)}
    const a3=d.sessions.find(s=>s.id.endsWith('aaaa-3')); if(a3.trigger!=='human') {console.error('FAIL code-tab state file without scheduledTaskId',a3);process.exit(1)}
    const a9=d.sessions.find(s=>s.id.endsWith('aaaa-9')); if(!d.sessions.some(s=>s.id.endsWith('aaaa-8'))||!a9||!a9.first_message.startsWith('Go with the second')||a9.messages_user!==1||a9.tools.includes('Read')) {console.error('FAIL forked session must be its own session, from its own records',a9);process.exit(1)}
    const a12=d.sessions.find(s=>s.id.endsWith('aaaa-12')); if(d.sessions.some(s=>s.id.endsWith('aaaa-11'))||!a12||a12.messages_user!==2||'firstUuid' in JSON.parse(JSON.stringify(a12))) {console.error('FAIL resume copy should replace the original',a12);process.exit(1)}
    if(d.sessions.some(s=>s.id.endsWith('aaaa-10'))) {console.error('FAIL headless ping counted as a session');process.exit(1)}
    const d2=d.sessions.find(s=>s.id==='s_claude-desktop_d2'); if(!d2||d2.source!=='claude-cowork'||d2.surface!=='cowork'||d2.title!=='Interview synthesis'||d2.messages_user!==1||!d2.tools.includes('Write')||!d2.skills.includes('research-synthesis')||!d2.connectors.includes('Google Drive')||d2.duration_minutes>10) {console.error('FAIL cowork parse',d2);process.exit(1)}
    if(d.sessions.some(s=>s.id.includes('cli-d2'))) {console.error('FAIL cowork transcript counted twice');process.exit(1)}
    const d3=d.sessions.find(s=>s.id==='s_claude-desktop_d3'); if(!d3||d3.source!=='claude-cowork'||d3.messages_user!==1||!d3.first_message.startsWith('Help me plan')||!d3.tools.includes('WebSearch')||d3.tools.includes('SubagentOnlyTool')||d3.model!=='claude-sonnet-4-6'||!(d3.duration_minutes>0&&d3.duration_minutes<10)) {console.error('FAIL cowork audit-only parse',d3);process.exit(1)}
    if(JSON.stringify(d).includes('never read this')||JSON.stringify(d).includes('test.person@example.com')) {console.error('FAIL read private state-file fields');process.exit(1)}
    const tb=Object.fromEntries(d.sources.map(r=>[r.source,r.sessions_in_window])); if(tb['claude-cowork']!==2||tb['claude-desktop']!==1) {console.error('FAIL source table split',tb);process.exit(1)}
    if(tb['claude-chat']!==1||d.sources.reduce((a,r)=>a+r.sessions_in_window,0)!==d.sessions.length) {console.error('FAIL source rows must count sessions kept after dedupe',tb);process.exit(1)}
    if(d.sessions.some(s=>s.id.endsWith('aaaa-5'))) {console.error('FAIL window filter');process.exit(1)}
    console.log('   claude sources ok:',JSON.stringify(by));"
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
  node -e "const p=require('$H/how-i-ai/share-rows.json'); const r=p.sessions.filter(r=>r.source==='claude-chat'); if(r.length!==1||r[0].messages_user!==''||r[0].messages_assistant!==''||r[0].duration_minutes!==''||r[0].surface!=='chat'){console.error('FAIL claude-chat row should be shared with blank counts and duration',r);process.exit(1)}; console.log('   claude-chat row shared with blank counts')"
  echo "== $plat: chatgpt entry point"; node scripts/how-i-ai.mjs --app chatgpt collect --no-codex-cloud --days 30 | sed 's/^/   /'
  node -e "
    const d=require('$H/how-i-ai-chatgpt/sessions.json'); const by={}; for(const s of d.sessions) by[s.source]=(by[s.source]||0)+1;
    const want={'codex':5,'chatgpt-export':3,'chatgpt-app':2,'claude-code':0,'claude-cowork':0,'claude-export':0};
    for(const [k,v] of Object.entries(want)) if((by[k]||0)!==v){console.error('FAIL',k,'expected',v,'got',by[k]);process.exit(1)}
    if(d.sessions.some(s=>s.source==='claude-chat')||d.sources.some(r=>r.source==='claude-chat')) {console.error('FAIL the ChatGPT entry point must not read claude-chat-threads.json');process.exit(1)}
    const g3=d.sessions.find(s=>s.id==='s_chatgpt_g3'); if(!g3.tools.includes('python')||g3.model!=='gpt-5') {console.error('FAIL chatgpt parse',g3);process.exit(1)}
    if(d.sessions.some(s=>s.id==='s_chatgpt_g4')) {console.error('FAIL window filter');process.exit(1)}
    if(d.sessions.some(s=>s.id==='s_codex_c3-review')) {console.error('FAIL codex sub-agent rollout counted as a session');process.exit(1)}
    const c3=d.sessions.find(s=>s.id==='s_codex_c3'); if(!c3||!c3.first_message.startsWith('Find the meeting notes')||c3.messages_user!==1||c3.surface!=='desktop'||!c3.connectors.includes('notion')||c3.title!=='Open action items'||c3.model!=='gpt-6') {console.error('FAIL codex desktop parse',c3);process.exit(1)}
    const want3=['meeting-notes','notes-kit:action-items','plugin:notes-kit']; if(want3.some(k=>!c3.skills.includes(k))||c3.skills.length!==3||!c3.tools.includes('shell')||!c3.tools.includes('web_search')||c3.tools.includes('exec')||/secret-project|\/Users\/me|SKILL/.test(JSON.stringify([c3.skills,c3.tools,c3.context]))) {console.error('FAIL codex skills, plugins and tool names',c3.skills,c3.tools,c3.context);process.exit(1)}
    const c2=d.sessions.find(s=>s.id==='s_codex_c2'); if(!c2.skills.includes('pr-labels')||c2.skills.length!==1||c2.trigger!=='human') {console.error('FAIL codex cli skill read',c2);process.exit(1)}
    if(c3.duration_minutes!==1||c2.duration_minutes!==5) {console.error('FAIL codex duration is active time from record timestamps',c3.duration_minutes,c2.duration_minutes);process.exit(1)}
    const c4=d.sessions.find(s=>s.id==='s_codex_c4'); if(c4.trigger!=='scheduled'||c4.mode!=='routine') {console.error('FAIL codex scheduled task by thread_source',c4);process.exit(1)}
    const hasSqlite=typeof process.getBuiltinModule==='function'&&!!process.getBuiltinModule('node:sqlite'); const c5=d.sessions.find(s=>s.id==='s_codex_c5');
    if(hasSqlite?(c5.trigger!=='scheduled'||c5.mode!=='routine'):c5.trigger!=='human') {console.error('FAIL codex scheduled task by automation_runs.thread_id',c5);process.exit(1)}
    if(JSON.stringify(d).includes('SECRET')) {console.error('FAIL read automation name, prompt or title');process.exit(1)}
    for(const id of ['s_chatgpt_g1','s_chatgpt_app1']) if(d.sessions.find(s=>s.id===id).duration_minutes!==null) {console.error('FAIL duration must be null without per-message timestamps',id);process.exit(1)}
    const app1=d.sessions.find(s=>s.id==='s_chatgpt_app1'); if(!app1||app1.source!=='chatgpt-app'||app1.messages_user!==2||!app1.context.includes('Make day two lighter')) {console.error('FAIL chatgpt-app parse',app1);process.exit(1)}
    const app2=d.sessions.find(s=>s.id==='s_chatgpt_app2'); if(!app2||app2.messages_user!==null||app2.messages_assistant!==null||app2.first_message!=='Long thread, opening not reached') {console.error('FAIL unknown counts must stay null and the title stands in for the opening',app2);process.exit(1)}
    if(d.sessions.find(s=>s.id==='s_chatgpt_g1').source!=='chatgpt-export') {console.error('FAIL export should win over the app listing for the same conversation');process.exit(1)}
    const tb=Object.fromEntries(d.sources.map(r=>[r.source,r.sessions_in_window])); if(tb['chatgpt-app']!==2||d.sources.reduce((a,r)=>a+r.sessions_in_window,0)!==d.sessions.length) {console.error('FAIL source rows must count sessions kept after dedupe',tb);process.exit(1)}
    const sig=d.signals.find(x=>x.source==='chatgpt-desktop'); if(!sig||!sig.installed){console.error('FAIL chatgpt desktop signal',d.signals);process.exit(1)}
    console.log('   chatgpt sources ok:',JSON.stringify(by));"
  node scripts/how-i-ai.mjs --app chatgpt config --title "Senior Product Designer" --function Design >/dev/null
  node scripts/how-i-ai.mjs --app chatgpt classify prep --size 10 >/dev/null; node tests/fake-classify.mjs "$H/how-i-ai-chatgpt/classify" >/dev/null; node scripts/how-i-ai.mjs --app chatgpt classify merge | sed 's/^/   /'
  node scripts/how-i-ai.mjs --app chatgpt stats >/dev/null; node scripts/how-i-ai.mjs --app chatgpt render | sed 's/^/   /'; [ -s "$H/how-i-ai-chatgpt/how-i-ai.html" ] || { echo 'FAIL default render'; exit 1; }
  node scripts/how-i-ai.mjs --app chatgpt share preview >/dev/null
  node -e "const b=require('$H/how-i-ai-chatgpt/share-rows.json'); if(!b.sessions.some(r=>r.messages_user===''&&r.source==='chatgpt-app')){console.error('FAIL unknown counts should be shared blank');process.exit(1)}"
  node -e "const a=require('$H/how-i-ai/share-rows.json'),b=require('$H/how-i-ai-chatgpt/share-rows.json'); if(a.participant.participant_id===b.participant.participant_id||b.sessions.some(r=>/^claude/.test(r.source))||a.sessions.some(r=>/^(codex|chatgpt)/.test(r.source))){console.error('FAIL the two entry points must not share an id or sessions');process.exit(1)}; console.log('   two entry points: separate ids, no shared sessions (',a.sessions.length,'+',b.sessions.length,'rows )')"
  node scripts/aggregate.mjs --json "$H/how-i-ai/share-rows.json" --team "Test team" --out "$H/how-i-ai/aggregate.json" | sed 's/^/   /'
  for t in aggregate-boardroom aggregate-exhibit; do [ -f templates/$t.html ] && node scripts/render.mjs --template templates/$t.html --data "$H/how-i-ai/aggregate.json" --out "$H/how-i-ai/$t.html" | sed 's/^/   /' || true; done
  # gather: a valid chat listing arrives in Downloads under a browser's " (1)" name; an invalid listing, an unrelated
  # file and a valid but older cloud list must stay where they are.
  echo "== $plat: gather"; D="$H/Downloads"; mkdir -p "$D"
  echo '{"source":"claude-cloud","data":[]}' > "$D/cloud-sessions.json"; touch -t 202001010000 "$D/cloud-sessions.json"
  YESTERDAY=$(node -e "console.log(new Date(Date.now()-86400e3).toISOString())")
  ( sleep 1
    echo '{"source":"claude-chat","chats":"not a list"}' > "$D/claude-chat-threads (2).json"
    echo '{"unrelated":true}' > "$D/notes.json"
    echo '{"source":"claude-chat","exported_at":"'"$YESTERDAY"'","chats":[{"url":"https://claude.ai/chat/gather-1","updated_at":"'"$YESTERDAY"'","title":"Gathered chat","summary":"A chat listed for the gather test."}]}' > "$D/claude-chat-threads (1).json" ) &
  node scripts/how-i-ai.mjs gather --no-open --timeout 5 > "$T/gather-$plat.txt"; wait; sed 's/^/   /' "$T/gather-$plat.txt"
  grep -q 'Arrived: claude-chat-threads.json. Not arrived: cloud-sessions.json.' "$T/gather-$plat.txt" || { echo 'FAIL gather summary'; exit 1; }
  grep -q 'gather --chatgpt' "$T/gather-$plat.txt" || { echo 'FAIL gather should point at the ChatGPT run when the app is installed'; exit 1; }
  if grep -q 'notes.json' "$T/gather-$plat.txt"; then echo 'FAIL gather reported an unrelated file'; exit 1; fi
  [ ! -e "$D/claude-chat-threads (1).json" ] && grep -q 'gather-1' "$H/how-i-ai/inbox/claude-chat-threads.json" || { echo 'FAIL valid listing not moved to the inbox under its canonical name'; exit 1; }
  grep -q 'not a list' "$D/claude-chat-threads (2).json" && grep -q unrelated "$D/notes.json" && [ -e "$D/cloud-sessions.json" ] || { echo 'FAIL gather touched a file it should have left'; exit 1; }
  grep -q session_cloud1 "$H/how-i-ai/inbox/cloud-sessions.json" || { echo 'FAIL an older cloud list replaced the inbox copy'; exit 1; }
  if node scripts/how-i-ai.mjs --app chatgpt gather --no-open --timeout 0 >/dev/null 2>&1; then echo 'FAIL gather must refuse the ChatGPT entry point'; exit 1; fi
  node scripts/collect.mjs --no-codex-cloud --days 30 | grep '^claude-chat' | sed 's/^/   /'
  node -e "
    const d=require('$H/how-i-ai/sessions.json'); const g=d.sessions.find(s=>s.id==='s_claude-export_gather-1');
    if(!g||g.source!=='claude-chat'||!d.sources.some(r=>r.source==='claude-chat'&&r.found&&r.sessions_in_window===1)) {console.error('FAIL collect should read the gathered listing',g);process.exit(1)}
    if(d.sessions.some(s=>s.id==='s_claude-export_0b5f7c1e-3d2a-4e61-9a77-5c1d2e3f4a5b')) {console.error('FAIL the older listing should have been replaced');process.exit(1)}
    console.log('   gathered listing collected')"
done
node tests/check-prompts.mjs
# collect started inside Cowork stops with a pointer to Claude Code instead of reading the VM's own folders.
if CLAUDE_CODE_ENTRYPOINT=remote_cowork HOW_I_AI_HOME_OVERRIDE="$T/cowork" node scripts/collect.mjs --dry-run > "$T/collect-cowork.txt" 2>&1; then echo 'FAIL collect ran inside Cowork'; exit 1; fi
grep -q 'Run it from Claude Code' "$T/collect-cowork.txt" && [ ! -e "$T/cowork/how-i-ai/sessions.json" ] || { echo 'FAIL collect inside Cowork should point at Claude Code and write nothing'; exit 1; }
echo "== cowork: collect points at Claude Code"
# gather in a shell with no display and no Downloads (a Cowork VM): print the links and return at once.
C="$T/cowork"; mkdir -p "$C"
env -u DISPLAY -u WAYLAND_DISPLAY HOW_I_AI_HOME_OVERRIDE="$C" HOW_I_AI_PLATFORM_OVERRIDE=linux CLAUDE_CONFIG_DIR="$C/.claude" node scripts/how-i-ai.mjs gather --timeout 30 > "$T/gather-cowork.txt" &
GP=$!; sleep 5; if kill -0 $GP 2>/dev/null; then kill $GP; echo 'FAIL gather waited in a shell that cannot see Downloads'; exit 1; fi
[ "$(grep -c '^claude://claude.ai/new?q=\|^https://claude.ai/code?q=' "$T/gather-cowork.txt")" = 2 ] && grep -q 'cannot see your Downloads' "$T/gather-cowork.txt" || { echo 'FAIL gather should print both links and say why it is not waiting'; cat "$T/gather-cowork.txt"; exit 1; }
echo "== linux, no display: gather printed both links and did not wait"
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
