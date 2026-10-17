import fs from 'node:fs';
import {generate} from './generate.mjs';
import {model,solve} from './solver.mjs';
const file=new URL('../dist/levels.json',import.meta.url),levels=JSON.parse(fs.readFileSync(file));
for(let id=1;id<=9;id++){
 let p;for(let variant=0;variant<50;variant++){p=generate(id,variant);if(p.solution.some(cell=>{const initial=Array(p.n*p.n).fill(0);initial[cell]=2;const r=solve(model(p.n,p.k,p.regions),{initial,maxNodes:1});return !r.aborted&&r.count===1;})){p.generationVariant=variant;break;}}p.generationIndex=id;p.generatedBy='ushishi-original-v2';levels[id-1]=p;
 console.log(`Created level ${id}: ${p.n}×${p.n}`);
}
for(const p of levels){
 // Choose a useful opening clue. Early boards must be solvable by propagation alone.
 let best=null;
 for(const cell of p.solution){
  const initial=Array(p.n*p.n).fill(0);initial[cell]=2;
  const result=solve(model(p.n,p.k,p.regions),{initial,limit:2,maxNodes:p.id<=9?100000:1500});
  const score=result.aborted?100000:result.nodes;
  if(!best||score<best.score)best={cell,score};
  if(score===1)break;
 }
 p.given=best.cell;p.openingSearchNodes=best.score;
 if(p.id<=9&&best.score!==1)throw Error(`Early level ${p.id} requires branching with its opening clue`);
}
fs.writeFileSync(file,JSON.stringify(levels));
fs.writeFileSync(new URL('../dist/levels.js',import.meta.url),'window.LEVELS='+JSON.stringify(levels)+';\n');
console.log('100 opening clues added; early 9 levels need no search branching.');
