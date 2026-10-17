const {app,BrowserWindow,ipcMain,Menu,session}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');const {pathToFileURL}=require('node:url');
app.setAppUserModelId('com.ushishi.puzzlefarm');
app.setName('시시의 퍼즐 목장');
if(process.env.USHISHI_TEST_DATA)app.setPath('userData',process.env.USHISHI_TEST_DATA);
let win,saveQueue=Promise.resolve(),quitting=false;
const primaryInstance=app.requestSingleInstanceLock();
if(!primaryInstance)app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
const entry=path.join(__dirname,'dist','index.html');
const trusted=e=>e.senderFrame?.url===pathToFileURL(entry).href;
async function loadSave(){try{return JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'progress.json'),'utf8'));}catch{return null;}}
async function replaceSave(tmp,file){
 // Windows scanners can briefly lock the destination. Preserve the old save and retry.
 for(let attempt=0;;attempt++)try{await fs.rename(tmp,file);return;}catch(error){
  if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=4)throw error;
  await new Promise(resolve=>setTimeout(resolve,50*2**attempt));
 }
}
function save(data){
 const json=JSON.stringify(data);if(json.length>2000000)throw Error('Save too large');
 saveQueue=saveQueue.catch(()=>{}).then(async()=>{const dir=app.getPath('userData');await fs.mkdir(dir,{recursive:true});const tmp=path.join(dir,'progress.tmp');await fs.writeFile(tmp,json,'utf8');await replaceSave(tmp,path.join(dir,'progress.json'));});
 return saveQueue;
}
app.whenReady().then(()=>{
 if(!primaryInstance)return;
 Menu.setApplicationMenu(null);
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:/i.test(details.url)}));
 ipcMain.handle('progress:load',e=>trusted(e)?loadSave():null);
 ipcMain.handle('progress:save',(e,data)=>{if(!trusted(e)||!data||data.v!==1)throw Error('Invalid save');return save(data);});
 ipcMain.handle('window:fullscreen',e=>{if(trusted(e))win.setFullScreen(!win.isFullScreen());});
 win=new BrowserWindow({width:1160,height:960,minWidth:760,minHeight:720,title:'시시의 퍼즐 목장',backgroundColor:'#f5faff',icon:path.join(__dirname,'dist','assets','icon.ico'),show:false,
  webPreferences:{backgroundThrottling:!process.env.USHISHI_HEADLESS_TEST,offscreen:Boolean(process.env.USHISHI_HEADLESS_TEST),preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(event,url)=>{if(url!==pathToFileURL(entry).href)event.preventDefault();});
 win.webContents.on('before-input-event',(e,input)=>{if(input.type==='keyDown'&&input.key==='F11'){e.preventDefault();win.setFullScreen(!win.isFullScreen());}});
 win.once('ready-to-show',()=>{if(!process.env.USHISHI_HEADLESS_TEST)win.show();});
 win.on('close',event=>{
  if(quitting)return;event.preventDefault();
  win.webContents.executeJavaScript('window.flushGameSave ? window.flushGameSave() : null').catch(()=>{}).finally(()=>saveQueue.catch(()=>{}).finally(()=>{quitting=true;win.close();}));
 });
 win.loadFile(entry);
 if(!app.isPackaged&&process.env.USHISHI_TEST_COMMANDS)require('./scripts/electron-test-driver.cjs')(win,app);
});
app.on('window-all-closed',()=>app.quit());

