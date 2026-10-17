import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import E from '../dist/engine.js';
const levels=JSON.parse(fs.readFileSync(new URL('../dist/levels.json',import.meta.url)));
const previous=[
 ...JSON.parse(fs.readFileSync(new URL('../provenance/openings-v0.4.0.json',import.meta.url))).checks.map(p=>({...p,lives:3})),
 ...JSON.parse(fs.readFileSync(new URL('../provenance/hint-paths-v0.4.2.json',import.meta.url))).entries.map(p=>({level:p.level,puzzleHash:p.sha256,indices:p.opening,opening:p.opening.length,hints:p.hintAllowance,lives:3})),
 ...JSON.parse(fs.readFileSync(new URL('../provenance/hint-paths-v0.4.3.json',import.meta.url))).entries.map(p=>({level:p.level,puzzleHash:p.sha256,indices:p.opening,opening:p.opening.length,hints:p.hintAllowance,lives:p.level<60?3:4}))
];

test('older rounds gain only allowance differences and keep prior openings, mistakes, notes and time',()=>{
 for(const old of previous){
  const p=levels[old.level-1],config=E.rules(p),starts=E.starters(p),added=starts.filter(i=>!old.indices.includes(i));
  assert.equal(p.sha256,old.puzzleHash);assert.deepEqual(starts.slice(0,old.indices.length),old.indices);assert.equal(added.length,config.opening-old.opening);
  for(let used=0;used<=old.hints;used++)for(let lives=0;lives<=old.lives;lives++){
   const marks=Array(p.n*p.n).fill(0);for(const i of old.indices)marks[i]=2;
   for(const i of added)marks[i]=1;const note=p.regions.findIndex((_,i)=>!p.solution.includes(i));marks[note]=1;
   const saved={version:4,level:p.id,hash:p.sha256,marks,hints:old.hints-used,hintLimit:old.hints,lives,lifeLimit:old.lives,elapsed:456789,status:lives?'playing':'lost'},snapshot=structuredClone(saved);
   const r=E.restore(saved,p),expectedHints=config.hints-used;
   assert.equal(r.hints,expectedHints);assert.equal(r.hintLimit,config.hints);assert.equal(r.lives,lives?lives+config.lives-old.lives:0);assert.equal(r.elapsed,saved.elapsed);
   for(let i=0;i<marks.length;i++)assert.equal(r.marks[i],lives&&added.includes(i)?2:marks[i]);
   assert.deepEqual(E.restore(structuredClone(r),p),r);assert.deepEqual(saved,snapshot);
   if(lives){E.hint(r,p);const spent=E.restore(structuredClone(r),p);assert.equal(spent.hints,Math.max(0,expectedHints-1));}
   else assert.equal(r.status,'lost');
  }
 }
});

test('extra starting clues can finish old active rounds without overwriting historical completions',()=>{
 for(const old of previous){
  const p=levels[old.level-1],config=E.rules(p),added=E.starters(p).find(i=>!old.indices.includes(i)),marks=Array(p.n*p.n).fill(0);
  for(const i of p.solution)if(i!==added)marks[i]=2;
  const saved={version:4,level:p.id,hash:p.sha256,marks,hints:0,hintLimit:old.hints,lives:2,lifeLimit:old.lives,elapsed:123456,status:'playing'};
  const completion={hash:p.sha256,elapsed:111000,hintsUsed:old.hints,lives:2,date:'2026-10-18T01:00:00+09:00'};
  const r=E.restore(saved,p);assert.equal(r.status,'won');assert.equal(r.hints,config.hints-old.hints);assert.equal(r.elapsed,123456);assert.equal(r.lives,config.lives-(old.lives-2));
  assert.deepEqual(E.validCompletions({completed:{[p.id]:completion},rounds:{[p.id]:saved}},levels),{[p.id]:completion});
 }
});
