"use strict";
/* 공용 저장소(app_kv), 월 잠금, 반복 항목 템플릿, 예산 설정 */
/* ---------- 공용 저장소(app_kv): 템플릿·예산·메모 ---------- */
var KV={templates:{income:[],saving:[],fixed:[]},budgets:{},memo:[],locks:{},history:[],ok:false}, kvDirty={}, kvTimer={};
var LOCK_LS="gagyebu_locks";
/* 월 잠금: app_kv가 있으면 부부 공용, 없으면 이 기기에만 저장 */
function isLocked(y,m){return !!KV.locks[y+"-"+m]}
function toggleLock(m){
  var k=YEAR+"-"+m;
  if(KV.locks[k]){if(!confirm(m+"월 잠금을 풀까요?"))return;delete KV.locks[k]}
  else KV.locks[k]=true;
  if(KV.ok)saveKV("locks");
  else try{localStorage.setItem(LOCK_LS,JSON.stringify(KV.locks))}catch(e){}
  logH(YEAR+"년 "+m+"월 "+(KV.locks[k]?"잠금":"잠금 해제"));
  render();
  if(KV.locks[k])openSummary(m,true);
}
function applyLock(){
  var on=isMonth()&&isLocked(YEAR,cur);
  main.classList.toggle("locked",on);
  if(!on)return;
  main.querySelectorAll(".card input,.card select,.stat input").forEach(function(i){i.readOnly=true;i.tabIndex=-1});
  main.querySelectorAll(".card button[data-act],.dinput").forEach(function(b){if(b.getAttribute("data-act")!=="budget")b.disabled=true});
}
var KV_SQL="create table if not exists public.app_kv (\n  household_id uuid not null references public.households(id) on delete cascade,\n  key text not null,\n  value jsonb not null default '{}'::jsonb,\n  updated_at timestamptz not null default now(),\n  primary key (household_id, key)\n);\nalter table public.app_kv enable row level security;\ncreate policy \"members all app_kv\" on public.app_kv\n  for all using (public.is_member(household_id))\n  with check (public.is_member(household_id));";
async function loadKV(){
  try{
    var r=await sb.from("app_kv").select("key,value").eq("household_id",HH);
    if(r.error)throw r.error;
    KV.ok=true;
    r.data.forEach(function(x){
      if(x.key==="templates")KV.templates=Object.assign({income:[],saving:[],fixed:[]},x.value||{});
      else if(x.key==="budgets")KV.budgets=x.value||{};
      else if(x.key==="memo")KV.memo=(x.value&&x.value.notes)||[];
      else if(x.key==="locks")KV.locks=x.value||{};
      else if(x.key==="history")KV.history=(x.value&&x.value.items)||[];
      else if(x.key==="car")KV.car=carNorm(x.value);
    });
  }catch(e){KV.ok=false}
  if(!KV.ok){try{KV.locks=JSON.parse(localStorage.getItem(LOCK_LS)||"{}")||{}}catch(e){KV.locks={}}}
}
function kvVal(key){return key==="templates"?KV.templates:key==="budgets"?KV.budgets:key==="locks"?KV.locks:key==="history"?{items:KV.history}:key==="car"?{records:KV.car.records}:{notes:KV.memo}}
async function flushKV(key){
  if(key==="car")return flushCar();
  clearTimeout(kvTimer[key]);
  if(!kvDirty[key])return;
  delete kvDirty[key];
  try{
    var r=await sb.from("app_kv").upsert({household_id:HH,key:key,value:kvVal(key),updated_at:new Date().toISOString()},{onConflict:"household_id,key"});
    if(r.error)throw r.error;
  }catch(e){kvDirty[key]=true;setStatus("저장 실패 (템플릿·예산·메모)",true)}
}
function saveKV(key){
  if(!KV.ok)return;
  kvDirty[key]=true;setStatus("저장 중…");
  clearTimeout(kvTimer[key]);
  kvTimer[key]=setTimeout(function(){flushKV(key).then(function(){if(!Object.keys(kvDirty).length&&!hasPending())setStatus("저장됨")})},700);
}
function kvAlert(){alert("템플릿·예산·메모를 저장할 공간(app_kv 테이블)이 아직 없어요.\n'메모' 탭에 설정 방법(SQL)이 있어요.")}
function kvSetupHTML(){
  return '<div class="card" style="padding:14px"><h3>한 번만 설정하면 돼요</h3>'
    +'<p class="dim">템플릿·예산·메모는 부부가 같이 보도록 Supabase에 저장해요. SQL Editor에서 아래를 한 번 실행한 뒤 새로고침해 주세요.</p>'
    +'<pre class="sqlbox">'+esc(KV_SQL)+'</pre></div>';
}

