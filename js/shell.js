"use strict";
/* 라우팅·메뉴·화면 그리기, 로그인, 시작(boot), 이벤트 연결, 백업·복원, 테마, 더보기 */
/* ---------- shell ---------- */
var main=document.getElementById("main"), navEl=document.getElementById("nav"), gate=document.getElementById("gate"), appEl=document.getElementById("app");
function parseHash(){
  var h=location.hash.slice(1);
  /* 주소에 화면 지정이 없으면(처음 로그인·다시 접속) 이번 달 탭을 먼저 보여 준다 */
  if(!h)return {y:YEAR,v:NOW.getFullYear()===YEAR?NOW.getMonth()+1:"summary"};
  /* 홈 화면 바로가기: #add = 이번 달 한 줄 입력, #caradd = 차계부 기록 추가 */
  if(h==="add")return {y:YEAR,v:NOW.getFullYear()===YEAR?NOW.getMonth()+1:"home"};
  if(h==="caradd")return {y:YEAR,v:"car"};
  var mm=/^(?:(\d{4})-)?(?:(summary|compare|search|memo|annual|history|home|calendar|car|projects|tax)|m(\d{1,2}))$/.exec(h);
  var y=YEAR, v="summary";
  if(mm){
    if(mm[2])v=mm[2];
    if(mm[1]){var yy=+mm[1];if(yy>=2000&&yy<=2100)y=yy}
    if(mm[3]){var n=+mm[3];if(n>=1&&n<=12)v=n}
  }
  return {y:y,v:v};
}
function recalcCurM(){curM=NOW.getFullYear()===YEAR?NOW.getMonth()+1:0}
function yearList(){
  var set={};
  years.forEach(function(y){set[y]=1});
  set[YEAR]=1;set[NOW.getFullYear()]=1;
  return Object.keys(set).map(Number).sort(function(a,b){return b-a});
}
function renderYearSel(){
  var sel=document.getElementById("yearSel");
  if(!sel)return;
  sel.innerHTML=yearList().map(function(y){return '<option value="'+y+'"'+(y===YEAR?" selected":"")+'>'+y+'년</option>'}).join("");
}
async function loadYears(){
  try{
    var r=await sb.from("monthly_summary").select("year").eq("household_id",HH);
    if(r.error)throw r.error;
    var set={};
    r.data.forEach(function(x){set[x.year]=1});
    years=Object.keys(set).map(Number);
  }catch(e){}
}
async function flushAll(){
  for(var i=0;i<4;i++){
    clearTimeout(timer);
    while(flushing)await new Promise(function(r){setTimeout(r,80)});
    if(!hasPending())return true;
    await flush();
  }
  return !hasPending();
}
async function switchYear(y){
  setStatus("불러오는 중…");
  var ok=await flushAll();
  if(!ok){setStatus("저장 실패. 잠시 후 다시 시도해 주세요",true);return false}
  var prev=YEAR;
  undoSnap=null;hideToast();
  try{
    YEAR=y;recalcCurM();
    var n=await loadAll();
    if(n===0&&!wasSeeded()){await seed();setSeeded();await loadAll()}
    else if(n>0){setSeeded()}
    await loadYears();
    setStatus("저장됨");
    return true;
  }catch(e){
    YEAR=prev;recalcCurM();
    try{await loadAll()}catch(e2){}
    setStatus("연도를 불러오지 못했어요",true);
    return false;
  }
}
function navHTML(){
  var h='<a class="first'+(cur==="home"?" on":"")+'" href="#'+YEAR+'-home"'+(cur==="home"?' aria-current="page"':"")+'>홈</a>'
    +'<a class="first'+(cur==="summary"?" on":"")+'" href="#'+YEAR+'-summary"'+(cur==="summary"?' aria-current="page"':"")+'>종합 현황</a>';
  for(var m=1;m<=12;m++){
    h+='<a class="'+(cur===m?"on":"")+(m===curM?" now":"")+'" href="#'+YEAR+'-m'+m+'"'+(cur===m?' aria-current="page"':"")+'>'+m+'월'+(isLocked(YEAR,m)?'<span class="lk" aria-label="잠김">🔒</span>':"")+'</a>';
  }
  [["calendar","달력"],["car","차계부"],["search","검색"],["memo","메모"]].forEach(function(x,i){
    h+='<a class="extra'+(i===0?" xfirst":"")+(cur===x[0]?" on":"")+'" href="#'+YEAR+'-'+x[0]+'"'+(cur===x[0]?' aria-current="page"':"")+'>'+x[1]+'</a>';
  });
  h+='<a class="extra moreitem'+(cur==="history"||cur==="compare"||cur==="annual"||cur==="projects"||cur==="tax"?" on":"")+'" href="#" data-more="1" role="button" aria-haspopup="dialog">더보기</a>';
  return h;
}
function render(){
  cur=parseHash().v;
  if(isMonth())lastMonth=cur;
  renderYearSel();
  navEl.innerHTML=navHTML();
  main.className=isMonth()?"":"narrow";
  main.innerHTML=cur==="summary"?summaryView():cur==="home"?homeView():cur==="calendar"?calendarView():cur==="car"?carView():cur==="projects"?projView():cur==="tax"?taxView():cur==="compare"?compareView():cur==="annual"?annualView():cur==="search"?searchView():cur==="memo"?memoView():cur==="history"?historyView():monthView(cur);
  if(isMonth()){refresh();applyLock()}
  else if(cur==="search")searchRun();
  else if(cur==="projects")projLoad();
  handleLaunchHash();
}
var hashBusy=false, hashAgain=false;
async function onHash(){
  if(appEl.hidden)return;
  if(hashBusy){hashAgain=true;return}
  hashBusy=true;
  try{
    var h=parseHash();
    if(h.y!==YEAR){
      var ok=await switchYear(h.y);
      if(!ok)location.replace("#"+YEAR+"-"+(isMonth()?"m"+cur:cur));
    }
    render();window.scrollTo(0,0);
  }finally{
    hashBusy=false;
    if(hashAgain){hashAgain=false;onHash()}
  }
}
window.addEventListener("hashchange",onHash);

