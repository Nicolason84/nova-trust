/* Recovered from gazole-qui-finance-2026-09-20.html; one arithmetic owner for both views. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OJOCashModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function createOJOCashModel(){
'use strict';
// OJO Gazole 1.0 — illustrative cash calendar, not a statutory accounting engine.
const DEFAULTS=Object.freeze({sales:300000,fuel:25,other:40,surplus:3.5,activity:50,rise:40,duration:30,index:40,weight:25,cycle:30,client:30,bill:0,late:0,fuelDays:7,otherDays:15,surchargeLag:0,capacity:0,empty:0,cash:300000,credit:0,vat:1,vatLag:20,otherVat:50,rate:8,exceptional:0,flex:100});
const RULES={sales:[1000,10000000],fuel:[0,60],other:[0,90],surplus:[-10,30],activity:[0,150],rise:[0,150],duration:[1,90],index:[0,150],weight:[0,60],cycle:[1,30],client:[0,30],bill:[0,30],late:[0,60],fuelDays:[0,90],otherDays:[0,90],surchargeLag:[0,60],capacity:[0,100],empty:[0,50],cash:[0,5000000],credit:[0,5000000],vat:[0,1],vatLag:[0,60],otherVat:[0,100],rate:[0,30],exceptional:[0,1000000],flex:[0,100]};
const INTS=['duration','cycle','client','bill','late','fuelDays','otherDays','surchargeLag','vat','vatLag'];
function validate(p){for(const [k,[lo,hi]] of Object.entries(RULES)){if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error('Valeur hors limites : '+k);}for(const k of INTS)if(!Number.isInteger(p[k]))throw Error('Nombre entier requis : '+k);if(p.fuel+p.other+p.surplus>100)throw Error('Carburant + autres variables + surplus doivent rester ≤ 100 %.');return true;}
const endCycle=(d,n)=>Math.floor((d-1)/n)*n+n;
function simulate(p,stress=true){
 validate(p);const H=180,START=-360,LAST=H+240,M=LAST-START+1;
 const events=Array.from({length:M},()=>({in:0,fuel:0,other:0,fixed:0,tax:0,exceptional:0,taxBase:0}));
 const add=(d,k,n)=>{if(d>=START&&d<=LAST)events[d-START][k]+=n;};
 const at=d=>events[d-START];
 let profit=0,rev=0,fuelExpense=0,surcharge=0,otherExpense=0,fixedExpense=0;
 const vatRate=p.vat?0.2:0,dt=p.sales/30,ff=p.fuel/100,ov=p.other/100,fx=1-ff-ov-p.surplus/100;
 for(let d=START;d<=H;d++){
  const hit=stress&&d>=1&&d<=p.duration,q=hit?1+p.activity/100:1,h=hit?p.rise/100:0;
  const base=dt*q,extra=hit?base*p.weight/100*p.index/100:0;
  const f=dt*ff*q*(1+h)*(hit?1+p.empty/100:1);
  const o=dt*ov*(q+(hit?(q-1)*p.capacity/100:0)),fixed=dt*fx*(1+(hit?(q-1)*p.flex/100:0));
  const invoice=endCycle(d,p.cycle)+p.bill,pay=invoice+p.client+(hit?p.late:0),payExtra=pay+(hit?p.surchargeLag:0);
  add(pay,'in',base*(1+vatRate));add(pay,'taxBase',base*vatRate);
  add(payExtra,'in',extra*(1+vatRate));add(payExtra,'taxBase',extra*vatRate);
  add(d+p.fuelDays,'fuel',f*(1+vatRate));add(d+p.fuelDays,'taxBase',-f*vatRate);
  const otherTax=o*vatRate*p.otherVat/100;
  add(d+p.otherDays,'other',o+otherTax);add(d+p.otherDays,'taxBase',-otherTax);
  add(endCycle(d,30),'fixed',fixed);
  if(d>=1&&d<=p.duration){rev+=base+extra;fuelExpense+=f;surcharge+=extra;otherExpense+=o;fixedExpense+=fixed;profit+=base+extra-f-o-fixed;}
 }
 if(stress)add(15,'exceptional',p.exceptional);
 // VAT uses receipts/payment dates by explicit convention. Credits carried, never paid out automatically.
 let creditTax=0;
 for(let end=START+30;end<=LAST;end+=30){let net=0;for(let d=end-29;d<=end;d++){if(d>=START&&d<=LAST)net+=at(d).taxBase;}net-=creditTax;creditTax=Math.max(0,-net);add(end+p.vatLag,'tax',Math.max(0,net));}
 let balance=p.cash,min=p.cash,minDay=0,interest=0;const rows=[{day:0,cash:balance,in:0,fuel:0,other:0,fixed:0,tax:0,exceptional:0,out:0}];
 for(let d=1;d<=H;d++){const e=at(d),out=e.fuel+e.other+e.fixed+e.tax+e.exceptional;interest+=Math.max(0,-balance)*p.rate/100/365;balance+=e.in-out;if(balance<min){min=balance;minDay=d;}rows.push({day:d,cash:balance,...e,out});}
 return {rows,min,minDay,need:Math.max(0,-min),unfunded:Math.max(0,-min-p.credit),interest,profit,rev,surcharge,fuelExpense,otherExpense,fixedExpense,final:balance};
}
function compare(p){const base=simulate(p,false),stress=simulate(p,true);let gap=0,gapDay=0;for(let d=0;d<stress.rows.length;d++){const g=base.rows[d].cash-stress.rows[d].cash;if(g>gap){gap=g;gapDay=d;}}return {p,base,stress,gap,gapDay};}
function pump(p0=1.691,p1=2.405,litres=50000,volume=50){const q=1+volume/100;return {before:p0*litres,after:p1*litres*q,pricePct:(p1/p0-1)*100,billPct:(p1*q/p0-1)*100,volumeEffect:p0*litres*(q-1),priceEffect:(p1-p0)*litres,interaction:(p1-p0)*litres*(q-1),extra:p1*litres*q-p0*litres};}

for(const range of Object.values(RULES))Object.freeze(range);Object.freeze(RULES);Object.freeze(INTS);
function methodSource(){return JSON.stringify({DEFAULTS,RULES,INTS})+'\n'+[validate,simulate,compare,endCycle].map(f=>f.toString()).join('\n');}
function standaloneSource(){return 'window.OJOCashModel=('+createOJOCashModel.toString()+')();';}
return Object.freeze({DEFAULTS,RULES,INTS,validate,simulate,compare,pump,endCycle,methodID:'OJO_GAZOLE_1.0',methodSource,standaloneSource});
});
