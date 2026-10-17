/* Original local-only puzzle game engine. */
(function(root){
'use strict';
const EMPTY=0,X=1,AYADAN=2;
function starter(p){return Number.isInteger(p.given)&&p.solution.includes(p.given)?p.given:p.solution[0];}
function create(p){const marks=Array(p.n*p.n).fill(0);marks[starter(p)]=AYADAN;return {version:2,level:p.id,hash:p.sha256,marks,lives:2,hints:1,elapsed:0,status:'playing'};}
function unlocked(completed,total=100){let next=1;while(next<total&&Object.hasOwn(completed,next)&&completed[next])next++;return next;}
function canPlay(id,completed,total=100){return Number.isInteger(id)&&id>=1&&id<=unlocked(completed,total);}
function validCompletions(saved,levels){const clean={};for(const p of levels){const c=saved?.completed?.[p.id];if(c&&typeof c==='object'&&(c.hash||saved?.rounds?.[p.id]?.hash)===p.sha256&&Number.isFinite(c.elapsed)&&c.elapsed>=0)clean[p.id]={...c,hash:p.sha256};}return clean;}
function finished(s,p){return s.marks.filter(v=>v===AYADAN).length===p.n*p.k;}
function restore(saved,p){
 if(!saved||saved.level!==p.id||saved.hash!==p.sha256||!Array.isArray(saved.marks)||saved.marks.length!==p.n*p.n)return create(p);
 if(!saved.marks.every((v,i)=>[0,1,2].includes(v)&&(v!==2||p.solution.includes(i))))return create(p);
 const s=create(p);s.marks=saved.marks.slice();s.marks[starter(p)]=AYADAN;s.lives=Number.isInteger(saved.lives)?Math.max(0,Math.min(2,saved.lives)):2;s.hints=saved.hints===0?0:1;
 s.elapsed=Number.isFinite(saved.elapsed)?Math.max(0,Math.min(saved.elapsed,31536000000)):0;
 s.status=s.lives===0?'lost':finished(s,p)?'won':'playing';return s;
}
function mark(s,i,value){if(s.status!=='playing'||!Number.isInteger(i)||i<0||i>=s.marks.length||s.marks[i]===2)return false;s.marks[i]=value===1?1:0;return true;}
function place(s,p,i){
 if(s.status!=='playing'||!Number.isInteger(i)||i<0||i>=s.marks.length||s.marks[i]===2)return {type:'ignored'};
 if(!p.solution.includes(i)){s.lives--;if(!s.lives)s.status='lost';return {type:s.status==='lost'?'lost':'mistake',index:i};}
 s.marks[i]=2;if(finished(s,p))s.status='won';return {type:s.status==='won'?'won':'placed',index:i};
}
function hint(s,p){if(s.status!=='playing'||s.hints!==1)return {type:'ignored'};const i=p.solution.find(i=>s.marks[i]!==2);if(i===undefined)return {type:'ignored'};s.hints=0;return {...place(s,p,i),hint:true};}
const api={EMPTY,X,AYADAN,starter,unlocked,canPlay,validCompletions,create,restore,mark,place,hint,finished};if(typeof module!=='undefined')module.exports=api;else root.PuzzleEngine=api;
})(typeof window!=='undefined'?window:globalThis);

