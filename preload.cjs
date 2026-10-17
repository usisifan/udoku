const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
 load:()=>ipcRenderer.invoke('progress:load'),
 save:data=>ipcRenderer.invoke('progress:save',data),
 fullscreen:()=>ipcRenderer.invoke('window:fullscreen')
});

