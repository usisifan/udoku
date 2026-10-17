import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import E from '../dist/engine.js';
const levels=JSON.parse(fs.readFileSync(new URL('../dist/levels.json',import.meta.url)));
const previous=JSON.parse(fs.readFileSync(new URL('../provenance/openings-v0.4.0.json',import.meta.url))).checks;

test('v0.4.0/1 rounds gain one hint once and keep all old opening cells, mistakes, notes and time',()=>{
 for(const old of previous){
  const p=levels[old.level-1],starts=E.starters(p),added=starts.filter(i=>!old.indices.includes(i));
  assert.equal(p.sha256,old.puzzleHash);assert.deepEqual(starts.slice(0,old.indices.length),old.indices);assert.equal(added.length,1);
  assert.equal(E.rules(p).hints,old.hints+1);assert.equal(E.rules(p).opening,old.opening+1);
  for(let used=0;used<=old.hints;used++)for(const lives of [0,1,2,3]){
   const marks=Array(p.n*p.n).fill(0);for(const i of old.indices)marks[i]=2;
   marks[added[0]]=1;const note=p.regions.findIndex((_,i)=>!p.solution.includes(i));marks[note]=1;
   const saved={version:4,level:p.id,hash:p.sha256,marks,hints:old.hints-used,hintLimit:old.hints,lives,lifeLimit:3,elapsed:456789,status:lives?'playing':'lost'},snapshot=structuredClone(saved);
   const r=E.restore(saved,p);
   assert.equal(r.hints,saved.hints+1);assert.equal(r.hintLimit,old.hints+1);assert.equal(r.lives,lives);assert.equal(r.elapsed,saved.elapsed);
   for(let i=0;i<marks.length;i++)assert.equal(r.marks[i],lives&&i===added[0]?2:marks[i]);
   assert.deepEqual(E.restore(structuredClone(r),p),r);assert.deepEqual(saved,snapshot);
   if(lives){E.hint(r,p);const spent=E.restore(structuredClone(r),p);assert.equal(spent.hints,saved.hints);}
   else assert.equal(r.status,'lost');
  }
 }
});

test('the extra starting clue can finish an old active round without overwriting historical completions',()=>{
 for(const old of previous){
  const p=levels[old.level-1],added=E.starters(p).find(i=>!old.indices.includes(i)),marks=Array(p.n*p.n).fill(0);
  for(const i of p.solution)if(i!==added)marks[i]=2;
  const saved={version:4,level:p.id,hash:p.sha256,marks,hints:0,hintLimit:old.hints,lives:2,lifeLimit:3,elapsed:123456,status:'playing'};
  const completion={hash:p.sha256,elapsed:111000,hintsUsed:old.hints,lives:2,date:'2026-10-18T01:00:00+09:00'};
  const r=E.restore(saved,p);assert.equal(r.status,'won');assert.equal(r.hints,1);assert.equal(r.elapsed,123456);assert.equal(r.lives,2);
  assert.deepEqual(E.validCompletions({completed:{[p.id]:completion},rounds:{[p.id]:saved}},levels),{[p.id]:completion});
 }
});
