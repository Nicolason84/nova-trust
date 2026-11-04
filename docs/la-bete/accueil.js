(() => {
  'use strict';
  const attribution = new URLSearchParams(location.search);
  document.querySelectorAll('[data-track-link]').forEach(link => {
    const url = new URL(link.href, location.href);
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(key => {if(attribution.has(key)) url.searchParams.set(key,attribution.get(key));});
    link.href=url.href;
    link.addEventListener('click',()=>{
      const detail={action:'link_open',destination:url.pathname,surface:'la_bete_home'};
      window.dispatchEvent(new CustomEvent('nova-era:public-navigation',{detail}));
      
    });
  });
})();
