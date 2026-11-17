"use strict";
/* 월 화면: 카드·행 그리기, 전월 복사, 합계 갱신(refresh) */
/* ---------- month view ---------- */
function dayPicker(x){
  var m=x._m||1, y=x._y||YEAR, last=new Date(y,m,0).getDate(), mm=("0"+m).slice(-2);
  var dn=parseInt(x.day,10), has=dn>=1&&dn<=last;
  var def=has?dn:((NOW.getFullYear()===y&&NOW.getMonth()+1===m)?NOW.getDate():1);
  return '<span class="dwrap"><button type="button" class="dbtn'+(x.day?"":" empty")+'" data-act="pick" aria-label="날짜 선택">'+(x.day?esc(x.day):"날짜")+'</button>'
    +'<input type="date" class="dinput" tabindex="-1" aria-hidden="true" min="'+y+'-'+mm+'-01" max="'+y+'-'+mm+'-'+("0"+last).slice(-2)+'" value="'+y+'-'+mm+'-'+("0"+def).slice(-2)+'"></span>';
}
function rowHTML(sec,x){
  var del='<span class="racts"><button class="del mv" type="button" data-act="rowmenu" aria-label="수정·삭제·복사" title="수정·삭제·복사">⋯</button></span>';
  var amt='<input class="amt" data-f="amt" inputmode="'+AMT_MODE+'" placeholder="0" aria-label="금액" value="'+fmtIn(x.amt)+'">';
  var payer='<select data-f="payer" aria-label="결제자">'+["","옹","답"].map(function(p){return '<option value="'+p+'"'+(x.payer===p?" selected":"")+'>'+(p||"-")+'</option>'}).join("")+'</select>';
  var name='<input data-f="name" list="dl-'+sec+'" autocomplete="off" placeholder="항목" aria-label="항목" value="'+esc(x.name)+'">';
  var paybtn='<button class="pay" type="button" data-act="pay" data-p="'+esc(x.payer)+'" aria-label="결제자 바꾸기">'+(x.payer||"-")+'</button>';
  var h;
  if(sec==="income"||sec==="saving"){h='<div class="row r2" data-id="'+x.id+'" data-sec="'+sec+'">'+name+amt+del+'</div>'}
  else if(sec==="fixed"){h='<div class="row r3" data-id="'+x.id+'" data-sec="'+sec+'">'+name+paybtn+amt+del+'</div>'}
  else{h='<div class="row r4'+(isEx(x)?' ex':'')+(DUPS.ids[x.id]?' dup':'')+'" data-id="'+x.id+'" data-sec="'+sec+'">'+paybtn+''+dayPicker(x)+'<input data-f="desc" list="dl-'+sec+'" autocomplete="off" placeholder="내용" aria-label="내용" value="'+esc(x.desc)+'">'+amt+del+'</div>'}
  return h;
}
function keyOf(sec){return sec==="income"?"inc":sec==="saving"?"sav":sec==="fixed"?"fix":sec}
function cardHTML(sec,d){
  var k=keyOf(sec);
  var foot=sec==="income"
    ?'<span>합계</span><span data-bind="inc"></span>'
    :'<span>합계</span><span><span class="pct" data-bind="'+k+'P"></span><span data-bind="'+k+'"></span></span>';
  var copyBtn=(sec==="income"||sec==="saving"||sec==="fixed")?'<button class="add" type="button" data-act="copysec" data-sec="'+sec+'" title="전월 '+SECS[sec]+'을(를) 이번 달로 복사">전월 복사</button>':"";
  var tplBtn=(sec==="income"||sec==="saving"||sec==="fixed")?'<button class="add" type="button" data-act="tpl" data-sec="'+sec+'" title="매달 반복되는 항목을 템플릿으로 저장·적용">템플릿</button>':"";
  var budBtn=isVar(sec)?'<button class="add" type="button" data-act="budget" data-sec="'+sec+'" title="월 예산 설정">예산</button>':"";
  var varBtns=isVar(sec)?'<button class="add" type="button" data-act="paste" data-sec="'+sec+'" title="여러 줄을 한 번에 붙여넣기">붙여넣기</button><button class="add" type="button" data-act="sortday" data-sec="'+sec+'" title="날짜순으로 정렬">날짜순</button>':"";
  return '<section class="card sec-'+sec+'"><div class="card-h"><h3>'+SECS[sec]+'</h3><span class="card-btns">'+copyBtn+tplBtn+varBtns+budBtn+'<button class="add" type="button" data-act="add" data-sec="'+sec+'">+ 추가</button></span></div>'
    +(isVar(sec)?quickHTML(sec):"")
    +'<div class="rows">'+d[sec].map(function(x){return rowHTML(sec,x)}).join("")+'</div>'
    +'<div class="card-f">'+foot+'</div>'
    +(isVar(sec)?'<div class="bud" data-budget="'+sec+'" hidden></div>':"")+'</section>';
}
var DUPS={ids:{},groups:[]};
function monthView(m){
  DUPS=findDups(m);
  var d=S.months[m];
  var spend='<div class="stat"><span class="lb">이달의 지출</span><div class="v"><span data-bind="exp"></span><small data-bind="expP"></small></div></div>';
  var room='<div class="stat key"><span class="lb">이달의 비상금<br>수입 − 저축 − 지출</span><div class="v" data-bind="room"></div></div>';
  var settle='<section class="settle" aria-label="결제자별 합계">'
    +'<div class="who o"><span class="lb"><i></i>옹우한테 보내준 돈</span><div class="v" data-bind="sendO"></div><span class="sub">옹 결제 항목 합계</span></div>'
    +'<div class="who d"><span class="lb"><i></i>답니한테 보내준 돈</span><div class="v" data-bind="sendD"></div><span class="sub">답 결제 항목 합계</span></div></section>';
  var avail='<div class="stat"><label for="top-avail">가용금액 합계</label><input id="top-avail" class="amt" data-top="avail" inputmode="'+AMT_MODE+'" placeholder="0" value="'+fmtIn(d.avail)+'">'
    +'<span class="hint">올해 1~'+m+'월 비상금 누적 <b data-bind="cumRoom"></b><button type="button" data-act="availauto">자동 입력</button></span></div>'
    +'<div class="stat"><label for="top-baby">하꿍이 저축 합계 (25일 기준)</label><input id="top-baby" class="amt" data-top="baby" inputmode="'+AMT_MODE+'" placeholder="0" value="'+fmtIn(d.baby)+'">'
    +'<span class="hint" data-bind="babyHint"></span></div>';
  return '<div class="pagehead"><div><h1>'+YEAR+'년 '+m+'월 〈조이쀼의 가계부〉</h1><div class="dupnote" data-bind="dupNote"></div></div>'
    +'<div class="pager"><button class="btn" type="button" data-act="gocal">달력</button><button class="btn" type="button" data-go="m'+(m-1)+'"'+(m===1?" disabled":"")+'>이전 달</button><button class="btn" type="button" data-go="m'+(m+1)+'"'+(m===12?" disabled":"")+'>다음 달</button></div></div>'
    +qlineHTML()
    +'<div class="sheetwrap"><div class="sheet">'
      +'<div class="zone z1">'+cardHTML("income",d)+cardHTML("saving",d)+spend+room+'</div>'
      +'<div class="zone z2">'+cardHTML("fixed",d)+avail+settle+'</div>'
      +'<div class="z3">'+VARS.map(function(k){return cardHTML(k,d)}).join("")+'</div>'
    +'</div></div>'+datalistsHTML();
}
/* 항목명 자동완성: 올해 입력한 항목명을 많이 쓴 순서로 제안 */
function datalistsHTML(){
  return ALL.map(function(sec){
    var cnt={}, v=isVar(sec);
    for(var m=1;m<=12;m++)S.months[m][sec].forEach(function(x){
      var s=(v?x.desc:x.name)||"";
      s=s.replace(/^\[제외\]\s*/,"").trim();
      if(!s||(!v&&/\d{1,2}월/.test(s)))return;
      cnt[s]=(cnt[s]||0)+1;
    });
    var list=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]||(a<b?-1:1)}).slice(0,120);
    return '<datalist id="dl-'+sec+'">'+list.map(function(s){return '<option value="'+esc(s)+'">'}).join("")+'</datalist>';
  }).join("");
}
/* 같은 이름으로 마지막에 입력한 금액·결제자를 찾아 빈 금액에 채워 준다 */
function lastLike(sec,label,selfId){
  var v=isVar(sec), key=label.replace(/^\[제외\]\s*/,"").trim(), found=null;
  if(!key)return null;
  for(var m=1;m<=12;m++)S.months[m][sec].forEach(function(x){
    if(x.id===selfId||!(+x.amt))return;
    var s=((v?x.desc:x.name)||"").replace(/^\[제외\]\s*/,"").trim();
    if(s===key)found=x;
  });
  return found;
}
/* 전월 복사(수입·저축·고정지출): 항목명·결제자·금액을 그대로 가져온다. 1월은 전년 12월에서 가져온다.
   항목명 안의 전월 숫자("10월 대출 이자상환", "청년미래적금 10월")는 이번 달 숫자로 바꾼다. */
