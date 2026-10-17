import fs from 'node:fs';
const file=new URL('../dist/levels.json',import.meta.url),levels=JSON.parse(fs.readFileSync(file));
if(!levels.every(p=>p.generationIndex)){
 const ranges=[[1,1],[2,3],[4,6],[7,8],[9,9],[10,24],[25,39],[40,59],[60,79],[80,100]],sorted=[];
 for(const [a,b]of ranges){const group=levels.filter(p=>p.id>=a&&p.id<=b).sort((x,y)=>x.verification.nodes-y.verification.nodes);group.forEach((p,i)=>sorted.push({...p,generationIndex:p.id,id:a+i}));}
 fs.writeFileSync(file,JSON.stringify(sorted));
}
const final=JSON.parse(fs.readFileSync(file));fs.writeFileSync(new URL('../dist/levels.js',import.meta.url),'window.LEVELS='+JSON.stringify(final)+';\n');
console.log('Finalized '+final.length+' original levels');

