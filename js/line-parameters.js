"use strict";
mountHeader("book");
const box=q("#parameter-detail"), input=q("#parameter-query"), limit=12;
const pageUrl=new URL(location.href), shards=new Map();
let directory, matches=[], selected=null, page=0, generation=0;
input.value = pageUrl.searchParams.get("q") || "";
function key(name) {
  return name.normalize("NFKC").toLowerCase().replace(/\s+/g,"")
    .replace(/高速铁路|高铁线?|高速线|客运专线|客专线?/g,"高速").replace(/城际铁路|城际线/g,"城际").replace(/铁路$/,"线");
}
function linkFor(id, term="") {
  const url=new URL(pageUrl);
  url.searchParams.delete("id");
  url.searchParams.delete("q");
  url.searchParams.delete("section");
  url.searchParams.delete("scope");
  if(term)url.searchParams.set("q",term);
  if(id)url.searchParams.set("id",id);
  return url.pathname+url.search;
}
function renderList() {
  const pages=Math.max(1,Math.ceil(matches.length/limit));
  page=Math.min(page,pages-1);
  q("#parameter-match").textContent="匹配 "+fmt(matches.length)+" 个来源条目"+(directory.scopeHits ? " · "+directory.scopeHits+" 个百科区段" : "");
  q("#parameter-page").textContent=(page+1)+" / "+pages;
  q("#parameter-prev").disabled=page===0;
  q("#parameter-next").disabled=page+1>=pages;
  q("#parameter-results").innerHTML=matches.slice(page*limit,(page+1)*limit).map(r=>
    '<a data-id="'+esc(r.id)+'" href="'+esc(linkFor(r.id,input.value.trim()))+'"'+(r.id===selected?' aria-current="true"':'')+'>'+esc(r.name)+'<small>'+(r.status==="available"?fmt(r.sections)+" 区段":"待补充")+'</small></a>').join("");
}
function filter() {
  const term=key(input.value.trim());
  matches=directory.items.filter(r=>!term||r.key.includes(term)||r.aliasKeys?.some(alias=>alias.includes(term)));
  const scoped = (directory.scoped || []).filter(r => term && r.aliasKeys.some(alias => alias.includes(term)));
  directory.scopeHits = scoped.length;
  q("#parameter-scoped").innerHTML = scoped.map(r => '<a class="context-link" href="' + esc(parameterLink(r.parameterRef)) + '">' + esc(r.name) + ' · 区段参数</a>').join("");
  if(term)matches.sort((a,b)=>Number(b.key===term)-Number(a.key===term));
  page=0;
}
function details(record) {
  const sections=record.sections.map((s,i)=>{
    const heading=s.name||"区段 "+(i+1);
    const scope=[s.trackName,s.scope].filter(Boolean).map(esc).join(" · ");
    const dates=s.events.map(e=>'<li><b>'+esc(e.label)+'</b>'+esc(e.value)+'</li>').join("");
    const fields=s.metrics.map(f=>'<div><dt>'+esc(f.label)+'</dt><dd>'+esc(f.value)+'</dd></div>').join("");
    return '<section><h3>'+esc(heading)+'</h3>'+(scope?'<p class="parameter-subtitle">'+scope+'</p>':'')+
      (dates?'<ul class="parameter-events">'+dates+'</ul>':'')+(fields?'<dl class="parameter-metrics">'+fields+'</dl>':'<p class="parameter-subtitle">该区段的技术规格待补充。</p>')+'</section>';
  }).join("");
  const groups=record.placeGroups.map(group=>{
    const places=group.places.map(p=>'<li>'+esc(p.name)+'<small>'+esc(p.kind)+(p.fareKm==null?(p.sourceMark?' · 来源标注 '+esc(p.sourceMark):''):' · '+esc(p.fareKm)+' km')+'</small></li>').join("");
    return '<details class="parameter-places"><summary>'+esc(group.name||"地点序列")+' · '+fmt(group.places.length)+' 个地点</summary><ol>'+places+'</ol></details>';
  }).join("");
  return sections+(groups?'<h3>沿线地点与计价里程</h3>'+groups:'');
}
async function addAtlasLinks(name,slot) {
  // The search spelling rules are intentionally separate from linkage evidence.
  const rows=await atlasIndex();
  const params = new URLSearchParams(location.search);
  const exact=rows.filter(row => {
    if (params.has("section")) return row.parameterRef?.document === params.get("id") &&
      row.parameterRef.section === params.get("section") && row.parameterRef.scope === params.get("scope");
    return (!row.parameterRef?.section && row.parameterRef?.document === params.get("id")) || row.name === name || (row.aliases || []).includes(name);
  });
  if(exact.length!==1||!slot.isConnected)return;
  const row=exact[0];
  const archive='<a href="'+esc(recordLink(row.id))+'">百科档案</a>';
  const mapped=row.sections.some(s=>Array.isArray(s.bbox)&&s.bbox.length===4);
  const map=mapped?'<a href="./?line='+encodeURIComponent(row.id)+'">在百科地图定位</a>':'';
  slot.innerHTML=archive+map;
  slot.hidden=false;
}
async function choose(item, update=false, focus=false) {
  const token=++generation;
  selected=item.id;
  const index=matches.indexOf(item);
  if(index>=0)page=Math.floor(index/limit);
  renderList();
  if(update)history.pushState(null,"",linkFor(item.id,input.value.trim()));
  document.title=item.name+" · 线路技术参数 · 中国铁路图鉴";
  const heading='<h2>'+esc(item.name)+'</h2>';
  const source='<p class="parameter-source"><a target="_blank" rel="noopener noreferrer" href="'+esc(item.url)+'">China-EMU 来源页</a> · '+
    esc(directory.asOf)+(item.status==="not_fetched"?' 目录日期':' 查阅')+' · <a href="'+esc(directory.license.url)+'" target="_blank" rel="noopener noreferrer">'+esc(directory.license.name)+'</a></p>';
  box.innerHTML=heading+source+'<div class="parameter-atlas-links" hidden></div><div class="parameter-sections"><p>正在读取区段参数…</p></div>';
  const body=box.querySelector(".parameter-sections");
  addAtlasLinks(item.name,box.querySelector(".parameter-atlas-links")).catch(()=>{});
  if(focus){box.focus({preventScroll:true});if(matchMedia("(max-width:740px)").matches)box.scrollIntoView({block:"start"});}
  if(item.status!=="available"){
    const empty={not_fetched:"目前仅有目录记录，该页面参数尚待采集。",unrecognized:"已读取来源页，原名或参数结构待人工复核。",no_table:"本次查阅未找到可识别的区段参数或地点。"};
    body.innerHTML='<p>'+esc(empty[item.status]||"区段参数待补充。")+'</p>';return;
  }
  try {
    if(!shards.has(item.shard))shards.set(item.shard,readData("line-parameters/"+directory.version+"/"+item.shard+".json").catch(e=>{shards.delete(item.shard);throw e;}));
    const shard=await shards.get(item.shard);
    if(token!==generation)return;
    const r=shard[item.id];
    if(!r||r.url!==item.url)throw Error("参数记录与目录不符");
    const query=new URLSearchParams(location.search);
    const scope=query.get("scope"), sectionName=query.get("section");
    if(sectionName&&query.get("id")===item.id){
      const sections=r.sections.filter(s=>s.name===sectionName&&(scope===null||scope===(s.scope||"")));
      const full='<p><a href="'+esc(linkFor(item.id))+'">查看该档案全部区段</a></p>';
      body.innerHTML=(sections.length?details({...r,sections,placeGroups:[]}):'<p>所选区段暂时未收录。</p>')+full;
    } else body.innerHTML=details(r);
  } catch {
    if(token===generation)body.innerHTML='<p>分片未能载入，请再次点选该线路重试。</p>';
  }
}
function promptResult(message) {
  ++generation;selected=null;box.textContent=message;document.title="线路技术参数 · 中国铁路图鉴";
}
function restore() {
  const params=new URLSearchParams(location.search);
  input.value=params.get("q")||"";
  filter();
  const item=directory.items.find(r=>r.id===params.get("id"));
  if(params.has("id")&&!item){promptResult("这个参数详情链接已失效。请重新搜索线路名称。");renderList();return;}
  if(item&&!matches.includes(item)){input.value=item.name;filter();history.replaceState(null,"",linkFor(item.id));}
  const exact=matches.find(r=>r.key===key(input.value.trim()));
  const initial=item||exact||(matches.length===1?matches[0]:null)||
    (!input.value.trim()?directory.items.find(r=>r.name==="石济高速铁路"):null);
  if(initial)choose(initial,false,Boolean(item)&&matchMedia("(max-width:740px)").matches);
  else {promptResult(matches.length?"请选择线路，查看区段资料。":"没有匹配条目，请缩短名称再试。");renderList();}
}
input.oninput=()=>{
  if(!directory){history.replaceState(null,"",linkFor(null,input.value.trim()));return;}
  filter();promptResult(matches.length?"请选择线路，查看区段资料。":"没有匹配条目，请缩短名称再试。");renderList();
  history.replaceState(null,"",linkFor(null,input.value.trim()));
};
input.onkeydown=e=>{if(e.key==="Enter"&&!e.isComposing&&matches.length){e.preventDefault();choose(matches[0],true,true);}};
q("#parameter-results").onclick=e=>{
  const link=e.target.closest("a[data-id]");
  if(!link||e.ctrlKey||e.shiftKey||e.metaKey||e.altKey)return;
  e.preventDefault();const item=directory.items.find(r=>r.id===link.dataset.id);if(item)choose(item,true,true);
};
q("#parameter-prev").onclick=()=>{if(page>0){page--;renderList();}};
q("#parameter-next").onclick=()=>{if((page+1)*limit<matches.length){page++;renderList();}};
window.addEventListener("popstate",()=>{if(directory)restore();});
(async()=>{
  directory=await readData("line-parameters/index.json");
  for(const item of directory.items)item.key=key(item.name);
  const s=directory.summary;
  q("#parameter-summary").textContent=fmt(s.items)+" 个来源条目，已整理 "+fmt(s.sections)+" 个区段的 "+fmt(s.metrics)+" 项技术参数。里程、速度和时间均按来源区段列示。";
  restore();
  const rows = await atlasIndex().catch(() => []);
  directory.scoped = [];
  const byId = new Map(directory.items.map(item => [item.id,item]));
  for (const r of rows) {
    if (!r.parameterRef || !byId.has(r.parameterRef.document)) continue;
    const aliasKeys = [r.name,...(r.aliases || [])].map(key);
    if (r.parameterRef.section) directory.scoped.push({...r,aliasKeys});
    else { const item = byId.get(r.parameterRef.document); item.aliasKeys = [...new Set([...(item.aliasKeys || []), ...aliasKeys])]; }
  }
  if (input.value && !new URLSearchParams(location.search).has("id")) restore();
})().catch(()=>{q("#parameter-summary").textContent="参数目录暂时无法载入，请刷新重试。";});
