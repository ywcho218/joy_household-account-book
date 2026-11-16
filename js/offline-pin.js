"use strict";
/* 오프라인 임시 저장, 앱 잠금(PIN·생체 인증) */
/* ---------- 오프라인 임시 저장: 저장 못 한 변경을 이 기기에 남겨 두었다가 다시 올린다 ---------- */
var PEND_KEY="gagyebu_pending";
function persistPending(){
  try{
    var rows=[];
    Object.keys(dirty).forEach(function(id){var it=findItem(id);if(it)rows.push(toRow(it))});
    var dl=Object.keys(dels), meta=Object.keys(metaDirty).map(function(m){var d=S.months[+m];return {y:YEAR,m:+m,avail:Math.round(d.avail||0),baby:Math.round(d.baby||0)}});
    if(!rows.length&&!dl.length&&!meta.length)localStorage.removeItem(PEND_KEY);
    else localStorage.setItem(PEND_KEY,JSON.stringify({hh:HH,rows:rows,dl:dl,meta:meta}));
  }catch(e){}
}
async function pushPending(){
  var raw=null;try{raw=localStorage.getItem(PEND_KEY)}catch(e){}
  if(!raw)return 0;
  var p;try{p=JSON.parse(raw)}catch(e){try{localStorage.removeItem(PEND_KEY)}catch(e2){}return 0}
  if(!p||p.hh!==HH)return 0;
  try{
    for(var u=0;u<p.rows.length;u+=300){var r=await sb.from("entries").upsert(p.rows.slice(u,u+300),{onConflict:"id"});if(r.error)throw r.error}
    for(var c=0;c<p.dl.length;c+=50){var r2=await sb.from("entries").delete().in("id",p.dl.slice(c,c+50));if(r2.error)throw r2.error}
    for(var i=0;i<p.meta.length;i++){var x=p.meta[i];var r3=await sb.from("month_meta").upsert({household_id:HH,year:x.y,month:x.m,avail:x.avail,baby_savings:x.baby},{onConflict:"household_id,year,month"});if(r3.error)throw r3.error}
    localStorage.removeItem(PEND_KEY);
    return p.rows.length+p.dl.length+p.meta.length;
  }catch(e){return 0}
}
window.addEventListener("online",function(){if(HH){flush();if(rtLost)rtReload()}});
window.addEventListener("offline",function(){if(HH)setStatus("오프라인이에요. 연결되면 자동으로 저장해요",true)});

