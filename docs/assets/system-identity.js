(async function(){
  const root=document.documentElement;
  const endpoint=root.dataset.identityUrl||"";
  if(!endpoint)return;
  let identity;
  try{const response=await fetch(endpoint,{cache:"no-store"});if(!response.ok)throw Error(response.status);identity=await response.json();}
  catch(error){document.querySelectorAll("[data-identity-error]").forEach(n=>n.hidden=false);return;}
  const palette=identity.artistic_identity.palette||{};
  const paletteVars={night:"--supra-night",signal_red:"--supra-red",patinated_copper:"--supra-amber",milk_glass:"--supra-glass",fog_light:"--supra-fog"};
  for(const [key,name] of Object.entries(paletteVars)){if(palette[key])root.style.setProperty(name,palette[key]);}
  document.querySelectorAll("[data-identity-name]").forEach(n=>n.textContent=identity.artistic_identity.name);
  document.querySelectorAll("[data-identity-art]").forEach(img=>{if(identity.artistic_identity.image_asset)img.src=new URL(identity.artistic_identity.image_asset,document.baseURI).href;});
  document.querySelectorAll("[data-track-title]").forEach(n=>n.textContent=identity.music.title+" · "+identity.music.artist);
  document.querySelectorAll("[data-track-link]").forEach(n=>{n.href=identity.music.track_url;n.target="_blank";n.rel="noopener noreferrer";});
  document.querySelectorAll("[data-track-play]").forEach(button=>button.addEventListener("click",()=>{
    const host=button.closest("[data-track]");if(!host||host.querySelector("iframe"))return;
    if(identity.music.playback!=="click_to_load")return;
    const frame=document.createElement("iframe");frame.src=identity.music.embed_url+"?theme=0";
    frame.title=identity.music.title+" — "+identity.music.artist+" · Spotify";
    frame.loading="lazy";frame.referrerPolicy="no-referrer";
    frame.allow="encrypted-media; clipboard-write; fullscreen; picture-in-picture";
    host.appendChild(frame);button.setAttribute("aria-pressed","true");button.textContent="Lecteur prêt";
  }));
})();