function showGate(kind,msg){
  appEl.hidden=true;gate.hidden=false;
  var h='<div class="gate-card"><h1>조이쀼의 가계부</h1>';
  if(kind==="setup"){
    h+='<p>Supabase 연결 정보를 먼저 넣어야 해요. 이 파일 위쪽 스크립트에서 아래 두 값을 내 프로젝트 값으로 바꿔 주세요.</p>'
      +'<pre>var SUPABASE_URL="...";\nvar SUPABASE_ANON_KEY="...";</pre>'
      +'<p class="dim">Supabase 대시보드의 Project Settings &gt; API에서 Project URL과 anon public key를 확인할 수 있어요. service_role key는 넣지 마세요.</p>';
  }else if(kind==="login"){
    h+='<p class="dim">공용 계정으로 로그인해 주세요.</p>'
      +'<form><label for="g-email">이메일</label><input id="g-email" name="email" type="email" autocomplete="username" required>'
      +'<label for="g-pw">비밀번호</label><input id="g-pw" name="password" type="password" autocomplete="current-password" required>'
      +'<div class="gmsg" role="alert"></div><button class="btn primary" type="submit">로그인</button></form>';
  }else if(kind==="nohh"){
    h+='<p>이 계정은 아직 가계부에 연결되지 않았어요. Supabase SQL Editor에서 아래를 실행한 뒤 새로고침해 주세요. 이메일은 이 계정의 이메일로 바꿔야 해요.</p>'
      +'<pre>'+esc("with h as (\n  insert into public.households (name)\n  values ('조이쀼의 가계부') returning id\n)\ninsert into public.household_members (household_id, user_id)\nselect h.id, u.id from h, auth.users u\nwhere u.email = '공용계정@이메일';")+'</pre>'
      +'<button class="btn" type="button" id="g-reload">새로고침</button> <button class="btn" type="button" id="g-out">로그아웃</button>';
  }else{
    h+='<p>'+esc(msg||"문제가 생겼어요.")+'</p><button class="btn" type="button" id="g-reload">다시 시도</button>';
  }
  gate.innerHTML=h+'</div>';
  var f=gate.querySelector("form");
  if(f)f.addEventListener("submit",async function(e){
    e.preventDefault();
    var btn=f.querySelector("button"), box=gate.querySelector(".gmsg");
    btn.disabled=true;box.textContent="";
    var r;
    try{r=await sb.auth.signInWithPassword({email:f.email.value.trim(),password:f.password.value})}catch(err){r={error:err}}
    btn.disabled=false;
    if(r.error){box.textContent="이메일 또는 비밀번호가 맞지 않아요.";return}
    start();
  });
  var rl=document.getElementById("g-reload");if(rl)rl.addEventListener("click",function(){location.reload()});
  var go=document.getElementById("g-out");if(go)go.addEventListener("click",signOut);
}
function hideGate(){gate.hidden=true;gate.innerHTML="";appEl.hidden=false;updateBkInfo()}
async function signOut(){
  try{await flush()}catch(e){}
  try{await sb.auth.signOut()}catch(e){}
  location.reload();
}

