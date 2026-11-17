"use strict";
/* 변경 이력 기록, 여러 줄 붙여넣기, 항목 수정·이동·복사, 월 요약, 연간 결산 */
/* ---------- 변경 이력 ---------- */
function deviceName(){var u=navigator.userAgent;return /iPhone|iPad|iPod/.test(u)?"iPhone":/Android/.test(u)?"Android":"PC"}
function logH(text){
  KV.history.unshift({t:Date.now(),d:deviceName(),x:text});
  if(KV.history.length>200)KV.history.length=200;
  saveKV("history");
}
function itemLabel(sec,x){return ((isVar(sec)?x.desc:x.name)||"(빈 항목)")+" "+won(+x.amt||0)}
function cumRoom(m){var s=0;for(var i=1;i<=m;i++)s+=calc(i).room;return s}

/* ---------- 여러 줄 붙여넣기 ---------- */
var pstSec=null, pstDlg=document.getElementById("pst"), pstText=document.getElementById("pstText"), pstMsg=document.getElementById("pstMsg");
function parseLines(txt){
  var out=[], skip=0;
  txt.split(/\r?\n/).forEach(function(line){
    line=line.replace(/ /g," ").trim();if(!line)return;
    var day="", dm=/^(\d{1,2})\s*[\/.]\s*(\d{1,2})\s+/.exec(line);
    if(dm){day=(+dm[2])+"일";line=line.slice(dm[0].length)}
    else{dm=/^(\d{1,2})일\s+/.exec(line);if(dm){day=(+dm[1])+"일";line=line.slice(dm[0].length)}}
    var m=/^(.*?)[\s,]+(-?\d[\d,]*)\s*원?$/.exec(line);
    if(!m||!m[1].trim()){skip++;return}
    var amt=parseInt(m[2].replace(/,/g,""),10);
    if(isNaN(amt)){skip++;return}
    out.push({desc:m[1].trim().replace(/\s+/g," "),day:day,amt:amt});
  });
  return {items:out,skip:skip};
}
function pstPreview(){
  var r=parseLines(pstText.value), tot=r.items.reduce(function(s,x){return s+x.amt},0);
  pstMsg.className="msg";
  var dn=r.items.filter(function(x){return existsLike(cur,x.desc,x.amt,x.day)}).length;
  pstMsg.textContent=pstText.value.trim()?(r.items.length+"줄 인식 · 합계 "+won(tot)+(r.skip?" · "+r.skip+"줄은 형식이 달라 건너뛰어요":"")+(dn?" · 이미 있는 것과 같아 보이는 줄 "+dn+"개":"")):"";
}
function pstOpen(sec){
  pstSec=sec;pstText.value="";pstMsg.textContent="";
  document.getElementById("pstTitle").textContent=cur+"월 "+SECS[sec]+" · 여러 줄 붙여넣기";
  if(pstDlg.showModal)pstDlg.showModal();else pstDlg.setAttribute("open","");
  pstText.focus();
}
pstText.addEventListener("input",pstPreview);
document.getElementById("pstClose").addEventListener("click",function(){if(pstDlg.close)pstDlg.close();else pstDlg.removeAttribute("open")});
document.getElementById("pstOk").addEventListener("click",function(){
  var r=parseLines(pstText.value);
  if(!r.items.length){pstMsg.className="msg neg";pstMsg.textContent="추가할 줄이 없어요. '내용 금액' 형태로 한 줄에 하나씩 적어 주세요.";return}
  var dupN=r.items.filter(function(x){return existsLike(cur,x.desc,x.amt,x.day)}).length;
  if(dupN&&confirm("이미 있는 항목과 같아 보이는 줄이 "+dupN+"개 있어요.\n확인: 그 줄은 건너뛰고 "+(r.items.length-dupN)+"개만 추가\n취소: 모두 추가")){
    r.items=r.items.filter(function(x){return !existsLike(cur,x.desc,x.amt,x.day)});
    if(!r.items.length){pstMsg.className="msg neg";pstMsg.textContent="모두 이미 있는 항목이라 추가하지 않았어요.";return}
  }
  var payer=document.getElementById("pstPayer").value, d=S.months[cur][pstSec], base=d.length;
  snapshot(cur+"월 "+SECS[pstSec]+" "+r.items.length+"개를 붙여넣어 추가했어요.");
  r.items.forEach(function(x,i){var it=mkItem(cur,pstSec,{desc:x.desc,day:x.day,amt:x.amt,payer:payer,order:base+i});d.push(it);dirty[it.id]=true});
  logH(cur+"월 "+SECS[pstSec]+" "+r.items.length+"개 붙여넣기 추가");
  schedule();render();
  if(pstDlg.close)pstDlg.close();else pstDlg.removeAttribute("open");
});

