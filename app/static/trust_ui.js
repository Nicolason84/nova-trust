function el(id){ return document.getElementById(id); }
function getParam(name){ var u=new URL(window.location.href); return u.searchParams.get(name); }
function setParam(name, value){ var u=new URL(window.location.href); u.searchParams.set(name, value); history.replaceState(null, "", u.toString()); }
function trackUse(){ var n=Number(localStorage.getItem("nova_trust_uses")||0)+1; localStorage.setItem("nova_trust_uses", n); if(el("usage_count")) el("usage_count").textContent=n; }
function refreshUsage(){ var n=Number(localStorage.getItem("nova_trust_uses")||0); if(el("usage_count")) el("usage_count").textContent=n; }
function txt(v, fb){ return (v === undefined || v === null || v === "") ? (fb || "—") : String(v); }
function cls(v){ v = String(v || "").toUpperCase(); if (v === "SAFE") return "safe"; if (v === "ACT") return "act"; if (v === "WAIT") return "wait"; if (v === "RISKY") return "risky"; return ""; }
function getJSON(url, ok, ko){ var x = new XMLHttpRequest(); x.open("GET", url, true); x.onreadystatechange = function(){ if (x.readyState !== 4) return; if (x.status >= 200 && x.status < 300){ try { ok(JSON.parse(x.responseText)); } catch(e){ ko("JSON parse error: " + e); } } else { ko("HTTP " + x.status + " " + x.responseText); } }; x.send(); }
function setBar(id, score, verdict){ var n=Number(score||0); var bar=el(id); if(!bar) return; bar.style.width=Math.max(0,Math.min(100,n))+"%"; bar.className="score-fill "+cls(verdict||"ACT"); }

function copyText(text){ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text); } }

function renderLive(j){ el("status").textContent = txt(j.status || (j.ok ? "LIVE" : "DOWN")); el("app").textContent = txt(j.app || j.key); el("cash").textContent = txt(j.cash); el("payments").textContent = txt(j.payments); el("business_score").textContent = txt(j.score); setBar("business_bar", j.score, "ACT"); el("live_json").textContent = JSON.stringify(j, null, 2); }
function renderHistory(items){ var box = el("history"); if (items && items.length){ box.innerHTML = ""; for (var i = 0; i < items.length; i++){ (function(item){ var div = document.createElement("div"); div.className = "history-item " + cls(item.fusion_verdict); div.innerHTML = "<div><strong class=\"" + cls(item.fusion_verdict) + "\">" + txt(item.fusion_verdict) + "</strong> <span class=\"mini\">· " + txt(item.ts) + "</span></div><div class=\"mini\">Fusion " + txt(item.fusion_score) + " · Analyse " + txt(item.analysis_score) + " · Business " + txt(item.business_score) + "</div><div style=\"margin-top:6px\">" + txt(item.input, "") + "</div>"; div.onclick = function(){ var all = document.querySelectorAll(".history-item"); for (var k = 0; k < all.length; k++){ all[k].classList.remove("active-history"); } div.classList.add("active-history"); el("target").value = item.input || ""; el("target").focus(); runFusion(); }; box.appendChild(div); })(items[i]); } } else { box.innerHTML = "<div class=\"mini\">Aucun historique pour le moment.</div>"; } }
function pulseVerdict(node){ node.classList.remove("verdict-pop"); void node.offsetWidth; node.classList.add("verdict-pop"); }
function loadLive(){ getJSON("/api/trust/live?ts=" + Date.now(), renderLive, function(err){ el("live_json").textContent = err; }); }
function loadHistory(){ getJSON("/api/trust/history?ts=" + Date.now(), function(j){ renderHistory(j.items || []); }, function(err){ el("history").innerHTML = "<div class=\"mini\">" + err + "</div>"; }); }
function runFusion(){ var q = el("target").value || ""; setParam("q", q); trackUse(); getJSON("/api/trust/fuse?q=" + encodeURIComponent(q), function(j){ el("analysis_score").textContent = txt(j.analysis_score); el("fusion_score").textContent = txt(j.fusion_score); var fv = el("fusion_verdict"); fv.textContent = txt(j.fusion_verdict); fv.className = "v " + cls(j.fusion_verdict); pulseVerdict(fv); setBar("fusion_bar", j.fusion_score, j.fusion_verdict); el("rationale").textContent = JSON.stringify(j.rationale || [], null, 2); el("fusion_json").textContent = JSON.stringify(j, null, 2); renderHistory(j.history || []); }, function(err){ el("fusion_json").textContent = err; }); }
window.addEventListener("DOMContentLoaded", function(){

setTimeout(function(){
  if(el("target")){
    el("target").focus();
    el("target").select();
  }
}, 300);

// autoFocusLanding
 el("run").onclick = runFusion; el("refresh").onclick = function(){ loadLive(); loadHistory(); }; el("target").addEventListener("paste", function(){ setTimeout(runFusion, 120); });
if (el("share_btn")){ el("share_btn").onclick=function(){ var q=el("target").value||""; var url=window.location.origin + "/trust?q=" + encodeURIComponent(q); if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url); } }; }
refreshUsage();
var q=getParam("q"); if(q){ el("target").value=q; setTimeout(runFusion, 180); } loadLive(); loadHistory(); setInterval(loadLive, 10000); });