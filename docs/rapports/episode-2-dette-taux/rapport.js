(() => {
'use strict';
const params=new URLSearchParams(location.search);
document.querySelectorAll('a').forEach(link=>{const url=new URL(link.href,location.href);if(url.origin!==location.origin)return;['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(key=>{if(params.has(key))url.searchParams.set(key,params.get(key));});link.href=url.href;link.addEventListener('click',()=>{const detail={action:'link_open',report_id:'episode-2',destination:url.pathname};window.dispatchEvent(new CustomEvent('nova-era:public-navigation',{detail}));});});
})();
