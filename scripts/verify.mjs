import fs from 'node:fs';import crypto from 'node:crypto';import {model,solve,validate} from './solver.mjs';
const levels=JSON.parse(fs.readFileSync(new URL('../dist/levels.json',import.meta.url))),hashes=new Set(),canonical=new Set(),entries=[];let totalNodes=0;
function shape(p){const versions=[];for(let flip=0;flip<2;flip++)for(let rot=0;rot<4;rot++){const a=Array(p.n*p.n);p.regions.forEach((g,i)=>{let r=Math.floor(i/p.n),c=i%p.n;if(flip)c=p.n-1-c;for(let j=0;j<rot;j++)[r,c]=[c,p.n-1-r];a[r*p.n+c]=g;});const names=new Map();versions.push(a.map(g=>{if(!names.has(g))names.set(g,names.size);return names.get(g);}).join(','));}return p.n+':'+p.k+':'+versions.sort()[0];}
if(levels.length!==100)throw Error('Expected100 levels');
for(let idx=0;idx<levels.length;idx++){
 const p=levels[idx];if(p.id!==idx+1)throw Error('Nonsequential IDs');validate(p.n,p.k,p.regions,p.solution);
 const hash=crypto.createHash('sha256').update(JSON.stringify({n:p.n,k:p.k,regions:p.regions})).digest('hex');if(hash!==p.sha256||hashes.has(hash))throw Error('Hash mismatch/duplicate');hashes.add(hash);
 const key=shape(p);if(canonical.has(key))throw Error('Rotated/reflected duplicate');canonical.add(key);
 const result=solve(model(p.n,p.k,p.regions),{limit:2,maxNodes:1000000});if(result.aborted||result.count!==1)throw Error('Not proven unique at level'+p.id);
 if(result.solutions[0].join(',')!==p.solution.join(','))throw Error('Stored solution differs');
 if(!Number.isInteger(p.given)||!p.solution.includes(p.given))throw Error('Missing valid opening clue at level '+p.id);
 const initial=Array(p.n*p.n).fill(0);initial[p.given]=2;const opening=solve(model(p.n,p.k,p.regions),{initial,maxNodes:p.id<=9?1:1000000});
 if(opening.aborted||opening.count!==1)throw Error('Opening clue check failed at level '+p.id);
 totalNodes+=result.nodes;entries.push({level:p.id,size:p.n,quota:p.k,seed:p.seed,sha256:hash,connected:true,valid:true,solutions:1,exhaustiveSearch:true,searchNodes:result.nodes,given:p.given,openingSearchNodes:opening.nodes});
}
const report={generator:'ushishi-original-v2 (levels 1–9); original v1 boards retained for 10–100',createdAt:new Date().toISOString(),externalPuzzleSources:[],method:'Planted non-touching row/column solutions; connected region growth under uniqueness checks; exhaustive CSP search until all alternatives excluded. One given on every board; early 9 solvable by propagation without branching. No puzzle data imported.',puzzles:100,distinctIncludingRotationsAndReflections:canonical.size,uniqueSolutions:100,totalSearchNodes:totalNodes,checks:entries};
fs.mkdirSync(new URL('../provenance/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../provenance/verification.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({puzzles:100,connected:100,unique:100,distinctIncludingSymmetry:canonical.size,totalSearchNodes:totalNodes}));

