"use strict";
/* 차계부: 주유·보험·세금·정비 기록과 요약. 저장은 app_kv의 'car' 키(기록 id별로 병합해서 저장) */
var CAR_KINDS=["주유","보험","세금·등록","정비·소모품","주차·통행","기타"];
var carF={year:"all",kind:"all"};
var carDirtyIds={}, carDelIds={}, carEditId=null, carAuto=true;
KV.car={records:[]};

function carNorm(v){
  var a=(v&&Array.isArray(v.records))?v.records:[];
  return {records:a.map(function(x){
    return {id:x.id||newId(),date:x.date||"",place:x.place||"",kind:CAR_KINDS.indexOf(x.kind)>=0?x.kind:"기타",
      amount:+x.amount||0,discount:+x.discount||0,pay:x.pay||"",unit:+x.unit||0,liters:+x.liters||0,odo:+x.odo||0,memo:x.memo||""};
  })};
}
/* 순비용 = 금액 − 할인. 상품권으로 결제한 건은 0원으로 본다 */
function carNet(r){return /상품권/.test(r.pay||"")?0:(+r.amount||0)-(+r.discount||0)}
function carById(id){return KV.car.records.filter(function(x){return x.id===id})[0]}
function carDateLabel(d){return d?d.slice(2).replace(/-/g,"."):""}

/* ---------- 저장: 서버에 있는 최신 기록과 id별로 합쳐서 올린다 ---------- */
function carApplyServer(list){
  var local=carNorm({records:list}).records;
  var keep=KV.car.records.filter(function(x){return carDirtyIds[x.id]});
  var have={};local.forEach(function(x,i){have[x.id]=i});
  keep.forEach(function(x){if(have[x.id]!=null)local[have[x.id]]=x;else local.push(x)});
  KV.car.records=local.filter(function(x){return !carDelIds[x.id]});
}
async function flushCar(){
  clearTimeout(kvTimer.car);
  if(!kvDirty.car)return;
  delete kvDirty.car;
  var dirtyIds=Object.keys(carDirtyIds), delIds=Object.keys(carDelIds);
  carDirtyIds={};carDelIds={};
  try{
    var r=await sb.from("app_kv").select("value").eq("household_id",HH).eq("key","car");
    if(r.error)throw r.error;
    var server=(r.data&&r.data[0]&&r.data[0].value&&r.data[0].value.records)||[];
    var map={}, order=[];
    server.forEach(function(x){if(!map[x.id])order.push(x.id);map[x.id]=x});
    delIds.forEach(function(id){delete map[id]});
    dirtyIds.forEach(function(id){var l=carById(id);if(l){if(!map[id])order.push(id);map[id]=l}});
    var merged=order.filter(function(id){return map[id]}).map(function(id){return map[id]});
    var w=await sb.from("app_kv").upsert({household_id:HH,key:"car",value:{records:merged},updated_at:new Date().toISOString()},{onConflict:"household_id,key"});
    if(w.error)throw w.error;
    carApplyServer(merged);
    if(cur==="car"&&!editingNow()&&!document.getElementById("carDlg").open)render();
  }catch(e){
    dirtyIds.forEach(function(id){carDirtyIds[id]=true});delIds.forEach(function(id){carDelIds[id]=true});
    kvDirty.car=true;setStatus("저장 실패 (차계부). 5초 뒤 다시 시도해요",true);
    kvTimer.car=setTimeout(function(){flushCar()},5000);
  }
}
function carChanged(id,deleted){
  if(deleted){carDelIds[id]=true;delete carDirtyIds[id]}
  else{carDirtyIds[id]=true;delete carDelIds[id]}
  saveKV("car");
}
/* 백업 복원: 지금 있는 기록을 모두 지우고 파일의 기록으로 바꾼다 */
function carReplaceAll(records){
  var have={};records.forEach(function(x){have[x.id]=true});
  KV.car.records.forEach(function(x){if(!have[x.id])carDelIds[x.id]=true});
  records.forEach(function(x){carDirtyIds[x.id]=true;delete carDelIds[x.id]});
  KV.car.records=records;
  saveKV("car");
}

