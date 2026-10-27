const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),alerts=[];
function el(s){if(!elements.has(s))elements.set(s,{value:s==='#weeks'?'4':'',innerHTML:'',style:{}});return elements.get(s);}
const context=vm.createContext({console,Date,Set,Map,Number,String,Math,JSON,Array,Object,Blob,URL,setTimeout,alert:m=>alerts.push(m),confirm:()=>true,localStorage:{getItem:()=>null,setItem:()=>{}},document:{querySelector:el,querySelectorAll:()=>[]}});
for(const file of ['rules.js','extras.js','app.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context);
vm.runInContext(`
$('#start').value='2026-11-02';
generate();
if(state.dates.length!==28||allRuleProblems().length)throw Error('Geração inicial');
for(const p of state.people){if(state.dates.filter(d=>date(d).getDay()===0&&state.cells[key(p.id,d)].off).length<2)throw Error('Cota 2');}
const before=JSON.stringify(state.cells),p=state.people[0];
state.specialDates=[{id:1,date:'2026-11-08',name:'Domingo especial',sector:'Caixa',minimum:3,includeSupport:false}];
generate();
if(coverage(state.specialDates[0],state.cells)<3||allRuleProblems().length)throw Error('Mínimo viável');
const preserved=JSON.stringify(state.cells);
state.specialDates[0].minimum=99;generate();
if(JSON.stringify(state.cells)!==preserved)throw Error('Falha destruiu escala');
state.specialDates=[];
let cells={};for(const d of ['2026-11-07','2026-11-08','2026-11-09'])cells[key(p.id,d)]={...p.shifts[0],off:true};
if(!personRules(p,['2026-11-09'],cells).some(s=>s.includes('3 folgas')))throw Error('Três folgas entre semanas');
state.vacations=[{id:1,type:'employee',personId:p.id,from:'2026-11-07',to:'2026-11-09'}];
if(personRules(p,['2026-11-09'],cells).some(s=>s.includes('3 folgas')))throw Error('Férias confundidas com folgas');
state.vacations=[];
cells={};for(const d of ['2026-11-08','2026-11-15','2026-11-22'])cells[key(p.id,d)]={...p.shifts[6],off:false};
p.sundayProfile='female';if(!personRules(p,['2026-11-08','2026-11-15'],cells).some(s=>s.includes('intervalo')))throw Error('Quinzenal');
p.sundayProfile='male';if(!personRules(p,['2026-11-08','2026-11-15','2026-11-22'],cells).some(s=>s.includes('intervalo')))throw Error('Três semanas');
state.specialDates=[{id:2,date:'2026-11-03',name:'Apoio',sector:'Caixa',minimum:1,includeSupport:false}];
state.support[0].sector='Caixa';state.support[0].windows=[{from:'2026-11-03',to:'2026-11-03',days:[1],begin:'10:00',end:'14:00',break:0}];
if(coverage(state.specialDates[0],{})!==0)throw Error('Apoio contado sem autorização');
state.specialDates[0].includeSupport=true;if(coverage(state.specialDates[0],{})!==1)throw Error('Apoio não contado');
state.vacations=[{id:2,type:'support',personId:1,from:'2026-11-03',to:'2026-11-03'}];
if(coverage(state.specialDates[0],{})!==0)throw Error('Apoio em férias contado');
validate(JSON.parse(JSON.stringify(state)));
`,context);
assert(alerts.some(m=>m.includes('supera o total')));
console.log('OK: domingos, intervalos, mínimo viável, falha sem perda, limite entre semanas, férias e apoio opcional.');