/* ---------- 항목 이동·복사·정렬 ---------- */
var mvRow=null, mvDlg=document.getElementById("mv"), mvSecSel=document.getElementById("mvSec"), mvMonSel=document.getElementById("mvMonth");
function mvClose(){if(mvDlg.close)mvDlg.close();else mvDlg.removeAttribute("open")}
function mvItem(){return mvRow?S.months[cur][mvRow.sec].filter(function(x){return x.id===mvRow.id})[0]:null}
function mvOpen(row){
  if(!row)return;
  var sec=row.getAttribute("data-sec"), id=row.getAttribute("data-id");
  var it=S.months[cur][sec].filter(function(x){return x.id===id})[0];if(!it)return;
  mvRow={sec:sec,id:id};
  var v=isVar(sec);
  document.getElementById("mvInfo").textContent=cur+"월 "+SECS[sec];
  document.getElementById("mvTextLb").textContent=v?"내용":"항목";
  var md=v?methodOf(it.desc):{pay:"",sp:""};
  document.getElementById("mvText").value=v?stripMethod(it.desc):(it.name||"");
  document.getElementById("mvPay").value=md.pay;document.getElementById("mvSp").value=md.sp;
  ["mvPay","mvPayLb","mvSp","mvSpLb","mvSplit"].forEach(function(k){document.getElementById(k).hidden=!v});
  var mt=document.getElementById("mvTags");
  mt.innerHTML=v?tagStats().slice(0,8).map(function(t){return '<button type="button" class="qbtn" data-tag="'+esc(t.t)+'">#'+esc(t.t)+'</button>'}).join("")+'<span class="hint" style="margin:0 0 0 2px">내용에 #태그를 붙이면 모아 볼 수 있어요</span>':"";
  var am=document.getElementById("mvAmt");am.inputMode=AMT_MODE;am.value=fmtIn(it.amt);
  var dm=/(\d+)/.exec(it.day||"");document.getElementById("mvDay").value=dm?dm[1]:"";
  document.getElementById("mvPayer").value=it.payer||"";
  var hasPayer=(sec==="fixed"||v);
  ["mvDay","mvDayLb"].forEach(function(k){document.getElementById(k).hidden=!v});
  ["mvPayer","mvPayerLb"].forEach(function(k){document.getElementById(k).hidden=!hasPayer});
  mvSecSel.innerHTML=(v?VARS:[sec]).map(function(k){return '<option value="'+k+'"'+(k===sec?" selected":"")+'>'+SECS[k]+'</option>'}).join("");
  var o="";for(var m=1;m<=12;m++)o+='<option value="'+m+'"'+(m===cur?" selected":"")+'>'+m+'월'+(isLocked(YEAR,m)?" 🔒":"")+'</option>';
  mvMonSel.innerHTML=o;
  if(mvDlg.showModal)mvDlg.showModal();else mvDlg.setAttribute("open","");
}
document.getElementById("mvAmt").addEventListener("input",function(e){parseAmt(e.target)});
document.getElementById("mvTags").addEventListener("click",function(e){
  var b=e.target.closest("[data-tag]");if(!b)return;
  var inp=document.getElementById("mvText"), t="#"+b.getAttribute("data-tag");
  if(tagsOf(inp.value).indexOf(b.getAttribute("data-tag"))<0)inp.value=(inp.value.replace(/\s+$/,"")+" "+t).trim();
});
document.getElementById("mvSave").addEventListener("click",function(){
  var it=mvItem();if(!it)return;
  var v=isVar(mvRow.sec), txt=document.getElementById("mvText").value;
  if(v)it.desc=withMethod(txt,document.getElementById("mvPay").value,document.getElementById("mvSp").value);else it.name=txt;
  it.amt=parseAmt(document.getElementById("mvAmt"));
  if(v){var dd=parseInt(document.getElementById("mvDay").value,10);it.day=(dd>=1&&dd<=31)?dd+"일":""}
  if(mvRow.sec==="fixed"||v)it.payer=document.getElementById("mvPayer").value;
  markDirty(it.id);mvClose();render();
});
document.getElementById("mvDel").addEventListener("click",function(){
  var it=mvItem();if(!it)return;
  if(!confirm("지우시겠습니까?"))return;
  snapshot("항목을 지웠어요.");
  logH(cur+"월 "+SECS[mvRow.sec]+" 삭제: "+itemLabel(mvRow.sec,it));
  var sec=mvRow.sec, id=it.id;
  S.months[cur][sec]=S.months[cur][sec].filter(function(x){return x.id!==id});
  delete dirty[id];dels[id]=true;schedule();mvClose();render();
});
function mvApply(copy){
  var src=mvItem();if(!src)return;
  var tsec=mvSecSel.value, tm=+mvMonSel.value;
  if(!copy&&tm===cur&&tsec===mvRow.sec){alert("같은 위치예요. 다른 구분이나 달을 골라 주세요.");return}
  if(isLocked(YEAR,tm)){alert(tm+"월은 잠겨 있어요. 잠금을 풀고 다시 해 주세요.");return}
  var label=itemLabel(mvRow.sec,src), fromS=mvRow.sec, fromM=cur;
  snapshot("항목을 "+(copy?"복사":"이동")+"했어요 ("+tm+"월 "+SECS[tsec]+").");
  var tgt=S.months[tm][tsec];
  if(copy){var n=mkItem(tm,tsec,{name:src.name,desc:src.desc,day:src.day,amt:src.amt,payer:src.payer,order:tgt.length});tgt.push(n);dirty[n.id]=true}
  else{
    S.months[cur][fromS]=S.months[cur][fromS].filter(function(x){return x.id!==src.id});
    src._m=tm;src._s=tsec;src.order=tgt.length;tgt.push(src);dirty[src.id]=true;
  }
  logH(label+" → "+tm+"월 "+SECS[tsec]+" ("+(copy?"복사":"이동")+", 원래 "+fromM+"월 "+SECS[fromS]+")");
  schedule();render();mvClose();
}
document.getElementById("mvMove").addEventListener("click",function(){mvApply(false)});
document.getElementById("mvCopy").addEventListener("click",function(){mvApply(true)});
document.getElementById("mvClose").addEventListener("click",mvClose);
function sortDay(sec){
  var d=S.months[cur][sec];if(d.length<2)return;
  snapshot(cur+"월 "+SECS[sec]+"을 날짜순으로 정렬했어요.");
  var dn=function(x){var m=/(\d+)/.exec(x.day||"");return m?+m[1]:999};
  var arr=d.map(function(x,i){return {x:x,i:i}}).sort(function(a,b){return dn(a.x)-dn(b.x)||a.i-b.i});
  S.months[cur][sec]=arr.map(function(o,i){o.x.order=i;dirty[o.x.id]=true;return o.x});
  schedule();render();
}

