"use strict";
/* 한 줄 빠른 입력, 결제수단 표시(@신용 등), 항목 나누기, 홈 화면 바로가기 처리 */

/* ---------- 결제수단 표시: 내용 끝에 @신용 @체크 @현금 (+ @시장 @교통 @문화) ---------- */
var PAY_TOKENS={"신용":"신용카드","체크":"체크카드","현금":"현금영수증"};
var SP_TOKENS={"시장":"전통시장","교통":"대중교통","문화":"도서·공연"};
function methodOf(desc){
  var pay="", sp="", m, re=/(^|\s)@(신용|체크|현금|시장|교통|문화)(?=\s|$)/g;
  while((m=re.exec(desc||""))!==null){if(PAY_TOKENS[m[2]])pay=m[2];else sp=m[2]}
  return {pay:pay,sp:sp};
}
function stripMethod(desc){return (desc||"").replace(/(^|\s)@(신용|체크|현금|시장|교통|문화)(?=\s|$)/g,"$1").replace(/\s{2,}/g," ").trim()}
function withMethod(desc,pay,sp){return (stripMethod(desc)+(pay?" @"+pay:"")+(sp?" @"+sp:"")).trim()}

/* ---------- 한 줄 빠른 입력 ---------- */
function qlineHTML(){
  return '<form class="qline" data-qline="1"><input class="qline-in" name="q" autocomplete="off" placeholder="한 줄로 입력: 스타벅스 5500 어제 답" aria-label="한 줄 빠른 입력">'
    +'<button class="btn primary" type="submit">추가</button></form>'
    +'<div class="qhelp">날짜(오늘·어제·10/5·5일) · 결제자(옹·답) · 결제수단(신용·체크·현금)을 같이 쓸 수 있어요. 예) 점심 9000 옹 신용 / 3만5천 주유 어제</div>';
}
/* "5500", "5,500원", "3만", "1.5만", "3만5천" 같은 금액 읽기. 못 읽으면 null */
function parseKoAmount(tok){
  var m=/^(\d+)만(\d+)(천|000)?$/.exec(tok);
  if(m){return parseInt(m[1],10)*10000+(m[3]?parseInt(m[2],10)*1000:parseInt(m[2],10))}
  m=/^(-?)(\d[\d,]*)(?:\.(\d+))?(만원|천원|원|만|천)?$/.exec(tok);
  if(!m)return null;
  var n=parseFloat(m[2].replace(/,/g,"")+(m[3]?"."+m[3]:""));
  if(isNaN(n))return null;
  var unit=m[4]||"";
  if(unit==="만"||unit==="만원")n*=10000;else if(unit==="천"||unit==="천원")n*=1000;
  n=Math.round(n);
  return m[1]==="-"?-n:n;
}
var QK_WORDS={
  food:["식비","외식","점심","저녁","아침","야식","커피","카페","스타벅스","투썸","메가","이디야","빽다방","배민","배달","요기요","치킨","피자","햄버거","맥도날드","버거킹","롯데리아","김밥","분식","국밥","족발","삼겹","고기","술","맥주","회식","식당","빵","베이커리","디저트","간식","과자","아이스크림","편의점","도시락","마라","초밥","파스타","쌀국수","반찬"],
  living:["생필품","마트","이마트","홈플러스","코스트코","다이소","쿠팡","올리브영","세제","휴지","샴푸","화장품","기저귀","분유","물티슈","청소","주방","욕실","수건","건전지","가구","인테리어"],
  life:["교통","주유","주차","톨게이트","하이패스","택시","버스","지하철","기차","ktx","통신","핸드폰","인터넷","병원","약국","의원","치과","한의원","진료","교육","학원","강의","영화","공연","넷플릭스","유튜브","구독","여행","숙소","호텔","항공","책"]
};
/* 내용으로 어느 카드에 넣을지 추측: 이전에 같은 내용을 넣은 곳 → 이전 내용이 들어 있으면 → 키워드 → 기타 */
function quickGuessSection(desc){
  var base=stripMethod(desc).replace(/#[^\s#]+/g,"").replace(/^\[제외\]\s*/,"").replace(/\s+/g," ").trim().toLowerCase();
  if(!base)return "etc";
  var hist={}, best=null, bestLen=0;
  for(var m=1;m<=12;m++)VARS.forEach(function(k){S.months[m][k].forEach(function(x){
    var d=stripMethod(x.desc).replace(/#[^\s#]+/g,"").replace(/^\[제외\]\s*/,"").replace(/\s+/g," ").trim().toLowerCase();
    if(!d)return;
    var h=hist[d]||(hist[d]={});h[k]=(h[k]||0)+1;
  })});
  function top(h){var k0=null,c0=0;Object.keys(h).forEach(function(k){if(h[k]>c0){c0=h[k];k0=k}});return k0}
  if(hist[base])return top(hist[base]);
  Object.keys(hist).forEach(function(d){if(d.length>=2&&base.indexOf(d)>=0&&d.length>bestLen){best=d;bestLen=d.length}});
  if(best)return top(hist[best]);
  var found=null;
  Object.keys(QK_WORDS).forEach(function(k){if(!found&&QK_WORDS[k].some(function(w){return base.indexOf(w)>=0}))found=k});
  return found||"etc";
}
function parseQuick(text){
  var toks=String(text||"").trim().split(/\s+/).filter(Boolean);
  if(!toks.length)return {error:"입력할 내용이 없어요."};
  var today=new Date();today=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  var date=null, payer="", pay="", sp="", hint="", rest=[], used={};
  /* 금액: 읽을 수 있는 마지막 토큰 */
  var amtIdx=-1, amt=null;
  for(var i=toks.length-1;i>=0;i--){
    if(/^(\d{4}[-\/.])?(\d{1,2})[\/.-](\d{1,2})$/.test(toks[i])||/^\d{1,2}일$/.test(toks[i])||/^\d{1,2}월\d{1,2}일$/.test(toks[i]))continue;
    var a=parseKoAmount(toks[i]);
    if(a!==null){amtIdx=i;amt=a;break}
  }
  if(amtIdx<0)return {error:"금액을 찾지 못했어요. 예) 스타벅스 5500"};
  toks.forEach(function(tok,i){
    if(i===amtIdx)return;
    var m;
    if(tok==="오늘")date=new Date(today);
    else if(tok==="어제"){date=new Date(today);date.setDate(date.getDate()-1)}
    else if(tok==="그제"||tok==="그저께"||tok==="엊그제"){date=new Date(today);date.setDate(date.getDate()-2)}
    else if((m=/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/.exec(tok)))date=new Date(+m[1],+m[2]-1,+m[3]);
    else if((m=/^(\d{1,2})[\/.-](\d{1,2})$/.exec(tok)))date=new Date(today.getFullYear(),+m[1]-1,+m[2]);
    else if((m=/^(\d{1,2})월(\d{1,2})일$/.exec(tok)))date=new Date(today.getFullYear(),+m[1]-1,+m[2]);
    else if((m=/^(\d{1,2})일$/.exec(tok))){
      var d=+m[1], mo=today.getMonth();
      if(d>today.getDate())mo-=1;
      date=new Date(today.getFullYear(),mo,d);
    }
    else if(tok==="옹"||tok==="옹우")payer="옹";
    else if(tok==="답"||tok==="답니")payer="답";
    else if(tok==="신용"||tok==="신용카드")pay="신용";
    else if(tok==="체크"||tok==="체크카드")pay="체크";
    else if(tok==="현금"||tok==="현금영수증")pay="현금";
    else if(tok==="전통시장")sp="시장";
    else if(tok==="대중교통")sp="교통";
    else if(tok==="식비"||tok==="외식비")hint="food";
    else if(tok==="생필품"||tok==="생필품비")hint="living";
    else if(tok==="기타")hint="etc";
    else rest.push(tok);
  });
  var desc=rest.join(" ").trim();
  if(!desc)return {error:"내용을 찾지 못했어요. 예) 스타벅스 5500"};
  desc=withMethod(desc,pay,sp);
  return {desc:desc,amt:amt,date:date||today,payer:payer,section:hint||quickGuessSection(desc)};
}
function quickEntry(text){
  var p=parseQuick(text);
  if(p.error)return p;
  var y=p.date.getFullYear(), m=p.date.getMonth()+1, d=p.date.getDate();
  if(y!==YEAR)return {error:y+"년 날짜예요. 연도 선택을 "+y+"년으로 바꾼 뒤 입력해 주세요."};
  if(isLocked(YEAR,m))return {error:m+"월은 잠겨 있어요. 잠금을 풀고 입력해 주세요."};
  var sec=p.section, dl=S.months[m][sec];
  snapshot(won(p.amt)+"원 "+stripMethod(p.desc)+" → "+SECS[sec].split("/")[0]+" ("+m+"/"+d+")에 추가했어요.");
  var it=mkItem(m,sec,{desc:p.desc,amt:p.amt,payer:p.payer,day:d+"일",order:dl.length});
  dl.push(it);markDirty(it.id);
  logH(m+"월 "+SECS[sec]+" 한 줄 입력: "+itemLabel(sec,it));
  if(isMonth()&&cur===m)render();
  else if(cur==="home")render();
  return {ok:true,item:it,month:m,section:sec};
}
document.getElementById("main").addEventListener("submit",function(e){
  var f=e.target.closest("form.qline");if(!f)return;
  e.preventDefault();
  var inp=f.querySelector(".qline-in"), r=quickEntry(inp.value);
  if(r.error){showNotice(r.error,7000);return}
  inp.value="";
  var again=document.getElementById("main").querySelector(".qline-in");if(again)again.focus();
});

/* ---------- 항목 나누기 (영수증 하나를 여러 카드로) ---------- */
var splitDlg=document.getElementById("splitDlg"), splitBody=document.getElementById("splitBody"), splitRef=null, splitTotal=0, splitRows=[];
function splitClose(){if(splitDlg.close)splitDlg.close();else splitDlg.removeAttribute("open")}
function splitOpen(){
  var it=mvItem();if(!it||!isVar(mvRow.sec))return;
  splitRef={sec:mvRow.sec,id:it.id};splitTotal=+it.amt||0;
  var other=VARS.filter(function(k){return k!==mvRow.sec})[0];
  splitRows=[{sec:mvRow.sec,desc:it.desc||"",amt:splitTotal},{sec:other,desc:it.desc||"",amt:0}];
  mvClose();splitRender();
  if(splitDlg.showModal)splitDlg.showModal();else splitDlg.setAttribute("open","");
}
function splitSum(){return splitRows.reduce(function(s,r){return s+(+r.amt||0)},0)}
function splitRender(){
  document.getElementById("splitInfo").textContent="총 "+won(splitTotal)+"원을 나눠요. 둘째 줄부터 금액을 넣으면 첫째 줄이 자동으로 줄어요.";
  splitBody.innerHTML=splitRows.map(function(r,i){
    return '<div class="splitrow" data-i="'+i+'"><select data-sf="sec" aria-label="구분">'+VARS.map(function(k){return '<option value="'+k+'"'+(k===r.sec?" selected":"")+'>'+esc(SECS[k].split("/")[0])+'</option>'}).join("")+'</select>'
      +'<input data-sf="desc" autocomplete="off" aria-label="내용" value="'+esc(r.desc)+'">'
      +'<input class="amt" data-sf="amt" inputmode="'+AMT_MODE+'" aria-label="금액" placeholder="0" value="'+fmtIn(r.amt)+'">'
      +(i>=2?'<button class="del" type="button" data-sdel="'+i+'" aria-label="줄 삭제">×</button>':'<span></span>')+'</div>';
  }).join("");
  splitRemain();
}
function splitRemain(){
  var rest=splitTotal-splitSum(), el=document.getElementById("splitRemain"), ok=rest===0&&splitRows.every(function(r){return +r.amt});
  el.textContent=rest===0?"합계가 맞아요.":"남은 금액 "+won(rest)+"원";
  el.className="msg"+(rest===0?"":" neg");
  document.getElementById("splitOk").disabled=!ok;
}
splitBody.addEventListener("input",function(e){
  var t=e.target, row=t.closest("[data-i]"), f=t.getAttribute("data-sf");if(!row||!f)return;
  var i=+row.getAttribute("data-i"), r=splitRows[i];
  if(f==="amt"){
    r.amt=parseAmt(t);
    if(i>0){
      var others=splitRows.slice(1).reduce(function(s,x){return s+(+x.amt||0)},0);
      splitRows[0].amt=splitTotal-others;
      var first=splitBody.querySelector('[data-i="0"] [data-sf="amt"]');if(first)first.value=fmtIn(splitRows[0].amt);
    }
  }else r[f]=t.value;
  splitRemain();
});
splitBody.addEventListener("change",function(e){
  var t=e.target, row=t.closest("[data-i]");if(!row||t.getAttribute("data-sf")!=="sec")return;
  splitRows[+row.getAttribute("data-i")].sec=t.value;
});
splitBody.addEventListener("click",function(e){
  var b=e.target.closest("[data-sdel]");if(!b)return;
  splitRows.splice(+b.getAttribute("data-sdel"),1);
  splitRows[0].amt=splitTotal-splitRows.slice(1).reduce(function(s,x){return s+(+x.amt||0)},0);
  splitRender();
});
document.getElementById("splitAdd").addEventListener("click",function(){
  splitRows.push({sec:splitRows[0].sec,desc:splitRows[0].desc,amt:0});splitRender();
});
document.getElementById("splitCancel").addEventListener("click",splitClose);
document.getElementById("splitOk").addEventListener("click",function(){
  if(!splitRef||splitTotal-splitSum()!==0)return;
  var src=S.months[cur][splitRef.sec].filter(function(x){return x.id===splitRef.id})[0];if(!src)return;
  snapshot("항목을 "+splitRows.length+"개로 나눴어요.");
  logH(cur+"월 항목 나누기: "+itemLabel(splitRef.sec,src)+" → "+splitRows.map(function(r){return SECS[r.sec].split("/")[0]+" "+won(r.amt)}).join(", "));
  var first=splitRows[0], oldSec=splitRef.sec;
  src.desc=first.desc;src.amt=+first.amt;
  if(first.sec!==oldSec){
    S.months[cur][oldSec]=S.months[cur][oldSec].filter(function(x){return x.id!==src.id});
    src._s=first.sec;src.order=S.months[cur][first.sec].length;S.months[cur][first.sec].push(src);
  }
  markDirty(src.id);
  splitRows.slice(1).forEach(function(r){
    var list=S.months[cur][r.sec], it=mkItem(cur,r.sec,{desc:r.desc,amt:+r.amt,payer:src.payer,day:src.day,order:list.length});
    list.push(it);markDirty(it.id);
  });
  splitClose();render();
});
document.getElementById("mvSplit").addEventListener("click",splitOpen);

/* ---------- 홈 화면 바로가기(#add, #caradd)로 들어왔을 때 ---------- */
function handleLaunchHash(){
  var h=location.hash;
  if(h==="#add"){
    var q=document.getElementById("main").querySelector(".qline-in");if(q)q.focus();
    try{history.replaceState(null,"",location.pathname+location.search+"#"+YEAR+"-"+(isMonth()?"m"+cur:cur))}catch(e){}
  }else if(h==="#caradd"){
    try{history.replaceState(null,"",location.pathname+location.search+"#"+YEAR+"-car")}catch(e){}
    carOpen(null);
  }
}
