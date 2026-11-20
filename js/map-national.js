"use strict";
let nationalSearchData, lastNationQuery, nationalTimer;
function updateNationalMapSearch(term) {
  const panel=document.getElementById("map-nation-results");
  if(!panel||term===lastNationQuery)return;
  lastNationQuery=term;
  clearTimeout(nationalTimer);
  panel.innerHTML=""; panel.hidden=!term;
  if(!term)return;
  const queryLink="national.html?q="+encodeURIComponent(term);
  const all='<a class="map-registry-link" href="'+esc(queryLink)+'">在全国目录检索「'+esc(term)+'」</a>';
  panel.innerHTML=all;
  nationalTimer=setTimeout(async()=>{
    try {
      nationalSearchData ||= Promise.all([readData("bureau-roster.json"),readData("catalog/passenger-network.json")]).then(([d,net])=>{
        const group=new Map(net.groups.map(g=>[g.id,g.name]));
        return {items:d.items,groups:new Map(d.bureaus.map(b=>[b.id,b.short])),
          network:net.items.map(r=>({...r,group:group.get(r.groupId)}))};
      }).catch(e=>{nationalSearchData=null;throw e;});
      const data=await nationalSearchData;
      if(term!==lastNationQuery)return;
      const key=s=>s.normalize("NFKC").replace(/高速铁路|高速线|高铁/g,"高速");
      const keyword=key(term);
      const matches=data.items.filter(r=>key([r.raw,r.canonicalName,data.groups.get(r.bureauId)].filter(Boolean).join(" ")).includes(keyword));
      const reviewed=data.network.filter(r=>key([r.raw,r.name,r.group].join(" ")).includes(keyword));
      const networkLinks=reviewed.slice(0,3).map(r=>'<a class="map-registry-row" href="national.html?view=networks&amp;id='+
        encodeURIComponent(r.id)+'"><b>'+esc(r.raw)+'</b><small>'+esc(r.group)+' · '+esc(statusName(r.status))+'</small></a>');
      panel.innerHTML=networkLinks.join("")+matches.slice(0,4-networkLinks.length).map(r=>
        '<a class="map-registry-row" href="national.html?id='+encodeURIComponent(r.id)+'"><b>'+esc(r.raw)+'</b><small>'+esc(data.groups.get(r.bureauId))+' · 清单资料</small></a>'
      ).join("")+all;
    } catch {if(term===lastNationQuery)panel.innerHTML=all;}
  },120);
}
