import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { flattenMissions, isMissionUnlocked, nextMissionPosition, episodeProgress, normalizeCompleted, normalizeMisses, resolveInitialMissionId } from '../progression.js';
const data=JSON.parse(fs.readFileSync(new URL('../data/missions.json',import.meta.url)));
test('schema has four episodes and sixteen missions',()=>{const all=flattenMissions(data);assert.equal(data.episodes.length,4);assert.equal(all.length,16);assert.equal(new Set(all.map(m=>m.id)).size,16);});
test('first mission only is unlocked',()=>{const all=flattenMissions(data);assert.equal(isMissionUnlocked(data,all[0].id,[]),true);assert.equal(isMissionUnlocked(data,all[1].id,[]),false);});
test('previous completion unlocks next and boundary next works',()=>{const all=flattenMissions(data);assert.equal(isMissionUnlocked(data,all[1].id,[all[0].id]),true);assert.equal(nextMissionPosition(data,all[3].id).id,all[4].id);});
test('episode progress counts completed missions',()=>{assert.deepEqual(episodeProgress(data,'ep01',["ep01-m1","ep01-m2"]),{done:2,total:4});});
test('outputs are valid and quizzes valid',()=>{for(const m of flattenMissions(data)){assert.match(m.output,/^\$ /);assert.ok(m.quiz.answer>=0&&m.quiz.answer<m.quiz.choices.length);}});
test('commands avoid offensive escalation language',()=>{const text=JSON.stringify(data);assert.equal(/sudo -i|su -|exploit|credential theft/i.test(text),false);});
test('normalizes duplicate and unknown completion ids',()=>{assert.deepEqual(normalizeCompleted(data,['ep01-m1','ep01-m1','unknown']),['ep01-m1']);});
test('invalid saved id falls back to latest unlocked',()=>{assert.equal(resolveInitialMissionId(data,['ep01-m1'],'missing'),'ep01-m2');});
test('locked saved id falls back safely',()=>{assert.equal(resolveInitialMissionId(data,[],'ep04-m4'),'ep01-m1');});
test('valid saved id restores',()=>{assert.equal(resolveInitialMissionId(data,['ep01-m1'],'ep01-m1'),'ep01-m1');});
test('empty data resolves null',()=>{assert.equal(resolveInitialMissionId({episodes:[]},[],'x'),null);});
test('progress completion remains unique',()=>{const p=episodeProgress(data,'ep01',['ep01-m1','ep01-m1']);assert.deepEqual(p,{done:1,total:4});});
test('no generic placeholder phrases',()=>{const text=JSON.stringify(data);assert.equal(/前の手掛かりを受けて安全に確認する|Training evidence for|この確認で大切な判断は？/.test(text),false);});
test('all handoffs are unique and nonempty',()=>{const all=flattenMissions(data);assert.equal(new Set(all.map(m=>m.handoff)).size,16);assert.ok(all.every(m=>m.handoff));});
test('operators are separate tokens',()=>{const all=flattenMissions(data);assert.ok(all.find(m=>m.command.includes('|')).tokens.some(t=>t.text==='|'));assert.ok(all.find(m=>m.command.includes('>')).tokens.some(t=>t.text==='>'));});
test('reserved fictional evidence only',()=>{const text=JSON.stringify(data);assert.equal(/example\.(?!test)|10\.0\.|172\.16\./i.test(text),false);});
test('all choice sets are unique',()=>{const all=flattenMissions(data);assert.equal(new Set(all.map(m=>JSON.stringify(m.quiz.choices))).size,16);});
test('all quiz explanations are unique',()=>{const all=flattenMissions(data);assert.equal(new Set(all.map(m=>m.quiz.explain)).size,16);});
test('content has no banned teaching templates',()=>{const text=JSON.stringify(data);assert.equal(/をこのコマンド内の要素として読みます|の役割を確認すると|固有手掛かり|実行前に対象と結果を確認する|この出力は|するを行い|するへ進みます/.test(text),false);});
test('expected correct choices match each mission',()=>{const expected={
  'ep01-m1':'現在の作業ディレクトリ','ep01-m2':'.case-idなど隠し項目も表示','ep01-m3':'教材内の現在の作業ディレクトリ','ep01-m4':'ops-traineeとNS-248',
  'ep02-m1':'現在の有効ユーザー','ep02-m2':'ユーザーの所属グループ','ep02-m3':'許可ルールを実行せず確認','ep02-m4':'restart試行は拒否・記録された',
  'ep03-m1':'MX配送先の変更','ep03-m2':'対応するIPv4アドレス','ep03-m3':'ドメインのメール配送先','ep03-m4':'MX変更の承認記録がない',
  'ep04-m1':'大文字小文字を区別しない','ep04-m2':'左の出力をgrepへ渡す','ep04-m3':'一致行をerrors.txtへ送る','ep04-m4':'同一IPの連続事象。要追加調査',
}; for(const m of flattenMissions(data)){assert.equal(m.quiz.choices[m.quiz.answer],expected[m.id],m.id);}});
test('choice labels fit one-line controls',()=>{for(const m of flattenMissions(data))for(const choice of m.quiz.choices)assert.ok(choice.length<=18,`${m.id}: ${choice}`);});
test('token meanings are distinct and substantive',()=>{const meanings=flattenMissions(data).flatMap(m=>m.tokens.map(t=>t.meaning));assert.ok(new Set(meanings).size>=30);assert.ok(meanings.every(text=>text.length>=12));});
test('narrative evidence keys are present',()=>{const text=JSON.stringify(data);for(const key of ['ops-trainee','NS-248','ticket=NONE','source=203.0.113.17','result=denied','侵害確定とは断定'])assert.ok(text.includes(key),key);});
test('normalizes misses to known nonnegative integers',()=>{assert.deepEqual(normalizeMisses(data,{'ep01-m1':2.9,'ep01-m2':NaN,'ep01-m3':-1,'unknown':4,'ep01-m4':0}),{'ep01-m1':2,'ep01-m4':0});assert.deepEqual(normalizeMisses(data,[]),{});});
test('visible copy avoids simulation jargon',()=>{const visible=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8')+fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');assert.equal(/模擬|SAFE SIMULATION|模擬証拠|模擬実行/.test(visible),false);});
test('all mission outputs start with their command prompt',()=>{for(const m of flattenMissions(data)){assert.match(m.output,/^\$ [^\n]+/);assert.ok(m.output.trim().length>2);}});
test('quiz feedback exposes explicit accessible correctness states',()=>{const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');assert.match(app,/× 不正解/);assert.match(app,/✓ 正解/);assert.match(app,/dataset\.state/);assert.match(css,/quiz-status\[data-state="correct"\]/);assert.match(css,/quiz-status\[data-state="incorrect"\]/);});
