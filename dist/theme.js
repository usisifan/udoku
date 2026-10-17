/* Apply before the first paint to avoid a bright flash on dark phones. */
(()=>{
 const key='udoku-theme-v1',media=matchMedia('(prefers-color-scheme: dark)'),modes=['auto','dark','light'],labels={auto:'자동',dark:'어둡게',light:'밝게'};
 let mode='auto';try{const saved=localStorage.getItem(key);if(modes.includes(saved))mode=saved;}catch{}
 function apply(){
  const theme=mode==='auto'?(media.matches?'dark':'light'):mode;
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#171d27':'#f4f9ff';
  const button=document.getElementById('theme-toggle');if(button){button.textContent='화면: '+labels[mode];button.title='누르면 '+labels[modes[(modes.indexOf(mode)+1)%modes.length]]+' 화면으로 변경';}
 }
 apply();media.addEventListener('change',apply);
 document.addEventListener('DOMContentLoaded',()=>{apply();document.getElementById('theme-toggle')?.addEventListener('click',()=>{mode=modes[(modes.indexOf(mode)+1)%modes.length];try{localStorage.setItem(key,mode);}catch{}apply();});});
})();
