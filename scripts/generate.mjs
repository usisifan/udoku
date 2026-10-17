import fs from 'node:fs';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';import {model,solve,connected,validate} from './solver.mjs';
const out=new URL('../dist/levels.json',import.meta.url);
function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function shuffle(a,rand){for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function specification(id){return id===1?[4,1]:id<=3?[5,1]:id<=6?[6,1]:id<=8?[7,1]:id===9?[8,1]:id<25?[10,1]:id<40?[12,1]:id<60?[14,2]:id<80?[16,2]:[20,2];}
function makeSolution(n,k,rand){
 if(k===1){
  const cols=Array.from({length:n},(_,i)=>i);
  for(let t=0;t<100000;t++){shuffle(cols,rand);if(cols.every((c,r)=>!r||Math.abs(c-cols[r-1])>1))return cols.map((c,r)=>[r*n+c]);}
 }
 const pairs=[];let start=0;
 while(n-start>6){pairs.push([start,start+2],[start+1,start+3]);start+=4;}
 if(n-start===6)pairs.push([start,start+2],[start+1,start+4],[start+3,start+5]);
 else if(n-start===4)pairs.push([start,start+2],[start+1,start+3]);
 const bag=pairs.flatMap((_,i)=>[i,i]),order=[];
 function arrange(){
  if(order.length===n)return true;
  const used=new Set(),candidates=shuffle(bag.map((_,i)=>i).filter(i=>bag[i]>=0),rand);
  for(const idx of candidates){const p=bag[idx];if(used.has(p))continue;used.add(p);
   if(order.length&&pairs[p].some(c=>pairs[order.at(-1)].some(v=>Math.abs(c-v)<=1)))continue;
   bag[idx]=-1;order.push(p);if(arrange())return true;order.pop();bag[idx]=p;
  }return false;
 }
 if(!arrange())throw Error('Could not arrange rows');
 return order.map((p,r)=>pairs[p].map(c=>r*n+c));
}
function transform(regions,solution,n,rand){
 const rot=Math.floor(rand()*4),flip=rand()<.5;
 function dest(i){let r=Math.floor(i/n),c=i%n;if(flip)c=n-1-c;for(let j=0;j<rot;j++){[r,c]=[c,n-1-r];}return r*n+c;}
 const labels=shuffle(Array.from({length:n},(_,i)=>i),rand),map=Array(n*n);
 regions.forEach((g,i)=>map[dest(i)]=labels[g]);
 return [map,solution.map(dest).sort((a,b)=>a-b)];
}
export function generate(id,variant=0){
 const [n,k]=specification(id),seed=0xA7AD0000+id*7919+variant*104729,rand=rng(seed);
 for(let attempt=0;attempt<30;attempt++){
  const rows=makeSolution(n,k,rand),solution=rows.flat(),stars=new Set(solution);
  let regions=Array(n*n).fill(n-1);
  const background=Math.floor(rand()*n);
  const labels=shuffle(Array.from({length:n-1},(_,i)=>i),rand);
  let l=0;
  for(let r=0;r<n;r++)if(r!==background){
   const cs=rows[r].map(i=>i%n);
   for(let c=Math.min(...cs);c<=Math.max(...cs);c++)regions[r*n+c]=labels[l];
   l++;
  }
  if(!Array.from({length:n},(_,g)=>connected(regions,n,g)).every(Boolean))continue;
  let result=solve(model(n,k,regions),{maxNodes:3000});
  if(result.aborted||result.count!==1)continue;
  const target=n*n-n,passes=id<10?850:id<40?1600:2400;
  let accepted=0;let bestRegions=regions.slice(),bestScore=-Infinity,bestNodes=1;
  const sizes=Array(n).fill(0);regions.forEach(g=>sizes[g]++);
  const start=performance.now();
  for(let step=0;step<passes;step++){
   // Grow smaller regions into larger neighbors; subsequent exchanges sculpt irregular boundaries.
   const i=Math.floor(rand()*n*n);if(stars.has(i))continue;
   const r=Math.floor(i/n),c=i%n,adj=shuffle([r?i-n:-1,r<n-1?i+n:-1,c?i-1:-1,c<n-1?i+1:-1].filter(j=>j>=0),rand);
   const old=regions[i],other=adj.find(j=>regions[j]!==old);
   if(other===undefined)continue;const next=regions[other];
   if(sizes[old]<=k+1|| (sizes[old]<=sizes[next] && rand()<.9))continue;
   if(!connected(regions,n,old,i))continue;
   regions[i]=next;
   const trial=solve(model(n,k,regions),{maxNodes:n>=14?450:1200});
   if(!trial.aborted&&trial.count===1){
    sizes[old]--;sizes[next]++;accepted++;result=trial;
    const min=Math.min(...sizes),max=Math.max(...sizes),balance=sizes.reduce((s,v)=>s+(v-n)**2,0);
    const score=-balance+Math.min(trial.nodes,80)*3+min*15;
    if(score>bestScore){bestScore=score;bestRegions=regions.slice();bestNodes=trial.nodes;}
   }else regions[i]=old;
   if(id>=10&&performance.now()-start>18000&&accepted>30)break;
  }
  regions=bestRegions;
  const transformed=transform(regions,solution,n,rand);regions=transformed[0];const answer=transformed[1];
  validate(n,k,regions,answer);
  const verified=solve(model(n,k,regions),{maxNodes:100000});
  if(verified.aborted||verified.count!==1)continue;
  const digest=crypto.createHash('sha256').update(JSON.stringify({n,k,regions})).digest('hex');
  return {id,n,k,regions,solution:answer,seed,sha256:digest,verification:{unique:true,nodes:verified.nodes,acceptedMutations:accepted},generatedBy:'ushishi-original-v1'};
 }
 throw Error('Generation exhausted for level '+id);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const args=process.argv.slice(2),from=Number(args[0]||1),to=Number(args[1]||100);
let levels=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):[];
for(let id=from;id<=to;id++){
 if(levels.some(p=>p.id===id))continue;
 const start=performance.now(),p=generate(id);levels.push(p);levels.sort((a,b)=>a.id-b.id);
 fs.writeFileSync(out,JSON.stringify(levels));console.log(JSON.stringify({level:id,n:p.n,k:p.k,nodes:p.verification.nodes,moves:p.verification.acceptedMutations,ms:Math.round(performance.now()-start)}));
}
}

