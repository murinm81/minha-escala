'use strict';
// Compatível com os cadastros e backups da primeira versão.
function validDate(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(date(d).getTime())&&iso(date(d))===d;}
function seedSupport(){return ['Walter','Eliezer','Elizangela'].map((name,i)=>({id:i+1,name,sector:'A definir',notes:'Informe os períodos e horários em que pode ajudar.',windows:[]}));}
function validateExtras(s){
 if(s.support===undefined)s.support=seedSupport();
 if(s.vacations===undefined)s.vacations=[];
 if(!Array.isArray(s.support)||!Array.isArray(s.vacations))throw Error('Apoios ou férias inválidos.');
 let ids=new Set();
 for(const p of s.support){
  if(!Number.isInteger(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||typeof p.sector!=='string'||!Array.isArray(p.windows))throw Error('Pessoa de apoio inválida.');
  ids.add(p.id);
  for(const w of p.windows)if(!validDate(w.from)||!validDate(w.to)||w.from>w.to||!Array.isArray(w.days)||!w.days.length||w.days.some(d=>!Number.isInteger(d)||d<0||d>6)||!validShift(w)||w.begin===w.end||duration({...w,off:false})<=0)throw Error('Disponibilidade de apoio inválida.');
  for(let i=0;i<p.windows.length;i++)for(let j=0;j<i;j++)if(windowsOverlap(p.windows[i],p.windows[j]))throw Error('Horários de apoio sobrepostos.');
 }
 ids=new Set();
 for(const v of s.vacations){
  if(!Number.isInteger(v.id)||ids.has(v.id)||!['employee','support'].includes(v.type)||!(v.type==='employee'?s.people:s.support).some(p=>p.id===v.personId)||!validDate(v.from)||!validDate(v.to)||v.from>v.to)throw Error('Período de férias inválido.');
  ids.add(v.id);
 }
 return migrateRules(s);
}
function onVacation(type,id,d){return state.vacations.some(v=>v.type===type&&v.personId===id&&v.from<=d&&d<=v.to);}
function crossesMidnight(c){return c&&c.end<c.begin&&c.end!=='00:00';}
function effectiveCell(p,d){
 let c=state.cells[key(p.id,d)];
 let vacation=onVacation('employee',p.id,d),overlap=c&&!c.off&&crossesMidnight(c)&&onVacation('employee',p.id,plus(d,1));
 if(vacation||overlap)return {...(c||p.shifts[(date(d).getDay()+6)%7]),off:true,vacation:true,vacationOverlap:!vacation&&overlap};
 return c;
}
function supportSlots(p,d){
 if(onVacation('support',p.id,d))return [];
 return p.windows.filter(w=>w.from<=d&&d<=w.to&&w.days.includes((date(d).getDay()+6)%7)&&!(crossesMidnight(w)&&onVacation('support',p.id,plus(d,1))));
}
function windowsOverlap(a,b){
 // Compare absolute intervals, including the previous day's overnight window.
 let first=a.from>b.from?a.from:b.from,last=a.to<b.to?a.to:b.to;
 if(plus(first,-1)>plus(last,1))return false;
 function interval(w,d){if(d<w.from||d>w.to||!w.days.includes((date(d).getDay()+6)%7))return null;let start=date(d).getTime()/60000+minutes(w.begin),length=(minutes(w.end)-minutes(w.begin)+1440)%1440;return [start,start+length];}
 // Weekly patterns repeat; ten days cover all day-of-week and overnight pairings.
 for(let d=plus(first,-1),n=0;d<=plus(last,1)&&n<10;d=plus(d,1),n++){
  let ai=interval(a,d);if(!ai)continue;
  for(let delta of [-1,0,1]){let bi=interval(b,plus(d,delta));if(bi&&ai[0]<bi[1]&&bi[0]<ai[1])return true;}
 }
 return false;
}
function supportScheduleRows(){return state.support.map(p=>`<tr class="support"><td><b>${esc(p.name)} • apoio</b><br><span class="muted">${esc(p.sector)}</span></td>${state.dates.map(d=>{let vacation=onVacation('support',p.id,d),slots=supportSlots(p,d);return `<td class="${vacation?'vacation':'support'}">${vacation?'Férias':slots.length?slots.map(w=>`${w.begin}–${w.end}<br><small>${fmt(duration({...w,off:false}))}h • pausa ${w.break}min</small>`).join('<hr>'):'—'}</td>`}).join('')}</tr>`).join('');}
function appendSupportCsv(rows){for(const p of state.support)for(const d of state.dates){let slots=supportSlots(p,d),vacation=onVacation('support',p.id,d),day=DAYS[(date(d).getDay()+6)%7];if(!slots.length)rows.push([p.name,p.sector,'Não','',d,day,vacation?'Férias':'Apoio indisponível','','','','0']);for(const w of slots)rows.push([p.name,p.sector,'Não','',d,day,'Apoio disponível',w.begin,w.end,w.break,fmt(duration({...w,off:false}))]);}}
function rangeText(v){return v.from.split('-').reverse().join('/')+' a '+v.to.split('-').reverse().join('/');}
function renderWeeklyHours(){
 const select=$('#hoursEmployee'),previous=Number(select.value);
 select.innerHTML='<option value="">Selecione um funcionário</option>'+state.people.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
 select.value=state.people.some(p=>p.id===previous)?String(previous):'';
 loadWeeklyHours();
}
function loadWeeklyHours(){
 const p=state.people.find(p=>p.id===Number($('#hoursEmployee').value));
 $('#weeklyHours').value=p?p.hours:'';
 $('#weeklyHours').disabled=!p;
 $('#saveWeeklyHours').disabled=!p;
 $('#hoursStatus').textContent='';
}
function saveWeeklyHours(event){
 event.preventDefault();
 const p=state.people.find(p=>p.id===Number($('#hoursEmployee').value)),hours=Number($('#weeklyHours').value);
 if(!p||!Number.isFinite(hours)||hours<0.1||hours>80){$('#hoursStatus').textContent='Selecione um funcionário e informe uma carga entre 0,1 e 80 horas semanais.';return;}
 p.hours=Math.round(hours*10)/10;
 save();render();
 $('#hoursStatus').textContent=`Carga de ${p.name} salva: ${fmt(p.hours)} horas por semana.`;
}
function renderExtras(){
 renderWeeklyHours();
 $('#supportList').innerHTML=state.support.map(p=>`<tr><td><b>${esc(p.name)}</b><br>${esc(p.sector)}</td><td>${p.windows.length?p.windows.map((w,i)=>`${rangeText(w)} • ${w.days.map(d=>DAYS[d].slice(0,3)).join(', ')}<br>${w.begin}–${w.end} • ${fmt(duration({...w,off:false}))}h/dia <button class="secondary" data-window-person="${p.id}" data-window="${i}" aria-label="Remover disponibilidade">Remover</button>`).join('<hr>'):'Nenhum horário cadastrado'}</td><td><button class="secondary" data-support-edit="${p.id}">Editar</button> <button data-availability="${p.id}">+ Disponibilidade</button></td></tr>`).join('');
 $('#vacationList').innerHTML=state.vacations.map(v=>{let p=(v.type==='employee'?state.people:state.support).find(p=>p.id===v.personId);return `<tr><td>${esc(p?.name||'Pessoa removida')}${v.type==='support'?' • apoio':''}</td><td>${rangeText(v)} (inclusive)</td><td><button class="secondary" data-vacation-edit="${v.id}">Editar</button> <button class="secondary" data-vacation-remove="${v.id}">Remover</button></td></tr>`}).join('')||'<tr><td colspan="3">Nenhum período de férias cadastrado.</td></tr>';
 document.querySelectorAll('[data-support-edit]').forEach(b=>b.onclick=()=>editSupport(+b.dataset.supportEdit));
 document.querySelectorAll('[data-availability]').forEach(b=>b.onclick=()=>editAvailability(+b.dataset.availability));
 document.querySelectorAll('[data-window]').forEach(b=>b.onclick=()=>{if(confirm('Remover este período de apoio?')){state.support.find(p=>p.id===+b.dataset.windowPerson).windows.splice(+b.dataset.window,1);save();render();}});
 document.querySelectorAll('[data-vacation-edit]').forEach(b=>b.onclick=()=>editVacation(+b.dataset.vacationEdit));
 document.querySelectorAll('[data-vacation-remove]').forEach(b=>b.onclick=()=>{if(confirm('Remover as férias? Os horários anteriores voltarão a aparecer.')){state.vacations=state.vacations.filter(v=>v.id!==+b.dataset.vacationRemove);save();render();}});
}
let supportEditing=null,availabilityPerson=null,vacationEditing=null;
function editSupport(id){supportEditing=id;let p=state.support.find(p=>p.id===id)||{name:'',sector:'',notes:''},f=$('#supportForm');for(let n of ['name','sector','notes'])f.elements[n].value=p[n]||'';$('#supportRemove').style.display=id?'':'none';$('#supportEditor').showModal();}
function editAvailability(id){availabilityPerson=id;let p=state.support.find(p=>p.id===id),f=$('#availabilityForm');$('#availabilityTitle').textContent='Disponibilidade • '+p.name;f.reset();f.elements.from.value=$('#start').value||iso(new Date());f.elements.to.value=f.elements.from.value;$('#availableDays').innerHTML=DAYS.map((d,i)=>`<label><input type="checkbox" name="days" value="${i}" checked>${d}</label>`).join('');$('#availabilityEditor').showModal();}
function editVacation(id=null){vacationEditing=id;let v=state.vacations.find(v=>v.id===id),f=$('#vacationForm');f.reset();f.elements.person.innerHTML=[...state.people.map(p=>({p,type:'employee'})),...state.support.map(p=>({p,type:'support'}))].map(({p,type})=>`<option value="${type}:${p.id}">${esc(p.name)}${type==='support'?' • apoio':''}</option>`).join('');if(v){f.elements.person.value=v.type+':'+v.personId;f.elements.from.value=v.from;f.elements.to.value=v.to;}$('#vacationEditor').showModal();}
function initExtras(){
 validateExtras(state);
 $('#hoursEmployee').onchange=loadWeeklyHours;
 $('#weeklyHoursForm').onsubmit=saveWeeklyHours;
 $('#addSupport').onclick=()=>editSupport(null);$('#addVacation').onclick=()=>editVacation();
 $('#supportForm').onsubmit=e=>{e.preventDefault();let f=e.target,name=f.elements.name.value.trim(),sector=f.elements.sector.value.trim();if(!name||!sector)return alert('Informe nome e setor de apoio.');let p=state.support.find(p=>p.id===supportEditing);if(!p){p={id:Math.max(0,...state.support.map(p=>p.id))+1,windows:[]};state.support.push(p);}Object.assign(p,{name,sector,notes:f.elements.notes.value.trim()});save();$('#supportEditor').close();render();};
 $('#supportRemove').onclick=()=>{if(!confirm('Excluir esta pessoa de apoio, seus horários e suas férias?'))return;state.support=state.support.filter(p=>p.id!==supportEditing);state.vacations=state.vacations.filter(v=>v.type!=='support'||v.personId!==supportEditing);save();$('#supportEditor').close();render();};
 $('#availabilityForm').onsubmit=e=>{e.preventDefault();let f=e.target,w={from:f.elements.from.value,to:f.elements.to.value,begin:f.elements.begin.value,end:f.elements.end.value,break:+f.elements.break.value,days:[...f.querySelectorAll('[name="days"]:checked')].map(x=>+x.value)};if(!validDate(w.from)||!validDate(w.to)||w.from>w.to||!w.days.length||!validShift(w)||w.begin===w.end||duration({...w,off:false})<=0)return alert('Confira datas, dias, horários e intervalo.');let p=state.support.find(p=>p.id===availabilityPerson);if(p.windows.some(x=>windowsOverlap(x,w)))return alert('Este horário se sobrepõe a uma disponibilidade já cadastrada para esta pessoa.');p.windows.push(w);save();$('#availabilityEditor').close();render();};
 $('#vacationForm').onsubmit=e=>{e.preventDefault();let f=e.target,[type,id]=f.elements.person.value.split(':'),v={id:vacationEditing||Math.max(0,...state.vacations.map(v=>v.id))+1,type,personId:+id,from:f.elements.from.value,to:f.elements.to.value};if(!validDate(v.from)||!validDate(v.to)||v.from>v.to)return alert('Informe datas válidas; o fim deve ser igual ou posterior ao início.');if(state.vacations.some(x=>x.id!==v.id&&x.type===v.type&&x.personId===v.personId&&x.from<=v.to&&v.from<=x.to))return alert('Já existem férias sobrepostas para esta pessoa.');if(vacationEditing)state.vacations[state.vacations.findIndex(x=>x.id===vacationEditing)]=v;else state.vacations.push(v);save();$('#vacationEditor').close();render();};
}
