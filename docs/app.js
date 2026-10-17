(() => {
'use strict';
const E=window.PuzzleEngine,levels=window.LEVELS,$=id=>document.getElementById(id),SAVE_KEY='ushishi-puzzle-farm-progress-v2';
const palette=['#32a4e6','#61bc64','#e8be43','#ff8851','#ef5d77','#9164dc','#37bfc2','#e96fab','#5369b6','#98b956','#be8950','#6b9db7','#bc5870','#549c7f','#cd83bf','#8a79aa','#d79c42','#66b8a7','#a66f54','#809663'];
const names=['파랑','초록','노랑','주황','코랄','보라','청록','분홍','남색','연두','황토','회청','자주','진초록','연보라','회보라','호박','민트','갈색','올리브'];
let store={v:1,rounds:{},completed:{},currentLevel:1,sound:false},puzzle,state,paused=false,lastTick=performance.now(),cells=[],focusIndex=0,gesture=null,pendingTap=null,tapTimer=null,toastTimer=null,saveTimer=null,saveErrorShown=false,audio=null,modalKind='',screen='home',zoomed=false,panning=false;
const chapters=[[1,9,'첫 번째 발걸음'],[10,24,'넓어진 목장'],[25,39,'한 번 더 생각하기'],[40,59,'이제 두 마리씩'],[60,79,'깊어지는 퍼즐'],[80,100,'마지막 도전']];
function formatTime(ms){const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function tick(){const now=performance.now();if(state&&state.status==='playing'&&!paused)state.elapsed+=Math.max(0,now-lastTick);lastTick=now;if(state)$('time').textContent=formatTime(state.elapsed);}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
async function persist(){if(!state)return;tick();store.rounds[puzzle.id]={...state,marks:state.marks.slice()};store.currentLevel=puzzle.id;
 try{if(window.desktop)await window.desktop.save(store);else localStorage.setItem(SAVE_KEY,JSON.stringify(store));}
 catch(err){if(!saveErrorShown){saveErrorShown=true;toast('진행 상황을 저장하지 못했어요. 저장 공간을 확인해 주세요.');}}
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,100);}
window.flushGameSave=()=>{cancelTap(true);clearTimeout(saveTimer);return persist();};
function sound(kind){
 if(!store.sound)return;
 try{audio??=new AudioContext();audio.resume();const frequencies=kind==='mistake'?[180]:kind==='won'?[523,659,784]:kind==='mark'?[330]:[660];
 frequencies.forEach((f,i)=>{const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+i*.11;osc.type='sine';osc.frequency.value=f;gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(kind==='mark'?.02:.065,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+.16);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.18);});
 }catch{}
}
function renderRules(){
 document.querySelectorAll('.rule-number').forEach(el=>el.textContent=puzzle.k);
 for(const type of ['row','col','region']){
  const node=$('rule-'+type);node.replaceChildren();
  const starIndices=type==='row'?(puzzle.k===1?[12]:[11,13]):type==='col'?(puzzle.k===1?[12]:[7,17]):(puzzle.k===1?[12]:[6,18]);
  for(let i=0;i<25;i++){const s=document.createElement('span'),r=Math.floor(i/5),c=i%5;
   if(type==='row'&&r===2||type==='col'&&c===2||type==='region'&&(r<4&&c<4))s.className=type;
   if(starIndices.includes(i)){const img=new Image();img.src='assets/ayadan.png';img.alt='';s.append(img);}
   node.append(s);
  }
 }
 const avoid=$('rule-avoid');avoid.replaceChildren();
 for(let i=0;i<9;i++){const s=document.createElement('span');if(i===4){const img=new Image();img.src='assets/ayadan.png';img.alt='';s.append(img);}else s.textContent='×';avoid.append(s);}
}
function colorAssignment(){
 const n=puzzle.n,adj=Array.from({length:n},()=>new Set()),sizes=Array(n).fill(0);puzzle.regions.forEach((g,i)=>{sizes[g]++;for(const j of [i%n<n-1?i+1:-1,i<n*(n-1)?i+n:-1])if(j>=0&&puzzle.regions[j]!==g){adj[g].add(puzzle.regions[j]);adj[puzzle.regions[j]].add(g);}});
 const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>adj[b].size-adj[a].size||sizes[b]-sizes[a]),used=new Set(),result=Array(n);
 const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),distance=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0));
 for(const g of order){let choice=-1,best=-1;for(let c=0;c<n;c++)if(!used.has(c)){let near=Infinity;for(const h of adj[g])if(result[h]!==undefined)near=Math.min(near,distance(rgb(palette[c]),rgb(palette[result[h]])));if(near>best){choice=c;best=near;}}result[g]=choice;used.add(choice);}
 return result;
}
let colors=[];
function createBoard(){
 const board=$('board');board.replaceChildren();zoomed=false;panning=false;$('board-viewport').className='board-viewport';$('board-viewport').style.setProperty('--zoom-size',(puzzle.n*40)+'px');$('zoom-board').textContent='확대';$('zoom-board').setAttribute('aria-pressed','false');$('zoom-board').disabled=puzzle.n<10;$('pan-board').hidden=true;board.style.setProperty('--n',puzzle.n);board.style.setProperty('--gap',puzzle.n>=16?'3px':puzzle.n>=12?'4px':'5px');board.setAttribute('aria-rowcount',puzzle.n);board.setAttribute('aria-colcount',puzzle.n);colors=colorAssignment();cells=[];focusIndex=0;
 for(let i=0;i<puzzle.n*puzzle.n;i++){
  const cell=document.createElement('button');cell.className='cell';cell.type='button';cell.dataset.index=i;cell.setAttribute('role','gridcell');cell.tabIndex=i===0?0:-1;cell.style.setProperty('--region',palette[colors[puzzle.regions[i]]]);
  const cross=document.createElement('span');cross.className='x';cross.setAttribute('aria-hidden','true');const img=new Image();img.src='assets/ayadan.png';img.alt='';img.draggable=false;cell.append(cross,img);board.append(cell);cells.push(cell);
 }
 updateAll();
}
function updateCell(i){
 const mark=state.marks[i],cell=cells[i];cell.dataset.mark=mark;cell.classList.toggle('given',i===E.starter(puzzle));
 cell.setAttribute('aria-label',Math.floor(i/puzzle.n)+1+'행 '+(i%puzzle.n+1)+'열, '+names[colors[puzzle.regions[i]]]+' 구역, '+(i===E.starter(puzzle)?'처음 공개된 아야단':mark===2?'아야단':mark===1?'X 표시':'빈 칸'));
 cell.setAttribute('aria-selected',String(mark===2));
}
function updateHUD(){
 $('level-number').textContent=String(puzzle.id).padStart(3,'0');$('count').textContent=state.marks.filter(v=>v===2).length+' / '+(puzzle.n*puzzle.k);
 $('hearts').innerHTML=Array.from({length:2},(_,i)=>'<span'+(i>=state.lives?' class="heart-lost"':'')+'>♥</span>').join(' ');
 $('life-count').textContent=state.lives+' / 2';$('life-count').setAttribute('aria-label','남은 목숨 '+state.lives+'회');
 $('hint-label').textContent='힌트 '+state.hints+'/1';$('hint').disabled=state.hints===0||state.status!=='playing';$('pause').disabled=state.status!=='playing';
 $('time').textContent=formatTime(state.elapsed);$('sound').dataset.enabled=String(store.sound);$('sound').title=store.sound?'소리 끄기':'소리 켜기';$('sound').setAttribute('aria-label',$('sound').title);
 $('level-note').textContent=puzzle.k===1?'각 줄과 색 구역마다 아야단 한 마리. 대각선도 조심해요!':'각 줄과 색 구역마다 아야단 두 마리. 서로 붙지 않게 놓아 주세요.';
}
function updateAll(){state.marks.forEach((_,i)=>updateCell(i));updateHUD();}
function loadLevel(id,reset=false){
 if(!E.canPlay(id,store.completed,levels.length)){toast('이전 레벨을 먼저 완료해 주세요.');return false;}
 cancelTap(false);clearTimeout(toastTimer);$('toast').classList.remove('visible');$('confetti').replaceChildren();tick();if(state){store.rounds[puzzle.id]={...state,marks:state.marks.slice()};}
 puzzle=levels.find(p=>p.id===id)||levels[0];
 const saved=store.rounds[puzzle.id];state=!reset&&saved&&saved.status==='playing'?E.restore(saved,puzzle):E.create(puzzle);
 paused=false;lastTick=performance.now();$('board-cover').hidden=true;renderRules();createBoard();scheduleSave();return true;
}
function cancelTap(flush=false){
 if(tapTimer)clearTimeout(tapTimer);tapTimer=null;
 if(flush&&pendingTap&&state?.status==='playing'&&!paused){paint(pendingTap.index,state.marks[pendingTap.index]===1?0:1);}
 pendingTap=null;
}
function paint(i,value){if(E.mark(state,i,value)){updateCell(i);scheduleSave();}}
function applyLine(from,to){
 let x0=from%puzzle.n,y0=Math.floor(from/puzzle.n),x1=to%puzzle.n,y1=Math.floor(to/puzzle.n),dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
 for(;;){const i=y0*puzzle.n+x0;if(!gesture.visited.has(i)){paint(i,gesture.value);gesture.visited.add(i);}if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}
}
function hit(e){const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest('.cell');return cell&&$('board').contains(cell)?Number(cell.dataset.index):-1;}
function takeResult(result){
 if(result.type==='ignored')return;
 if(result.type==='mistake'||result.type==='lost'){
  sound('mistake');const cell=cells[result.index];cell.classList.remove('mistake');void cell.offsetWidth;cell.classList.add('mistake');setTimeout(()=>cell.classList.remove('mistake'),850);
  toast(state.lives?'이 칸은 아야단의 자리가 아니에요. 남은 목숨 1회!':'목숨을 모두 사용했어요.');
 }else{
  updateCell(result.index);const cell=cells[result.index];cell.classList.add('pop');setTimeout(()=>cell.classList.remove('pop'),300);sound(result.type==='won'?'won':'placed');
  if(result.hint){cell.classList.add('hinted');setTimeout(()=>cell.classList.remove('hinted'),1700);toast('아야단 한 마리를 찾았어요. 이번 라운드의 힌트를 사용했어요.');}
 }
 updateHUD();scheduleSave();
 const resultState=state;
 if(result.type==='won'){recordWin();confetti();setTimeout(()=>{if(state===resultState)showResult(true);},220);}
 if(result.type==='lost')setTimeout(()=>{if(state===resultState)showResult(false);},450);
}
function place(i){if(paused)return;cancelTap(false);tick();takeResult(E.place(state,puzzle,i));}
function recordWin(){tick();const old=store.completed[puzzle.id];if(!old||state.elapsed<old.elapsed)store.completed[puzzle.id]={hash:puzzle.sha256,elapsed:state.elapsed,lives:state.lives,hintsUsed:1-state.hints,date:new Date().toISOString()};scheduleSave();}
function openModal(html,kind){
 cancelTap(true);gesture=null;tick();paused=true;modalKind=kind;$('board-cover').hidden=false;$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();lastTick=performance.now();scheduleSave();
}
function closeModal(){
 $('modal').close();modalKind='';paused=screen==='home';lastTick=performance.now();$('board-cover').hidden=true;
 if(screen==='home'){updateHome();return;}
 if(state.status!=='playing')showResult(state.status==='won');else cells[focusIndex]?.focus({preventScroll:true});
}
function pauseGame(){if(screen!=='game'||state.status!=='playing'||$('modal').open)return;
 openModal('<div class="modal-inner center"><img class="modal-mascot" src="assets/ayadan.png" alt=""><h2 id="modal-title">잠깐 쉬어가요</h2><p>아야단들이 기다리고 있어요.<br>준비되면 이어서 풀어 주세요.</p><div class="modal-actions"><button class="primary" id="resume-game">계속하기</button><button class="secondary" id="pause-levels">레벨 선택</button></div></div>','pause');
 $('resume-game').onclick=closeModal;$('pause-levels').onclick=openLevels;
}
function updateHome(){
 const done=Object.keys(store.completed).length,next=E.unlocked(store.completed,levels.length);
 $('home-progress-label').textContent=done+' / 100 완료';$('home-next-label').textContent=done===100?'모든 목장의 아야단을 찾았어요!':next+'레벨까지 열렸어요';$('home-progress-bar').style.width=done+'%';
 const continuing=state?.status==='playing'&&(state.elapsed>1000||state.marks.filter(v=>v===2).length>1||state.marks.includes(1));
 $('home-play').innerHTML=(continuing?'이어서 풀기':done?'다음 도전 시작':'게임 시작')+' <span>→</span>';
}
function showHome(){cancelTap(true);tick();persist();paused=true;screen='home';gesture=null;if($('modal').open)$('modal').close();modalKind='';$('game-view').hidden=true;$('home-screen').hidden=false;updateHome();window.scrollTo(0,0);}
function showGame(){screen='game';paused=false;lastTick=performance.now();$('home-screen').hidden=true;$('game-view').hidden=false;$('board-cover').hidden=true;window.scrollTo(0,0);}
function beginGame(){if(state.status!=='playing')loadLevel(E.unlocked(store.completed,levels.length),true);showGame();}
function openLevels(){
 const done=Object.keys(store.completed).length,next=E.unlocked(store.completed,levels.length);
 openModal('<div class="modal-inner"><div class="modal-top"><h2 id="modal-title">차근차근, 다음 목장으로</h2><button class="close-modal" id="close-levels" aria-label="닫기">×</button></div><p>이전 레벨을 완료하면 다음 레벨이 열려요. 풀던 문제는 저장돼요.</p><div class="level-summary"><strong>'+done+' / 100 완료</strong><span class="tiny-label">'+next+'레벨까지 열림</span></div><div class="level-list">'+chapters.map(([a,b,title])=>'<section><div class="chapter-title"><strong>'+title+'</strong><span>'+a+'–'+b+' · '+(a>=40?'각 2마리':'각 1마리')+'</span></div><div class="level-grid">'+Array.from({length:b-a+1},(_,j)=>{const id=a+j,locked=!E.canPlay(id,store.completed,levels.length);return '<button class="level-button'+(store.completed[id]?' done':'')+(id===puzzle.id?' current':'')+(locked?' locked':'')+'" data-level="'+id+'" '+(locked?'disabled ':'')+'aria-label="'+id+'레벨'+(locked?' 잠김':store.completed[id]?' 완료':' 도전 가능')+'">'+id+(locked?'<span class="lock-symbol" aria-hidden="true">🔒</span>':'')+'</button>';}).join('')+'</div></section>').join('')+'</div></div>','levels');
 $('close-levels').onclick=closeModal;
 $('modal-content').querySelectorAll('[data-level]').forEach(btn=>btn.onclick=()=>{const id=Number(btn.dataset.level);if(!E.canPlay(id,store.completed,levels.length))return;$('modal').close();modalKind='';if(loadLevel(id))showGame();});
}
function restartPrompt(){
 openModal('<div class="modal-inner center"><h2 id="modal-title">처음부터 도전할까요?</h2><p>이 라운드의 표시가 모두 지워져요.<br>목숨 2회와 힌트 1회로 새로 시작합니다.</p><div class="modal-actions"><button class="secondary" id="restart-cancel">계속 풀기</button><button class="primary" id="restart-yes">다시 시작</button></div></div>','restart');
 $('restart-cancel').onclick=closeModal;$('restart-yes').onclick=()=>{$('modal').close();loadLevel(puzzle.id,true);};
}
function showResult(won){
 openModal('<div class="modal-inner center"><img class="modal-mascot" src="assets/ayadan.png" alt=""><span class="tiny-label">LEVEL '+String(puzzle.id).padStart(3,'0')+'</span><h2 id="modal-title">'+(won?(puzzle.id===100?'마지막 도전도 성공!':'모두 찾았어요!'):'다시 도전해 볼까요?')+'</h2><p>'+(won?'아야단들이 자기 자리를 찾았어요.':'두 번의 기회를 모두 사용했어요.<br>천천히 살펴보면 분명 찾을 수 있어요.')+'</p><div class="result-stats"><div><span>플레이 시간</span><b>'+formatTime(state.elapsed)+'</b></div><div><span>남은 목숨</span><b>'+state.lives+' / 2</b></div><div><span>힌트 사용</span><b>'+(1-state.hints)+' / 1</b></div></div><div class="modal-actions"><button class="secondary" id="result-levels">레벨 선택</button><button class="primary" id="result-next">'+(won&&puzzle.id<100?'다음 레벨':'다시 도전')+'</button></div></div>','result');
 $('result-levels').onclick=openLevels;$('result-next').onclick=()=>{const next=won&&puzzle.id<100?puzzle.id+1:puzzle.id;$('modal').close();loadLevel(next,true);};
}
function showAbout(){
 openModal('<div class="modal-inner"><div class="modal-top"><h2 id="modal-title">시시의 퍼즐 목장</h2><button class="close-modal" id="close-about" aria-label="닫기">×</button></div><p>우시시와 함께 아야단의 자리를 찾는 논리 퍼즐.</p><ul class="about-list"><li>100개의 문제는 기존 게임의 문제를 가져오지 않고 직접 생성했어요. 모든 문제의 구역 연결성과 정답이 하나임을 검증했습니다.</li><li>4×4부터 차근차근 커져요. 시작할 때 아야단 한 마리를 무료로 공개하며, 이전 레벨을 완료해야 다음 레벨이 열립니다. 1–39레벨은 각 1마리, 40–100레벨은 각 2마리를 찾아요. 레벨이 올라가면 보드가 커집니다.</li><li>드래그하거나 한 번 클릭하면 X를 표시해요. X에서 드래그를 시작하면 표시를 지울 수 있어요. 두 번 클릭하거나 톡톡 누르면 아야단을 놓습니다. 작은 화면의 큰 보드는 확대 후 화면 이동 버튼으로 살펴볼 수 있어요.</li><li>잘못 놓으면 목숨을 1회 잃어요. 찾은 아야단은 다시 지울 수 없어요. 힌트는 라운드마다 한 번 사용할 수 있어요.</li><li><span class="keycap">방향키</span> 이동 · <span class="keycap">X</span> 표시 · <span class="keycap">Enter</span> 아야단 · <span class="keycap">Esc</span> 일시정지 · <span class="keycap">F11</span> 전체 화면</li><li>PC 프로그램은 오프라인에서 실행됩니다. 웹앱은 첫 로딩 후 오프라인으로 이용할 수 있습니다. 기록은 현재 기기·브라우저에 자동 저장되며 서로 동기화되지 않습니다.</li></ul><p style="font-size:11px">캐릭터 원화: 사용자 제공 우시시·아야단 이미지<br>오리지널 퍼즐 100개 · 버전 0.2.0</p></div>','about');$('close-about').onclick=closeModal;
}
function confetti(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const host=$('confetti');host.replaceChildren();for(let i=0;i<36;i++){const el=document.createElement('i');el.style.left=Math.random()*100+'%';el.style.setProperty('--c',palette[i%8]);el.style.setProperty('--d',2+Math.random()*1.8+'s');el.style.setProperty('--r',Math.random()*180+'deg');host.append(el);}setTimeout(()=>host.replaceChildren(),4500);}
function bind(){
 const board=$('board');
 board.addEventListener('pointerdown',e=>{
  if(e.button!==0||paused||panning||state.status!=='playing')return;if(gesture&&e.pointerId!==gesture.pointer){gesture=null;cancelTap(false);return;}const i=hit(e);if(i<0)return;
  e.preventDefault();focusIndex=i;cells.forEach((c,j)=>c.tabIndex=j===i?0:-1);cells[i].focus({preventScroll:true});
  gesture={start:i,last:i,value:state.marks[i]===1?0:1,dragging:false,visited:new Set(),pointer:e.pointerId};board.setPointerCapture(e.pointerId);
 });
 board.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.pointer||paused)return;const i=hit(e);if(i<0||i===gesture.last)return;
  if(!gesture.dragging){cancelTap(true);gesture.dragging=true;sound('mark');}
  applyLine(gesture.last,i);gesture.last=i;
 });
 board.addEventListener('pointerup',e=>{
  if(!gesture||e.pointerId!==gesture.pointer)return;
  const g=gesture;gesture=null;if(board.hasPointerCapture(e.pointerId))board.releasePointerCapture(e.pointerId);
  if(paused||state.status!=='playing')return;
  if(g.dragging){scheduleSave();return;}
  const i=hit(e);if(i!==g.start)return;const now=performance.now();
  if(pendingTap&&pendingTap.index===i&&now-pendingTap.time<350){cancelTap(false);place(i);}
  else{cancelTap(true);pendingTap={index:i,time:now};tapTimer=setTimeout(()=>{if(pendingTap){const idx=pendingTap.index;pendingTap=null;if(!paused){paint(idx,state.marks[idx]===1?0:1);sound('mark');}}},350);}
 });
 board.addEventListener('pointercancel',()=>{gesture=null;cancelTap(false);});
 board.addEventListener('dblclick',e=>e.preventDefault());board.addEventListener('contextmenu',e=>e.preventDefault());
 board.addEventListener('keydown',e=>{
  if(paused||state.status!=='playing')return;const idx=Number(e.target.dataset.index);if(!Number.isInteger(idx))return;let next=idx;
  if(e.key==='ArrowLeft')next=Math.max(0,idx-1);else if(e.key==='ArrowRight')next=Math.min(cells.length-1,idx+1);else if(e.key==='ArrowUp')next=Math.max(0,idx-puzzle.n);else if(e.key==='ArrowDown')next=Math.min(cells.length-1,idx+puzzle.n);else if(e.key==='x'||e.key==='X'){e.preventDefault();cancelTap(false);paint(idx,state.marks[idx]===1?0:1);return;}else if(e.key==='Enter'||e.key===' '){e.preventDefault();place(idx);return;}else return;
  e.preventDefault();focusIndex=next;cells.forEach((c,i)=>c.tabIndex=i===next?0:-1);cells[next].focus({preventScroll:true});
 });
 $('home-play').onclick=beginGame;$('home-levels').onclick=openLevels;$('go-home').onclick=showHome;
 $('zoom-board').onclick=()=>{zoomed=!zoomed;panning=false;$('board-viewport').classList.toggle('is-zoomed',zoomed);$('board-viewport').classList.remove('panning');$('zoom-board').textContent=zoomed?'축소':'확대';$('zoom-board').setAttribute('aria-pressed',String(zoomed));$('pan-board').hidden=!zoomed;$('pan-board').setAttribute('aria-pressed','false');};
 $('pan-board').onclick=()=>{cancelTap(false);gesture=null;panning=!panning;$('board-viewport').classList.toggle('panning',panning);$('pan-board').setAttribute('aria-pressed',String(panning));toast(panning?'보드를 밀어서 이동하세요. 표시하려면 화면 이동을 꺼 주세요.':'이제 칸에 표시할 수 있어요.');};
 $('install-help').onclick=()=>{openModal('<div class="modal-inner"><div class="modal-top"><h2 id="modal-title">홈 화면에서 바로 플레이</h2><button class="close-modal" id="close-install" aria-label="닫기">×</button></div><p><b>아이폰 · 아이패드</b><br>Safari에서 공유 버튼 → 홈 화면에 추가를 눌러 주세요.</p><p><b>안드로이드</b><br>Chrome 메뉴 → 홈 화면에 추가 또는 앱 설치를 눌러 주세요.</p><p>처음 접속해 게임 파일을 받은 뒤에는 오프라인에서도 플레이할 수 있어요. 기록은 기기와 브라우저마다 따로 저장돼요.</p></div>','install');$('close-install').onclick=closeModal;};
 $('menu').onclick=openLevels;$('level-label').onclick=openLevels;$('pause').onclick=pauseGame;$('about').onclick=showAbout;$('restart').onclick=restartPrompt;
 $('hint').onclick=()=>{if(!paused){cancelTap(true);tick();takeResult(E.hint(state,puzzle));}};
 $('sound').onclick=()=>{store.sound=!store.sound;updateHUD();scheduleSave();if(store.sound)sound('placed');};
 $('modal').addEventListener('cancel',e=>{e.preventDefault();if(modalKind!=='result')closeModal();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').open){e.preventDefault();pauseGame();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelTap(true);pauseGame();persist();}});
 window.addEventListener('blur',()=>{if(state?.status==='playing'&&!$('modal').open)pauseGame();});
 window.addEventListener('pagehide',()=>{cancelTap(true);persist();});
 window.addEventListener('beforeunload',()=>{cancelTap(true);persist();});
}
(async()=>{
 try{const saved=window.desktop?await window.desktop.load():JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(saved?.v===1){store={...store,...saved,rounds:saved.rounds&&typeof saved.rounds==='object'?saved.rounds:{},completed:saved.completed&&typeof saved.completed==='object'?saved.completed:{}};}}
 catch{}
 if(!Array.isArray(levels)||levels.length!==100){document.body.textContent='문제 파일을 읽지 못했어요. 프로그램 압축을 다시 풀어 주세요.';return;}
 store.completed=E.validCompletions(store,levels);bind();let initialLevel=Number(store.currentLevel);if(store.completed[initialLevel]&&store.rounds[initialLevel]?.status!=='playing')initialLevel=E.unlocked(store.completed,levels.length);loadLevel(E.canPlay(initialLevel,store.completed,levels.length)?initialLevel:E.unlocked(store.completed,levels.length));showHome();if(window.desktop){$('download-pc').hidden=true;$('install-help').hidden=true;}setInterval(tick,250);setInterval(()=>{if(state.status==='playing'&&!paused)persist();},5000);
 window.__gameReady=true;
})();
})();
