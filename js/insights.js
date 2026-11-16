"use strict";
/* 중복 항목 감지, 홈 대시보드, 달력 보기 */
/* ---------- 중복 항목 감지: 같은 달, 같은 날, 같은 내용·금액이 겹치면 표시 ---------- */
function dupText(x){return (x.desc||"").replace(/^\[제외\]\s*/,"").trim()}
function dupKey(x){var d=dupText(x);return d&&(+x.amt)&&x.day?d+"|"+(+x.amt)+"|"+x.day:""}
function findDups(m){
  var map={}, ids={}, groups=[];
  VARS.forEach(function(k){S.months[m][k].forEach(function(x){var key=dupKey(x);if(key)(map[key]=map[key]||[]).push(x)})});
  Object.keys(map).forEach(function(k){if(map[k].length>1){groups.push({key:k,items:map[k]});map[k].forEach(function(x){ids[x.id]=true})}});
  return {ids:ids,groups:groups};
}
/* 붙여넣을 줄이 이미 있는 항목과 같은지 (날짜가 없으면 내용·금액만 비교) */
function existsLike(m,desc,amt,day){
  var hit=false;
  VARS.forEach(function(k){S.months[m][k].forEach(function(x){
    if(hit||dupText(x)!==desc||(+x.amt||0)!==amt)return;
    if(!day||!x.day||x.day===day)hit=true;
  })});
  return hit;
}