/* ---------- 월 마감 요약 ---------- */
var sumDlg=document.getElementById("sum"), sumBody=document.getElementById("sumBody");
function sline(k,v,cls){return '<div class="sumline '+(cls||"")+'"><span>'+k+'</span><span>'+v+'</span></div>'}
function openSummary(m,locked){
  var r=calc(m), pr=m>1?calc(m-1):null;
  var h=sline("수입",won(r.inc))+sline("저축",won(r.sav))+sline("지출",won(r.exp))+sline("비상금 (수입−저축−지출)",won(r.room),r.room<0?"bad":"good");
  if(pr&&(pr.exp||r.exp)){var df=r.exp-pr.exp;h+=sline("전월 대비 지출",(df>0?"▲ ":df<0?"▼ ":"")+won(Math.abs(df)),df>0?"bad":df<0?"good":"")}
  [["fix","고정지출"],["food","식비/외식비"],["living","생필품비"],["life","교통·문화·병원 등"],["etc","기타"]].forEach(function(c){
    var v=r[c[0]], b=+KV.budgets[c[0]]||0;
    h+=sline(c[1],won(v)+(b?" / 예산 "+won(b):""),b&&v>b?"bad":"");
  });
  h+=sline("옹우한테 보내준 돈",won(r.sendO))+sline("답니한테 보내준 돈",won(r.sendD));
  var big=[];VARS.forEach(function(k){S.months[m][k].forEach(function(x){if(!isEx(x)&&(+x.amt||0)>0)big.push({l:x.desc||"(내용 없음)",a:+x.amt})})});
  big.sort(function(a,b){return b.a-a.a});
  if(big.length)h+='<div class="kvsub">큰 지출 TOP 3</div>'+big.slice(0,3).map(function(x){return sline(esc(x.l),won(x.a))}).join("");
  var bk=lastBackup(), days=bk?Math.floor((Date.now()-bk)/86400000):-1, stale=days<0||days>=7;
  h+='<div class="kvsub">백업</div><div class="sumline'+(stale?" bad":"")+'"><span>마지막 백업</span><span>'+(days<0?"한 적 없어요":days===0?"오늘":days+"일 전")+(stale?' <button class="add" type="button" id="sumBk">백업하기</button>':"")+'</span></div>';
  document.getElementById("sumTitle").textContent=YEAR+"년 "+m+"월 "+(locked?"마감 요약 🔒":"요약");
  sumBody.innerHTML=h;
  if(sumDlg.showModal)sumDlg.showModal();else sumDlg.setAttribute("open","");
}
sumBody.addEventListener("click",function(e){if(e.target.id==="sumBk"){sumDlg.close();openBackup()}});
document.getElementById("sumClose").addEventListener("click",function(){if(sumDlg.close)sumDlg.close();else sumDlg.removeAttribute("open")});

