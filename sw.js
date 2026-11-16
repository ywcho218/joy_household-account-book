/* 네트워크 우선: 항상 최신 화면을 받고, 오프라인일 때만 저장해 둔 화면을 보여 줘요. */
var CACHE="gagyebu-v1";
self.addEventListener("install",function(){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim())});
self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET"||new URL(req.url).origin!==location.origin)return;
  e.respondWith(
    fetch(req).then(function(res){
      var copy=res.clone();
      caches.open(CACHE).then(function(c){c.put(req,copy)}).catch(function(){});
      return res;
    }).catch(function(){return caches.match(req).then(function(r){return r||caches.match("./")})})
  );
});
