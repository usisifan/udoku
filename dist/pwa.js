(()=>{
 if(window.desktop||!/^https?:$/.test(location.protocol))return;
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
 let prompt=null;const button=document.getElementById('home-install');
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;button.hidden=false;});
 button.addEventListener('click',async()=>{if(!prompt)return;await prompt.prompt();await prompt.userChoice;prompt=null;button.hidden=true;});
 window.addEventListener('appinstalled',()=>{prompt=null;button.hidden=true;});
})();
