/* Original local-only puzzle game engine. */
(function(root){
'use strict';
const EMPTY=0,X=1,AYADAN=2;
function rules(p){return p.id>=80?{hints:7,lives:4,opening:8}:p.id>=60?{hints:6,lives:4,opening:6}:p.id>=40?{hints:5,lives:3,opening:5}:{hints:2,lives:2,opening:1};}
function starter(p){return Number.isInteger(p.given)&&p.solution.includes(p.given)?p.given:p.solution[0];}
const openingCache=new WeakMap();
function starters(p){
 if(openingCache.has(p))return openingCache.get(p);
 const n=p.n,count=rules(p).opening,chosen=[starter(p)];
 const quadrant=i=>(Math.floor(i/n)>=n/2?2:0)+(i%n>=n/2?1:0);
 while(chosen.length<count){
  const regions=new Set(chosen.map(i=>p.regions[i])),quadrants=new Set(chosen.map(quadrant));let best,bestScore=-Infinity;
  for(const i of p.solution){
   if(regions.has(p.regions[i]))continue;
   const distances=chosen.map(j=>(Math.floor(i/n)-Math.floor(j/n))**2+(i%n-j%n)**2);
   // Cover new quarters first, then maximize distance to the nearest opening clue.
   const score=(!quadrants.has(quadrant(i))?4*n*n:0)+Math.min(...distances)+distances.reduce((a,b)=>a+b,0)/(count*4*n*n);
   if(score>bestScore){best=i;bestScore=score;}
  }
  if(best===undefined)throw Error('Not enough distinct regions for opening clues');chosen.push(best);
 }
 const result=Object.freeze(chosen);openingCache.set(p,result);return result;
}
function create(p){const config=rules(p),marks=Array(p.n*p.n).fill(0);for(const i of starters(p))marks[i]=AYADAN;return {version:4,level:p.id,hash:p.sha256,marks,lives:config.lives,lifeLimit:config.lives,hints:config.hints,hintLimit:config.hints,elapsed:0,status:'playing'};}
function unlocked(completed,total=100){let next=1;while(next<total&&Object.hasOwn(completed,next)&&completed[next])next++;return next;}
function canPlay(id,completed,total=100){return Number.isInteger(id)&&id>=1&&id<=unlocked(completed,total);}
function validCompletions(saved,levels){const clean={};for(const p of levels){const c=saved?.completed?.[p.id];if(c&&typeof c==='object'&&(c.hash||saved?.rounds?.[p.id]?.hash)===p.sha256&&Number.isFinite(c.elapsed)&&c.elapsed>=0)clean[p.id]={...c,hash:p.sha256};}return clean;}
function finished(s,p){return s.marks.filter(v=>v===AYADAN).length===p.n*p.k;}
function restore(saved,p){
 if(!saved||saved.level!==p.id||saved.hash!==p.sha256||!Array.isArray(saved.marks)||saved.marks.length!==p.n*p.n)return create(p);
 if(!saved.marks.every((v,i)=>[0,1,2].includes(v)&&(v!==2||p.solution.includes(i))))return create(p);
 const s=create(p);s.marks=saved.marks.slice();
 const limit=(value,fallback)=>Number.isInteger(value)&&value>0&&value<=100?value:fallback;
 const oldHints=saved.version>=4?limit(saved.hintLimit,s.hintLimit):saved.version>=3?2:1;
 const oldLives=saved.version>=4?limit(saved.lifeLimit,s.lifeLimit):2;
 const remaining=(value,max)=>Number.isInteger(value)?Math.max(0,Math.min(max,value)):max;
 // Preserve prior uses and mistakes, with explicit limits preventing repeat grants.
 s.hints=Math.max(0,s.hintLimit-(oldHints-remaining(saved.hints,oldHints)));
 const lost=saved.lives===0;s.lives=lost?0:Math.max(0,s.lifeLimit-(oldLives-remaining(saved.lives,oldLives)));
 if(!lost)for(const i of starters(p))s.marks[i]=AYADAN;
 s.elapsed=Number.isFinite(saved.elapsed)?Math.max(0,Math.min(saved.elapsed,31536000000)):0;
 s.status=s.lives===0?'lost':finished(s,p)?'won':'playing';return s;
}
function mark(s,i,value){if(s.status!=='playing'||!Number.isInteger(i)||i<0||i>=s.marks.length||s.marks[i]===2)return false;s.marks[i]=value===1?1:0;return true;}
function place(s,p,i){
 if(s.status!=='playing'||!Number.isInteger(i)||i<0||i>=s.marks.length||s.marks[i]===2)return {type:'ignored'};
 if(!p.solution.includes(i)){s.lives--;if(!s.lives)s.status='lost';return {type:s.status==='lost'?'lost':'mistake',index:i};}
 s.marks[i]=2;if(finished(s,p))s.status='won';return {type:s.status==='won'?'won':'placed',index:i};
}
// Evaluate clues using deductions only: no search guesses and no player X notes.
const hintModels=new WeakMap();
function hintModel(p){
 if(hintModels.has(p))return hintModels.get(p);
 const n=p.n,groups=Array.from({length:3*n},()=>[]),memberships=[],neighbors=[];
 for(let i=0;i<n*n;i++){
  const r=Math.floor(i/n),c=i%n,ms=[r,n+c,2*n+p.regions[i]],ns=[];
  memberships.push(ms);for(const g of ms)groups[g].push(i);
  for(let y=Math.max(0,r-1);y<=Math.min(n-1,r+1);y++)for(let x=Math.max(0,c-1);x<=Math.min(n-1,c+1);x++){const j=y*n+x;if(j!==i)ns.push(j);}
  neighbors.push(ns);
 }
 const m={k:p.k,groups,memberships,neighbors};hintModels.set(p,m);return m;
}
function deduceHint(m,a){
 const {k,groups,memberships,neighbors}=m;let changed=true;
 while(changed){
  changed=false;
  for(let i=0;i<a.length;i++)if(a[i]===AYADAN)for(const j of neighbors[i]){
   if(a[j]===AYADAN)return null;if(a[j]===EMPTY){a[j]=X;changed=true;}
  }
  for(const cells of groups){
   let stars=0;const open=[];
   for(const i of cells){if(a[i]===AYADAN)stars++;else if(a[i]===EMPTY)open.push(i);}
   const need=k-stars;if(need<0||need>open.length)return null;
   if(need===0){for(const i of open){a[i]=X;changed=true;}}
   else if(need===open.length){for(const i of open){a[i]=AYADAN;changed=true;}}
   else if(need===2&&open.length<=7){
    for(const i of open)if(!open.some(j=>i!==j&&!neighbors[i].includes(j))){a[i]=X;changed=true;}
   }
  }
  for(let g=0;g<groups.length;g++){
   let count=0;const open=[];for(const i of groups[g]){if(a[i]===AYADAN)count++;else if(a[i]===EMPTY)open.push(i);}
   const need=k-count;if(!need||!open.length)continue;
   for(const h of memberships[open[0]]){
    if(h===g||!open.every(i=>memberships[i].includes(h)))continue;
    let existing=0;for(const i of groups[h])if(a[i]===AYADAN)existing++;
    if(k-existing===need)for(const i of groups[h])if(a[i]===EMPTY&&!memberships[i].includes(g)){a[i]=X;changed=true;}
   }
  }
 }
 return a;
}
function chooseHint(s,p){
 const fallback=p.solution.find(i=>s.marks[i]!==AYADAN);if(p.id<40||fallback===undefined)return fallback;
 const m=hintModel(p),base=deduceHint(m,Uint8Array.from(s.marks,v=>v===AYADAN?AYADAN:EMPTY));
 if(!base)return fallback;
 let best=fallback,bestScore=-1;
 for(const i of p.solution){
  // Skip positions already inferable, so limited hints target the next bottleneck.
  if(base[i]===AYADAN)continue;
  const trial=base.slice();trial[i]=AYADAN;const result=deduceHint(m,trial);if(!result)continue;
  let score=0;for(const mark of result)if(mark===AYADAN)score++;
  if(score>bestScore){best=i;bestScore=score;}
 }
 return best;
}
function hint(s,p){if(s.status!=='playing'||s.hints<=0)return {type:'ignored'};const i=chooseHint(s,p);if(i===undefined)return {type:'ignored'};s.hints--;return {...place(s,p,i),hint:true};}
const api={EMPTY,X,AYADAN,rules,starter,starters,unlocked,canPlay,validCompletions,create,restore,mark,place,hint,finished};if(typeof module!=='undefined')module.exports=api;else root.PuzzleEngine=api;
})(typeof window!=='undefined'?window:globalThis);

