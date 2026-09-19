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
    const want={'claude-code':5,'claude-desktop':2,'claude-cowork':1,'codex':2,'chatgpt-export':3,'claude-export':2};
    for(const [k,v] of Object.entries(want)) if((by[k]||0)!==v){console.error('FAIL',k,'expected',v,'got',by[k]);process.exit(1)}
    const r=d.sessions.find(s=>s.id.endsWith('aaaa-4')); if(r.mode!=='routine'||r.trigger!=='routine'||r.surface!=='cloud') {console.error('FAIL routine detection',r);process.exit(1)}
    const c=d.sessions.find(s=>s.id.includes('cloud1')); if(!c||c.surface!=='cloud') {console.error('FAIL cloud');process.exit(1)}
    if(d.sessions.some(s=>s.id.includes('bridge1'))) {console.error('FAIL bridge should be skipped');process.exit(1)}
    const a1=d.sessions.find(s=>s.id.endsWith('aaaa-1')); if(!a1.connectors.includes('github')||a1.messages_user!==2||!a1.tools.includes('Edit')) {console.error('FAIL cc parse',a1);process.exit(1)}
    const g3=d.sessions.find(s=>s.id==='s_chatgpt_g3'); if(!g3.tools.includes('python')||g3.model!=='gpt-5') {console.error('FAIL chatgpt parse',g3);process.exit(1)}
    const d2=d.sessions.find(s=>s.id==='s_claude-desktop_d2'); if(d2.source!=='claude-cowork'||!d2.tools.includes('Google Drive')) {console.error('FAIL cowork parse',d2);process.exit(1)}
    if(d.sessions.some(s=>s.id.endsWith('aaaa-5')||s.id==='s_chatgpt_g4')) {console.error('FAIL window filter');process.exit(1)}
    console.log('   sources ok:',JSON.stringify(by));"
  node scripts/config.mjs --title "Senior Product Designer" --function Design >/dev/null
  node scripts/classify.mjs prep --size 6 | sed 's/^/   /'
  node tests/fake-classify.mjs "$H/how-i-ai/classify" >/dev/null
  node scripts/classify.mjs merge | sed 's/^/   /'
  echo '{"headline":"Test headline","summary":"Test summary.","patterns":["p1","p2"],"one_liner":"one liner","signature_move":"move","surprise_why":"because"}' > "$H/how-i-ai/narrative.json"
  node scripts/stats.mjs | sed 's/^/   /'
  for t in profile-wrapped profile-editorial profile-terminal; do [ -f templates/$t.html ] && node scripts/render.mjs --template templates/$t.html --data "$H/how-i-ai/profile.json" --out "$H/how-i-ai/$t.html" | sed 's/^/   /' || true; done
  node scripts/share.mjs preview | head -4 | sed 's/^/   /'
  node -e "const p=require('$H/how-i-ai/share-rows.json'); const cols=Object.keys(p.sessions[0]); for(const bad of ['first_message','title','project_hash','context']) if(cols.includes(bad)){console.error('FAIL leak',bad);process.exit(1)}; if(JSON.stringify(p).includes('/Users/me')){console.error('FAIL path leak');process.exit(1)}; console.log('   share rows clean:',p.sessions.length,'rows,',cols.length,'columns')"
  node scripts/aggregate.mjs --json "$H/how-i-ai/share-rows.json" --team "Test team" --out "$H/how-i-ai/aggregate.json" | sed 's/^/   /'
  for t in aggregate-boardroom aggregate-exhibit; do [ -f templates/$t.html ] && node scripts/render.mjs --template templates/$t.html --data "$H/how-i-ai/aggregate.json" --out "$H/how-i-ai/$t.html" | sed 's/^/   /' || true; done
done
echo "ALL OK ($T)"
