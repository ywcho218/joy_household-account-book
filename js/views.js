"use strict";
/* 월별 비교·검색·메모 화면, 월 화면 밖의 입력/클릭 처리 */
/* ---------- 카테고리별 월간 비교 ---------- */
var CMP=[["exp","전체 지출"],["fix","고정지출"],["food","식비/외식비"],["living","생필품비"],["life","교통·문화·병원 등"],["etc","기타"],["inc","수입"],["sav","저축"]];
var cmpKey="exp";
function compareView(){
  var rs=[], key=cmpKey, inc=(key==="inc"||key==="sav");
  for(var m=1;m<=12;m++)rs.push(calc(m));
  var isTag=key.indexOf("tag:")===0, tagList=tagStats().slice(0,8);
  if(isTag){var tg=key.slice(4);rs.forEach(function(r,i){r[key]=tagSum(i+1,tg)})}
  var max=0;rs.forEach(function(r){max=Math.max(max,Math.abs(r[key]))});
  var bud=VARS.indexOf(key)>=0?(+KV.budgets[key]||0):0;
  if(bud)max=Math.max(max,bud);
  if(!max)max=1;
  var label=isTag?"#"+key.slice(4):CMP.filter(function(c){return c[0]===key})[0][1];
  var chips=CMP.concat(tagList.map(function(t){return ["tag:"+t.t,"#"+t.t]})).map(function(c){return '<button type="button" class="chip'+(c[0]===key?" on":"")+'" data-act="cmp" data-k="'+c[0]+'">'+c[1]+'</button>'}).join("");
  var vals=rs.map(function(r){return r[key]}), nz=vals.filter(function(v){return v!==0});
  var total=vals.reduce(function(s,v){return s+v},0), avg=nz.length?Math.round(total/nz.length):0;
  var mx=0;vals.forEach(function(v,i){if(Math.abs(v)>Math.abs(vals[mx]))mx=i});
  var rows=rs.map(function(r,i){
    var m=i+1, v=r[key], pv=i>0?rs[i-1][key]:null, delta="";
    if(pv!==null&&(v||pv)){
      var df=v-pv, pct=pv?Math.round(Math.abs(df)/Math.abs(pv)*100):null;
      var good=inc?df>0:df<0;
      delta='<span class="dl '+(df===0?"":good?"good":"bad")+'">'+(df>0?"▲ ":df<0?"▼ ":"")+won(Math.abs(df))+(pct!==null&&df?" ("+pct+"%)":"")+'</span>';
    }
    return '<div class="cmprow'+(m===curM?" now":"")+'" data-go="m'+m+'" role="link" tabindex="0">'
      +'<span class="mm">'+m+'월</span>'
      +'<span class="bar"><i class="'+(bud&&v>bud?"over":"")+'" style="width:'+(Math.abs(v)/max*100).toFixed(1)+'%"></i>'+(bud?'<b style="left:'+(bud/max*100).toFixed(1)+'%" title="예산"></b>':"")+'</span>'
      +'<span class="val">'+won(v)+'</span>'+delta+'</div>';
  }).join("");
  var cols=[["fix","고정"],["food","식비"],["living","생필품"],["life","교통·문화"],["etc","기타"],["exp","지출 합계"]];
  var colMax={};cols.forEach(function(c){var b=0;rs.forEach(function(r,i){if(r[c[0]]>rs[b][c[0]])b=i});colMax[c[0]]=b});
  var thead='<tr><th>월</th>'+cols.map(function(c){return '<th>'+c[1]+'</th>'}).join("")+'</tr>';
  var tbody=rs.map(function(r,i){
    return '<tr data-go="m'+(i+1)+'"><td>'+(i+1)+'월</td>'+cols.map(function(c){return '<td class="'+(r[c[0]]&&colMax[c[0]]===i?"mx":"")+'">'+won(r[c[0]])+'</td>'}).join("")+'</tr>';
  }).join("");
  var tfoot='<tr><td>합계</td>'+cols.map(function(c){return '<td>'+won(rs.reduce(function(s,r){return s+r[c[0]]},0))+'</td>'}).join("")+'</tr>';
  return '<div class="pagehead"><div><h1>'+YEAR+'년 월별 비교</h1></div></div>'
    +'<div class="chips">'+chips+'</div>'
    +'<section class="card" style="padding:14px"><div class="cmpmeta"><b>'+label+'</b><span>합계 '+won(total)+'</span><span>월평균 '+won(avg)+'</span>'
    +(nz.length?'<span>최대 '+(mx+1)+'월</span>':"")+(bud?'<span>예산 '+won(bud)+' (세로 선)</span>':"")+'</div>'
    +'<div class="cmplist">'+rows+'</div></section>'
    +'<section class="card" style="padding:14px;margin-top:14px"><h3 style="margin-bottom:8px">한눈에 보기</h3><div class="tscroll"><table class="cmptbl"><thead>'+thead+'</thead><tbody>'+tbody+'</tbody><tfoot>'+tfoot+'</tfoot></table></div>'
    +'<p class="dim" style="margin-top:8px">굵게 표시한 칸이 그 항목에서 가장 많이 쓴 달이에요. 행을 누르면 그 달로 이동해요.</p></section>';
}