/* ---------- 연간 결산 ---------- */
function annualView(){
  var rs=[];for(var m=1;m<=12;m++)rs.push(calc(m));
  var T={inc:0,sav:0,exp:0,fix:0,food:0,living:0,life:0,etc:0};
  rs.forEach(function(r){for(var k in T)T[k]+=r[k]});
  var months=rs.filter(function(r){return r.exp||r.inc}).length||1;
  var room=T.inc-T.sav-T.exp, rate=T.inc?(T.sav/T.inc*100).toFixed(1)+"%":"-";
  function card(k,v,cls,key){return '<div class="kvc'+(key?" key":"")+'"><div class="k">'+k+'</div><div class="v '+(cls||"")+'">'+v+'</div></div>'}
  var cards='<div class="kvgrid">'+card("수입",won(T.inc))+card("지출",won(T.exp))+card("저축",won(T.sav))+card("비상금 합계",won(room),room<0?"neg":"pos",1)+card("저축률",rate)+card("월평균 지출",won(Math.round(T.exp/months)))+'</div>';
  var cats=[["fix","고정지출"],["food","식비/외식비"],["living","생필품비"],["life","교통·문화·병원 등"],["etc","기타"]], max=1;
  cats.forEach(function(c){max=Math.max(max,T[c[0]])});
  var catRows=cats.map(function(c){
    var v=T[c[0]];
    return '<div class="cmprow annrow"><span class="mm">'+c[1]+'</span><span class="bar"><i style="width:'+(Math.max(0,v)/max*100).toFixed(1)+'%"></i></span><span class="val">'+won(v)+'</span><span class="dl">'+(T.exp?(v/T.exp*100).toFixed(1)+"%":"")+' · 월 '+won(Math.round(v/months))+'</span></div>';
  }).join("");
  var items=[], vend={};
  for(var mm=1;mm<=12;mm++)VARS.forEach(function(k){S.months[mm][k].forEach(function(x){
    var a=+x.amt||0;if(isEx(x)||a<=0)return;
    var l=(x.desc||"").replace(/^\[제외\]\s*/,"").trim()||"(내용 없음)";
    items.push({m:mm,l:l,a:a,day:x.day});
    var v=vend[l]||(vend[l]={l:l,n:0,s:0});v.n++;v.s+=a;
  })});
  items.sort(function(a,b){return b.a-a.a});
  var vl=Object.keys(vend).map(function(k){return vend[k]}).sort(function(a,b){return b.s-a.s}).slice(0,10);
  var top=items.slice(0,10).map(function(x){return '<a class="srrow" href="#'+YEAR+'-m'+x.m+'"><span class="srd">'+x.m+'월'+(x.day?" "+esc(x.day):"")+'</span><span class="srs"></span><span class="srl">'+esc(x.l)+'</span><span class="srp"></span><span class="sra">'+won(x.a)+'</span></a>'}).join("");
  var vtop=vl.map(function(v){return '<div class="srrow vrow"><span class="srl">'+esc(v.l)+'</span><span class="srd">'+v.n+'번</span><span class="sra">'+won(v.s)+'</span></div>'}).join("");
  var baby="";for(var b=12;b>=1;b--){if(S.months[b].baby){baby='<p class="dim" style="margin-top:10px">하꿍이 저축은 '+b+'월(25일 기준)에 '+won(S.months[b].baby)+'이에요.</p>';break}}
  var ts=tagStats().slice(0,12);
  var tagSec='<section class="card" style="padding:14px;margin-top:14px"><h3 style="margin-bottom:6px">태그별 지출</h3>'+(ts.length?'<div class="srlist">'+ts.map(function(t){
    return '<button type="button" class="srrow vrow tagrow" data-act="tagsearch" data-tag="'+esc(t.t)+'"><span class="srl">#'+esc(t.t)+'</span><span class="srd">'+t.n+'번</span><span class="sra">'+won(t.s)+'</span></button>';
  }).join("")+'</div>':'<p class="dim">내용에 <b>#카페</b>, <b>#배달</b>처럼 #태그를 붙이면 여기에 모아서 보여요. 항목 ⋯ 메뉴에서 태그를 골라 붙일 수도 있어요.</p>')+'</section>';
  return '<div class="pagehead"><div><h1>'+YEAR+'년 연간 결산</h1></div></div>'+cards
    +'<section class="card" style="padding:14px"><h3 style="margin-bottom:8px">카테고리별 지출</h3><div class="cmplist">'+catRows+'</div>'+baby+'</section>'
    +tagSec
    +'<section class="card" style="padding:14px;margin-top:14px"><h3 style="margin-bottom:6px">가장 큰 지출 TOP 10</h3><div class="srlist">'+(top||'<p class="dim">아직 없어요.</p>')+'</div></section>'
    +'<section class="card" style="padding:14px;margin-top:14px"><h3 style="margin-bottom:6px">가장 많이 쓴 곳 TOP 10 (내용 기준 합계)</h3><div class="srlist">'+(vtop||'<p class="dim">아직 없어요.</p>')+'</div></section>';
}

/* ---------- 변경 이력 화면 ---------- */
function historyView(){
  var head='<div class="pagehead"><div><h1>변경 이력</h1></div></div>';
  if(!KV.ok)return head+kvSetupHTML();
  if(!KV.history.length)return head+'<p class="dim">아직 기록이 없어요. 삭제, 전월 복사, 복원, 잠금, 붙여넣기 같은 큰 변경이 여기에 남아요.</p>';
  return head+'<section class="card" style="padding:10px 14px"><div class="srlist">'+KV.history.map(function(h){
    return '<div class="histrow"><span class="hd">'+new Date(h.t).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})+'</span><span class="hv">'+esc(h.d)+'</span><span class="ht">'+esc(h.x)+'</span></div>';
  }).join("")+'</div></section><p class="dim" style="margin-top:8px">공용 계정이라 누가 했는지는 알 수 없고, 어떤 기기에서 했는지만 보여요. 최근 200건까지 남아요.</p>';
}
