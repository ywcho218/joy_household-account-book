"use strict";
/* 실시간 동시 수정 반영(Supabase Realtime) */
/* ---------- 동시 수정: 상대가 고친 내용을 바로 반영한다 (Supabase Realtime) ---------- */
var rtChan=null, rtStale=false, rtLost=false, rtEverSub=false;
function editingNow(){var a=document.activeElement;return !!(a&&main.contains(a)&&/INPUT|SELECT|TEXTAREA/.test(a.tagName))}
var rtStaleT=null;
function rtRender(){
  if(editingNow()){
    rtStale=true;
    if(!rtStaleT)rtStaleT=setInterval(function(){
      if(editingNow())return;
      clearInterval(rtStaleT);rtStaleT=null;
      if(rtStale){rtStale=false;render()}
    },800);
    return;
  }
  render();
}
document.getElementById("main").addEventListener("focusout",function(){
  if(rtStale)setTimeout(function(){if(!editingNow()&&rtStale){rtStale=false;render()}},250);
});
function rtRemove(id){
  var found=false;
  for(var m=1;m<=12;m++)ALL.forEach(function(k){
    var l=S.months[m][k], n=l.filter(function(x){return x.id!==id});
    if(n.length!==l.length){S.months[m][k]=n;found=true}
  });
  return found;
}
function rtEntry(p){
  if(!p)return;
  if(p.eventType==="DELETE"){
    var id=p.old&&p.old.id;if(!id||dirty[id]||dels[id])return;
    if(rtRemove(id))rtRender();
    return;
  }
  var r=p.new;
  if(!r||!r.id||r.household_id!==HH||r.year!==YEAR||!S.months[r.month]||!S.months[r.month][r.section])return;
  var v=isVar(r.section), it=findItem(r.id);
  var vals={name:v?"":(r.label||""),desc:v?(r.label||""):"",day:v?(r.day||""):"",amt:Number(r.amount)||0,payer:r.payer||"",order:r.sort_order||0};
  if(dirty[r.id]){
    if(it&&(it.amt!==vals.amt||(v?it.desc!==vals.desc:it.name!==vals.name)))showNotice("같은 항목을 상대도 고쳤어요. 내가 입력한 내용으로 저장돼요.");
    return;
  }
  if(dels[r.id])return;
  if(it){
    var same=it._m===r.month&&it._s===r.section&&it.name===vals.name&&it.desc===vals.desc&&it.day===vals.day&&it.amt===vals.amt&&it.payer===vals.payer&&it.order===vals.order;
    if(same)return;
    if(it._m!==r.month||it._s!==r.section){rtRemove(it.id);it=null}
  }
  if(it){it.name=vals.name;it.desc=vals.desc;it.day=vals.day;it.amt=vals.amt;it.payer=vals.payer;it.order=vals.order}
  else{it=mkItem(r.month,r.section,{id:r.id,name:vals.name,desc:vals.desc,day:vals.day,amt:vals.amt,payer:vals.payer,order:vals.order});S.months[r.month][r.section].push(it)}
  S.months[r.month][r.section].sort(function(a,b){return a.order-b.order});
  rtRender();
}
function rtMeta(p){
  var r=p&&p.new;
  if(!r||r.household_id!==HH||r.year!==YEAR||!S.months[r.month]||metaDirty[r.month])return;
  var d=S.months[r.month], a=Number(r.avail)||0, b=Number(r.baby_savings)||0;
  if(d.avail===a&&d.baby===b)return;
  d.avail=a;d.baby=b;rtRender();
}
function rtKV(p){
  var r=p&&p.new;
  if(!r||r.household_id!==HH||r.key!=="locks"||kvDirty.locks)return;
  var v=r.value||{};
  if(JSON.stringify(v)===JSON.stringify(KV.locks))return;
  KV.locks=v;rtRender();
}
async function rtReload(){
  if(!HH||hasPending()||editingNow())return;
  try{await loadAll();await loadKV();rtLost=false;render();setStatus("저장됨")}catch(e){}
}
function startRealtime(){
  if(!sb||!sb.channel||rtChan)return;
  try{
    rtChan=sb.channel("gagyebu-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"entries"},rtEntry)
      .on("postgres_changes",{event:"*",schema:"public",table:"month_meta"},rtMeta)
      .on("postgres_changes",{event:"*",schema:"public",table:"app_kv"},rtKV)
      .subscribe(function(status){
        if(status==="SUBSCRIBED"){if(rtEverSub&&rtLost)rtReload();rtEverSub=true}
        else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")rtLost=true;
      });
  }catch(e){rtChan=null}
}