/* ---------- 검색/필터 ---------- */
var SR={q:"",sec:"",payer:"",all:false,seq:0}, srTimer=null;
function searchView(){
  return '<div class="pagehead"><div><h1>검색</h1></div></div><section class="card" style="padding:14px">'
    +'<div class="sform"><input id="srQ" data-sf="q" type="search" placeholder="내용·항목 검색 (예: 병원, 스타벅스)" autocomplete="off" value="'+esc(SR.q)+'">'
    +'<select data-sf="sec" aria-label="구분"><option value="">전체 구분</option>'+ALL.map(function(k){return '<option value="'+k+'"'+(SR.sec===k?" selected":"")+'>'+SECS[k]+'</option>'}).join("")+'</select>'
    +'<select data-sf="payer" aria-label="결제자"><option value="">결제자 전체</option><option value="옹"'+(SR.payer==="옹"?" selected":"")+'>옹</option><option value="답"'+(SR.payer==="답"?" selected":"")+'>답</option></select>'
    +'<label class="chk"><input type="checkbox" data-sf="all"'+(SR.all?" checked":"")+'> 모든 연도</label></div>'
    +'<div id="srRes" class="sres" aria-live="polite"></div></section>';
}
function srShow(list,note){
  var el=document.getElementById("srRes");if(!el)return;
  var tot=0;list.forEach(function(x){if(!x.ex)tot+=x.amt});
  var shown=list.slice(0,300);
  el.innerHTML='<div class="srsum"><b>'+list.length+'건</b><span>합계 '+won(tot)+'</span>'+(note?'<span class="dim">'+note+'</span>':"")+'</div>'
    +(list.length?'<div class="srlist">'+shown.map(function(x){
      return '<a class="srrow'+(x.ex?" ex":"")+'" href="#'+x.y+'-m'+x.m+'"><span class="srd">'+x.y+'.'+x.m+(x.day?" "+esc(x.day):"")+'</span><span class="srs">'+SECS[x.sec]+'</span><span class="srl">'+esc(x.label)+'</span><span class="srp">'+esc(x.payer)+'</span><span class="sra">'+won(x.amt)+'</span></a>';
    }).join("")+'</div>'+(list.length>300?'<p class="dim">앞의 300건만 보여요. 조건을 좁혀 보세요.</p>':""):"");
}
async function searchRun(){
  var el=document.getElementById("srRes");if(!el)return;
  var q=SR.q.trim().toLowerCase();
  if(!q&&!SR.sec&&!SR.payer){el.innerHTML='<p class="dim">검색어를 입력하거나 구분·결제자를 골라 보세요.</p>';return}
  var seq=++SR.seq;
  if(!SR.all){
    var out=[];
    for(var m=1;m<=12;m++)ALL.forEach(function(sec){
      if(SR.sec&&SR.sec!==sec)return;
      S.months[m][sec].forEach(function(x){
        var label=(isVar(sec)?x.desc:x.name)||"";
        if(q&&label.toLowerCase().indexOf(q)<0)return;
        if(SR.payer&&x.payer!==SR.payer)return;
        out.push({y:YEAR,m:m,sec:sec,label:label,day:x.day,payer:x.payer||"",amt:+x.amt||0,ex:isEx(x)});
      });
    });
    srShow(out,YEAR+"년 안에서 검색");return;
  }
  el.innerHTML='<p class="dim">모든 연도에서 찾는 중…</p>';
  try{
    var rq=sb.from("entries").select("year,month,section,label,day,amount,payer").eq("household_id",HH);
    if(q)rq=rq.ilike("label","%"+q.replace(/[%_\\]/g,"\\$&")+"%");
    if(SR.sec)rq=rq.eq("section",SR.sec);
    if(SR.payer)rq=rq.eq("payer",SR.payer);
    var r=await rq.order("year",{ascending:false}).order("month",{ascending:true}).limit(1000);
    if(r.error)throw r.error;
    if(seq!==SR.seq)return;
    srShow(r.data.map(function(x){var v=isVar(x.section);return {y:x.year,m:x.month,sec:x.section,label:x.label||"",day:v?x.day:"",payer:x.payer||"",amt:Number(x.amount)||0,ex:(x.label||"").indexOf("[제외]")===0}}),"모든 연도에서 검색");
  }catch(e){if(seq===SR.seq)el.innerHTML='<p class="dim">검색하지 못했어요. 네트워크를 확인해 주세요.</p>'}
}