/* ---------- 계산 ---------- */
function carYears(){
  var s={};KV.car.records.forEach(function(r){if(r.date)s[r.date.slice(0,4)]=1});
  return Object.keys(s).sort().reverse();
}
function carByYear(){
  return KV.car.records.filter(function(r){return carF.year==="all"||(r.date||"").slice(0,4)===carF.year});
}
function carStats(list){
  var by={}, net=0;CAR_KINDS.forEach(function(k){by[k]=0});
  list.forEach(function(r){var n=carNet(r);by[r.kind]+=n;net+=n});
  var fuel=list.filter(function(r){return r.kind==="주유"});
  var withL=fuel.filter(function(r){return r.liters>0});
  var litSum=withL.reduce(function(s,r){return s+r.liters},0), amtSum=withL.reduce(function(s,r){return s+r.amount},0);
  var odo=list.filter(function(r){return r.odo>0}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.odo-b.odo});
  var st={net:net,by:by,fuelCount:fuel.length,liters:litSum,avgPrice:litSum?Math.round(amtSum/litSum):0,dist:0,spanCost:0,eff:0,missing:0,odoN:odo.length};
  if(odo.length>=2){
    var a=odo[0], b=odo[odo.length-1], dist=b.odo-a.odo;
    if(dist>0){
      st.dist=dist;
      var span=list.filter(function(r){return r.date>a.date&&r.date<=b.date});
      st.spanCost=span.reduce(function(s,r){return s+carNet(r)},0);
      var sf=span.filter(function(r){return r.kind==="주유"});
      var sl=sf.reduce(function(s,r){return s+(r.liters>0?r.liters:0)},0);
      st.missing=sf.filter(function(r){return !(r.liters>0)}).length;
      st.eff=sl>0?dist/sl:0;
    }
  }
  return st;
}

/* ---------- 화면 ---------- */
function carView(){
  var head='<div class="pagehead"><div><h1>차계부</h1></div><div class="pager"><button class="btn" type="button" data-act="carcsv">CSV</button><button class="btn primary" type="button" data-act="caradd">+ 기록 추가</button></div></div>';
  if(!KV.ok)return head+kvSetupHTML();
  var all=KV.car.records;
  if(!all.length)return head+'<p class="dim">아직 기록이 없어요. "+ 기록 추가"로 주유·보험·세금·정비를 적어 보세요. 주유는 단가와 리터만 넣으면 금액이 자동으로 계산돼요.</p>';
  var years=carYears();
  if(carF.year!=="all"&&years.indexOf(carF.year)<0)carF.year="all";
  var yl=carByYear(), st=carStats(yl);
  var yChips='<button type="button" class="chip'+(carF.year==="all"?" on":"")+'" data-act="caryear" data-v="all">전체 기간</button>'
    +years.map(function(y){return '<button type="button" class="chip'+(carF.year===y?" on":"")+'" data-act="caryear" data-v="'+y+'">'+y+'년</button>'}).join("");
  var kChips='<button type="button" class="chip'+(carF.kind==="all"?" on":"")+'" data-act="carkind" data-v="all">전체</button>'
    +CAR_KINDS.map(function(k){return '<button type="button" class="chip'+(carF.kind===k?" on":"")+'" data-act="carkind" data-v="'+k+'">'+k+'</button>'}).join("");
  function card(k,v,key,sub){return '<div class="kvc'+(key?" key":"")+'"><div class="k">'+k+'</div><div class="v">'+v+'</div>'+(sub?'<div class="k" style="margin-top:3px">'+sub+'</div>':"")+'</div>'}
  var other=st.by["주차·통행"]+st.by["기타"];
  var cards1='<div class="kvgrid">'+card("총 유지비",won(st.net),1,yl.length+"건 · 상품권 결제는 0원")
    +card("주유비",won(st.by["주유"]),0,st.fuelCount+"번")+card("보험",won(st.by["보험"]))+card("세금·등록",won(st.by["세금·등록"]))
    +card("정비·소모품",won(st.by["정비·소모품"]))+card("주차·통행·기타",won(other))+'</div>';
  var odoNote=st.odoN<2?"키로수를 2번 이상 입력하면 계산돼요":st.dist?"":"키로수가 늘지 않았어요";
  var cards2='<div class="kvgrid">'+card("평균 주유 단가",st.avgPrice?won(st.avgPrice)+"원/L":"-",0,st.liters?"주유 "+st.liters.toFixed(1)+"L":"리터를 입력하면 계산돼요")
    +card("주행거리",st.dist?st.dist.toLocaleString("ko-KR")+" km":"-",0,odoNote)
    +card("km당 유지비",st.dist?won(Math.round(st.spanCost/st.dist))+"원":"-",0,st.dist?"주행 구간 유지비 "+won(st.spanCost):"")
    +card("추정 연비",st.eff?st.eff.toFixed(1)+" km/L":"-",0,st.eff?"주행거리 ÷ 구간 주유량"+(st.missing?" · 리터 빠진 주유 "+st.missing+"건":""):"")
    +'</div>';
  /* 월별 유지비 */
  var months={};
  yl.forEach(function(r){var m=(r.date||"").slice(0,7);if(!m)return;var o=months[m]||(months[m]={s:0,n:0});o.s+=carNet(r);o.n++});
  var ml=Object.keys(months).sort().slice(-18), mx=1;
  ml.forEach(function(m){mx=Math.max(mx,months[m].s)});
  var monthRows=ml.map(function(m){
    var o=months[m];
    return '<div class="cmprow annrow"><span class="mm">'+m.slice(0,4)+'.'+m.slice(5)+'</span><span class="bar"><i style="width:'+(Math.max(0,o.s)/mx*100).toFixed(1)+'%"></i></span><span class="val">'+won(o.s)+'</span><span class="dl">'+o.n+'건</span></div>';
  }).join("");
  /* 기록 목록 */
  var list=yl.filter(function(r){return carF.kind==="all"||r.kind===carF.kind})
    .sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0});
  var rows=list.map(function(r){
    var net=carNet(r), sub=[];
    if(r.kind==="주유"&&(r.unit||r.liters))sub.push((r.unit?won(r.unit)+"원":"")+(r.liters?" × "+r.liters+"L":""));
    if(r.odo)sub.push(r.odo.toLocaleString("ko-KR")+"km");
    if(r.pay)sub.push(r.pay);
    if(r.memo)sub.push(r.memo);
    var note=/상품권/.test(r.pay||"")?"상품권 · 0원 처리":(r.discount?"할인 −"+won(r.discount):"");
    return '<button type="button" class="srrow carrow" data-act="caredit" data-id="'+r.id+'">'
      +'<span class="srd">'+esc(carDateLabel(r.date))+'</span><span class="srs"><i class="kindtag" data-k="'+esc(r.kind)+'">'+esc(r.kind)+'</i></span>'
      +'<span class="srl">'+esc(r.place||"(장소 없음)")+(sub.length?'<small>'+esc(sub.join(" · "))+'</small>':"")+'</span>'
      +'<span class="sra">'+won(net)+(note?'<small>'+esc(note)+'</small>':"")+'</span></button>';
  }).join("");
  return head
    +'<div class="chips">'+yChips+'</div>'
    +cards1+cards2
    +'<section class="card" style="padding:14px"><h3 style="margin-bottom:8px">월별 유지비'+(carF.year==="all"?"":" ("+carF.year+"년)")+'</h3><div class="cmplist">'+(monthRows||'<p class="dim">기록이 없어요.</p>')+'</div></section>'
    +'<section class="card" style="padding:14px;margin-top:14px"><h3 style="margin-bottom:8px">기록 ('+list.length+'건)</h3><div class="chips" style="margin-bottom:8px">'+kChips+'</div><div class="srlist">'+(rows||'<p class="dim">조건에 맞는 기록이 없어요.</p>')+'</div></section>'
    +'<p class="dim" style="margin-top:10px">추정 연비는 첫·마지막 키로수 사이의 주유량으로 어림한 값이라, 만땅이 아닌 주유가 섞여 있으면 오차가 있어요. 키로수는 주유할 때마다 적어 두면 더 정확해져요.</p>';
}

