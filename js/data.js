"use strict";
/* 저장 계층: 되돌리기, 백업 날짜, flush(저장), 불러오기, 시드 */
/* ---------- Supabase 데이터 계층 ---------- */
var sb=null, HH=null;
var dirty={}, dels={}, metaDirty={}, timer=null, flushing=false, again=false;

function setStatus(text,bad){
  var el=document.getElementById("sync");
  if(!el)return;
  el.textContent=text;el.classList.toggle("bad",!!bad);
}
function configured(){return SUPABASE_URL.indexOf("YOUR-PROJECT")<0&&SUPABASE_ANON_KEY.indexOf("YOUR-ANON")<0}
function isVar(sec){return VARS.indexOf(sec)>=0}
function findItem(id){
  for(var m=1;m<=12;m++){
    var d=S.months[m];
    for(var i=0;i<ALL.length;i++){
      var l=d[ALL[i]];
      for(var j=0;j<l.length;j++)if(l[j].id===id)return l[j];
    }
  }
  return null;
}
function toRow(it){
  var v=isVar(it._s);
  return {id:it.id,household_id:HH,year:it._y||YEAR,month:it._m,section:it._s,
    label:v?(it.desc||""):(it.name||""),day:v?(it.day||null):null,
    amount:Math.round(+it.amt||0),payer:it.payer||null,sort_order:it.order||0};
}
function mkItem(m,sec,o){
  o=o||{};
  return {id:o.id||newId(),name:o.name||"",desc:o.desc||"",day:o.day||"",amt:+o.amt||0,payer:o.payer||"",order:o.order||0,_m:m,_s:sec,_y:YEAR};
}
/* ---------- 실행 취소(Undo): 지우기·전월 복사·복원 직전 상태를 저장해 둔다 ---------- */
var undoSnap=null, undoTimer=null;
function snapshot(label){
  undoSnap={label:label,year:YEAR,months:JSON.parse(JSON.stringify(S.months))};
  showToast(label);
}
function showToast(label,btn,fn,ms){
  var t=document.getElementById("toast");
  if(!t)return;
  t.innerHTML="";
  var sp=document.createElement("span");sp.textContent=label+" ";
  var b=document.createElement("button");b.type="button";b.textContent=btn||"되돌리기";
  b.addEventListener("click",function(){hideToast();(fn||doUndo)()});
  t.appendChild(sp);t.appendChild(b);t.hidden=false;
  clearTimeout(undoTimer);undoTimer=setTimeout(hideToast,ms||12000);
}
function hideToast(){var t=document.getElementById("toast");if(t)t.hidden=true}
function doUndo(){
  var u=undoSnap;
  if(!u||u.year!==YEAR){hideToast();return}
  var keep={};
  for(var m=1;m<=12;m++)ALL.forEach(function(k){u.months[m][k].forEach(function(x){keep[x.id]=true})});
  for(var m2=1;m2<=12;m2++)ALL.forEach(function(k){S.months[m2][k].forEach(function(x){if(!keep[x.id]){delete dirty[x.id];dels[x.id]=true}})});
  S.months=u.months;
  for(var m3=1;m3<=12;m3++){
    ALL.forEach(function(k){S.months[m3][k].forEach(function(x){delete dels[x.id];dirty[x.id]=true})});
    metaDirty[m3]=true;
  }
  undoSnap=null;hideToast();schedule();render();
}
/* ---------- 백업 날짜 ---------- */
var BK_KEY="gagyebu_last_backup";
function lastBackup(){try{return +localStorage.getItem(BK_KEY)||0}catch(e){return 0}}
function markBackup(){try{localStorage.setItem(BK_KEY,String(Date.now()))}catch(e){}updateBkInfo()}
function updateBkInfo(){
  var el=document.getElementById("bkInfo"), btn=document.getElementById("bkBtn");
  if(!el)return;
  var t=lastBackup(), days=t?Math.floor((Date.now()-t)/86400000):-1, stale=(days<0||days>=30);
  el.textContent=days<0?"백업한 적 없어요":(days===0?"오늘 백업함":days+"일 전 백업");
  el.classList.toggle("bad",stale);
  if(btn)btn.classList.toggle("alert",stale);
}
function schedule(){setStatus("저장 중…");persistPending();clearTimeout(timer);timer=setTimeout(flush,600)}
function markDirty(id){dirty[id]=true;schedule()}
function markMeta(m){metaDirty[m]=true;schedule()}
function hasPending(){return flushing||Object.keys(dirty).length>0||Object.keys(dels).length>0||Object.keys(metaDirty).length>0}

