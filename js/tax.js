"use strict";
/* 연말정산 도우미: 신용·체크·현금 사용액을 사람별로 모아 소득공제를 대략 계산한다 (참고용) */
var TAX_DEFAULT={gross:{},cfg:{rate:{credit:15,debit:30,market:40,transit:40,culture:30},limit:{high:300,mid:250,low:200,extra:100},taxRate:15}};
KV.tax=JSON.parse(JSON.stringify(TAX_DEFAULT));
function taxNorm(v){
  var d=JSON.parse(JSON.stringify(TAX_DEFAULT));
  if(!v||typeof v!=="object")return d;
  if(v.gross&&typeof v.gross==="object")d.gross=v.gross;
  if(v.cfg){
    ["rate","limit"].forEach(function(g){if(v.cfg[g])Object.keys(d.cfg[g]).forEach(function(k){if(isFinite(+v.cfg[g][k]))d.cfg[g][k]=+v.cfg[g][k]})});
    if(isFinite(+v.cfg.taxRate))d.cfg.taxRate=+v.cfg.taxRate;
  }
  return d;
}
function taxGross(p){var y=KV.tax.gross[YEAR]||{};return +y[p]||0}

/* 올해 변동지출을 사람(결제자)별·결제수단별로 모은다 */
function taxBuckets(){
  var out={}, empty=function(){return {신용:0,체크:0,현금:0,시장:0,교통:0,문화:0,un:0,unN:0}};
  ["옹","답",""].forEach(function(p){out[p]=empty()});
  for(var m=1;m<=12;m++)VARS.forEach(function(k){S.months[m][k].forEach(function(x){
    if(isEx(x))return;
    var a=+x.amt||0;if(!a)return;
    var b=out[x.payer||""], md=methodOf(x.desc), cat=md.sp||md.pay;
    if(cat)b[cat]+=a;else{b.un+=a;b.unN++}
  })});
  return out;
}
/* 소득공제 대략 계산. 문턱(총급여 25%)은 신용 → 체크·현금 → 도서·공연 → 전통시장 → 대중교통 순서로 채운다 */
function taxCalc(b,G){
  var c=KV.tax.cfg, r=c.rate;
  if(!(G>0))return null;
  var T=G*0.25, rem=T;
  var cats=[["credit",Math.max(0,b.신용),r.credit],["debit",Math.max(0,b.체크+b.현금),r.debit],["culture",G<=70000000?Math.max(0,b.문화):0,r.culture],["market",Math.max(0,b.시장),r.market],["transit",Math.max(0,b.교통),r.transit]];
  var res={}, total=0;
  cats.forEach(function(x){var cut=Math.min(x[1],rem);rem-=cut;res[x[0]]=(x[1]-cut)*x[2]/100;total+=x[1]});
  var baseLimit=(G<=70000000?c.limit.high:G<=120000000?c.limit.mid:c.limit.low)*10000, extraCap=c.limit.extra*10000;
  var all=res.credit+res.debit+res.culture+res.market+res.transit;
  var basic=Math.min(all,baseLimit), excess=Math.max(0,all-baseLimit);
  var extraPool=Math.min(res.market,extraCap)+Math.min(res.transit,extraCap)+Math.min(res.culture,extraCap);
  var deduction=Math.round(basic+Math.min(excess,extraPool));
  return {threshold:T,used:total,toThreshold:Math.max(0,T-total),over:Math.max(0,total-T),deduction:deduction,
    saving:Math.round(deduction*c.taxRate/100*1.1),baseLimit:baseLimit,capped:all>baseLimit};
}

