// Execute the *existing page renderer* in a bounded DOM projection adapter.
// No source I/O, polling, new claims or model calculations are implemented here.
const fs=require('node:fs'),vm=require('node:vm');
const input=JSON.parse(fs.readFileSync(0,'utf8')),nodes=new Map();
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
class Node {
  constructor(seed=''){this.seed=seed;this.children={};this.dataset={};this.classList={add(){},remove(){}};this.style={setProperty(){}};this.changed=false;}
  set textContent(v){this.html=escape(v);this.changed=true;} get textContent(){return this.html??this.seed;}
  set innerHTML(v){this.html=String(v);this.children={};this.changed=true;} get innerHTML(){return this.html??this.seed;}
  querySelector(tag){if(!this.children[tag])this.children[tag]=new Node();return this.children[tag];}
  addEventListener(){} setAttribute(){} animate(){}
  output(){let html=this.innerHTML;for(const [tag,n] of Object.entries(this.children)){if(n.changed){this.changed=true;html=html.replace(new RegExp('(<'+tag+'(?:\\s[^>]*)?>)[\\s\\S]*?(</'+tag+'>)'),(_,a,b)=>a+n.output()+b);}}return html;}
}
const document={getElementById(id){if(!nodes.has(id))nodes.set(id,new Node(input.seeds[id]||''));return nodes.get(id);},querySelectorAll(){return[];},body:new Node(),documentElement:new Node()};
const window={matchMedia(){return{matches:true};}};
const context=vm.createContext({document,window,console:{log(){}},Date,Number,Math,String,Array,Object,JSON,setTimeout(){},Blob:class{},URL,ResizeObserver:class{}});
vm.runInContext(input.script,context,{timeout:3000});
context.snapshot=input.live;context.evo=input.evolution;
// Archived HTML uses absolute timestamps: it must not look live or create
// repository churn merely because wall-clock time passes.
vm.runInContext("ago=x=>x?String(x):'UNKNOWN';",context);
vm.runInContext('render(snapshot); applyEvolution(evo); renderFranceBinding(snapshot);',context,{timeout:3000});
const out={};for(const [id,n] of nodes){const html=n.output();if(n.changed)out[id]=html;}
process.stdout.write(JSON.stringify(out));