async function start(){
  try{
    setStatus("불러오는 중…");
    var r=await sb.from("household_members").select("household_id").limit(1);
    if(r.error)throw r.error;
    if(!r.data||!r.data.length){showGate("nohh");return}
    HH=r.data[0].household_id;
    var pushed=await pushPending();
    YEAR=parseHash().y;recalcCurM();
    var n=await loadAll();
    if(n===0&&!wasSeeded()){await seed();setSeeded();await loadAll()}
    else if(n>0){setSeeded()}
    await loadYears();
    await loadKV();
    hideGate();render();setStatus("저장됨");backupNudge();startRealtime();
    if(pushed)showNotice("저장하지 못했던 변경 "+pushed+"건을 올렸어요.",8000);
  }catch(e){
    showGate("error","데이터를 불러오지 못했어요. 네트워크와 Supabase 설정을 확인해 주세요. ("+(e&&e.message?e.message:"알 수 없는 오류")+")");
  }
}

/* 매달 초(1~7일)에 이번 달 백업을 안 했으면 알려 준다 */
function backupNudge(){
  var t=lastBackup(), now=new Date(), first=new Date(now.getFullYear(),now.getMonth(),1).getTime();
  if(now.getDate()<=7&&t<first)showToast("이번 달 백업을 아직 안 했어요.","백업하기",openBackup,15000);
}
try{if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})}catch(e){}
function boot(){
  if(pinCfg())lockApp();
  if(!configured()){showGate("setup");return}
  if(!window.supabase){showGate("error","Supabase 라이브러리를 불러오지 못했어요. 네트워크를 확인해 주세요.");return}
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  sb.auth.getSession().then(function(r){
    if(r.data&&r.data.session)start();else showGate("login");
  }).catch(function(){showGate("login")});
}

