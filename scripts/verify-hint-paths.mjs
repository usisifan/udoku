// Verify a solving path on the shipped boards, without changing puzzle or save data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {model,solve} from './solver.mjs';
const levels=JSON.parse(fs.readFileSync(new URL('../dist/levels.json',import.meta.url)));
const entries=[];
for(const p of levels.filter(p=>p.id>=40)){
 const s=E.create(p),m=model(p.n,p.k,p.regions),clues=[];let r;
 for(let used=0;used<=E.rules(p).hints;used++){
  r=solve(m,{initial:s.marks,maxNodes:1});
  if(!r.aborted&&r.count===1)break;
  if(!s.hints)break;
  clues.push(E.hint(s,p).index);
 }
 assert.equal(r.aborted,false,'No branch-free path within allowance: '+p.id);
 assert.equal(r.count,1);assert.equal(r.nodes,1);assert.deepEqual(r.solutions[0],p.solution);
 entries.push({level:p.id,sha256:p.sha256,opening:E.starters(p),hintAllowance:E.rules(p).hints,hintsUsed:clues.length,hintCells:clues,solvesWithoutSearchBranches:true});
}
const bands=[[40,59],[60,79],[80,100]].map(([a,b])=>{const xs=entries.filter(x=>x.level>=a&&x.level<=b);return {range:a+'-'+b,boards:xs.length,hintAllowance:xs[0].hintAllowance,maxHintsOnVerifiedPaths:Math.max(...xs.map(x=>x.hintsUsed))};});
const report={version:'0.4.2',createdAt:new Date().toISOString(),method:'Start with the current opening clues; add actual engine hints until the separate constraint solver completes via propagation at one node. Propagation uses quotas, touching exclusions, non-touching partners, and locked groups. No DFS branch is permitted in the final solving path. User X notes are ignored when ranking hints.',limits:'This establishes a path from a fresh round within its hint budget, not that every player can see the deductions or that every previously spent hint sequence remains sufficient. Existing hint uses are not refunded.',boards:entries.length,bands,entries};
fs.writeFileSync(new URL('../provenance/hint-paths-v0.4.2.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({boards:entries.length,bands}));
