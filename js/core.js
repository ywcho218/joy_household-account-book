"use strict";
/* 기본 상수·전역 상태·공통 함수·합계 계산 */

var YEAR=new Date().getFullYear(), years=[];
var SECS={income:"수입",saving:"저축",fixed:"고정지출",food:"식비/외식비",living:"생필품비",life:"교통/유류/통신/교육/문화/병원비",etc:"기타"};
var VARS=["food","living","life","etc"];
var ALL=["income","saving","fixed","food","living","life","etc"];
var NOW=new Date(), curM=NOW.getFullYear()===YEAR?NOW.getMonth()+1:0;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function won(n){return n===0?"-":(n<0?"-":"")+Math.abs(n).toLocaleString("ko-KR")}
function fmtIn(n){return n?Number(n).toLocaleString("ko-KR"):""}
function newId(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==="x"?r:(r&3|8)).toString(16)});
}
function emptyMonth(){return {income:[],saving:[],fixed:[],food:[],living:[],life:[],etc:[],avail:0,baby:0}}
var S={months:{}};
(function(){for(var m=1;m<=12;m++)S.months[m]=emptyMonth()})();
var cur="summary";
function isMonth(){return typeof cur==="number"}
var AMT_MODE=(/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1))?"text":"numeric"; /* iOS 숫자 키패드엔 '-'가 없어서 */

/* 내용이 "[제외]"로 시작하는 행은 금액은 보이지만 합계·지출 계산에서 빠진다 */
function isEx(x){return !!x.desc&&x.desc.indexOf("[제외]")===0}
function sum(a){return a.reduce(function(s,x){return s+(isEx(x)?0:(+x.amt||0))},0)}
function calc(m){
  var d=S.months[m], r={inc:sum(d.income),sav:sum(d.saving),fix:sum(d.fixed)};
  VARS.forEach(function(k){r[k]=sum(d[k])});
  r.exp=r.fix+VARS.reduce(function(s,k){return s+r[k]},0);
  r.room=r.inc-r.sav-r.exp;
  var all=d.fixed.concat(d.food,d.living,d.life,d.etc);
  function paid(p){return all.filter(function(x){return x.payer===p&&!isEx(x)}).reduce(function(s,x){return s+(+x.amt||0)},0)}
  r.sendO=paid("옹");r.sendD=paid("답");
  return r;
}
function pc(x,inc){return inc>0?(x/inc*100).toFixed(1)+"%":"-"}
