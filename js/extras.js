"use strict";
/* 작은 안내, 예산 알림, 태그, 빠른 추가, CSV 내보내기 */
/* ---------- 작은 안내 ---------- */
var noticeTimer=null;
function showNotice(msg,ms){
  var n=document.getElementById("notice");if(!n)return;
  n.textContent=msg;n.hidden=false;
  clearTimeout(noticeTimer);noticeTimer=setTimeout(function(){n.hidden=true},ms||6000);
}

/* ---------- 예산 알림: 80%·100%를 넘는 순간 알려 준다 ---------- */
var budLvl={};
function checkBudgets(r){
  VARS.forEach(function(k){
    var b=+KV.budgets[k]||0, key=YEAR+"-"+cur+"-"+k;
    if(!b){delete budLvl[key];return}
    var spent=r[k], lvl=spent>b?2:spent>=b*0.8?1:0, prev=budLvl[key];
    budLvl[key]=lvl;
    if(prev===undefined||lvl<=prev)return;
    showNotice(lvl===2?SECS[k]+" 예산을 "+won(spent-b)+" 넘었어요 ("+won(spent)+" / "+won(b)+")":SECS[k]+" 예산의 80%를 넘었어요 (남은 "+won(b-spent)+")");
  });
}

/* ---------- 태그(#카페): 내용에 붙인 #태그를 모아 본다 ---------- */
function tagsOf(s){var out=[],m,re=/#([^\s#]+)/g;while((m=re.exec(s||""))!==null)out.push(m[1]);return out}
function tagStats(){
  var st={};
  for(var m=1;m<=12;m++)VARS.forEach(function(k){S.months[m][k].forEach(function(x){
    if(isEx(x))return;var a=+x.amt||0;
    tagsOf(x.desc).forEach(function(t){var o=st[t]||(st[t]={t:t,n:0,s:0});o.n++;o.s+=a});
  })});
  return Object.keys(st).map(function(k){return st[k]}).sort(function(a,b){return b.s-a.s});
}
function tagSum(m,tag){
  var s=0;
  VARS.forEach(function(k){S.months[m][k].forEach(function(x){if(!isEx(x)&&tagsOf(x.desc).indexOf(tag)>=0)s+=+x.amt||0})});
  return s;
}

/* ---------- 빠른 추가: 자주 쓴 내용을 버튼으로 ---------- */
var QUICK_ON=false; /* 빠른 추가 버튼 표시 여부 (true로 바꾸면 다시 나타나요) */
function quickHTML(sec){
  if(!QUICK_ON)return "";
  var cnt={};
  for(var m=1;m<=12;m++)S.months[m][sec].forEach(function(x){
    var s=(x.desc||"").replace(/^\[제외\]\s*/,"").trim();if(s)cnt[s]=(cnt[s]||0)+1;
  });
  var list=Object.keys(cnt).filter(function(k){return cnt[k]>=2}).sort(function(a,b){return cnt[b]-cnt[a]||(a<b?-1:1)}).slice(0,6);
  if(!list.length)return "";
  return '<div class="quick" aria-label="자주 쓰는 항목 빠른 추가">'+list.map(function(l){
    return '<button type="button" class="qbtn" data-act="quick" data-sec="'+sec+'" data-l="'+esc(l)+'" title="'+esc(l)+' 바로 추가">+ '+esc(l.length>9?l.slice(0,9)+"…":l)+'</button>';
  }).join("")+'</div>';
}
function quickAdd(sec,label){
  var d=S.months[cur][sec], lk=lastLike(sec,label,null);
  var it=mkItem(cur,sec,{desc:label,amt:lk?+lk.amt:0,payer:lk?lk.payer:"",order:d.length});
  if(NOW.getFullYear()===YEAR&&NOW.getMonth()+1===cur)it.day=NOW.getDate()+"일";
  d.push(it);markDirty(it.id);render();
  var inp=main.querySelector('[data-id="'+it.id+'"] .amt');if(inp){inp.focus();inp.select()}
}

/* ---------- 엑셀(CSV) 내보내기 ---------- */
function csvCell(v){v=v==null?"":String(v);return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function saveFile(name,text,mime){
  var blob=new Blob(["﻿"+text],{type:mime||"text/csv;charset=utf-8"}), a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
}
function csvText(rows){
  var head=["연도","월","구분","내용","날짜","결제자","금액","제외","태그"];
  return [head].concat(rows.map(function(r){
    return [r.y,r.m,SECS[r.sec]||r.sec,r.label,r.day,r.payer,r.amt,r.ex?"Y":"",tagsOf(r.label).join(" ")];
  })).map(function(r){return r.map(csvCell).join(",")}).join("\r\n");
}
function yearRows(){
  var out=[];
  for(var m=1;m<=12;m++)ALL.forEach(function(sec){
    S.months[m][sec].forEach(function(x){
      var v=isVar(sec), label=(v?x.desc:x.name)||"";
      if(!label&&!(+x.amt))return;
      out.push({y:YEAR,m:m,sec:sec,label:label,day:v?(x.day||""):"",payer:x.payer||"",amt:+x.amt||0,ex:isEx(x)});
    });
  });
  return out;
}
document.getElementById("bkCsv").addEventListener("click",function(){
  saveFile("가계부-"+YEAR+".csv",csvText(yearRows()));
  bkMsg.className="msg";bkMsg.textContent=YEAR+"년 CSV 파일을 내려받았어요. 엑셀·구글 시트에서 열 수 있어요.";
});
document.getElementById("bkCsvAll").addEventListener("click",async function(){
  bkMsg.className="msg";bkMsg.textContent="모든 연도를 불러오는 중…";
  try{
    var all=[], from=0;
    for(;;){
      var r=await sb.from("entries").select("year,month,section,label,day,amount,payer,sort_order").eq("household_id",HH)
        .order("year",{ascending:true}).order("month",{ascending:true}).order("sort_order",{ascending:true}).range(from,from+999);
      if(r.error)throw r.error;
      all=all.concat(r.data);if(r.data.length<1000)break;from+=1000;
    }
    var rows=all.map(function(x){var v=isVar(x.section);return {y:x.year,m:x.month,sec:x.section,label:x.label||"",day:v?(x.day||""):"",payer:x.payer||"",amt:Number(x.amount)||0,ex:(x.label||"").indexOf("[제외]")===0}});
    saveFile("가계부-전체.csv",csvText(rows));
    bkMsg.textContent="전체 연도 "+rows.length+"줄을 CSV로 내려받았어요.";
  }catch(e){bkMsg.className="msg neg";bkMsg.textContent="불러오지 못했어요. 네트워크를 확인해 주세요."}
});
