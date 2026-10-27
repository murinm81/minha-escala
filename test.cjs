// Execute com: node test.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map();
function el(selector){if(!elements.has(selector))elements.set(selector,{value:selector==='#weeks'?'4':'',innerHTML:'',style:{},files:[]});return elements.get(selector)}
const context=vm.createContext({console,Date,Set,Map,Number,String,Math,JSON,Array,Object,Blob,URL,setTimeout,alert:()=>{},confirm:()=>true,localStorage:{getItem:()=>null,setItem:()=>{}},document:{querySelector:el,querySelectorAll:()=>[]}});
vm.runInContext(fs.readFileSync(__dirname+'/rules.js','utf8'),context);
vm.runInContext(fs.readFileSync(__dirname+'/extras.js','utf8'),context);
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),context);
vm.runInContext(`
$('#start').value='2026-11-02'; generate();
if(state.people.length!==14)throw Error('Cadastro inicial');
if(state.dates.length!==28)throw Error('Período');
for(const p of state.people)for(let w=0;w<4;w++){
 const days=state.dates.slice(w*7,w*7+7);
 if(days.filter(d=>state.cells[key(p.id,d)].off).length!==2)throw Error('5x2');
}
for(const g of groups())for(const d of state.dates){
 if(new Set(g.map(p=>state.cells[key(p.id,d)].off)).size!==1)throw Error('Vínculo');
}
if(duration({begin:'17:00',end:'00:00',break:60,off:false})!==6)throw Error('Meia-noite');
if(duration({begin:'07:30',end:'16:30',break:60,off:false})!==8)throw Error('Intervalo');
if(!$('#warnings').innerHTML.includes('Ágatha'))throw Error('Alerta carga');
const roundtrip=validate(JSON.parse(JSON.stringify(state)));
if(roundtrip.people.length!==14)throw Error('Backup');
const analu=state.people.find(p=>p.name==='Analu');
if(state.dates.filter(d=>date(d).getDay()===0&&state.cells[key(analu.id,d)].off).length<2)throw Error('Domingos');
const joao=state.people.find(p=>p.name==='João');
if(joao.shifts.some(s=>s.begin<'13:30'))throw Error('Estudante');
state.people[0].fixed=[2];generate();
if(!state.cells[key(1,'2026-11-04')].off||!state.cells[key(4,'2026-11-04')].off)throw Error('Folga fixa de grupo');
`,context);
assert.throws(()=>vm.runInContext("validate({version:9})",context));
vm.runInContext(`
if(state.support.map(p=>p.name).join(',')!=='Walter,Eliezer,Elizangela')throw Error('Apoios iniciais');
let legacy=JSON.parse(JSON.stringify(state));delete legacy.support;delete legacy.vacations;
if(validate(legacy).support.length!==3)throw Error('Migração');
const p=state.people[0],day='2026-11-03',original=JSON.stringify(state.cells[key(p.id,day)]);
state.vacations.push({id:1,type:'employee',personId:p.id,from:day,to:'2026-11-05'});
if(!effectiveCell(p,day).vacation||duration(effectiveCell(p,day))!==0)throw Error('Bloqueio férias');
if(!effectiveCell(p,'2026-11-05').vacation||effectiveCell(p,'2026-11-06')?.vacation)throw Error('Limites férias');
if(JSON.stringify(state.cells[key(p.id,day)])!==original)throw Error('Preservar turnos');
render();if(!$('#schedule').innerHTML.includes('Férias'))throw Error('Exibição férias');
state.vacations=[];
if(JSON.stringify(effectiveCell(p,day))!==original)throw Error('Restaurar turnos');
let w={from:'2026-11-02',to:'2026-11-08',days:[0,2],begin:'10:00',end:'14:00',break:30};
state.support[0].windows.push(w);
if(supportSlots(state.support[0],'2026-11-02').length!==1||supportSlots(state.support[0],'2026-11-03').length)throw Error('Dias apoio');
if(duration({...supportSlots(state.support[0],'2026-11-02')[0],off:false})!==3.5)throw Error('Horas apoio');
if(supportSlots(state.support[0],'2026-11-09').length)throw Error('Período apoio');
if(!windowsOverlap(w,{...w,begin:'13:00',end:'16:00'})||windowsOverlap(w,{...w,begin:'14:00',end:'16:00'}))throw Error('Sobreposição');
if(!windowsOverlap({...w,days:[0],begin:'22:00',end:'02:00'},{...w,days:[1],begin:'01:00',end:'03:00'}))throw Error('Sobreposição noturna');
state.vacations.push({id:2,type:'support',personId:1,from:'2026-11-02',to:'2026-11-02'});
if(supportSlots(state.support[0],'2026-11-02').length)throw Error('Férias apoio');
let rows=[];appendSupportCsv(rows);
if(!rows.some(r=>r[0]==='Walter'&&r[6]==='Férias')||!rows.some(r=>r[0]==='Walter'&&r[6]==='Apoio disponível'))throw Error('CSV apoio');
validate(JSON.parse(JSON.stringify(state)));
state.cells[key(p.id,'2026-11-02')]={begin:'22:00',end:'02:00',break:0,off:false};
state.vacations.push({id:3,type:'employee',personId:p.id,from:day,to:day});
if(!effectiveCell(p,'2026-11-02').vacationOverlap)throw Error('Férias noturnas');
let bad=JSON.parse(JSON.stringify(state));bad.vacations[0].from='2026-02-30';
let rejected=false;try{validate(bad)}catch{rejected=true}if(!rejected)throw Error('Data inválida aceita');
`,context);
console.log('OK: escala, grupos, horas, backups antigos, apoios, disponibilidade, sobreposição, férias, turnos noturnos e CSV.');