async function copySection(sec,m){
  var src, pm=(m>1?m-1:12), prevLabel=pm+"월", sname=SECS[sec];
  var monthRe=new RegExp("(^|[^0-9])"+pm+"월","g");
  try{
    if(m>1){
      src=S.months[m-1][sec].map(function(x){return {name:x.name,payer:x.payer,amt:+x.amt||0}});
    }else{
      var r=await sb.from("entries").select("label,payer,amount").eq("household_id",HH).eq("year",YEAR-1).eq("month",12).eq("section",sec)
        .order("sort_order",{ascending:true}).order("created_at",{ascending:true});
      if(r.error)throw r.error;
      src=r.data.map(function(x){return {name:x.label||"",payer:x.payer||"",amt:Number(x.amount)||0}});
    }
  }catch(e){alert("전월 "+sname+" 내용을 불러오지 못했어요.");return}
  if(cur!==m)return;
  if(!src.length){alert((m>1?prevLabel:(YEAR-1)+"년 "+prevLabel)+"에 "+sname+" 항목이 없어요.");return}
  var d=S.months[m];
  var msg=d[sec].length
    ?m+"월 "+sname+" "+d[sec].length+"개를 지우고 "+prevLabel+" 내용("+src.length+"개)으로 바꿀까요?"
    :prevLabel+" "+sname+" "+src.length+"개를 "+m+"월에 복사할까요?";
  if(!confirm(msg))return;
  snapshot(m+"월 "+sname+" 전월 복사를 했어요.");
  logH(m+"월 "+sname+" 전월 복사 ("+src.length+"개"+(d[sec].length?", 기존 "+d[sec].length+"개 교체":"")+")");
  d[sec].forEach(function(x){delete dirty[x.id];dels[x.id]=true});
  d[sec]=src.map(function(s,i){
    var it=mkItem(m,sec,{name:s.name.replace(monthRe,function(_,p){return p+m+"월"}),payer:s.payer,amt:s.amt,order:i});
    dirty[it.id]=true;return it;
  });
  schedule();render();
}
function refresh(){
  var r=calc(cur), inc=r.inc, map={};
  ["inc","sav","fix","food","living","life","etc","exp","room","sendO","sendD"].forEach(function(k){map[k]=won(r[k])});
  ["sav","fix","food","living","life","etc","exp"].forEach(function(k){map[k+"P"]=pc(r[k],inc)});
  map.expP=inc>0?"수입의 "+pc(r.exp,inc):"";
  var dpx=findDups(cur);
  map.dupNote=dpx.groups.length?"같은 날 같은 내용·금액이 겹친 항목이 "+dpx.groups.length+"쌍 있어요 (주황색 표시)":"";
  document.querySelectorAll(".row.r4").forEach(function(rw){rw.classList.toggle("dup",!!dpx.ids[rw.getAttribute("data-id")])});
  var cum=cumRoom(cur);
  map.cumRoom=won(cum);
  var bb=S.months[cur].baby||0, pb=cur>1?(S.months[cur-1].baby||0):null;
  map.babyHint=pb===null?"":(bb||pb?"전월 "+won(pb)+" → 증감 "+won(bb-pb):"");
  document.querySelectorAll("[data-bind]").forEach(function(el){
    var k=el.getAttribute("data-bind");
    el.textContent=map[k]==null?"":map[k];
    if(k==="room"){el.classList.toggle("neg",r.room<0);el.classList.toggle("pos",r.room>0)}
  });
  checkBudgets(r);
  VARS.forEach(function(k){
    var el=document.querySelector('[data-budget="'+k+'"]'), b=+KV.budgets[k]||0;
    if(!el)return;
    if(!b){el.hidden=true;el.innerHTML="";return}
    var spent=r[k], p=spent/b;
    el.hidden=false;el.className="bud "+(p>1?"over":p>=0.8?"warn":"ok");
    el.innerHTML='<div class="bar"><i style="width:'+Math.max(0,Math.min(100,p*100)).toFixed(1)+'%"></i></div>'
      +'<div class="bl"><span>예산 '+won(b)+'</span><span>'+(spent>b?won(spent-b)+' 초과':won(b-spent)+' 남음')+'</span></div>';
  });
}