/* ---------- 화면 ---------- */
function taxView(){
  var head='<div class="pagehead"><div><h1>'+YEAR+'년 연말정산 도우미</h1></div></div>';
  if(!KV.ok)return head+kvSetupHTML();
  var B=taxBuckets(), c=KV.tax.cfg;
  function numIn(path,val,cls){return '<input class="'+(cls||"")+'" data-tx="'+path+'" inputmode="'+(cls==="amt"?AMT_MODE:"decimal")+'" value="'+(cls==="amt"?fmtIn(val):val)+'">'}
  var people=["옹","답"].map(function(p){
    var b=B[p], G=taxGross(p), r=taxCalc(b,G), name=p==="옹"?"옹우":"답니";
    var lines=[["신용카드",b.신용],["체크카드",b.체크],["현금영수증",b.현금],["전통시장",b.시장],["대중교통",b.교통],["도서·공연",b.문화]].map(function(x){return sline(x[0],won(x[1]))}).join("");
    var res=r?(sline("사용액 합계(분류된 것)",won(r.used))
      +sline("문턱 (총급여의 25%)",won(Math.round(r.threshold)))
      +(r.toThreshold>0?sline("문턱까지 남은 금액",won(Math.round(r.toThreshold)),"bad"):sline("문턱을 넘은 금액",won(Math.round(r.over)),"good"))
      +sline("예상 소득공제",won(r.deduction)+(r.capped?" (한도 적용)":""),"good")
      +sline("예상 절세 효과(세율 "+c.taxRate+"% 가정)",won(r.saving),"good")):'<p class="dim">총급여를 넣으면 계산돼요.</p>';
    var tip=r&&r.toThreshold>0?'<p class="hint">문턱까지는 신용카드(혜택·포인트), 문턱을 넘은 뒤에는 공제율이 높은 체크카드·현금영수증이 유리한 것이 일반적이에요.</p>':"";
    return '<section class="card" style="padding:14px"><h3 style="margin-bottom:8px">'+name+'</h3>'
      +'<div class="kvrow" style="grid-template-columns:96px minmax(0,1fr)"><label>총급여(연)</label>'+numIn("gross."+p,G,"amt")+'</div>'
      +lines+sline("<b>분류 안 된 지출</b>",won(b.un)+" ("+b.unN+"건)",b.un?"bad":"")+res+tip+'</section>';
  }).join("");
  var none=B[""];
  var noneNote=(none.un||none.신용||none.체크||none.현금||none.시장||none.교통||none.문화)?'<p class="dim" style="margin-top:8px">결제자가 지정되지 않은 변동지출이 있어요(분류 안 된 지출 '+won(none.un)+'원 포함). 결제자를 정해야 사람별로 계산돼요.</p>':"";
  var tool='<section class="card" style="padding:14px;margin-top:14px"><h3 style="margin-bottom:6px">일괄 지정</h3>'
    +'<p class="dim" style="margin:0 0 8px">결제수단이 없는 올해 변동지출에 한꺼번에 결제수단을 붙여요. 항목 ⋯ 메뉴에서 하나씩 바꿀 수도 있어요. (잠긴 달은 건너뛰고, 직전 작업은 "되돌리기"로 되돌릴 수 있어요.)</p>'
    +'<div class="sform"><select id="taxBulkWho" aria-label="결제자"><option value="옹">옹우 결제</option><option value="답">답니 결제</option><option value="">결제자 없음</option></select>'
    +'<select id="taxBulkPay" aria-label="결제수단"><option value="신용">신용카드</option><option value="체크">체크카드</option><option value="현금">현금영수증</option></select>'
    +'<button class="btn" type="button" data-act="taxbulk">분류 안 된 지출에 지정</button></div></section>';
  var cfg='<details class="card taxcfg" style="padding:12px 14px;margin-top:14px"><summary>계산 기준 (수정할 수 있어요)</summary>'
    +'<p class="dim" style="margin:8px 0">세법 기준은 해마다 바뀔 수 있어서 직접 고칠 수 있게 했어요. 확정 기준은 국세청 홈택스에서 확인하세요.</p>'
    +'<div class="taxgrid">'
    +'<label>신용카드 공제율(%)</label>'+numIn("cfg.rate.credit",c.rate.credit)
    +'<label>체크·현금 공제율(%)</label>'+numIn("cfg.rate.debit",c.rate.debit)
    +'<label>전통시장 공제율(%)</label>'+numIn("cfg.rate.market",c.rate.market)
    +'<label>대중교통 공제율(%)</label>'+numIn("cfg.rate.transit",c.rate.transit)
    +'<label>도서·공연 공제율(%)</label>'+numIn("cfg.rate.culture",c.rate.culture)
    +'<label>한도: 총급여 7천만 이하(만원)</label>'+numIn("cfg.limit.high",c.limit.high)
    +'<label>한도: 7천만 초과~1.2억(만원)</label>'+numIn("cfg.limit.mid",c.limit.mid)
    +'<label>한도: 1.2억 초과(만원)</label>'+numIn("cfg.limit.low",c.limit.low)
    +'<label>추가 한도(시장·교통·도서공연 각각, 만원)</label>'+numIn("cfg.limit.extra",c.limit.extra)
    +'<label>절세 계산에 쓸 소득세율(%)</label>'+numIn("cfg.taxRate",c.taxRate)
    +'</div></details>';
  return head
    +'<p class="dim" style="margin:0 0 12px">변동지출 내용에 <b>@신용</b>·<b>@체크</b>·<b>@현금</b>(전통시장·대중교통·도서공연은 @시장·@교통·@문화)이 붙은 항목만 계산에 들어가요. 올해('+YEAR+'년)에 입력한 내용 기준이고, 결과는 <b>대략적인 참고용</b>이에요.</p>'
    +'<div class="homegrid">'+people+'</div>'+noneNote+tool+cfg;
}
function taxInput(t){
  var path=t.getAttribute("data-tx").split(".");
  var val;
  if(path[0]==="gross"){
    val=parseAmt(t);
    var g=KV.tax.gross[YEAR]||(KV.tax.gross[YEAR]={});g[path[1]]=val;
  }else{
    val=parseFloat(String(t.value).replace(",","."));if(!isFinite(val))val=0;
    var o=KV.tax.cfg;for(var i=1;i<path.length-1;i++)o=o[path[i]];
    o[path[path.length-1]]=val;
  }
  saveKV("tax");
  clearTimeout(taxInput.t);
  taxInput.t=setTimeout(function(){
    if(cur==="tax")rtRender();
  },900);
}
function taxBulk(){
  var who=document.getElementById("taxBulkWho").value, pay=document.getElementById("taxBulkPay").value;
  var targets=[], skippedLocked=0, sum=0;
  for(var m=1;m<=12;m++)VARS.forEach(function(k){S.months[m][k].forEach(function(x){
    if(isEx(x)||!(+x.amt)||(x.payer||"")!==who)return;
    var md=methodOf(x.desc);if(md.pay||md.sp)return;
    if(isLocked(YEAR,m)){skippedLocked++;return}
    targets.push(x);sum+=+x.amt||0;
  })});
  if(!targets.length){alert("지정할 항목이 없어요."+(skippedLocked?" (잠긴 달 "+skippedLocked+"건은 건너뛰었어요)":""));return}
  var label=(who==="옹"?"옹우":who==="답"?"답니":"결제자 없음")+" 결제 · "+PAY_TOKENS[pay];
  if(!confirm("분류 안 된 지출 "+targets.length+"건(합계 "+won(sum)+"원)에 '"+PAY_TOKENS[pay]+"'를 붙일까요?"+(skippedLocked?"\n(잠긴 달 "+skippedLocked+"건은 건너뛰어요)":"")))return;
  snapshot("분류 안 된 지출 "+targets.length+"건에 "+PAY_TOKENS[pay]+"을(를) 지정했어요.");
  targets.forEach(function(x){x.desc=withMethod(x.desc,pay,"");markDirty(x.id)});
  logH("연말정산 일괄 지정: "+label+" "+targets.length+"건 "+won(sum)+"원");
  render();
}
function taxAct(b){
  var act=b.getAttribute("data-act");
  if(act==="taxbulk")taxBulk();
}
