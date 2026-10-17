/* Development-only tier and save-migration checks, using an isolated profile. */
module.exports=async({win,run,check,load,button,shot,playCell,saved,cdp,pause,origin})=>{
 async function fixture(id,mode='fresh'){
  const data=await run(`(()=>{const id=${id},p=window.LEVELS[id-1],completed=Object.fromEntries(window.LEVELS.slice(0,id-1).map(q=>[q.id,{hash:q.sha256,elapsed:90000,lives:1,hintsUsed:1,date:'2026-10-17T00:00:00.000Z'}])),store={v:1,currentLevel:id,sound:false,completed,rounds:{}};
   if(${JSON.stringify(mode)}!=='fresh'){const marks=Array(p.n*p.n).fill(0);marks[p.given]=2;marks[p.regions.findIndex((_,i)=>!p.solution.includes(i))]=1;
    if(['finish','completed'].includes(${JSON.stringify(mode)})){for(const i of p.solution)marks[i]=2;if(${JSON.stringify(mode)}==='finish')marks[window.PuzzleEngine.starters(p).find(i=>i!==p.given)]=0;else completed[id]={hash:p.sha256,elapsed:70000,lives:1,hintsUsed:2,date:'2026-10-17T00:00:00.000Z'};}
    store.rounds[id]={version:3,level:id,hash:p.sha256,marks,lives:1,hints:0,elapsed:70000,status:'playing'};
    if(['v041','v042'].includes(${JSON.stringify(mode)})){const older=${JSON.stringify(mode)}==='v041',oldHints=(id<60?5:id<80?6:7)-(older?1:0),oldCount=(id<60?4:id<80?5:6)-(older?1:0),oldOpening=window.PuzzleEngine.starters(p).slice(0,oldCount);for(const i of oldOpening)marks[i]=2;Object.assign(store.rounds[id],{version:4,lives:2,lifeLimit:3,hints:older?0:1,hintLimit:oldHints});}}
   return store;})()`);
  await win.loadURL('about:blank');await win.loadURL(origin+'/fixture.html');
  await run(`localStorage.setItem('ushishi-puzzle-farm-progress-v2',${JSON.stringify(JSON.stringify(data))})`);await load();return data;
 }
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const [id,hints,lives,opening] of [[39,2,2,1],[40,5,3,5],[59,5,3,5],[60,6,4,6],[79,6,4,6],[80,7,4,8],[100,7,4,8]]){
  await fixture(id);check('Level '+id+' home describes its allowance',await run(`document.getElementById('home-bubble').textContent.startsWith('${opening}마리')&&!document.getElementById('home-life-label')&&!document.getElementById('home-hearts')&&document.getElementById('home-hint-label').textContent.includes('${hints}회')&&!document.getElementById('home-play').textContent.includes('이어서')`));
  await button('home-play');
  check('Level '+id+' board displays correct counters and free clues',await run(`document.getElementById('hint-label').textContent==='힌트 ${hints}/${hints}'&&document.getElementById('hint-limit').textContent==='라운드당 ${hints}회'&&document.getElementById('life-count').textContent==='${lives} / ${lives}'&&document.querySelectorAll('#hearts span').length===${lives}&&document.querySelectorAll('.cell.given').length===${opening}&&document.querySelectorAll('.cell[data-mark="2"]').length===${opening}&&document.getElementById('opening-note').textContent==='시작 아야단 ${opening}마리 공개'&&document.getElementById('guide-copy').textContent.includes('${opening}마리')`));
  if([40,60,80].includes(id))await shot('udoku-level-'+id+'-opening.png');
  const wrong=await run(`window.LEVELS[${id-1}].regions.findIndex((_,i)=>!window.LEVELS[${id-1}].solution.includes(i))`);
  await button('hint');await playCell(wrong);await button('go-home');await load();await button('home-play');
  check('Level '+id+' spent resources survive reload',await run(`document.getElementById('hint-label').textContent==='힌트 ${hints-1}/${hints}'&&document.getElementById('life-count').textContent==='${lives-1} / ${lives}'`));
  await button('restart');check('Level '+id+' restart describes its own allowance',await run(`document.getElementById('modal-content').textContent.includes('목숨 ${lives}회와 힌트 ${hints}회')&&document.getElementById('modal-content').textContent.includes('아야단 ${opening}마리')`));await button('restart-yes');
  check('Level '+id+' retry restores its exact allowance',await run(`document.getElementById('hint-label').textContent==='힌트 ${hints}/${hints}'&&document.getElementById('life-count').textContent==='${lives} / ${lives}'&&document.querySelectorAll('.cell[data-mark="2"]').length===${opening}`));
 }
 // Final tier: all seven hints, four mistakes, and consistent result counters.
 for(let i=0;i<7;i++)await button('hint');check('Seven hints exhaust the last tier',await run(`document.getElementById('hint-label').textContent==='힌트 0/7'&&document.getElementById('hint').disabled`));
 const wrong=await run('window.LEVELS[99].regions.findIndex((_,i)=>!window.LEVELS[99].solution.includes(i))');for(let i=0;i<4;i++)await playCell(wrong);await pause(500);
 check('Four mistakes end the last tier with correct result totals',await run(`document.getElementById('modal-title').textContent==='다시 도전해 볼까요?'&&document.querySelector('.result-stats').textContent.includes('0 / 4')&&document.querySelector('.result-stats').textContent.includes('7 / 7')`));
 for(const [id,hints,lives,opening] of [[40,5,3,5],[60,6,4,6],[80,7,4,8]]){
  const old=await fixture(id,'legacy');await run('window.flushGameSave()');let current=await saved();
  check('Legacy level '+id+' preserves history and grants only the increase',current.rounds[id].version===4&&current.rounds[id].hints===hints-2&&current.rounds[id].lives===lives-1&&current.rounds[id].marks.filter(v=>v===2).length===opening&&current.rounds[id].marks[old.rounds[id].marks.indexOf(1)]===1&&current.rounds[id].elapsed>=70000&&current.rounds[id].elapsed<70100&&JSON.stringify(current.completed)===JSON.stringify(old.completed));
  await load();current=await saved();check('Legacy level '+id+' does not refill again',current.rounds[id].hints===hints-2&&current.rounds[id].lives===lives-1);
 }
 for(const id of [40,60,80]){
  const old=await fixture(id,'v041');await run('window.flushGameSave()');let current=await saved();
  check('v0.4.1 level '+id+' gains exactly one hint with history and mistakes preserved',current.rounds[id].hints===1&&current.rounds[id].hintLimit===old.rounds[id].hintLimit+1&&current.rounds[id].lives===(id<60?2:3)&&current.rounds[id].marks.filter(v=>v===2).length===(id<60?5:id<80?6:8)&&current.rounds[id].elapsed>=70000&&current.rounds[id].elapsed<70100&&JSON.stringify(current.completed)===JSON.stringify(old.completed));
  await load();check('v0.4.1 level '+id+' increase is not duplicated by reload',(await saved()).rounds[id].hints===1);
  await button('home-play');await button('hint');await button('go-home');await load();check('v0.4.1 level '+id+' extra hint stays spent',(await saved()).rounds[id].hints===0);
 }
 for(const id of [40,60,80]){
  const old=await fixture(id,'v042');await run('window.flushGameSave()');let current=await saved();
  check('v0.4.2 level '+id+' keeps spent hints and adds only new lives and openings',current.rounds[id].hints===1&&current.rounds[id].hintLimit===old.rounds[id].hintLimit&&current.rounds[id].lives===(id<60?2:3)&&current.rounds[id].lifeLimit===(id<60?3:4)&&current.rounds[id].marks.filter(v=>v===2).length===(id<60?5:id<80?6:8)&&current.rounds[id].elapsed>=70000&&current.rounds[id].elapsed<70100&&JSON.stringify(current.completed)===JSON.stringify(old.completed));
  await load();current=await saved();check('v0.4.2 level '+id+' life increase does not repeat on reload',current.rounds[id].hints===1&&current.rounds[id].lives===(id<60?2:3));
  await button('home-play');const wrong=await run(`window.LEVELS[${id-1}].regions.findIndex((_,i)=>!window.LEVELS[${id-1}].solution.includes(i))`);await playCell(wrong);await button('hint');await button('go-home');await load();current=await saved();check('v0.4.2 level '+id+' new mistake and hint use remain spent',current.rounds[id].hints===0&&current.rounds[id].lives===(id<60?1:2));
 }
 await fixture(40,'finish');await run('window.flushGameSave()');const complete=await saved();
 check('A newly revealed final clue records completion and preserves elapsed time',complete.completed[40]?.hintsUsed===2&&complete.completed[40].elapsed>=70000&&complete.completed[40].elapsed<70100&&complete.rounds[40].status==='won');
 await button('home-play');check('Migration-completed round unlocks the next level',await run(`document.getElementById('level-number').textContent==='041'`));
 await fixture(100);await button('home-play');await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});await pause(100);
 check('Last tier fits a 320px phone viewport',await run('document.documentElement.scrollWidth===320'));
 check('Narrow header counters stay inside the bar on one line',await run(`(()=>{const bar=document.querySelector('.statusbar').getBoundingClientRect(),nodes=[document.getElementById('level-number'),document.querySelector('.level-label small'),document.getElementById('count'),document.getElementById('hearts')];return nodes.every(el=>{const r=el.getBoundingClientRect();return r.left>=bar.left&&r.right<=bar.right&&r.top>=bar.top&&r.bottom<=bar.bottom})&&document.getElementById('count').getBoundingClientRect().height<25;})()`));
 await shot('udoku-level-100-small.png');await button('go-home');await shot('udoku-tier-home-small.png');
 // Completion proof must come from a saved win, never from merely unlocking 100.
 await fixture(99);await button('home-levels');
 check('Locked final level has no completion star',await run(`(()=>{const b=document.querySelector('[data-level="100"]');return b.disabled&&!b.classList.contains('final-cleared')&&b.querySelector('.final-status').textContent==='잠김';})()`));
 await fixture(100);await button('home-levels');
 check('Unlocked final level explicitly remains incomplete',await run(`(()=>{const b=document.querySelector('[data-level="100"]');return !b.disabled&&!b.classList.contains('done')&&!b.classList.contains('final-cleared')&&b.querySelector('.final-status').textContent==='미완료';})()`));
 await button('close-levels');await button('home-play');
 check('Redundant footer sentence is removed but navigation remains',await run(`!document.getElementById('level-note')&&document.querySelector('.footnote').textContent.trim()==='첫 화면게임 안내'`));
 const solution=await run('window.LEVELS[99].solution.filter(i=>!window.PuzzleEngine.starters(window.LEVELS[99]).includes(i))');for(const i of solution.slice(0,-1))await playCell(i);
 await button('go-home');await button('home-levels');
 check('One missing final Ayadan still has no completion star',await run(`!document.querySelector('[data-level="100"]').classList.contains('final-cleared')`));
 await button('close-levels');await button('home-play');await playCell(solution.at(-1));await pause(400);await run('window.flushGameSave()');
 check('Last correct placement saves an actual level 100 win',Boolean((await saved()).completed[100]));await button('result-levels');
 const hasBadge=`(()=>{const b=document.querySelector('[data-level="100"]');return b.classList.contains('final-cleared')&&b.querySelector('.final-status').textContent==='★ 클리어 완료'&&b.getAttribute('aria-label')==='100레벨 클리어 완료';})()`;
 check('Final clear badge appears immediately after winning',await run(hasBadge));
 await run(`document.querySelector('[data-level="100"]').scrollIntoView({block:'end'})`);
 check('Final badge fits inside its tile at 320px',await run(`(()=>{const b=document.querySelector('[data-level="100"]'),r=b.getBoundingClientRect(),t=b.querySelector('.final-status').getBoundingClientRect();return t.left>=r.left&&t.right<=r.right&&t.bottom<=r.bottom&&document.documentElement.scrollWidth===320;})()`));await shot('udoku-100-cleared-dark.png');
 await load();await button('home-levels');check('Final clear badge survives reload',await run(hasBadge));
 await button('close-levels');await button('home-play');await button('go-home');await button('home-levels');check('Replaying level 100 retains its completion badge',await run(hasBadge));
 await fixture(100,'completed');await button('home-levels');check('Existing pre-update level 100 completion also receives the badge',await run(hasBadge));
 await button('close-levels');await button('theme-toggle');await button('theme-toggle');await button('home-levels');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await run(`document.querySelector('[data-level="100"]').scrollIntoView({block:'end'})`);await shot('udoku-100-cleared-light.png');
 await button('close-levels');await button('reset-progress');await button('reset-confirm');await button('home-levels');check('Explicit progress reset also removes the completion badge',await run(`!document.querySelector('[data-level="100"]').classList.contains('final-cleared')&&document.querySelector('[data-level="100"]').disabled`));
};
