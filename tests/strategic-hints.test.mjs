import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import E from '../dist/engine.js';
import {model,solve} from '../scripts/solver.mjs';
const levels=JSON.parse(fs.readFileSync(new URL('../dist/levels.json',import.meta.url)));

test('all 61 later boards have a branch-free solving path within their existing hint allowance',()=>{
 for(const p of levels.filter(p=>p.id>=40)){
  let s=E.create(p),r;const m=model(p.n,p.k,p.regions),opening=s.marks.slice();
  for(let used=0;used<=E.rules(p).hints;used++){
   r=solve(m,{initial:s.marks,maxNodes:1});
   if(!r.aborted&&r.count===1)break;
   if(!s.hints)break;
   const before=structuredClone(s),hint=E.hint(s,p);
   assert.ok(p.solution.includes(hint.index),'valid clue on '+p.id);
   assert.equal(s.marks.filter((v,i)=>v!==before.marks[i]).length,1,'only one cell revealed');
   assert.equal(s.hints,before.hints-1);assert.equal(s.lives,before.lives);
   s=E.restore(structuredClone(s),p);
  }
  assert.equal(r.aborted,false,'logic stalled after budget on '+p.id);
  assert.equal(r.count,1,'unique completion on '+p.id);assert.equal(r.nodes,1,'no search branches on '+p.id);
  assert.deepEqual(r.solutions[0],p.solution);assert.deepEqual(E.create(p).marks,opening);
  for(const i of r.solutions[0])E.place(s,p,i);
  assert.equal(s.status,'won');assert.equal(s.lives,p.id<60?3:4);
 }
});

test('wrong X notes do not derail strategic hints or get erased wholesale',()=>{
 for(const p of levels.filter(p=>p.id>=40)){
  const clean=E.create(p),noted=E.create(p);
  for(let i=0;i<noted.marks.length;i++)if(noted.marks[i]!==2)noted.marks[i]=1;
  const before=noted.marks.slice(),a=E.hint(clean,p),b=E.hint(noted,p);
  assert.equal(a.index,b.index,'same correct clue on '+p.id);
  assert.equal(noted.marks.filter((v,i)=>v!==before[i]).length,1);
  assert.deepEqual(E.restore(structuredClone(noted),p),noted);
 }
});

test('level 40 now opens a complete logic path in at most three hints',()=>{
 const p=levels[39],m=model(p.n,p.k,p.regions),s=E.create(p);
 for(let i=0;i<3;i++)E.hint(s,p);
 const r=solve(m,{initial:s.marks,maxNodes:1});
 assert.equal(r.aborted,false);assert.equal(r.count,1);assert.equal(s.hints,2);
 assert.equal(s.marks.filter(v=>v===2).length,9,'the rest remain for the player to deduce');
});

test('early-level hint behavior and budgets remain unchanged',()=>{
 for(const p of levels.filter(p=>p.id<40)){
  const s=E.create(p),expected=p.solution.find(i=>s.marks[i]!==2);
  assert.equal(E.hint(s,p).index,expected);assert.equal(s.hints,1);assert.equal(s.lives,2);
 }
});