/* ---------- 앱 잠금 (PIN·생체 인증): 이 기기에서만 적용돼요 ---------- */
var PIN_KEY="gagyebu_pin";
function pinCfg(){try{return JSON.parse(localStorage.getItem(PIN_KEY)||"null")}catch(e){return null}}
function pinSave(c){try{if(c)localStorage.setItem(PIN_KEY,JSON.stringify(c));else localStorage.removeItem(PIN_KEY)}catch(e){}}
function bufHex(buf){return Array.prototype.map.call(new Uint8Array(buf),function(b){return ("0"+b.toString(16)).slice(-2)}).join("")}
async function pinHash(pin,salt){return bufHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(salt+":"+pin)))}
function randHex(n){var a=new Uint8Array(n);crypto.getRandomValues(a);return bufHex(a)}
function b64(buf){return btoa(String.fromCharCode.apply(null,new Uint8Array(buf)))}
function unb64(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
var pinEl=document.getElementById("pinlock"), pinInput=document.getElementById("pinInput"), pinMsg=document.getElementById("pinMsg");
var pinFails=0, pinWait=0, hiddenAt=0;
function lockApp(){
  var c=pinCfg();if(!c)return;
  pinEl.hidden=false;pinMsg.textContent="";pinInput.value="";
  document.getElementById("pinBio").hidden=!c.bio;
  setTimeout(function(){try{pinInput.focus()}catch(e){}},60);
}
function unlockApp(){pinEl.hidden=true;pinFails=0;pinInput.value="";pinMsg.textContent=""}
async function pinTry(){
  var c=pinCfg();if(!c){unlockApp();return}
  if(Date.now()<pinWait){pinMsg.textContent="잠시 뒤에 다시 해 주세요.";return}
  var h=await pinHash(pinInput.value,c.salt);
  if(h===c.hash){unlockApp();return}
  pinFails++;pinInput.value="";
  if(pinFails>=5){pinWait=Date.now()+30000;pinFails=0;pinMsg.textContent="5번 틀렸어요. 30초 뒤에 다시 해 주세요."}
  else pinMsg.textContent="PIN이 달라요 ("+pinFails+"/5)";
}
async function bioAuth(c){
  await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:"public-key",id:unb64(c.bio)}],userVerification:"required",timeout:60000}});
}
async function bioRegister(){
  var cred=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:"조이쀼의 가계부"},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:"gagyebu",displayName:"가계부"},pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required"},timeout:60000}});
  return b64(cred.rawId);
}
document.getElementById("pinOk").addEventListener("click",pinTry);
pinInput.addEventListener("keydown",function(e){if(e.key==="Enter")pinTry()});
document.getElementById("pinBio").addEventListener("click",async function(){
  var c=pinCfg();if(!c||!c.bio)return;
  try{await bioAuth(c);unlockApp()}catch(e){pinMsg.textContent="생체 인증을 하지 못했어요. PIN으로 열어 주세요."}
});
document.getElementById("pinForgot").addEventListener("click",function(){
  if(!confirm("PIN을 해제하고 로그아웃할까요? 다시 로그인하면 바로 쓸 수 있어요."))return;
  pinSave(null);unlockApp();signOut();
});
document.addEventListener("visibilitychange",function(){
  if(document.visibilityState==="hidden"){hiddenAt=Date.now();return}
  if(pinCfg()&&hiddenAt&&Date.now()-hiddenAt>120000)lockApp();
});
var pinDlg=document.getElementById("pinDlg"), pinSetMsg=document.getElementById("pinSetMsg");
function pinDlgRefresh(){
  var c=pinCfg(), bioOk=!!(window.PublicKeyCredential&&navigator.credentials);
  document.getElementById("pinState").textContent=c?"이 기기는 PIN 잠금이 켜져 있어요."+(c.bio?" (생체 인증 사용 중)":""):"이 기기는 잠금이 꺼져 있어요.";
  document.getElementById("pinRemove").hidden=!c;
  var bb=document.getElementById("pinBioSet");bb.hidden=!(c&&bioOk);bb.textContent=c&&c.bio?"생체 인증 끄기":"생체 인증 켜기";
  document.getElementById("pinNew").value="";document.getElementById("pinNew2").value="";
}
document.getElementById("pinBtn").addEventListener("click",function(){
  pinSetMsg.textContent="";pinDlgRefresh();
  if(pinDlg.showModal)pinDlg.showModal();else pinDlg.setAttribute("open","");
});
document.getElementById("pinSetClose").addEventListener("click",function(){if(pinDlg.close)pinDlg.close();else pinDlg.removeAttribute("open")});
document.getElementById("pinSave").addEventListener("click",async function(){
  var a=document.getElementById("pinNew").value, b=document.getElementById("pinNew2").value;
  pinSetMsg.className="msg neg";
  if(!/^\d{4,8}$/.test(a)){pinSetMsg.textContent="PIN은 숫자 4~8자리로 입력해 주세요.";return}
  if(a!==b){pinSetMsg.textContent="두 번 입력한 PIN이 달라요.";return}
  var old=pinCfg(), salt=randHex(8);
  pinSave({salt:salt,hash:await pinHash(a,salt),bio:old&&old.bio||null});
  pinSetMsg.className="msg";pinSetMsg.textContent="PIN을 저장했어요. 앱을 닫았다가 열거나 2분 이상 떠나 있다 돌아오면 PIN을 물어봐요.";
  pinDlgRefresh();
});
document.getElementById("pinRemove").addEventListener("click",function(){
  if(!confirm("이 기기의 PIN 잠금을 해제할까요?"))return;
  pinSave(null);pinSetMsg.className="msg";pinSetMsg.textContent="PIN 잠금을 해제했어요.";pinDlgRefresh();
});
document.getElementById("pinBioSet").addEventListener("click",async function(){
  var c=pinCfg();if(!c)return;
  pinSetMsg.className="msg";
  if(c.bio){c.bio=null;pinSave(c);pinSetMsg.textContent="생체 인증을 껐어요.";pinDlgRefresh();return}
  try{c.bio=await bioRegister();pinSave(c);pinSetMsg.textContent="생체 인증을 켰어요. 다음 잠금부터 지문·얼굴로도 열 수 있어요.";}
  catch(e){pinSetMsg.className="msg neg";pinSetMsg.textContent="이 기기·브라우저에서는 생체 인증을 켜지 못했어요. PIN만 쓸 수 있어요."}
  pinDlgRefresh();
});
