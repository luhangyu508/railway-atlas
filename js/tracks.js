"use strict";
mountHeader("map");
const trackMap = newMap("track-map").setView([35,105],4);
addBase(trackMap);
labels(trackMap);
L.control.zoom({position:"topright",zoomInTitle:"放大",zoomOutTitle:"缩小"}).addTo(trackMap);
const lineLayer = L.featureGroup().addTo(trackMap);
const canvas = L.canvas({padding:0.12});
const finder = q("#track-query");
const isNarrow = matchMedia("(max-width:700px)");
const showOptions = open => {
  q("#track-options").hidden=!open;
  q("#track-collapse").setAttribute("aria-expanded",String(open));
  q("#track-collapse").textContent=open?"收起":"搜索";
};
q("#track-collapse").onclick = () => {showOptions(q("#track-options").hidden)};
let trackIndex, results=[], pageNumber=0, chosen=null, generation=0;
const pageSize=8;
const shards=new Map();
const selectionHint="选择轨道名称，查看开放地图采集到的实际线段。";
const noMatches="本期轨道索引中没有匹配名称，可输入更短的线路简称继续查找。";

function plainName(name) {
  return name.normalize("NFKC").toLowerCase().replace(/\s+/g,"");
}
function searchName(name) {
  // Expand query terms only. Each OSM name keeps its own ID and geometry.
  return name.replace(/高速铁路|高速线|高铁线?|客运专线|客专线?/g,"高速")
    .replace(/城际(?:铁路|线)?/g,"城际").replace(/(?:普速)?铁路$/,"线");
}
function searchRank(item, term, key) {
  if(item.plain===term)return 0;
  if(item.key===key)return 1;
  if(item.key===key+"线"||item.key===key+"高速"||item.key===key+"城际")return 2;
  if(item.plain.startsWith(term)||item.key.startsWith(key))return 3;
  if(item.plain.includes(term)||item.key.includes(key))return 4;
  return -1;
}
function updateAddress(id,query) {
  const url=new URL(location.href);
  url.searchParams.delete("q");
  url.searchParams.delete("id");
  if(id)url.searchParams.set("id",id);
  else if(query)url.searchParams.set("q",query);
  if(url.href!==location.href)history.replaceState(null,"",url);
}
function drawList() {
  const pages=Math.max(1,Math.ceil(results.length/pageSize));
  q("#track-count").textContent=fmt(results.length)+" 个匹配名称";
  q("#track-choices").innerHTML=results.slice(pageNumber*pageSize,(pageNumber+1)*pageSize).map(item=>
    '<button type="button" data-track="'+esc(item.id)+'" aria-pressed="'+(chosen===item.id)+'"><span>'+esc(item.name)+'</span><small>'+fmt(item.ways)+' 段</small></button>').join("");
  q("#track-page").textContent=(pageNumber+1)+" / "+pages;
  q("#track-prev").disabled=pageNumber===0;
  q("#track-next").disabled=pageNumber+1>=pages;
}
function search(updateUrl=true) {
  if(!trackIndex)return;
  const query=finder.value.trim(), term=plainName(query);
  if(term){
    const key=searchName(term);
    const groups=[[],[],[],[],[]];
    for(const item of trackIndex.items){
      const rank=searchRank(item,term,key);
      if(rank>=0)groups[rank].push(item);
    }
    results=groups.flat();
  } else results=trackIndex.items;
  if(!chosen||!results.some(item=>item.id===chosen)){
    ++generation;
    chosen=null;
    lineLayer.clearLayers();
    q("#track-detail").textContent=results.length?selectionHint:noMatches;
  }
  if(updateUrl)updateAddress(chosen,query);
  pageNumber=0;
  drawList();
}
async function selectTrack(item) {
  if(!item)return;
  const token=++generation;
  chosen=item.id;
  lineLayer.clearLayers();
  const index=results.indexOf(item);
  if(index>=0)pageNumber=Math.floor(index/pageSize);
  drawList();
  updateAddress(item.id);
  if(isNarrow.matches)showOptions(false);
  q("#track-detail").textContent="正在读取"+item.name+"的轨迹…";
  try {
    const shard=item.id.slice(0,2);
    if(!shards.has(shard)){
      if(shards.size>=8)shards.delete(shards.keys().next().value);
      shards.set(shard,readData("open-tracks/"+trackIndex.snapshot+"/"+shard+".geojson").catch(e=>{shards.delete(shard);throw e}));
    }
    const file=await shards.get(shard);
    if(token!==generation)return;
    const feature=file.features.find(f=>f.properties.id===item.id);
    if(!feature)throw Error("轨迹分片内缺少该名称");
    L.geoJSON(feature,{renderer:canvas,style:{color:"#166850",weight:3.4,opacity:.95}}).bindTooltip(esc(item.name),{sticky:true}).addTo(lineLayer);
    const box=lineLayer.getBounds(),left=!isNarrow.matches&&q(".track-panel").offsetWidth+28;
    trackMap.fitBounds(box,{paddingTopLeft:[left||24,isNarrow.matches?95:40],paddingBottomRight:[36,isNarrow.matches?165:100],maxZoom:9,animate:false});
    q("#track-detail").innerHTML='<strong>'+esc(item.name)+'</strong><p>该名称包含 '+fmt(item.ways)+' 个开放地图线要素。同名线段分别绘制，快照日期 '+esc(trackIndex.snapshot)+'。</p><small>轨道标签不能单独证明全线开通或当前办理客运。</small> <a rel="noopener noreferrer" target="_blank" href="https://www.openstreetmap.org/way/'+encodeURIComponent(item.exampleWay)+'">查看一段原始轨道</a>';
  } catch(e) {if(token===generation)q("#track-detail").textContent="轨迹暂时未能读取，可再次选择重试。";}
}
q("#track-choices").onclick=e=>{
  const id=e.target.closest("[data-track]")?.dataset.track;
  if(id)selectTrack(trackIndex.items.find(item=>item.id===id));
};
finder.oninput=()=>search();
finder.onkeydown=e=>{
  if(e.key==="Enter"&&!e.isComposing&&results.length)selectTrack(results[0]);
};
for(const [id,step] of [["track-prev",-1],["track-next",1]])q("#"+id).onclick=()=>{pageNumber+=step;drawList()};
(async()=>{
  trackIndex=await readData("open-tracks/index.json");
  for(const item of trackIndex.items){
    item.plain=plainName(item.name);
    item.key=searchName(item.plain);
  }
  trackIndex.items.sort((a,b)=>b.ways-a.ways||a.name.localeCompare(b.name,"zh-CN"));
  q("#track-coverage").textContent=fmt(trackIndex.names)+" 个原始名称 · "+fmt(trackIndex.ways)+" 个开放轨道要素。";
  const params=new URLSearchParams(location.search);
  const linked=params.has("id")&&trackIndex.items.find(x=>x.id===params.get("id"));
  finder.value=linked?linked.name:params.get("q")||"";
  search(false);
  if(params.has("id")&&!linked){
    q("#track-detail").textContent="这个轨道链接已失效。请搜索轨道名称，重新选择要查看的线段。";
    return;
  }
  await selectTrack(linked||results[0]);
})().catch(()=>{q("#track-coverage").textContent="暂时无法载入开放轨道索引，请刷新重试。"});
