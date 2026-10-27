'use strict';
function migrateRules(s){
 if(s.specialDates===undefined)s.specialDates=[];
 if(!Array.isArray(s.specialDates))throw Error('Datas especiais inválidas.');
 for(const p of s.people){if(p.sundayProfile===undefined)p.sundayProfile='unspecified';if(!['female','male','unspecified'].includes(p.sundayProfile))throw Error('Regra de domingos inválida.');}
 let ids=new Set();for(const r of s.specialDates){if(!Number.isInteger(r.id)||ids.has(r.id)||!validDate(r.date)||typeof r.name!=='string'||typeof r.sector!=='string'||!r.sector.trim()||!Number.isInteger(r.minimum)||r.minimum<0||typeof r.includeSupport!=='boolean')throw Error('Mínimo por setor inválido.');ids.add(r.id);}return s;
}
function sundayQuota(p){return p.sundayProfile==='male'?1:2;}
function sundayLabel(p){return p.sundayProfile==='male'?'Homem: 1/mês; intervalo até 3 semanas':p.sundayProfile==='female'?'Mulher: 2/mês; intervalo quinzenal':'Não informado: regra de 2/mês e quinzenal';}
function monthSundays(m){let out=[];for(let d=m+'-01';d.startsWith(m);d=plus(d,1))if(date(d).getDay()===0)out.push(d);return out;}
function regularOff(p,d,cells){let c=cells[key(p.id,d)];return !!c?.off&&!onVacation('employee',p.id,d);}
function unavailable(p,d,cells){let c=cells[key(p.id,d)];return onVacation('employee',p.id,d)||(c&&!c.off&&crossesMidnight(c)&&onVacation('employee',p.id,plus(d,1)));}
function coverage(r,cells){let staff=state.people.filter(p=>p.sector===r.sector&&cells[key(p.id,r.date)]&&!cells[key(p.id,r.date)].off&&!unavailable(p,r.date,cells)).length;return staff+(r.includeSupport?state.support.filter(p=>p.sector===r.sector&&supportSlots(p,r.date).length).length:0);}
function personRules(p,dates,cells,partial=false){
 let problems=[],offRun=0,workRun=0;
 // Keep any previously saved adjacent days when generating a later period.
 let span=Array.from({length:6},(_,i)=>plus(dates[0],i-6)).concat(dates,Array.from({length:6},(_,i)=>plus(dates.at(-1),i+1)));
 for(const d of span){let c=cells[key(p.id,d)];if(!c||unavailable(p,d,cells)){offRun=0;workRun=0;continue;}offRun=c.off?offRun+1:0;workRun=c.off?0:workRun+1;
  if(d>=dates[0]&&offRun===3)problems.push(`${p.name}: 3 folgas consecutivas terminando em ${d}.`);
  if(d>=dates[0]&&workRun===7)problems.push(`${p.name}: mais de 6 dias consecutivos de trabalho em ${d}.`);
 }
 let sundays=Array.from({length:21},(_,i)=>plus(dates[0],i-21)).concat(dates,Array.from({length:21},(_,i)=>plus(dates.at(-1),i+1))).filter(d=>date(d).getDay()===0),streak=0,limit=p.sundayProfile==='male'?2:1;
 for(const d of sundays){let c=cells[key(p.id,d)];if(!c||unavailable(p,d,cells)){streak=0;continue;}streak=c.off?0:streak+1;if(d>=dates[0]&&streak===limit+1)problems.push(`${p.name}: intervalo de domingos excedido em ${d} (${sundayLabel(p)}).`);}
 for(const m of new Set(dates.map(d=>d.slice(0,7)))){
  let all=monthSundays(m),shown=all.filter(d=>dates.includes(d)),known=all.filter(d=>cells[key(p.id,d)]),free=known.filter(d=>regularOff(p,d,cells)).length;
  let pending=all.filter(d=>dates.includes(d)&&!cells[key(p.id,d)]).length;
  // Outside the displayed interval, previously saved Sundays are usable history.
  let target=known.length+pending===all.length?sundayQuota(p):Math.min(sundayQuota(p),shown.length);
  let exempt=known.filter(d=>unavailable(p,d,cells)).length;
  if(free+pending+exempt<target)problems.push(`${p.name}: ${free} domingo(s) de folga em ${m}; mínimo ${target} no período${shown.length<all.length?' parcial':''}.`);
 }
 return problems;
}
function allRuleProblems(dates=state.dates,cells=state.cells){if(!dates.length)return [];let out=state.people.flatMap(p=>personRules(p,dates,cells));for(const r of state.specialDates.filter(r=>dates.includes(r.date))){let n=coverage(r,cells);if(n<r.minimum)out.push(`${r.name||'Data especial'} (${r.date}) — ${r.sector}: ${n} pessoas; mínimo ${r.minimum}.`);}return out;}
function solveSchedule(dates){
 const original=state.cells,cells={...original};for(const p of state.people)for(const d of dates)delete cells[key(p.id,d)];
 const gs=groups(),variables=[];let nodes=0,limit=180000,deadline=Date.now()+5000,exhausted=false;
 for(let w=0;w<dates.length/7;w++)for(let gi=0;gi<gs.length;gi++){
  let group=gs[gi],targets=new Set(group.map(p=>p.regime==='5x2'?2:1));
  if(targets.size!==1)return {error:'Há regimes incompatíveis no grupo de '+group.map(p=>p.name).join(', ')+'. Ajuste os regimes ou os vínculos de folga.'};
  let target=[...targets][0],fixed=new Set(group.flatMap(p=>p.fixed)),patterns=[];
  if(group.some(p=>p.regime==='5x1'))return {error:'O ciclo 5x1 contínuo não é suportado por esta geração. Selecione 5x2 ou 6x1 para '+group.map(p=>p.name).join(', ')+'.'};
  for(let mask=0;mask<128;mask++){let ds=[0,1,2,3,4,5,6].filter(d=>mask&(1<<d));if(ds.length===target&&[...fixed].every(d=>ds.includes(d)))patterns.push(mask);}
  if(!patterns.length)return {error:'As folgas fixas do grupo '+group.map(p=>p.name).join(', ')+' excedem as folgas do regime.'};
  variables.push({w,gi,group,patterns});
 }
 variables.sort((a,b)=>a.gi-b.gi||a.w-b.w);
 function viableCoverage(){for(const r of state.specialDates.filter(r=>dates.includes(r.date))){let maximum=coverage(r,cells);for(const p of state.people)if(p.sector===r.sector&&!cells[key(p.id,r.date)]&&!onVacation('employee',p.id,r.date))maximum++;if(maximum<r.minimum)return false;}return true;}
 function search(index){if(++nodes>limit||Date.now()>deadline){exhausted=true;return false;}if(index===variables.length)return allRuleProblems(dates,cells).length===0;
  const v=variables[index],week=dates.slice(v.w*7,v.w*7+7);
  let patterns=v.patterns.map(mask=>{let cost=0;for(let d=0;d<7;d++)if(mask&(1<<d)){let day=week[d];cost+=state.people.filter(p=>cells[key(p.id,day)]?.off).length;for(const r of state.specialDates)if(r.date===day&&v.group.some(p=>p.sector===r.sector))cost+=r.minimum*20;}return {mask,cost};}).sort((a,b)=>a.cost-b.cost||((a.mask+v.gi*17)%127)-((b.mask+v.gi*17)%127));
  for(const {mask} of patterns){for(const p of v.group)for(let d=0;d<7;d++){let c={...p.shifts[d],off:!!(mask&(1<<d))};if(d>=5&&c.early&&(v.w+v.gi)%2===0)c.end=c.early;cells[key(p.id,week[d])]=c;}
   if(v.group.every(p=>personRules(p,dates,cells,true).length===0)&&viableCoverage()&&search(index+1))return true;
   for(const p of v.group)for(const d of week)delete cells[key(p.id,d)];
   if(exhausted)break;
  }return false;
 }
 if(!viableCoverage())return {error:'O mínimo exigido em uma data especial supera o total disponível no setor, considerando férias e apoios habilitados.'};
 if(!search(0))return {error:exhausted?'A busca atingiu o limite de tempo ou combinações. Não foi gerada uma escala. Reduza o período ou revise mínimos, folgas fixas e grupos; isso não prova que as regras são impossíveis.':'Nenhuma combinação atende às regras neste período. Revise mínimos por setor, férias, folgas fixas e grupos de folga conjunta.'};
 return {cells};
}
function generateWithRules(){let start=$('#start').value;if(!validDate(start)||date(start).getDay()!==1)return alert('Selecione uma segunda-feira válida.');if(state.dates.length&&!confirm('Gerar novamente substitui as edições da escala atual. Continuar?'))return;
 let dates=Array.from({length:Number($('#weeks').value)*7},(_,i)=>plus(start,i));let result=solveSchedule(dates);
 if(result.error){$('#generationStatus').textContent=result.error;alert(result.error);return;}
 state.dates=dates;state.cells=result.cells;save();render();$('#generationStatus').textContent='Escala gerada com as regras de domingos, sequências de folga e mínimos por setor.';
}
function renderRuleSettings(){
 $('#sundayProfiles').innerHTML=state.people.map(p=>`<tr><td>${esc(p.name)}</td><td><select data-sunday-profile="${p.id}" aria-label="Regra de domingos de ${esc(p.name)}"><option value="unspecified" ${p.sundayProfile==='unspecified'?'selected':''}>Não informado — aplicar 2 domingos e quinzenal</option><option value="female" ${p.sundayProfile==='female'?'selected':''}>Mulher — 2 domingos/mês e quinzenal</option><option value="male" ${p.sundayProfile==='male'?'selected':''}>Homem — 1 domingo/mês e até 3 semanas</option></select></td></tr>`).join('');
 document.querySelectorAll('[data-sunday-profile]').forEach(el=>el.onchange=()=>{state.people.find(p=>p.id===+el.dataset.sundayProfile).sundayProfile=el.value;save();renderSchedule();});
 let sectors=[...new Set([...state.people,...state.support].map(p=>p.sector))].sort();let selected=$('#specialSector').value;$('#specialSector').innerHTML=sectors.map(s=>`<option>${esc(s)}</option>`).join('');if(sectors.includes(selected))$('#specialSector').value=selected;
 $('#specialList').innerHTML=state.specialDates.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.name)}</td><td>${esc(r.sector)}</td><td>${r.minimum}</td><td>${r.includeSupport?'Sim':'Não'}</td><td>${state.dates.includes(r.date)?coverage(r,state.cells)+' / '+r.minimum:'Fora da escala'}</td><td><button class="secondary" data-special-edit="${r.id}">Editar</button> <button class="secondary" data-special-remove="${r.id}">Remover</button></td></tr>`).join('')||'<tr><td colspan="7">Nenhuma exigência cadastrada.</td></tr>';
 document.querySelectorAll('[data-special-edit]').forEach(b=>b.onclick=()=>{let r=state.specialDates.find(r=>r.id===+b.dataset.specialEdit);specialEditing=r.id;let f=$('#specialForm');for(const n of ['date','name','minimum'])f.elements[n].value=r[n];$('#specialSector').value=r.sector;f.elements.includeSupport.checked=r.includeSupport;$('#specialStatus').textContent='Editando exigência. Salve para aplicar.';});
 document.querySelectorAll('[data-special-remove]').forEach(b=>b.onclick=()=>{state.specialDates=state.specialDates.filter(r=>r.id!==+b.dataset.specialRemove);save();render();});
}
let specialEditing=null;
function initRules(){migrateRules(state);$('#generate').onclick=generateWithRules;
 $('#specialCancel').onclick=()=>{specialEditing=null;$('#specialForm').reset();$('#specialStatus').textContent='';};
 $('#specialForm').onsubmit=e=>{e.preventDefault();let f=e.target,r={id:specialEditing||Math.max(0,...state.specialDates.map(r=>r.id))+1,date:f.elements.date.value,name:f.elements.name.value.trim(),sector:$('#specialSector').value,minimum:Number(f.elements.minimum.value),includeSupport:f.elements.includeSupport.checked};if(!validDate(r.date)||!r.name||!r.sector||!Number.isInteger(r.minimum)||r.minimum<0)return alert('Informe data, nome, setor e mínimo inteiro válido.');if(state.specialDates.some(x=>x.id!==r.id&&x.date===r.date&&x.sector===r.sector))return alert('Já existe exigência para este setor nesta data. Use Editar.');if(specialEditing)state.specialDates[state.specialDates.findIndex(x=>x.id===specialEditing)]=r;else state.specialDates.push(r);specialEditing=null;save();f.reset();render();$('#specialStatus').textContent='Exigência salva. Gere novamente para reorganizar as folgas; a escala atual já mostra eventuais faltas.';};
}

function periodNotices(){return [...new Set(state.dates.map(d=>d.slice(0,7)))].filter(m=>monthSundays(m).some(d=>!state.dates.includes(d))).map(m=>`Mês ${m} exibido parcialmente: a cota mensal completa de domingos não foi conferida. Gere um período que inclua todos os domingos do mês. Sem histórico anterior, os intervalos também são conferidos apenas dentro da escala disponível.`);}
