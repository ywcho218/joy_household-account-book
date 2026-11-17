"use strict";
/* 프로젝트 가계부: #태그로 묶은 지출(출산 준비, 여행, 이사 등)에 목표 예산을 두고 진행률을 본다. 여러 해에 걸쳐도 합산해요 */
KV.projects={list:[]};
var projData={}, projSeq=0, projEditId=null;
function projNorm(v){
  var a=(v&&Array.isArray(v.list))?v.list:[];
  return {list:a.map(function(x){return {id:x.id||newId(),name:x.name||"",tag:String(x.tag||"").replace(/^#/,"").replace(/\s+/g,""),budget:+x.budget||0,memo:x.memo||""}})};
}
function projById(id){return KV.projects.list.filter(function(x){return x.id===id})[0]}

/* 한 프로젝트의 지출을 모은다: 올해는 지금 화면의 데이터, 다른 해는 서버에서 가져온다 */
async function projCollect(pj){
  var items=[];
  var addLocal=function(){
    for(var m=1;m<=12;m++)VARS.forEach(function(k){S.months[m][k].forEach(function(x){
      if(isEx(x)||tagsOf(x.desc).indexOf(pj.tag)<0)return;
      items.push({y:YEAR,m:m,d:dayNum(x),l:stripMethod(x.desc),a:+x.amt||0,p:x.payer||""});
    })});
  };
  addLocal();
  try{
    var r=await sb.from("entries").select("year,month,section,label,day,amount,payer").eq("household_id",HH)
      .ilike("label","%#"+pj.tag.replace(/[%_\\]/g,"\\$&")+"%").limit(1000);
    if(r.error)throw r.error;
    r.data.forEach(function(x){
      if(x.year===YEAR||VARS.indexOf(x.section)<0)return;
      var lab=x.label||"";
      if(lab.indexOf("[제외]")===0||tagsOf(lab).indexOf(pj.tag)<0)return;
      var dm=/(\d+)/.exec(x.day||"");
      items.push({y:x.year,m:x.month,d:dm?+dm[1]:0,l:stripMethod(lab),a:Number(x.amount)||0,p:x.payer||""});
    });
  }catch(e){return {items:items,partial:true}}
  return {items:items,partial:false};
}
async function projLoad(){
  var seq=++projSeq;
  var list=KV.projects.list.slice();
  for(var i=0;i<list.length;i++){
    var res=await projCollect(list[i]);
    if(seq!==projSeq)return;
    var it=res.items.sort(function(a,b){return (b.y-a.y)||(b.m-a.m)||(b.d-a.d)});
    var total=it.reduce(function(s,x){return s+x.a},0);
    projData[list[i].id]={total:total,count:it.length,items:it,partial:res.partial,
      first:it.length?it[it.length-1]:null,last:it.length?it[0]:null};
  }
  var box=document.getElementById("projList");
  if(box&&cur==="projects")box.innerHTML=projCards();
}
function projDate(x){return x?x.y+"."+("0"+x.m).slice(-2)+(x.d?"."+("0"+x.d).slice(-2):""):""}
function projCards(){
  if(!KV.projects.list.length)return '<p class="dim">아직 프로젝트가 없어요. "+ 프로젝트 추가"로 출산 준비, 여행, 이사처럼 묶어 볼 지출을 만들어 보세요. 지출 내용에 <b>#태그</b>를 붙이면 그 프로젝트에 모여요.</p>';
  return KV.projects.list.map(function(pj){
    var d=projData[pj.id];
    if(!d)return '<section class="card projcard" style="padding:14px"><div class="card-h"><h3>'+esc(pj.name)+' <span class="kindtag">#'+esc(pj.tag)+'</span></h3></div><p class="dim">불러오는 중…</p></section>';
    var b=pj.budget, p=b?d.total/b:0, cls=p>1?"over":p>=0.8?"warn":"ok";
    var bar=b?'<div class="bud '+cls+'" style="padding:0;margin:6px 0 8px"><div class="bar"><i style="width:'+Math.max(0,Math.min(100,p*100)).toFixed(1)+'%"></i></div><div class="bl"><span>예산 '+won(b)+' · '+(p*100).toFixed(0)+'%</span><span>'+(d.total>b?won(d.total-b)+" 초과":won(b-d.total)+" 남음")+'</span></div></div>':'<p class="hint">예산을 정하면 진행률이 나와요.</p>';
    var recent=d.items.slice(0,6).map(function(x){
      return '<a class="srrow" href="#'+x.y+'-m'+x.m+'"><span class="srd">'+x.m+'/'+(x.d||"-")+'</span><span class="srs">'+(x.y!==YEAR?x.y:"")+'</span><span class="srl">'+esc(x.l)+'</span><span class="srp">'+esc(x.p)+'</span><span class="sra">'+won(x.a)+'</span></a>';
    }).join("");
    return '<section class="card projcard" style="padding:14px"><div class="card-h"><h3>'+esc(pj.name)+' <span class="kindtag">#'+esc(pj.tag)+'</span></h3>'
      +'<button class="del mv" type="button" data-act="projedit" data-id="'+pj.id+'" aria-label="프로젝트 수정">⋯</button></div>'
      +'<div class="projsum"><b>'+won(d.total)+'원</b><span>'+d.count+'건'+(d.first?' · '+projDate(d.first)+' ~ '+projDate(d.last):"")+'</span></div>'+bar
      +(pj.memo?'<p class="dim" style="margin:0 0 6px">'+esc(pj.memo)+'</p>':"")
      +(recent?'<div class="srlist">'+recent+(d.count>6?'<p class="hint">최근 6건만 보여요. 전체는 검색에서 #'+esc(pj.tag)+'로 찾아보세요.</p>':"")+'</div>':'<p class="dim">이 태그가 붙은 지출이 아직 없어요.</p>')
      +(d.partial?'<p class="hint">다른 연도 데이터를 불러오지 못해 올해 것만 보여요.</p>':"")+'</section>';
  }).join("");
}
function projView(){
  var head='<div class="pagehead"><div><h1>프로젝트 가계부</h1></div><div class="pager"><button class="btn primary" type="button" data-act="projadd">+ 프로젝트 추가</button></div></div>';
  if(!KV.ok)return head+kvSetupHTML();
  return head+'<p class="dim" style="margin:0 0 12px">지출 내용에 <b>#태그</b>를 붙이면 같은 태그끼리 모아서 목표 예산과 비교해요. 여러 해에 걸쳐도 합산돼요. (태그는 항목 ⋯ 메뉴에서 눌러 붙일 수 있어요)</p>'
    +'<div id="projList" class="projlist">'+projCards()+'</div>';
}

/* ---------- 추가·수정 모달 ---------- */
var projDlg=document.getElementById("projDlg");
function projClose(){if(projDlg.close)projDlg.close();else projDlg.removeAttribute("open")}
function projOpen(id){
  if(!KV.ok){kvAlert();return}
  var pj=id?projById(id):null;projEditId=pj?pj.id:null;
  document.getElementById("projTitle").textContent=pj?"프로젝트 수정":"프로젝트 추가";
  document.getElementById("projName").value=pj?pj.name:"";
  document.getElementById("projTag").value=pj?pj.tag:"";
  document.getElementById("projBudget").value=pj&&pj.budget?fmtIn(pj.budget):"";
  document.getElementById("projBudget").inputMode=AMT_MODE;
  document.getElementById("projMemo").value=pj?pj.memo:"";
  document.getElementById("projDel").hidden=!pj;
  document.getElementById("projTags").innerHTML=tagStats().slice(0,10).map(function(t){return '<button type="button" class="qbtn" data-tag="'+esc(t.t)+'">#'+esc(t.t)+'</button>'}).join("");
  if(projDlg.showModal)projDlg.showModal();else projDlg.setAttribute("open","");
}
document.getElementById("projBudget").addEventListener("input",function(e){parseAmt(e.target)});
document.getElementById("projTags").addEventListener("click",function(e){
  var b=e.target.closest("[data-tag]");if(!b)return;
  document.getElementById("projTag").value=b.getAttribute("data-tag");
  if(!document.getElementById("projName").value.trim())document.getElementById("projName").value=b.getAttribute("data-tag");
});
document.getElementById("projClose").addEventListener("click",projClose);
document.getElementById("projSave").addEventListener("click",function(){
  var name=document.getElementById("projName").value.trim();
  var tag=document.getElementById("projTag").value.trim().replace(/^#/,"").replace(/\s+/g,"");
  if(!name){alert("프로젝트 이름을 입력해 주세요.");return}
  if(!tag)tag=name.replace(/\s+/g,"");
  var budget=+String(document.getElementById("projBudget").value).replace(/\D/g,"")||0;
  var memo=document.getElementById("projMemo").value.trim();
  var pj=projEditId?projById(projEditId):null;
  if(pj){pj.name=name;pj.tag=tag;pj.budget=budget;pj.memo=memo}
  else KV.projects.list.push({id:newId(),name:name,tag:tag,budget:budget,memo:memo});
  saveKV("projects");logH("프로젝트 "+(pj?"수정":"추가")+": "+name+" (#"+tag+")");
  projClose();projData={};render();
});
document.getElementById("projDel").addEventListener("click",function(){
  var pj=projById(projEditId);if(!pj)return;
  if(!confirm("프로젝트 '"+pj.name+"'를 지울까요? (지출 항목은 지워지지 않고 목록에서만 빠져요)"))return;
  KV.projects.list=KV.projects.list.filter(function(x){return x.id!==pj.id});
  saveKV("projects");logH("프로젝트 삭제: "+pj.name);
  projClose();projData={};render();
});
function projAct(b){
  var act=b.getAttribute("data-act");
  if(act==="projadd")projOpen(null);
  else if(act==="projedit")projOpen(b.getAttribute("data-id"));
}