/* ---------- 홈 대시보드 ---------- */
function homeCard(k,v,cls,key,sub){return '<div class="kvc'+(key?" key":"")+'"><div class="k">'+k+'</div><div class="v '+(cls||"")+'">'+v+'</div>'+(sub?'<div class="k" style="margin-top:3px">'+sub+'</div>':"")+'</div>'}
function dayNum(x){var m=/(\d+)/.exec(x.day||"");return m?+m[1]:0}
function homeMonth(){return NOW.getFullYear()===YEAR?NOW.getMonth()+1:12}
function homeView(){
  var m=homeMonth(), isNow=NOW.getFullYear()===YEAR&&NOW.getMonth()+1===m;
  var r=calc(m), dim=new Date(YEAR,m,0).getDate(), el=isNow?NOW.getDate():dim, left=dim-el;
  var varSpent=VARS.reduce(function(s,k){return s+r[k]},0);
  var pace=el?Math.round(varSpent/el):0, proj=r.fix+pace*dim;
  var cards='<div class="kvgrid">'
    +homeCard("이번 달 지출",won(r.exp),"",0,"수입의 "+pc(r.exp,r.inc))
    +homeCard("수입",won(r.inc))
    +homeCard("이달의 비상금",won(r.room),r.room<0?"neg":"pos",1,"수입 − 저축 − 지출")
    +homeCard("월말 예상 지출",won(proj),proj>r.inc&&r.inc>0?"neg":"","","하루 평균 변동지출 "+won(pace)+(isNow?" · 남은 "+left+"일":""))
    +'</div>';
  /* 예산 */
  var budRows=VARS.filter(function(k){return +KV.budgets[k]}).map(function(k){
    var b=+KV.budgets[k], sp=r[k], p=sp/b, cls=p>1?"over":p>=0.8?"warn":"ok";
    return '<div class="homebud"><div class="hb-h"><span>'+esc(SECS[k])+'</span><span>'+won(sp)+' / '+won(b)+'</span></div><div class="bud '+cls+'" style="padding:0"><div class="bar"><i style="width:'+Math.max(0,Math.min(100,p*100)).toFixed(1)+'%"></i></div><div class="bl"><span>'+(p*100).toFixed(0)+'%</span><span>'+(sp>b?won(sp-b)+" 초과":won(b-sp)+" 남음")+'</span></div></div></div>';
  }).join("");
  var budSec='<section class="card" style="padding:14px"><h3 style="margin-bottom:8px">예산 현황 ('+m+'월)</h3>'+(budRows||'<p class="dim">예산을 정하면 여기에서 진행률을 볼 수 있어요. 월 화면 변동지출 카드의 "예산" 버튼으로 정해요.</p>')+'</section>';
  /* 최근 7일 큰 지출 */
  var ref=isNow?NOW.getDate():dim, items=[];
  [m,m-1].forEach(function(mm,idx){
    if(mm<1)return;
    var dm=new Date(YEAR,mm,0).getDate();
    VARS.forEach(function(k){S.months[mm][k].forEach(function(x){
      var d=dayNum(x), a=+x.amt||0;if(!d||isEx(x)||a<=0)return;
      var ago=idx===0?ref-d:ref+(dm-d);
      if(ago>=0&&ago<=6)items.push({m:mm,d:d,l:x.desc||"(내용 없음)",a:a,p:x.payer});
    })});
  });
  items.sort(function(a,b){return b.a-a.a});
  var wk=items.slice(0,5).map(function(x){return '<a class="srrow" href="#'+YEAR+'-m'+x.m+'"><span class="srd">'+x.m+'/'+x.d+'</span><span class="srs">'+esc(x.p||"")+'</span><span class="srl">'+esc(x.l)+'</span><span class="srp"></span><span class="sra">'+won(x.a)+'</span></a>'}).join("");
  var wkSec='<section class="card" style="padding:14px"><h3 style="margin-bottom:6px">최근 7일 큰 지출</h3><div class="srlist">'+(wk||'<p class="dim">최근 7일 동안 날짜가 입력된 지출이 없어요.</p>')+'</div></section>';
  /* 카테고리 비중 */
  var cats=[["fix","고정지출"],["food","식비/외식비"],["living","생필품비"],["life","교통·문화·병원 등"],["etc","기타"]], mx=1;
  cats.forEach(function(c){mx=Math.max(mx,r[c[0]])});
  var share='<section class="card" style="padding:14px"><h3 style="margin-bottom:8px">카테고리 비중</h3><div class="cmplist">'+cats.map(function(c){
    var v=r[c[0]];
    return '<div class="cmprow annrow"><span class="mm">'+c[1]+'</span><span class="bar"><i style="width:'+(Math.max(0,v)/mx*100).toFixed(1)+'%"></i></span><span class="val">'+won(v)+'</span><span class="dl">'+(r.exp?(v/r.exp*100).toFixed(1)+"%":"")+'</span></div>';
  }).join("")+'</div></section>';
  /* 알림 모음 */
  var dp=findDups(m), notes=[];
  if(dp.groups.length)notes.push('같은 날 같은 내용·금액이 겹친 항목이 '+dp.groups.length+'쌍 있어요. <a href="#'+YEAR+'-m'+m+'">월 화면에서 주황색 표시를 확인</a>해 보세요.');
  var bk=lastBackup(), days=bk?Math.floor((Date.now()-bk)/86400000):-1;
  if(days<0||days>=30)notes.push(days<0?"아직 백업한 적이 없어요. 더보기 → 백업·복원에서 받아 두세요.":"마지막 백업이 "+days+"일 전이에요. 더보기 → 백업·복원에서 받아 두세요.");
  if(isLocked(YEAR,m))notes.push(m+"월은 잠겨 있어요.");
  var alerts=notes.length?'<section class="card homealert" style="padding:12px 14px">'+notes.map(function(n){return '<p>'+n+'</p>'}).join("")+'</section>':"";
  var sendSec='<section class="settle" aria-label="결제자별 합계"><div class="who o"><span class="lb"><i></i>옹우한테 보내준 돈</span><div class="v">'+won(r.sendO)+'</div><span class="sub">옹 결제 항목 합계</span></div><div class="who d"><span class="lb"><i></i>답니한테 보내준 돈</span><div class="v">'+won(r.sendD)+'</div><span class="sub">답 결제 항목 합계</span></div></section>';
  return '<div class="pagehead"><div><h1>'+YEAR+'년 '+m+'월 홈</h1></div><div class="pager"><a class="btn" href="#'+YEAR+'-m'+m+'">월 화면</a><a class="btn" href="#'+YEAR+'-calendar">달력</a></div></div>'
    +alerts+cards+'<div class="homegrid">'+budSec+share+wkSec+sendSec+'</div>';
}

