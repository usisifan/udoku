import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import E from '../dist/engine.js';import {model,solve,validate} from '../scripts/solver.mjs';
const levels=JSON.parse(fs.readFileSync(new URL('../dist/levels.json',import.meta.url)));
test('two mistakes end a round; marks and clicks cannot act after loss',()=>{const p=levels[0],s=E.create(p),wrong=p.regions.findIndex((_,i)=>!p.solution.includes(i));assert.equal(E.place(s,p,wrong).type,'mistake');assert.equal(s.lives,1);assert.equal(E.place(s,p,wrong).type,'lost');assert.equal(s.lives,0);assert.equal(E.place(s,p,p.solution[0]).type,'ignored');assert.equal(E.mark(s,p.solution[0],1),false);});
test('confirmed Ayadan cannot be erased, repeated placement costs no life',()=>{const p=levels[0],s=E.create(p),i=p.solution.find(i=>i!==p.given);E.mark(s,i,1);assert.equal(E.place(s,p,i).type,'placed');assert.equal(E.mark(s,i,0),false);assert.equal(E.place(s,p,i).type,'ignored');assert.equal(s.lives,2);});
test('two hints survive reloads without refills, and a third use is ignored',()=>{
 const p=levels[0],s=E.create(p);assert.equal(s.hints,2);assert.equal(E.hint(s,p).hint,true);assert.equal(s.hints,1);
 const r=E.restore(JSON.parse(JSON.stringify(s)),p);assert.equal(r.hints,1);assert.equal(E.hint(r,p).hint,true);assert.equal(r.hints,0);
 const exhausted=E.restore(JSON.parse(JSON.stringify(r)),p),before=structuredClone(exhausted);
 assert.equal(E.hint(exhausted,p).type,'ignored');assert.deepEqual(exhausted,before);assert.equal(exhausted.marks.filter(x=>x===2).length,3);
});
test('legacy hint allowance migrates once while preserving progress and previous uses',()=>{
 const p=levels[1];
 for(const version of [undefined,1,2])for(const remaining of [0,1]){
  const saved={version,level:p.id,hash:p.sha256,marks:Array(p.n*p.n).fill(0),lives:1,hints:remaining,elapsed:123456,status:'playing'};
  saved.marks[p.given]=2;saved.marks[p.solution.find(i=>i!==p.given)]=2;saved.marks[p.regions.findIndex((_,i)=>!p.solution.includes(i))]=1;
  const snapshot=structuredClone(saved),r=E.restore(saved,p);
  assert.equal(r.version,4);assert.equal(r.hints,remaining+1);assert.equal(2-r.hints,1-remaining);
  assert.deepEqual(r.marks,saved.marks);assert.equal(r.lives,1);assert.equal(r.elapsed,123456);assert.equal(r.status,'playing');assert.deepEqual(saved,snapshot);
  assert.deepEqual(E.restore(JSON.parse(JSON.stringify(r)),p),r);
 }
});
test('legacy completed and lost rounds keep their status and best-result history',()=>{
 const p=levels[0],completed={hash:p.sha256,elapsed:90000,lives:1,hintsUsed:1,date:'2026-10-17T00:00:00.000Z'};
 const won={version:2,level:1,hash:p.sha256,marks:Array(p.n*p.n).fill(0),lives:1,hints:0,elapsed:90000,status:'won'};for(const i of p.solution)won.marks[i]=2;
 const restored=E.restore(won,p);assert.equal(restored.status,'won');assert.equal(restored.hints,1);assert.equal(E.hint(restored,p).type,'ignored');
 assert.deepEqual(E.validCompletions({completed:{1:completed},rounds:{1:won}},levels),{1:completed});
 const lost={...won,marks:E.create(p).marks,lives:0,status:'lost'};const r=E.restore(lost,p);assert.equal(r.status,'lost');assert.equal(E.hint(r,p).type,'ignored');
});
test('opening clues and resources match each campaign band',()=>{for(const p of levels){const expected=p.id<40?[2,2,1]:p.id<60?[5,3,5]:p.id<80?[6,4,6]:[7,4,8],s=E.create(p);assert.deepEqual([s.hints,s.lives,s.marks.filter(x=>x===2).length],expected);assert.equal(s.marks[p.given],2);for(const i of E.starters(p)){assert.ok(p.solution.includes(i));assert.equal(E.mark(s,i,0),false);assert.equal(E.place(s,p,i).type,'ignored');}}});
test('older saved rounds gain their opening clue without refunding hint or lives',()=>{const p=levels[0],s=E.create(p);s.marks[p.given]=1;s.hints=0;s.lives=1;const r=E.restore(s,p);assert.equal(r.marks[p.given],2);assert.equal(r.hints,0);assert.equal(r.lives,1);});
test('all later openings span different regions and directions with stable positions',()=>{
 for(const p of levels.filter(p=>p.id>=40)){
  const a=E.starters(p),rows=a.map(i=>Math.floor(i/p.n)),cols=a.map(i=>i%p.n),quarters=new Set(a.map(i=>(Math.floor(i/p.n)>=p.n/2?2:0)+(i%p.n>=p.n/2?1:0)));
  assert.equal(new Set(a.map(i=>p.regions[i])).size,a.length,'distinct colors: '+p.id);
  assert.equal(quarters.size,Math.min(4,a.length),'directions: '+p.id);
  assert.ok(Math.max(...rows)-Math.min(...rows)>=(p.n-1)/2,'vertical span: '+p.id);
  assert.ok(Math.max(...cols)-Math.min(...cols)>=(p.n-1)/2,'horizontal span: '+p.id);
  assert.deepEqual(E.starters(structuredClone(p)),a);assert.ok(a.includes(p.given));
 }
});
test('old campaign saves keep prior uses, mistakes, marks and elapsed time across tier migration',()=>{
 for(const p of levels)for(const version of [1,2,3])for(const used of [0,1])for(const lives of [0,1,2]){
  const oldLimit=version===3?2:1,marks=Array(p.n*p.n).fill(0);marks[p.given]=2;marks[p.solution.at(-1)]=2;
  const note=p.regions.findIndex((_,i)=>!p.solution.includes(i));marks[note]=1;
  const saved={version,level:p.id,hash:p.sha256,marks,lives,hints:oldLimit-used,elapsed:456789,status:lives?'playing':'lost'},snapshot=structuredClone(saved),r=E.restore(saved,p),config=E.rules(p);
  assert.equal(r.hints,config.hints-used);assert.equal(r.lives,lives===0?0:config.lives-(2-lives));assert.equal(r.elapsed,456789);
  for(let i=0;i<marks.length;i++)assert.equal(r.marks[i],lives&&E.starters(p).includes(i)?2:marks[i]);
  assert.equal(r.status,lives?'playing':'lost');assert.deepEqual(E.restore(structuredClone(r),p),r);assert.deepEqual(saved,snapshot);
 }
});
test('later tiers allow exactly their hint budget and life allowance without reload refills',()=>{
 for(const id of [40,59,60,79,80,100]){
  const p=levels[id-1],config=E.rules(p);let s=E.create(p);
  for(let i=0;i<config.hints;i++){assert.equal(E.hint(s,p).hint,true);s=E.restore(structuredClone(s),p);assert.equal(s.hints,config.hints-i-1);}
  const before=structuredClone(s);assert.equal(E.hint(s,p).type,'ignored');assert.deepEqual(s,before);
  const wrong=p.regions.findIndex((_,i)=>!p.solution.includes(i));
  for(let i=0;i<config.lives;i++){assert.equal(E.place(s,p,wrong).type,i===config.lives-1?'lost':'mistake');s=E.restore(structuredClone(s),p);assert.equal(s.lives,config.lives-1-i);}
  assert.equal(E.place(s,p,wrong).type,'ignored');assert.equal(E.hint(s,p).type,'ignored');
 }
});
test('additional opening clues may finish a nearly complete old round without spending hints',()=>{
 const p=levels[39],missing=E.starters(p).find(i=>i!==p.given),marks=Array(p.n*p.n).fill(0);for(const i of p.solution)if(i!==missing)marks[i]=2;
 const saved={version:3,level:p.id,hash:p.sha256,marks,lives:1,hints:0,elapsed:67890,status:'playing'},r=E.restore(saved,p);
 assert.equal(r.status,'won');assert.equal(r.hints,3);assert.equal(r.lives,2);assert.equal(r.elapsed,67890);assert.deepEqual(E.restore(structuredClone(r),p),r);
});
test('sequential unlocking requires every earlier level and handles campaign end',()=>{assert.equal(E.unlocked({}),1);assert.equal(E.canPlay(2,{}),false);assert.equal(E.unlocked({1:{},3:{}}),2);assert.equal(E.canPlay(3,{1:{},3:{}}),false);assert.equal(E.canPlay(0,{}),false);assert.equal(E.canPlay(1.5,{}),false);const done=Object.fromEntries(levels.map(p=>[p.id,{}]));assert.equal(E.unlocked(done),100);assert.equal(E.canPlay(100,done),true);assert.equal(E.canPlay(101,done),false);});
test('changed puzzle completions are rejected and old matching records migrate',()=>{const [a,b]=levels,saved={completed:{1:{elapsed:10,hash:'old'},2:{elapsed:20}},rounds:{2:{hash:b.sha256}}};assert.deepEqual(Object.keys(E.validCompletions(saved,levels)),['2']);assert.equal(E.validCompletions(saved,levels)[2].hash,b.sha256);saved.completed[1]={elapsed:0,hash:a.sha256};assert.equal(E.unlocked(E.validCompletions(saved,levels)),3);});
test('early boards grow from 4x4 and can be solved from one clue without branching',()=>{assert.deepEqual(levels.slice(0,10).map(p=>p.n),[4,5,5,6,6,6,7,7,8,10]);for(const p of levels.slice(0,9)){const initial=E.create(p).marks,r=solve(model(p.n,p.k,p.regions),{initial,maxNodes:1});assert.equal(r.aborted,false);assert.equal(r.count,1);assert.deepEqual(r.solutions[0],p.solution);}});
test('all exact solutions produce a win, with count matching row quota',()=>{for(const p of levels){const s=E.create(p);for(const i of p.solution)E.place(s,p,i);assert.equal(s.status,'won');assert.equal(s.lives,p.id<40?2:p.id<60?3:4);assert.equal(s.marks.filter(v=>v===2).length,p.n*p.k);}});
test('invalid restored marks, changed puzzle hash, and malformed saves reset safely',()=>{const p=levels[0],s=E.create(p);s.hash='outdated';assert.deepEqual(E.restore(s,p),E.create(p));s.hash=p.sha256;s.marks[p.regions.findIndex((_,i)=>!p.solution.includes(i))]=2;assert.deepEqual(E.restore(s,p),E.create(p));assert.deepEqual(E.restore(null,p),E.create(p));});
test('100 distinct boards have connected regions and valid placed solutions',()=>{assert.equal(levels.length,100);assert.equal(new Set(levels.map(p=>p.sha256)).size,100);for(const p of levels)assert.equal(validate(p.n,p.k,p.regions,p.solution),true);});
test('solver agrees with independent exhaustive permutation oracle on 200 small boards',()=>{
 let seed=1729;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const n=5,permutations=[];function enumerate(cols){if(cols.length===n){permutations.push(cols.map((c,r)=>r*n+c));return;}for(let c=0;c<n;c++)if(!cols.includes(c)&&(!cols.length||Math.abs(c-cols.at(-1))>1))enumerate([...cols,c]);}enumerate([]);
 for(let t=0;t<200;t++){const regions=Array.from({length:n*n},()=>Math.floor(rand()*n));const actual=permutations.filter(s=>new Set(s.map(i=>regions[i])).size===n).length;const result=solve(model(n,1,regions),{limit:1000,maxNodes:100000});assert.equal(result.aborted,false);assert.equal(result.count,actual,'oracle case '+t);}
});
test('row-region 4x4 has exactly two 1-star solutions; impossible 2-star has none',()=>{const r=Array.from({length:16},(_,i)=>Math.floor(i/4));assert.equal(solve(model(4,1,r),{limit:20}).count,2);assert.equal(solve(model(4,2,r),{limit:20}).count,0);});