/* ---------- 메모 ---------- */
function memoView(){
  var head='<div class="pagehead"><div><h1>메모</h1></div><div class="pager"><button class="btn" type="button" data-act="memoadd">+ 새 메모</button></div></div>';
  if(!KV.ok)return head+kvSetupHTML();
  if(!KV.memo.length)return head+'<p class="dim">아직 메모가 없어요. "+ 새 메모"로 시작해 보세요. (대출 정산, 대학원 비용 등 자유롭게 적어요)</p>';
  return head+'<div class="memos">'+KV.memo.map(function(n){
    return '<section class="card memo" data-mid="'+n.id+'"><div class="card-h"><input class="mtitle" data-mf="title" placeholder="제목" aria-label="메모 제목" value="'+esc(n.title)+'">'
      +'<button class="del" type="button" data-act="memodel" aria-label="메모 삭제">×</button></div>'
      +'<textarea class="mbody" data-mf="body" placeholder="내용" aria-label="메모 내용">'+esc(n.body)+'</textarea>'
      +'<div class="mdate">'+(n.t?new Date(n.t).toLocaleDateString("ko-KR")+" 수정":"")+'</div></section>';
  }).join("")+'</div>';
}
function viewInput(t){
  var sf=t.getAttribute("data-sf");
  if(sf){
    if(sf==="all")SR.all=t.checked;else SR[sf]=t.value;
    clearTimeout(srTimer);srTimer=setTimeout(searchRun,SR.all?450:120);return;
  }
  var mf=t.getAttribute("data-mf");
  if(mf){
    var card=t.closest("[data-mid]");if(!card)return;
    var n=KV.memo.filter(function(x){return x.id===card.getAttribute("data-mid")})[0];
    if(n){n[mf]=t.value;n.t=Date.now();saveKV("memo")}
  }
}
function viewAct(b){
  var act=b.getAttribute("data-act");
  if(act==="cmp"){cmpKey=b.getAttribute("data-k");render()}
  else if(act==="calprev"){calM=Math.max(1,(calM||lastMonth||homeMonth())-1);calSel=null;render()}
  else if(act==="calnext"){calM=Math.min(12,(calM||lastMonth||homeMonth())+1);calSel=null;render()}
  else if(act==="calday"){calSel=+b.getAttribute("data-d");render()}
  else if(/^car/.test(act)){carAct(b)}
  else if(act==="tagsearch"){SR.q="#"+b.getAttribute("data-tag");SR.sec="";SR.payer="";SR.all=false;location.hash=YEAR+"-search"}
  else if(act==="memoadd"){
    if(!KV.ok){kvAlert();return}
    KV.memo.unshift({id:newId(),title:"",body:"",t:Date.now()});saveKV("memo");render();
    var f=main.querySelector('[data-mf="title"]');if(f)f.focus();
  }else if(act==="memodel"){
    if(!confirm("지우시겠습니까?"))return;
    var card=b.closest("[data-mid]"), id=card&&card.getAttribute("data-mid");
    KV.memo=KV.memo.filter(function(x){return x.id!==id});saveKV("memo");render();
  }
}