/* ---------- 반복 항목 템플릿 ---------- */
var tplSec=null, tplDlg=document.getElementById("tpl"), tplBody=document.getElementById("tplBody");
function tplList(){return KV.templates[tplSec]||(KV.templates[tplSec]=[])}
function tplOpen(sec){
  if(!KV.ok){kvAlert();return}
  tplSec=sec;tplRender();
  document.getElementById("tplTitle").textContent=SECS[sec]+" 템플릿";
  if(tplDlg.showModal)tplDlg.showModal();else tplDlg.setAttribute("open","");
}
function tplRender(){
  var list=tplList(), fx=tplSec==="fixed";
  tplBody.innerHTML=list.length?list.map(function(t,i){
    return '<div class="trow'+(fx?" fx":"")+'" data-i="'+i+'"><input data-tf="name" autocomplete="off" placeholder="항목 ({월}=이번 달 숫자)" aria-label="항목" value="'+esc(t.name)+'">'
      +(fx?'<button class="pay" type="button" data-tact="pay" data-p="'+esc(t.payer)+'" aria-label="결제자 바꾸기">'+(t.payer||"-")+'</button>':"")
      +'<input class="amt" data-tf="amt" inputmode="'+AMT_MODE+'" placeholder="0" aria-label="금액" value="'+fmtIn(t.amt)+'">'
      +'<button class="del" type="button" data-tact="del" aria-label="템플릿 항목 삭제">×</button></div>';
  }).join(""):'<p class="dim">아직 템플릿이 없어요. "이번 달 항목으로 저장"을 누르거나 항목을 직접 추가해 보세요.</p>';
}
function parseAmt(t){
  var raw=t.value, neg=/^\s*[-−–—ㅡ]|[-−–—ㅡ]\s*$/.test(raw), digits=raw.replace(/\D/g,""), num=digits?parseInt(digits,10):0;
  t.value=digits?(neg?"-":"")+num.toLocaleString("ko-KR"):(neg?"-":"");
  return (neg?-num:num)||0;
}
tplBody.addEventListener("input",function(e){
  var t=e.target, f=t.getAttribute("data-tf"), row=t.closest("[data-i]");
  if(!f||!row)return;
  var it=tplList()[+row.getAttribute("data-i")];if(!it)return;
  if(f==="amt")it.amt=parseAmt(t);else it.name=t.value;
  saveKV("templates");
});
tplBody.addEventListener("click",function(e){
  var b=e.target.closest("[data-tact]"), row=e.target.closest("[data-i]");
  if(!b||!row)return;
  var list=tplList(), i=+row.getAttribute("data-i"), a=b.getAttribute("data-tact");
  if(a==="pay"){var c=["","옹","답"];list[i].payer=c[(c.indexOf(list[i].payer)+1)%3];b.textContent=list[i].payer||"-";b.setAttribute("data-p",list[i].payer)}
  else if(a==="del"){if(!confirm("지우시겠습니까?"))return;list.splice(i,1);tplRender()}
  saveKV("templates");
});
document.getElementById("tplAdd").addEventListener("click",function(){
  tplList().push({name:"",payer:"",amt:0});saveKV("templates");tplRender();
  var ins=tplBody.querySelectorAll('input[data-tf="name"]');if(ins.length)ins[ins.length-1].focus();
});
document.getElementById("tplSave").addEventListener("click",function(){
  var d=S.months[cur][tplSec];
  if(!d.length){alert("이번 달 "+SECS[tplSec]+" 항목이 없어요.");return}
  if(tplList().length&&!confirm("기존 템플릿 "+tplList().length+"개를 이번 달 항목 "+d.length+"개로 바꿀까요?"))return;
  var re=new RegExp("(^|[^0-9])"+cur+"월","g");
  KV.templates[tplSec]=d.map(function(x){return {name:(x.name||"").replace(re,"$1{월}"),payer:x.payer||"",amt:+x.amt||0}});
  saveKV("templates");tplRender();
});
document.getElementById("tplApply").addEventListener("click",function(){
  var d=S.months[cur], list=tplList();
  if(!list.length){alert("템플릿이 비어 있어요.");return}
  var have={};d[tplSec].forEach(function(x){have[(x.name||"").trim()]=1});
  var add=[];
  list.forEach(function(t){var nm=(t.name||"").replace(/\{월\}/g,cur+"월").trim();if(!nm||have[nm])return;have[nm]=1;add.push({name:nm,payer:t.payer,amt:t.amt})});
  if(!add.length){alert("템플릿 항목이 이미 모두 들어 있어요.");return}
  if(!confirm("템플릿에서 "+add.length+"개 항목을 "+cur+"월 "+SECS[tplSec]+"에 추가할까요? (이미 있는 이름은 건너뛰어요)"))return;
  snapshot(cur+"월 "+SECS[tplSec]+" 템플릿을 적용했어요.");
  logH(cur+"월 "+SECS[tplSec]+" 템플릿 "+add.length+"개 적용");
  var base=d[tplSec].length;
  add.forEach(function(s,i){var it=mkItem(cur,tplSec,{name:s.name,payer:s.payer,amt:s.amt,order:base+i});d[tplSec].push(it);dirty[it.id]=true});
  schedule();render();
  if(tplDlg.close)tplDlg.close();else tplDlg.removeAttribute("open");
});
document.getElementById("tplClose").addEventListener("click",function(){if(tplDlg.close)tplDlg.close();else tplDlg.removeAttribute("open")});

/* ---------- 예산 ---------- */
function setBudget(sec){
  if(!KV.ok){kvAlert();return}
  var b0=+KV.budgets[sec]||0;
  var s=prompt(SECS[sec]+"의 월 예산(원)을 입력하세요. 모든 달에 같이 적용돼요. 비우면 해제돼요.",b0?String(b0):"");
  if(s===null)return;
  var n=parseInt(String(s).replace(/\D/g,""),10)||0;
  if(n>0)KV.budgets[sec]=n;else delete KV.budgets[sec];
  Object.keys(budLvl).forEach(function(k){if(k.slice(-sec.length-1)==="-"+sec)delete budLvl[k]});
  logH(SECS[sec]+" 예산 "+(n>0?won(n):"해제"));
  saveKV("budgets");refresh();
}
