/* Run with Electron and isolated USHISHI_TEST_DATA / USHISHI_TEST_COMMANDS paths. */
const {app,BrowserWindow}=require('electron'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
if(!process.env.USHISHI_TEST_DATA||!process.env.USHISHI_TEST_COMMANDS)throw Error('An isolated test profile and output directory are required');
app.setPath('userData',process.env.USHISHI_TEST_DATA);
const out=process.env.USHISHI_TEST_COMMANDS,root=path.resolve(__dirname,'../dist'),pause=ms=>new Promise(r=>setTimeout(r,ms));
const report={version:'0.4.1',checks:[],errors:[],screenshots:[],started:new Date().toISOString()};
app.whenReady().then(async()=>{
 await fs.mkdir(out,{recursive:true});
 const server=http.createServer(async(req,res)=>{try{if(req.url==='/fixture.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated save fixture</title>');return;}const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),prefix=pathname.startsWith('/udoku/')?'/udoku/':'/ushishi-puzzle-farm/';if(!pathname.startsWith(prefix))throw Error();const file=path.resolve(root,pathname.slice(prefix.length)||'index.html');if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end('Not found');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/udoku/';
 const win=new BrowserWindow({width:390,height:844,show:false,webPreferences:{offscreen:true,backgroundThrottling:false,sandbox:true,contextIsolation:true,nodeIntegration:false}});
 win.webContents.on('console-message',e=>{if(e.level==='error')report.errors.push(e.message);});
 const run=js=>win.webContents.executeJavaScript(js,true),check=(name,value)=>{assert.ok(value,name);report.checks.push(name);};
 await win.loadURL('about:blank');win.webContents.debugger.attach('1.3');const cdp=(method,params={})=>win.webContents.debugger.sendCommand(method,params);
 const media=scheme=>cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:scheme}]});
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await media('dark');
 async function ready(){for(let i=0;i<120;i++){if(await run('Boolean(window.__gameReady)').catch(()=>false))return;await pause(50);}throw Error('Game did not become ready');}
 async function load(address=url){await win.loadURL(address);await ready();await pause(150);}
 async function button(id){await run(`document.getElementById(${JSON.stringify(id)}).click()`);await pause(100);}
 async function shot(name){await pause(220);await fs.writeFile(path.join(out,name),(await win.webContents.capturePage()).toPNG());report.screenshots.push(name);}
 const saved=()=>run(`JSON.parse(localStorage.getItem('ushishi-puzzle-farm-progress-v2'))`);
 async function playCell(i){await run(`document.querySelectorAll('.cell')[${i}].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await pause(70);}
 async function touch(type,point){await cdp('Input.dispatchTouchEvent',{type,touchPoints:point?[{...point,id:1}]:[]});await pause(35);}
 const center=i=>run(`(()=>{const r=document.querySelectorAll('.cell')[${i}].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 try{
  await load();check('System dark mode applies before gameplay',await run(`document.documentElement.dataset.theme==='dark'&&getComputedStyle(document.body).backgroundColor==='rgb(23, 29, 39)'`));
  check('USISI brand, reset, and theme controls on start screen',await run(`document.querySelector('.home-brand').textContent==='USISI'&&Boolean(document.getElementById('reset-progress'))&&document.getElementById('theme-toggle').textContent==='화면: 자동'`));
  check('No Windows download link on homepage',await run(`!document.getElementById('download-pc')&&!Array.from(document.querySelectorAll('a')).some(a=>a.href.includes('/releases'))`));
  check('390px homepage fits width',await run('document.documentElement.scrollWidth===390'));await shot('udoku-home-dark.png');
  await button('home-play');const darkColor=await run(`getComputedStyle(document.querySelector('.cell')).backgroundColor`);
  const a=await center(0),b=await center(3);await touch('touchStart',a);for(let n=1;n<=10;n++)await touch('touchMove',{x:a.x+(b.x-a.x)*n/10,y:a.y});await touch('touchEnd');
  check('Dark-mode touch swipe marks X and preserves free clue',await run(`Array.from(document.querySelectorAll('.cell')).slice(0,4).map(e=>e.dataset.mark).join()==='1,2,1,1'`));
  check('X remains white in dark mode',await run(`getComputedStyle(document.querySelector('.cell[data-mark="1"] .x'),'::before').backgroundColor==='rgb(255, 255, 255)'`));
  await shot('udoku-play-dark.png');await button('go-home');
  await button('theme-toggle');check('Manual dark mode can be selected',await run(`document.getElementById('theme-toggle').textContent==='화면: 어둡게'`));
  await media('light');check('Manual choice overrides system theme',await run(`document.documentElement.dataset.theme==='dark'`));
  await button('theme-toggle');await button('home-play');const lightColor=await run(`getComputedStyle(document.querySelector('.cell')).backgroundColor`);check('Dark tiles differ from bright palette',darkColor!==lightColor);
  await button('go-home');await shot('udoku-home-light.png');await load();check('Theme persists after reload',await run(`document.documentElement.dataset.theme==='light'&&document.getElementById('theme-toggle').textContent==='화면: 밝게'`));
  await button('theme-toggle');await media('dark');await pause(80);check('Automatic theme responds to system changes',await run(`document.documentElement.dataset.theme==='dark'`));
  await button('home-play');for(const i of await run('window.LEVELS[0].solution'))await playCell(i);await pause(250);await button('result-next');await playCell(await run('window.LEVELS[1].solution.find(i=>i!==window.LEVELS[1].given)'));await button('hint');await button('sound');await button('go-home');await run('window.flushGameSave()');
  const before=await saved();check('Test profile has completed and active round state',Boolean(before.completed[1])&&before.currentLevel===2&&before.rounds[2].hints===1);
  await run(`localStorage.setItem('another-game-sentinel','keep');caches.open('another-game-cache').then(c=>c.put('/other-game-sentinel',new Response('keep')))`);
  await button('reset-progress');check('Reset requires confirmation and starts focused on cancel',await run(`document.getElementById('modal').open&&document.activeElement.id==='reset-cancel'`));await shot('udoku-reset-confirm.png');await button('reset-cancel');await run('window.flushGameSave()');const cancelled=await saved();check('Cancel preserves completion, current round and hint use',Boolean(cancelled.completed[1])&&cancelled.currentLevel===2&&cancelled.rounds[2].hints===1);
  // Fault injection is confined to this isolated renderer, to verify rollback on failed persistence.
  await run(`window.__savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='ushishi-puzzle-farm-progress-v2')throw new DOMException('Full','QuotaExceededError');return window.__savedSetItem.call(this,k,v)};void 0`);
  await button('reset-progress');await button('reset-confirm');check('Failed reset keeps old progress and reports error',await run(`!document.getElementById('reset-error').hidden&&JSON.parse(localStorage.getItem('ushishi-puzzle-farm-progress-v2')).currentLevel===2`));await run(`Storage.prototype.setItem=window.__savedSetItem;void 0`);await button('reset-cancel');
  await button('reset-progress');await button('reset-confirm');await run('window.flushGameSave()');const reset=await saved();
  check('Confirmed reset clears only game progress',Object.keys(reset.completed).length===0&&Object.keys(reset.rounds).join()==='1'&&reset.currentLevel===1&&reset.rounds[1].marks.filter(v=>v===2).length===1&&reset.rounds[1].lives===2&&reset.rounds[1].hints===2);
  check('Reset preserves sound, theme and other apps data',reset.sound===before.sound&&await run(`document.documentElement.dataset.theme==='dark'&&localStorage.getItem('another-game-sentinel')==='keep'&&caches.has('another-game-cache')`));
  await load();await button('home-levels');check('Reset persists and locks later levels again',await run(`document.querySelectorAll('[data-level]:not(:disabled)').length===1`));await button('close-levels');
  // Same origin storage survives the switch from the old project path to /udoku/.
  await load(origin+'/ushishi-puzzle-farm/');await button('home-play');await playCell(7);await button('go-home');await load();await button('home-play');check('Existing game progress survives a project-path change',await run(`document.querySelectorAll('.cell')[7].dataset.mark==='2'`));await button('go-home');
  check('Service worker and manifest scoped to udoku',await run(`navigator.serviceWorker.ready.then(r=>r.scope)` )===url&&await run(`fetch('manifest.webmanifest').then(r=>r.json()).then(m=>m.scope==='./'&&m.start_url==='./'&&m.short_name==='udoku')`));
  check('New offline cache includes theme script',await run(`caches.open('udoku-v0.4.1').then(c=>c.match('theme.js')).then(Boolean)`));
  await cdp('Network.enable');await cdp('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await load();check('New dark homepage loads offline',await run(`document.documentElement.dataset.theme==='dark'&&Boolean(document.getElementById('reset-progress'))`));await cdp('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});await pause(120);check('320px screen has no horizontal overflow',await run('document.documentElement.scrollWidth===320'));await shot('udoku-home-small-dark.png');
  // Load an actual pre-update record shape, then exercise migration via the UI.
  const legacy=await run(`(()=>{const p=window.LEVELS[1],marks=Array(p.n*p.n).fill(0);marks[p.given]=2;marks[p.solution.find(i=>i!==p.given)]=2;marks[p.regions.findIndex((_,i)=>!p.solution.includes(i))]=1;return {v:1,currentLevel:2,sound:false,completed:{1:{hash:window.LEVELS[0].sha256,elapsed:90000,lives:1,hintsUsed:1,date:'2026-10-17T00:00:00.000Z'}},rounds:{2:{version:2,level:2,hash:p.sha256,marks,lives:1,hints:1,elapsed:123456,status:'playing'}}};})()`);
  await win.loadURL('about:blank');await win.loadURL(origin+'/fixture.html').catch(()=>{});
  await run(`localStorage.setItem('ushishi-puzzle-farm-progress-v2',${JSON.stringify(JSON.stringify(legacy))})`);await load();await run('window.flushGameSave()');
  const migrated=await saved();check('Legacy unspent hint becomes two without changing progress',migrated.rounds[2].version===4&&migrated.rounds[2].hints===2&&migrated.rounds[2].lives===1&&migrated.rounds[2].elapsed>=123456&&migrated.rounds[2].elapsed<123556&&JSON.stringify(migrated.rounds[2].marks)===JSON.stringify(legacy.rounds[2].marks)&&JSON.stringify(migrated.completed)===JSON.stringify(legacy.completed));
  await button('home-play');check('Updated UI offers two hints',await run(`document.getElementById('hint-label').textContent==='힌트 2/2'&&!document.getElementById('hint').disabled`));
  await button('hint');await button('go-home');await load();await button('home-play');check('First hint stays spent after reload',await run(`document.getElementById('hint-label').textContent==='힌트 1/2'&&!document.getElementById('hint').disabled`));
  await button('hint');await button('go-home');await load();await button('home-play');check('Second hint stays spent and disables further hints',await run(`document.getElementById('hint-label').textContent==='힌트 0/2'&&document.getElementById('hint').disabled`));
  await shot('udoku-two-hints.png');for(const i of await run('window.LEVELS[1].solution'))await playCell(i);await pause(250);await run('window.flushGameSave()');const won=await saved();check('Result and best record count two hint uses',won.completed[2].hintsUsed===2&&await run(`document.querySelector('.result-stats').textContent.includes('2 / 2')`));
  await win.loadURL('about:blank');await win.loadURL(origin+'/fixture.html').catch(()=>{});legacy.rounds[2].hints=0;
  await run(`localStorage.setItem('ushishi-puzzle-farm-progress-v2',${JSON.stringify(JSON.stringify(legacy))})`);await load();await button('home-play');check('Already used legacy hint leaves one extra hint',await run(`document.getElementById('hint-label').textContent==='힌트 1/2'`));await button('hint');await button('go-home');await load();await button('home-play');check('Legacy allowance is not granted again on later reloads',await run(`document.getElementById('hint-label').textContent==='힌트 0/2'&&document.getElementById('hint').disabled`));
  await require('./tier-ui-checks.cjs')({win,run,check,load,button,shot,playCell,saved,cdp,pause,origin});
  check('No renderer errors',report.errors.length===0);report.passed=true;
 }catch(e){report.passed=false;report.failure=e.stack;await shot('failure.png').catch(()=>{});}
 server.close();await fs.writeFile(path.join(out,'web-regression.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.passed?0:1);
});

