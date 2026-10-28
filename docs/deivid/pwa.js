'use strict';
(function(){
const button=document.getElementById('install-app'),dialog=document.getElementById('install-dialog');
let installEvent=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;button.textContent='Instalar Deivid';});
button.addEventListener('click',async()=>{if(installEvent){await installEvent.prompt();installEvent=null;}else dialog.showModal();});
if(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone)button.hidden=true;
if('serviceWorker' in navigator&&location.protocol==='https:'&&location.hostname==='nicolason84.github.io'){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});});}
})();