/* ---------- 달력 보기 ---------- */
var calM=null, calSel=null, lastMonth=null;
function compactWon(n){return Math.abs(n)>=10000?(n/10000).toFixed(1).replace(/\.0$/,"")+"만":n.toLocaleString("ko-KR")}
function calendarView(){
  var m=calM||lastMonth||homeMonth();
  var first=new Date(YEAR,m-1,1).getDay(), dim=new Date(YEAR,m,0).getDate();
  var tot={}, nodate=[];
  VARS.forEach(function(k){S.months[m][k].forEach(function(x){
    var d=dayNum(x), a=+x.amt||0, ex=isEx(x);
    if(!d||d>dim){if(a||x.desc)nodate.push({k:k,x:x});return}
    var t=tot[d]||(tot[d]={s:0,n:0,items:[]});
    if(!ex)t.s+=a;t.n++;t.items.push({k:k,x:x});
  })});
  var max=0;Object.keys(tot).forEach(function(d){max=Math.max(max,tot[d].s)});
  var isNowM=NOW.getFullYear()===YEAR&&NOW.getMonth()+1===m;
  if(calSel==null&&isNowM)calSel=NOW.getDate();
  var cells="";
  for(var i=0;i<first;i++)cells+='<span class="calcell blank"></span>';
  for(var d=1;d<=dim;d++){
    var t=tot[d], h=t&&max?Math.round(8+32*(Math.max(0,t.s)/max)):0;
    cells+='<button type="button" class="calcell'+(t?" has":"")+(d===calSel?" sel":"")+(isNowM&&d===NOW.getDate()?" today":"")+'" data-act="calday" data-d="'+d+'" style="--h:'+h+'">'
      +'<b>'+d+'</b>'+(t?'<span>'+(t.s?compactWon(t.s):"0")+'</span><em>'+t.n+'건</em>':"")+'</button>';
  }
  var monthTot=Object.keys(tot).reduce(function(s,d){return s+tot[d].s},0);
  var detail="";
  var sel=calSel&&tot[calSel];
  if(calSel){
    detail='<section class="card" style="padding:14px;margin-top:14px"><h3 style="margin-bottom:6px">'+m+'월 '+calSel+'일</h3>'+(sel?'<div class="srlist">'+sel.items.map(function(o){
      var x=o.x;return '<div class="srrow caldetail'+(isEx(x)?" ex":"")+'"><span class="srs">'+esc(x.payer||"")+'</span><span class="srl">'+esc(x.desc||"(내용 없음)")+'</span><span class="srp">'+esc(SECS[o.k].split("/")[0])+'</span><span class="sra">'+won(+x.amt||0)+'</span></div>';
    }).join("")+sline("합계",won(sel.s))+'</div>':'<p class="dim">이 날 입력된 지출이 없어요.</p>')+'</section>';
  }
  var nd=nodate.length?'<p class="dim" style="margin-top:10px">날짜가 없는 항목 '+nodate.length+'개 ('+won(nodate.reduce(function(s,o){return s+(isEx(o.x)?0:(+o.x.amt||0))},0))+')는 달력에 표시되지 않아요. 월 화면에서 날짜를 넣어 주세요.</p>':"";
  return '<div class="pagehead"><div><h1>'+YEAR+'년 '+m+'월 달력</h1></div><div class="pager"><button class="btn" type="button" data-act="calprev"'+(m===1?" disabled":"")+'>이전 달</button><button class="btn" type="button" data-act="calnext"'+(m===12?" disabled":"")+'>다음 달</button><a class="btn" href="#'+YEAR+'-m'+m+'">월 화면</a></div></div>'
    +'<p class="dim" style="margin:0 0 8px">변동지출 기준 · 날짜가 있는 항목의 합계 '+won(monthTot)+' · 색이 진할수록 그날 지출이 많아요 (제외 항목은 합계에서 빠져요)</p>'
    +'<section class="card calwrap" style="padding:10px"><div class="calhead">'+["일","월","화","수","목","금","토"].map(function(w,i){return '<span'+(i===0?' class="sun"':i===6?' class="sat"':"")+'>'+w+'</span>'}).join("")+'</div><div class="calgrid">'+cells+'</div></section>'+detail+nd;
}
