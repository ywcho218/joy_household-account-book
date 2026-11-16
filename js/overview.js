"use strict";
/* 종합 현황 화면과 차트 */
/* ---------- overview ---------- */
function chartSVG(R){
  var mob=window.innerWidth<=560;
  var W=mob?380:760,H=mob?250:300,L=mob?50:54,Rr=12,T=14,B=30,pw=W-L-Rr,ph=H-T-B;
  var max=Math.max.apply(null,R.map(function(r){return Math.max(r.exp,r.inc)}));
  var empty=max===0; if(empty)max=1000000;
  var raw=max/4, mag=Math.pow(10,Math.floor(Math.log10(raw))), n=raw/mag;
  var step=(n<=1?1:n<=2?2:n<=5?5:10)*mag, steps=Math.ceil(max/step), top=step*steps;
  function y(v){return T+ph-(v/top)*ph}
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="월별 지출 구성과 수입 차트">';
  for(var i=0;i<=steps;i++){
    var v=step*i;
    s+='<line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+y(v)+'" y2="'+y(v)+'" class="grid"/>'
      +'<text x="'+(L-8)+'" y="'+(y(v)+4)+'" text-anchor="end" class="ax">'+(v===0?"0":(v/10000).toLocaleString("ko-KR")+"만")+'</text>';
  }
  var sw=pw/12, bw=Math.min(34,sw*.58);
  var parts=[["fix","--c-fixed"],["food","--c-food"],["living","--c-living"],["life","--c-life"],["etc","--c-etc"]];
  R.forEach(function(r,i){
    var m=i+1, cx=L+sw*i+sw/2, x=cx-bw/2, acc=0;
    s+='<g class="bar" data-go="m'+m+'" tabindex="0" role="link" aria-label="'+m+'월 가계부 열기"><title>'+m+'월 수입 '+won(r.inc)+' / 지출 '+won(r.exp)+' / 비상금 '+won(r.room)+'</title>'
      +'<rect x="'+(L+sw*i)+'" y="'+T+'" width="'+sw+'" height="'+ph+'" fill="transparent"/>';
    parts.forEach(function(p){
      var val=r[p[0]];
      if(val>0){var y1=y(acc+val), y0=y(acc);
        s+='<rect x="'+x+'" y="'+y1+'" width="'+bw+'" height="'+Math.max(y0-y1,0)+'" style="fill:var('+p[1]+');stroke:var(--surface);stroke-width:1"/>';
        acc+=val}
    });
    if(r.inc>0)s+='<line class="inc" x1="'+(x-5)+'" x2="'+(x+bw+5)+'" y1="'+y(r.inc)+'" y2="'+y(r.inc)+'"/>';
    s+='<text x="'+cx+'" y="'+(H-10)+'" text-anchor="middle" class="ax'+(m===curM?" now":"")+'">'+m+'월</text></g>';
  });
  if(empty)s+='<text class="empty" x="'+(L+pw/2)+'" y="'+(T+ph/2)+'" text-anchor="middle">월별 탭에 금액을 입력하면 차트가 채워져요</text>';
  return s+'</svg>';
}
function summaryView(){
  var R=[];for(var m=1;m<=12;m++)R.push(calc(m));
  var T={inc:0,sav:0,fix:0,food:0,living:0,life:0,etc:0,exp:0,room:0};
  R.forEach(function(r){Object.keys(T).forEach(function(k){T[k]+=r[k]})});
  var rate=T.inc>0?(T.sav/T.inc*100).toFixed(1)+"%":"-";
  function u(n){return n===0?"-":won(n)+"<small>원</small>"}
  var items=[["고정지출",T.fix,"--c-fixed"],["식비/외식비",T.food,"--c-food"],["생필품비",T.living,"--c-living"],["교통/문화/병원 등",T.life,"--c-life"],["기타",T.etc,"--c-etc"]];
  var share=T.exp>0
    ?'<div class="share" role="img" aria-label="연간 지출 구성">'+items.map(function(it){return it[1]>0?'<span style="width:'+(it[1]/T.exp*100)+'%;background:var('+it[2]+')"></span>':""}).join("")+'</div>'
     +'<div class="sharelist">'+items.map(function(it){return '<div><span><i style="background:var('+it[2]+')"></i>'+it[0]+'</span><span><b>'+won(it[1])+'</b><small>'+(it[1]>0?(it[1]/T.exp*100).toFixed(1)+"%":"")+'</small></span></div>'}).join("")+'</div>'
    :'<p class="hint" style="margin:8px 0 0">아직 입력된 지출이 없어요.</p>';
  var rows=R.map(function(r,i){
    var m=i+1;
    return '<tr data-go="m'+m+'" tabindex="0" class="'+(m===curM?"now":"")+'"><td>'+m+'월</td><td>'+won(r.inc)+'</td><td>'+won(r.sav)+'</td><td>'+won(r.fix)+'</td><td>'+won(r.food)+'</td><td>'+won(r.living)+'</td><td>'+won(r.life)+'</td><td>'+won(r.etc)+'</td><td>'+won(r.exp)+'</td><td class="'+(r.room<0?"neg":r.room>0?"pos":"dim")+'">'+won(r.room)+'</td><td class="dim">'+pc(r.sav,r.inc)+'</td></tr>';
  }).join("");
  return '<div class="pagehead"><div><h1>'+YEAR+' 종합 현황</h1><p>월 막대나 표의 행을 누르면 그 달의 가계부로 이동해요.</p></div></div>'
    +'<dl class="kpis">'
      +'<div class="kpi"><dt>연간 수입</dt><dd>'+u(T.inc)+'</dd></div>'
      +'<div class="kpi"><dt>연간 지출</dt><dd>'+u(T.exp)+'<span class="sub">수입의 '+pc(T.exp,T.inc)+'</span></dd></div>'
      +'<div class="kpi"><dt>연간 저축</dt><dd>'+u(T.sav)+'<span class="sub">저축률 '+rate+'</span></dd></div>'
      +'<div class="kpi"><dt>비상금 누적</dt><dd class="'+(T.room<0?"neg":T.room>0?"pos":"")+'">'+u(T.room)+'<span class="sub">수입 − 저축 − 지출</span></dd></div>'
    +'</dl>'
    +'<section class="panel"><h2>월별 수입과 지출</h2><p class="hint">막대는 지출 구성, 검은 선은 그 달의 수입이에요.</p>'
      +'<div class="chartwrap">'+chartSVG(R)+'</div>'
      +'<div class="legend">'+items.map(function(it){return '<span><i style="background:var('+it[2]+')"></i>'+it[0]+'</span>'}).join("")+'<span><i class="tick"></i>수입</span></div></section>'
    +'<section class="panel"><h2>올해 지출은 어디에 썼을까</h2><p class="hint">12개월 지출 합계 기준이에요.</p>'+share+'</section>'
    +'<section class="panel"><h2>월별 한눈에 보기</h2><div class="scroll"><table class="tbl"><thead><tr><th>월</th><th>수입</th><th>저축</th><th>고정지출</th><th>식비/외식비</th><th>생필품비</th><th>교통/문화/병원 등</th><th>기타</th><th>총 지출</th><th>비상금</th><th>저축률</th></tr></thead><tbody>'+rows+'</tbody>'
      +'<tfoot><tr><td>합계</td><td>'+won(T.inc)+'</td><td>'+won(T.sav)+'</td><td>'+won(T.fix)+'</td><td>'+won(T.food)+'</td><td>'+won(T.living)+'</td><td>'+won(T.life)+'</td><td>'+won(T.etc)+'</td><td>'+won(T.exp)+'</td><td class="'+(T.room<0?"neg":T.room>0?"pos":"")+'">'+won(T.room)+'</td><td>'+rate+'</td></tr></tfoot></table></div></section>';
}