main.addEventListener("input",function(e){
  var t=e.target;
  if(!isMonth()){viewInput(t);return}
  var top=t.getAttribute("data-top"), f=t.getAttribute("data-f");
  if(t.classList.contains("amt")){
    var raw=t.value, neg=/^\s*[-−–—ㅡ]|[-−–—ㅡ]\s*$/.test(raw);
    var digits=raw.replace(/\D/g,"");
    var num=digits?parseInt(digits,10):0;
    t.value=digits?(neg?"-":"")+num.toLocaleString("ko-KR"):(neg?"-":"");
    var sval=(neg?-num:num)||0;
    if(top){S.months[cur][top]=sval;markMeta(cur);return}
    var rowEl=t.closest("[data-id]");
    if(!rowEl)return;
    var item=S.months[cur][rowEl.getAttribute("data-sec")].filter(function(x){return x.id===rowEl.getAttribute("data-id")})[0];
    if(item){item.amt=sval;markDirty(item.id);refresh()}
    return;
  }
  if(f){
    var row=t.closest("[data-id]");
    if(!row)return;
    var it=S.months[cur][row.getAttribute("data-sec")].filter(function(x){return x.id===row.getAttribute("data-id")})[0];
    if(it){it[f]=t.value;markDirty(it.id);if(f==="payer")refresh();if(f==="desc"){row.classList.toggle("ex",isEx(it));refresh()}}
  }
});
main.addEventListener("click",function(e){
  var b=e.target.closest("[data-act]");
  if(b){
    if(!isMonth()){viewAct(b);return}
    var act=b.getAttribute("data-act"), d=S.months[cur];
    if(act==="lock"){toggleLock(cur);return}
    if(act==="msum"){openSummary(cur);return}
    if(act==="gocal"){calM=cur;calSel=null;location.hash=YEAR+"-calendar";return}
    if(isLocked(YEAR,cur)&&act!=="budget")return;
    if(act==="availauto"){
      snapshot(cur+"월 가용금액을 자동 입력했어요.");
      d.avail=cumRoom(cur);markMeta(cur);
      var ai2=document.getElementById("top-avail");if(ai2)ai2.value=fmtIn(d.avail);
      logH(cur+"월 가용금액을 비상금 누적 "+won(d.avail)+"으로 자동 입력");return;
    }
    if(act==="quick"){quickAdd(b.getAttribute("data-sec"),b.getAttribute("data-l"));return}
    if(act==="paste"){pstOpen(b.getAttribute("data-sec"));return}
    if(act==="sortday"){sortDay(b.getAttribute("data-sec"));return}
    if(act==="rowmenu"){mvOpen(b.closest("[data-id]"));return}
    if(act==="tpl"){tplOpen(b.getAttribute("data-sec"));return}
    if(act==="budget"){setBudget(b.getAttribute("data-sec"));return}
    if(act==="add"){
      var sec=b.getAttribute("data-sec");
      var order=d[sec].reduce(function(mx,x){return Math.max(mx,x.order||0)},-1)+1;
      var it=mkItem(cur,sec,{order:order});
      if(isVar(sec)&&NOW.getFullYear()===YEAR&&NOW.getMonth()+1===cur)it.day=NOW.getDate()+"일";
      d[sec].push(it);markDirty(it.id);render();
      var first=main.querySelector('[data-id="'+it.id+'"] input[data-f="desc"],[data-id="'+it.id+'"] input[data-f="name"]');
      if(first)first.focus();
    }else if(act==="pick"){
      var inp=b.closest(".dwrap").querySelector(".dinput");
      try{if(inp.showPicker)inp.showPicker();else{inp.focus();inp.click()}}catch(err){inp.focus();inp.click()}
    }else if(act==="pay"){
      var prow=b.closest("[data-id]"), psc=prow.getAttribute("data-sec"), pid=prow.getAttribute("data-id");
      var pit=d[psc].filter(function(x){return x.id===pid})[0];
      if(pit){
        var cyc=["","옹","답"];
        pit.payer=cyc[(cyc.indexOf(pit.payer)+1)%3];
        b.textContent=pit.payer||"-";b.setAttribute("data-p",pit.payer);
        markDirty(pit.id);refresh();
      }
    }else if(act==="copysec"){
      copySection(b.getAttribute("data-sec"),cur);
    }
    return;
  }
  var g=e.target.closest("[data-go]");
  if(g&&!g.disabled){location.hash=YEAR+"-"+g.getAttribute("data-go")}
});
main.addEventListener("change",function(e){
  var t=e.target;
  if(isMonth()&&(t.getAttribute("data-f")==="desc"||t.getAttribute("data-f")==="name")){
    var rw=t.closest("[data-id]");if(!rw)return;
    var sc2=rw.getAttribute("data-sec"), it2=S.months[cur][sc2].filter(function(x){return x.id===rw.getAttribute("data-id")})[0];
    if(it2&&!(+it2.amt)){
      var lk=lastLike(sc2,t.value,it2.id);
      if(lk){
        it2.amt=+lk.amt;
        var ai=rw.querySelector(".amt");if(ai)ai.value=fmtIn(it2.amt);
        if(!it2.payer&&lk.payer){it2.payer=lk.payer;var pb=rw.querySelector(".pay");if(pb){pb.textContent=lk.payer;pb.setAttribute("data-p",lk.payer)}}
        markDirty(it2.id);refresh();
      }
    }
    return;
  }
  if(!t.classList.contains("dinput"))return;
  var row=t.closest("[data-id]"), mt=/^\d{4}-\d{2}-(\d{2})$/.exec(t.value);
  if(!row||!mt)return;
  var item=S.months[cur][row.getAttribute("data-sec")].filter(function(x){return x.id===row.getAttribute("data-id")})[0];
  if(!item)return;
  item.day=parseInt(mt[1],10)+"일";
  var btn=row.querySelector(".dbtn");
  btn.textContent=item.day;btn.classList.remove("empty");
  markDirty(item.id);
});
main.addEventListener("keydown",function(e){
  if(e.key!=="Enter")return;
  var g=e.target.closest("tr[data-go],g[data-go]");
  if(g)location.hash=YEAR+"-"+g.getAttribute("data-go");
});