/* ---------- 기록 추가·수정 모달 ---------- */
var carDlg=document.getElementById("carDlg");
function $car(id){return document.getElementById(id)}
function carListHTML(field){
  var cnt={};
  KV.car.records.forEach(function(r){var v=(r[field]||"").trim();if(v)cnt[v]=(cnt[v]||0)+1});
  return Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]}).slice(0,40).map(function(v){return '<option value="'+esc(v)+'">'}).join("");
}
function carFuelToggle(){
  var fuel=$car("carKind").value==="주유";
  ["carUnitRow","carUnit","carLitersRow","carLiters"].forEach(function(id){$car(id).hidden=!fuel});
}
function carHint(){
  var amt=+String($car("carAmt").value).replace(/[^\d-]/g,"")||0;
  var dis=+String($car("carDisc").value).replace(/[^\d]/g,"")||0, pay=$car("carPay").value;
  var net=/상품권/.test(pay)?0:amt-dis;
  $car("carHint").textContent="순비용 "+won(net)+(/상품권/.test(pay)?" (상품권 결제는 0원으로 계산해요)":"");
}
function carOpen(id){
  if(!KV.ok){kvAlert();return}
  var r=id?carById(id):null;carEditId=r?r.id:null;
  $car("carTitle").textContent=r?"차계부 기록 수정":"차계부 기록 추가";
  var today=new Date(), iso=today.getFullYear()+"-"+("0"+(today.getMonth()+1)).slice(-2)+"-"+("0"+today.getDate()).slice(-2);
  $car("carKind").innerHTML=CAR_KINDS.map(function(k){return '<option value="'+k+'">'+k+'</option>'}).join("");
  $car("carPlaces").innerHTML=carListHTML("place");$car("carPays").innerHTML=carListHTML("pay");
  $car("carDate").value=r?r.date:iso;
  $car("carKind").value=r?r.kind:"주유";
  $car("carPlace").value=r?r.place:"";
  $car("carUnit").value=r&&r.unit?fmtIn(r.unit):"";
  $car("carLiters").value=r&&r.liters?String(r.liters):"";
  $car("carAmt").value=r?fmtIn(r.amount):"";
  $car("carDisc").value=r&&r.discount?fmtIn(r.discount):"";
  $car("carPay").value=r?r.pay:"";
  $car("carOdo").value=r&&r.odo?fmtIn(r.odo):"";
  $car("carMemo").value=r?r.memo:"";
  carAuto=!r;
  $car("carDel").hidden=!r;
  ["carUnit","carAmt","carDisc","carOdo"].forEach(function(i){$car(i).inputMode=AMT_MODE});
  carFuelToggle();carHint();
  if(carDlg.showModal)carDlg.showModal();else carDlg.setAttribute("open","");
}
function carClose(){if(carDlg.close)carDlg.close();else carDlg.removeAttribute("open")}
function carAutoAmount(){
  if(!carAuto)return;
  var unit=+String($car("carUnit").value).replace(/\D/g,"")||0, lit=parseFloat(String($car("carLiters").value).replace(",","."))||0;
  if(unit>0&&lit>0)$car("carAmt").value=fmtIn(Math.round(unit*lit));
}
["carUnit","carAmt","carDisc","carOdo"].forEach(function(id){
  $car(id).addEventListener("input",function(e){
    var v=parseAmt(e.target);
    if(id==="carAmt")carAuto=false;
    if(id==="carUnit")carAutoAmount();
    carHint();
  });
});
$car("carLiters").addEventListener("input",function(){carAutoAmount();carHint()});
$car("carKind").addEventListener("change",carFuelToggle);
$car("carPay").addEventListener("input",carHint);
$car("carClose").addEventListener("click",carClose);
$car("carSave").addEventListener("click",function(){
  var date=$car("carDate").value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert("날짜를 골라 주세요.");return}
  var num=function(id){return +String($car(id).value).replace(/[^\d-]/g,"")||0};
  var rec={id:carEditId||newId(),date:date,kind:$car("carKind").value,place:$car("carPlace").value.trim(),
    amount:num("carAmt"),discount:Math.abs(num("carDisc")),pay:$car("carPay").value.trim(),
    unit:num("carUnit"),liters:parseFloat(String($car("carLiters").value).replace(",","."))||0,odo:num("carOdo"),memo:$car("carMemo").value.trim()};
  if(rec.kind!=="주유"){rec.unit=0;rec.liters=0}
  else if(rec.liters>0&&!rec.unit&&rec.amount>0)rec.unit=Math.round(rec.amount/rec.liters);
  if(!rec.amount&&!rec.place&&!rec.memo){alert("금액이나 장소를 입력해 주세요.");return}
  var idx=-1;KV.car.records.forEach(function(x,i){if(x.id===rec.id)idx=i});
  if(idx>=0)KV.car.records[idx]=rec;else KV.car.records.push(rec);
  carChanged(rec.id,false);
  logH("차계부 "+(idx>=0?"수정":"추가")+": "+rec.date+" "+rec.kind+" "+(rec.place||"")+" "+won(carNet(rec)));
  carClose();render();
});
$car("carDel").addEventListener("click",function(){
  var r=carById(carEditId);if(!r)return;
  if(!confirm("지우시겠습니까?"))return;
  KV.car.records=KV.car.records.filter(function(x){return x.id!==r.id});
  carChanged(r.id,true);
  logH("차계부 삭제: "+r.date+" "+r.kind+" "+(r.place||"")+" "+won(carNet(r)));
  carClose();render();
});

/* ---------- CSV ---------- */
function carCsv(){
  var head=["날짜","구분","장소","금액","할인","순비용","결제수단","단가(원/L)","리터","키로수","메모"];
  var rows=KV.car.records.slice().sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0}).map(function(r){
    return [r.date,r.kind,r.place,r.amount,r.discount,carNet(r),r.pay,r.unit||"",r.liters||"",r.odo||"",r.memo];
  });
  saveFile("차계부.csv",[head].concat(rows).map(function(r){return r.map(csvCell).join(",")}).join("\r\n"));
}

/* ---------- 버튼 처리 (월 화면 밖의 data-act) ---------- */
function carAct(b){
  var act=b.getAttribute("data-act");
  if(act==="caradd")carOpen(null);
  else if(act==="caredit")carOpen(b.getAttribute("data-id"));
  else if(act==="caryear"){carF.year=b.getAttribute("data-v");render()}
  else if(act==="carkind"){carF.kind=b.getAttribute("data-v");render()}
  else if(act==="carcsv")carCsv();
}