async function flush(){
  if(flushing){again=true;return}
  var ids=Object.keys(dirty), dl=Object.keys(dels), ms=Object.keys(metaDirty);
  if(!ids.length&&!dl.length&&!ms.length)return;
  flushing=true;
  var bad=false;
  dirty={};dels={};metaDirty={};
  try{
    var rows=[];
    ids.forEach(function(id){var it=findItem(id);if(it)rows.push(toRow(it))});
    for(var u=0;u<rows.length;u+=300){var r=await sb.from("entries").upsert(rows.slice(u,u+300),{onConflict:"id"});if(r.error)throw r.error}
  }catch(e){bad=true;ids.forEach(function(id){dirty[id]=true})}
  /* 한 번에 지우는 id가 많으면 요청 주소가 너무 길어져 실패하므로 나눠서 지운다 */
  var delFail={};
  for(var c=0;c<dl.length;c+=50){
    var part=dl.slice(c,c+50);
    try{var r2=await sb.from("entries").delete().in("id",part);if(r2.error)throw r2.error}
    catch(e){bad=true;part.forEach(function(id){delFail[id]=true})}
  }
  Object.keys(delFail).forEach(function(id){dels[id]=true});
  try{
    for(var i=0;i<ms.length;i++){
      var m=+ms[i], d=S.months[m];
      var r3=await sb.from("month_meta").upsert({household_id:HH,year:YEAR,month:m,avail:Math.round(d.avail||0),baby_savings:Math.round(d.baby||0)},{onConflict:"household_id,year,month"});
      if(r3.error)throw r3.error;
    }
  }catch(e){bad=true;ms.forEach(function(m){metaDirty[m]=true})}
  flushing=false;
  persistPending();
  clearTimeout(timer);
  if(bad){setStatus(navigator.onLine===false?"오프라인이에요. 연결되면 자동으로 저장해요":"저장 실패. 5초 뒤 다시 시도해요",true);timer=setTimeout(flush,5000)}
  else if(again||hasPending()){again=false;timer=setTimeout(flush,300)}
  else setStatus("저장됨");
}

async function fetchEntries(){
  var all=[], from=0, size=1000;
  for(;;){
    var r=await sb.from("entries").select("*").eq("household_id",HH).eq("year",YEAR)
      .order("sort_order",{ascending:true}).order("created_at",{ascending:true}).order("id",{ascending:true})
      .range(from,from+size-1);
    if(r.error)throw r.error;
    all=all.concat(r.data);
    if(r.data.length<size)break;
    from+=size;
  }
  return all;
}
async function loadAll(){
  var rows=await fetchEntries();
  var mt=await sb.from("month_meta").select("*").eq("household_id",HH).eq("year",YEAR);
  if(mt.error)throw mt.error;
  var months={};
  for(var m=1;m<=12;m++)months[m]=emptyMonth();
  rows.forEach(function(r){
    var d=months[r.month];
    if(!d||!d[r.section])return;
    var v=isVar(r.section);
    d[r.section].push(mkItem(r.month,r.section,{id:r.id,name:v?"":r.label,desc:v?r.label:"",day:r.day,amt:Number(r.amount),payer:r.payer,order:r.sort_order}));
  });
  mt.data.forEach(function(r){
    if(months[r.month]){months[r.month].avail=Number(r.avail)||0;months[r.month].baby=Number(r.baby_savings)||0}
  });
  S.months=months;
  return rows.length;
}
function defItems(){
  var out=[];
  function add(sec,label,amt,payer,i){out.push({sec:sec,label:label,amt:amt||0,payer:payer||"",order:i})}
  ["급여_옹우","급여_답니"].forEach(function(n,i){add("income",n,0,"",i)});
  ["임시저축","청년미래적금"].forEach(function(n,i){add("saving",n,0,"",i)});
  [["용돈_옹우",400000,""],["용돈_답니",400000,""],["관리비",0,"옹"],["TV,인터넷(SKT)",0,"옹"],["보험_옹우",0,"옹"],["보험_답니",0,"답"],["삼성 정수기",0,"옹"],["태아보험 실손",0,"답"],["태아보험 종합",0,"답"],["__LOAN__",0,"옹"],["식기세척기, 냉장고 AS 연장 구독",0,"옹"]]
    .forEach(function(f,i){add("fixed",f[0],f[1],f[2],i)});
  return out;
}
async function seed(){
  var rows=[];
  for(var m=1;m<=12;m++){
    defItems().forEach(function(it){
      rows.push({household_id:HH,year:YEAR,month:m,section:it.sec,label:it.label==="__LOAN__"?m+"월 대출 이자상환":it.label,amount:it.amt,payer:it.payer||null,sort_order:it.order});
    });
  }
  var r=await sb.from("entries").insert(rows);
  if(r.error)throw r.error;
}
function seededKey(){return "gagyebu-seeded-"+HH+"-"+YEAR}
function wasSeeded(){try{return localStorage.getItem(seededKey())==="1"}catch(e){return false}}
function setSeeded(){try{localStorage.setItem(seededKey(),"1")}catch(e){}}