/* 백업 / 복원 */
var bk=document.getElementById("bk"), bkText=document.getElementById("bkText"), bkMsg=document.getElementById("bkMsg"), bkRestore=document.getElementById("bkRestore");
var armed=false;
function disarm(){armed=false;bkRestore.textContent="이 내용으로 복원"}
function exportJSON(){
  var out={app:"gagyebu",year:YEAR,months:{}};
  for(var m=1;m<=12;m++){
    var d=S.months[m], o={avail:d.avail,baby:d.baby};
    ALL.forEach(function(k){o[k]=d[k].map(function(x){return {name:x.name,desc:x.desc,day:x.day,amt:x.amt,payer:x.payer}})});
    out.months[m]=o;
  }
  /* 연도와 상관없는 데이터(메모·템플릿·예산·잠금·이력)도 같이 담는다 */
  out.extra={templates:KV.templates,budgets:KV.budgets,memo:KV.memo,locks:KV.locks,history:KV.history,car:KV.car,projects:KV.projects,tax:KV.tax};
  return JSON.stringify(out);
}
function importMonths(obj){
  if(!obj||!obj.months)throw new Error("형식 오류");
  var months={};
  for(var m=1;m<=12;m++){
    var src=obj.months[m]||{}, d=emptyMonth();
    ALL.forEach(function(k){
      var l=Array.isArray(src[k])?src[k]:[];
      d[k]=l.map(function(x,i){return mkItem(m,k,{name:x.name,desc:x.desc,day:x.day,amt:x.amt,payer:x.payer,order:i})});
    });
    d.avail=+src.avail||0;d.baby=+src.baby||0;
    months[m]=d;
  }
  return months;
}
function openBackup(){
  bkText.value=exportJSON();bkMsg.textContent="";bkMsg.className="msg";disarm();updateExtraUI();
  if(bk.showModal)bk.showModal();else bk.setAttribute("open","");
}
document.getElementById("bkBtn").addEventListener("click",openBackup);
document.getElementById("bkClose").addEventListener("click",function(){bk.close()});
document.getElementById("bkCopy").addEventListener("click",function(){
  bkText.focus();bkText.select();
  var ok=false;try{ok=document.execCommand("copy")}catch(e){}
  bkMsg.className="msg";bkMsg.textContent=ok?"복사했어요.":"전체 선택됐어요. 길게 눌러 복사해 주세요.";
  if(ok)markBackup();
});
document.getElementById("bkDown").addEventListener("click",function(){
  try{
    var blob=new Blob([exportJSON()],{type:"application/json"}), a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download="가계부-백업-"+YEAR+"-"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
    markBackup();bkMsg.className="msg";bkMsg.textContent=YEAR+"년 백업 파일을 내려받았어요. 다른 연도도 연도를 바꿔서 각각 받아 주세요.";
  }catch(e){bkMsg.className="msg neg";bkMsg.textContent="파일 저장에 실패했어요. '전체 선택'으로 복사해 주세요."}
});
var bkExtra=document.getElementById("bkExtra"), bkExtraLb=document.getElementById("bkExtraLb");
function updateExtraUI(){
  var has=false;
  try{var o=JSON.parse(bkText.value);has=!!(o&&o.extra)}catch(e){}
  bkExtraLb.hidden=!has;if(!has)bkExtra.checked=false;
}
bkText.addEventListener("input",function(){disarm();updateExtraUI()});
bkRestore.addEventListener("click",function(){
  var months, parsed;
  try{parsed=JSON.parse(bkText.value);months=importMonths(parsed)}
  catch(e){bkMsg.className="msg neg";bkMsg.textContent="복원할 수 없어요. 백업 내용을 처음부터 끝까지 그대로 붙여 넣었는지 확인해 주세요.";disarm();return}
  if(!armed){armed=true;bkRestore.textContent="정말 복원할까요?";bkMsg.className="msg neg";bkMsg.textContent="지금 DB의 "+YEAR+"년 내용이 모두 이 내용으로 바뀌어요.";return}
  var withExtra=bkExtra.checked&&parsed.extra&&KV.ok;
  snapshot(YEAR+"년을 백업 내용으로 복원했어요.");
  logH(YEAR+"년을 백업 파일로 복원"+(withExtra?" (메모·템플릿·예산·잠금·이력 포함)":""));
  if(withExtra){
    var ex=parsed.extra;
    KV.templates=Object.assign({income:[],saving:[],fixed:[]},ex.templates||{});
    KV.budgets=ex.budgets||{};KV.memo=Array.isArray(ex.memo)?ex.memo:[];
    KV.locks=ex.locks||{};KV.history=Array.isArray(ex.history)?ex.history:[];
    ["templates","budgets","memo","locks","history"].forEach(saveKV);
    if(ex.car)carReplaceAll(carNorm(ex.car).records);
    if(ex.projects){KV.projects=projNorm(ex.projects);saveKV("projects")}
    if(ex.tax){KV.tax=taxNorm(ex.tax);saveKV("tax")}
  }
  for(var m=1;m<=12;m++){
    ALL.forEach(function(k){
      S.months[m][k].forEach(function(x){delete dirty[x.id];dels[x.id]=true});
    });
  }
  S.months=months;
  for(var mm=1;mm<=12;mm++){
    ALL.forEach(function(k){S.months[mm][k].forEach(function(x){dirty[x.id]=true})});
    metaDirty[mm]=true;
  }
  schedule();render();disarm();bk.close();
});
/* 다크/라이트 모드 (처음엔 기기 설정을 따르고, 누르면 기억해요) */
function curTheme(){var t=document.documentElement.getAttribute("data-theme");return t||(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}
function updateThemeBtn(){
  var b=document.getElementById("themeBtn"), dark=curTheme()==="dark";
  if(b)b.textContent=dark?"☀ 라이트":"🌙 다크";
  var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",dark?"#131728":"#4458CF");
}
/* 더보기: 자주 안 쓰는 기능 모음 */
var moreDlg=document.getElementById("more");
function moreClose(){if(moreDlg.close)moreDlg.close();else moreDlg.removeAttribute("open")}
function openMore(){
  var mo=isMonth(), dark=curTheme()==="dark";
  document.getElementById("moreTheme").textContent=dark?"라이트 모드":"다크 모드";
  var lk=document.getElementById("moreLock"), sm=document.getElementById("moreSum");
  lk.disabled=!mo;sm.disabled=!mo;
  lk.textContent=mo?(isLocked(YEAR,cur)?"🔒 "+cur+"월 잠금 해제":"🔓 "+cur+"월 잠금"):"월 잠금";
  sm.textContent=mo?cur+"월 요약":"월 요약";
  document.getElementById("moreHint").textContent=mo?"":"월 잠금과 월 요약은 월 탭에서 쓸 수 있어요.";
  if(moreDlg.showModal)moreDlg.showModal();else moreDlg.setAttribute("open","");
}
navEl.addEventListener("click",function(e){
  var a=e.target.closest("[data-more]");if(!a)return;
  e.preventDefault();openMore();
});
document.getElementById("moreClose").addEventListener("click",moreClose);
moreDlg.addEventListener("click",function(e){
  var b=e.target.closest("[data-m]");if(!b||b.disabled)return;
  var k=b.getAttribute("data-m");moreClose();
  if(k==="year")document.getElementById("yearAdd").click();
  else if(k==="history")location.hash=YEAR+"-history";
  else if(k==="compare")location.hash=YEAR+"-compare";
  else if(k==="annual")location.hash=YEAR+"-annual";
  else if(k==="projects")location.hash=YEAR+"-projects";
  else if(k==="tax")location.hash=YEAR+"-tax";
  else if(k==="theme")document.getElementById("themeBtn").click();
  else if(k==="backup")openBackup();
  else if(k==="lock"&&isMonth())toggleLock(cur);
  else if(k==="sum"&&isMonth())openSummary(cur);
});
document.getElementById("themeBtn").addEventListener("click",function(){
  var t=curTheme()==="dark"?"light":"dark";
  document.documentElement.setAttribute("data-theme",t);
  try{localStorage.setItem("gagyebu_theme",t)}catch(e){}
  updateThemeBtn();
});
updateThemeBtn();
document.getElementById("outBtn").addEventListener("click",signOut);

window.addEventListener("beforeunload",function(e){
  if(hasPending()||Object.keys(kvDirty).length){e.preventDefault();e.returnValue=""}
});
document.addEventListener("visibilitychange",async function(){
  if(!HH||appEl.hidden)return;
  if(document.visibilityState==="hidden"){clearTimeout(timer);flush();Object.keys(kvDirty).forEach(flushKV);return}
  var a=document.activeElement;
  if(hasPending()||(a&&main.contains(a)&&/INPUT|SELECT/.test(a.tagName)))return;
  try{await loadAll();render();setStatus("저장됨")}catch(e){}
});

document.getElementById("yearSel").addEventListener("change",function(e){
  var y=+e.target.value;
  location.hash=y+"-"+(isMonth()?"m"+cur:cur);
});
var ydlg=document.getElementById("ydlg"), yIn=document.getElementById("yIn"), yMsg=document.getElementById("yMsg");
document.getElementById("yearAdd").addEventListener("click",function(){
  var mx=Math.max.apply(null,yearList());
  yIn.value=mx+1;yMsg.textContent="";
  if(ydlg.showModal)ydlg.showModal();else ydlg.setAttribute("open","");
  yIn.focus();yIn.select();
});
document.getElementById("yCancel").addEventListener("click",function(){ydlg.close()});
document.getElementById("yOk").addEventListener("click",function(){
  var y=parseInt(yIn.value,10);
  if(!(y>=2000&&y<=2100)){yMsg.textContent="2000년부터 2100년 사이의 연도를 입력해 주세요.";return}
  ydlg.close();
  location.hash=y+"-summary";
});
yIn.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();document.getElementById("yOk").click()}});

boot();
