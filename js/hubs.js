"use strict";
mountHeader("globe");
async function hubs() {
  const params = new URLSearchParams(location.search), input = q("#hub-q");
  input.value = params.get("q") || "";
  const [docs, cards] = await Promise.all([atlasRead("junctions.json"), atlasIndex()]);
  const hubs = new Map(docs.hubs.map(h => [h.id, h]));
  const routes = new Map(cards.map(r => [r.id, r]));
  const nodes = new Map(docs.junctions.map(j => [j.id, j]));
  const connectors = cards.filter(r => r.role === "connector");
  const hubLink = id => "hubs.html?hub=" + encodeURIComponent(id);
  const link = (url,title) => '<a class="context-link" href="'+esc(url)+'">'+esc(title)+'</a>';
  const sourceList = refs => '<ul class="references">'+refs.map(s=>'<li>'+sourceLink(s)+'</li>').join('')+'</ul>';
  const entries = [
    ...docs.hubs.map(h=>({name:h.name,kind:'枢纽',url:hubLink(h.id),terms:[h.city]})),
    ...docs.junctions.map(j=>({name:j.name,kind:'线路所',url:junctionLink(j.id),terms:[j.city,hubs.get(j.hubId)?.name,...(j.aliases||[])]})),
    ...connectors.map(r=>({name:r.name,kind:'联络线',url:recordLink(r.id),terms:[...r.cities,...r.aliases]}))
  ];
  q("#hub-count").textContent = docs.hubs.length+' 个枢纽 · '+nodes.size+' 处线路所 · '+connectors.length+' 条联络线档案';
  const more = q("#more-hubs");
  let limit = 40;
  function list(){
    const term=input.value.trim().toLowerCase();
    const kind=q("#hub-kind").value;
    const hits=entries.filter(e=>(!kind || e.kind===kind) && (!term || [e.name,...e.terms].filter(Boolean).join(' ').toLowerCase().includes(term)));
    q("#hub-list").innerHTML=hits.length ? hits.slice(0,limit).map(e=>'<p>'+link(e.url,e.name)+' <small>'+e.kind+'</small></p>').join('') : '<p>未找到匹配记录。</p>';
    more.hidden = hits.length <= limit;
  }
  input.oninput=q("#hub-kind").onchange=()=>{limit=40;list();}; more.onclick=()=>{limit+=40;list();};list();
  const node=nodes.get(params.get('junction')), hub=hubs.get(params.get('hub')||node?.hubId);
  const pane=q("#hub-detail");
  if(node || hub) pane.parentElement.classList.add("selected-hub");
  if(node){
    document.title=node.name+' · 中国铁路图鉴';
    pane.innerHTML='<h2>'+esc(node.name)+'</h2><p>'+esc(statusName(node.statusCode))+' · 线路所</p><p>'+esc(node.notes)+'</p>'+
      (hub?link(hubLink(hub.id),hub.name):'')+(node.coordinate?link('./?junction='+encodeURIComponent(node.id),'在全国地图定位'):'<p>坐标待核实。</p>')+
      '<h3>有资料关联的线路</h3><div class="chips">'+node.lineIds.map(k=>link(recordLink(k),routes.get(k).name)).join('')+'</div>'+
      '<h3>资料与位置来源</h3>'+sourceList([...(node.sources||[]),...(node.coordinateSources||[])]);
  } else if(hub){
    const stops=hub.stationIds?.length?(await atlasRead('network.json')).stations.filter(s=>hub.stationIds.includes(s.id)):[];
    const local=docs.junctions.filter(j=>j.hubId===hub.id);
    pane.innerHTML='<h2>'+esc(hub.name)+'</h2>'+
      (hub.notes?'<p>'+esc(hub.notes)+'</p>':'')+
      (hub.connectorLineIds?.length?'<h3>已收录联络线</h3><div class="chips">'+hub.connectorLineIds.map(k=>link(recordLink(k),routes.get(k).name)).join('')+'</div>':'')+
      (local.length?'<h3>已收录线路所</h3><div class="chips">'+local.map(j=>link(junctionLink(j.id),j.name)).join('')+'</div>':'')+
      (stops.length?'<h3>已关联车站</h3><div class="chips">'+stops.map(s=>link(stationLink(s.id),s.name)).join('')+'</div>':'')+
      '<h3>资料来源</h3>'+sourceList(hub.sources);
  } else if(params.has('junction')||params.has('hub')) pane.innerHTML='<h2>未找到记录</h2><p>可通过名称查找已收录枢纽或线路所。</p>';
  else pane.innerHTML='<h2>已收录联络线</h2><div class="related-list">'+connectors.map(r=>'<a class="related-entry" href="'+recordLink(r.id)+'"><b>'+esc(r.name)+'</b><small>'+esc([r.start,r.end].filter(Boolean).join(' — '))+'</small></a>').join('')+'</div>';
}
hubs().catch(()=>{q("#hub-detail").textContent='枢纽资料暂时未能加载，请刷新重试。';});
