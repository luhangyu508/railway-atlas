"use strict";
mountHeader("globe");
const termBox = q("#national-query"), bureauBox = q("#bureau"), collectionBox = q("#collection");
const detailBox = q("#national-detail"), resultsBox = q("#national-results");
const pageLength = 12;
let page = 0, selected, records, groups, byId, publicNames, roster, filtered;
let parameters, datedServices, natureFilter="", trunkTotal=0;
function searchable(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g,"")
    .replace(/高速铁路|高速线|高铁/g,"高速").replace(/客运专线/g,"客专");
}
function target(id, currentPage=page) {
  const params = new URLSearchParams();
  for (const [key, value] of [["q",termBox.value.trim()],["bureau",bureauBox.value],["view",collectionBox.value],["nature",natureFilter],["group",networkGroup.value],["state",networkState.value],["id",id]]) {
    if (value) params.set(key,value);
  }
  if (currentPage) params.set("page",String(currentPage+1));
  return location.pathname+(params.size?"?"+params:"");
}
function siteLink(href,label) {
  return '<a href="'+esc(href)+'">'+esc(label)+'</a>';
}
function sourceURL(url,title) {
  return validLink(url)?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(title)+'</a>':"";
}
function metrics(pairs) {
  const rows = pairs.filter(([,v])=>v!==null&&v!==undefined&&v!=="");
  return rows.length?'<dl class="fact-list">'+rows.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join("")+'</dl>':"";
}
function occurrences(entry) {
  const row = entry.data;
  return roster.items.filter(r=>(row.lineId&&row.lineId===r.lineId)||r.name===row.name||
    r.canonicalName===row.name||(row.canonicalName&&(row.canonicalName===r.name||r.canonicalName===row.canonicalName)));
}
function publicSection(d) {
  const fields=metrics([
    ["本站分类",d.siteType ? typeName(d.siteType) : null],["运输性质",trafficLabel(d)],["来源分类",typeName(d.type)],["起点",d.start],["终点",d.end],
    ["里程",Number.isFinite(d.lengthKm)?fmt(d.lengthKm)+" km":null],
    ["设计速度",Number.isFinite(d.designSpeed)?fmt(d.designSpeed)+" km/h":null],
    ["运营速度",Number.isFinite(d.operatingSpeed)?fmt(d.operatingSpeed)+" km/h":null],["开通节点",d.opened]
  ]);
  const sources=[...new Set([d.source,...(d.sources||[])].filter(Boolean))];
  return fields+(d.lengthScope?'<p class="detail-foot">'+esc(d.lengthScope)+'</p>':"")+
    (d.stations?.length?'<h3>资料列举的沿线车站</h3><p>'+d.stations.map(esc).join("、")+'</p>':"")+
    (d.aliases?.length?'<p>其他名称：'+d.aliases.map(esc).join("、")+'</p>':"")+
    '<p class="detail-foot">资料来源 · '+sources.map((s,i)=>sourceURL(s,i?"分类或线路表 "+i:"线路资料")).filter(Boolean).join(" · ")+'</p>';
}
async function inlineParameters(row,slot) {
  parameters ||= readData("line-parameters/index.json").catch(e=>{parameters=null;throw e;});
  const index=await parameters;
  const item=index.items.find(r=>r.id===row.parameterId);
  if(!item||!slot.isConnected)return;
  const chunk=await readData("line-parameters/"+index.version+"/"+item.shard+".json");
  if(!slot.isConnected)return;
  const allSections=chunk[item.id]?.sections || [];
  const sections=row.sectionOnly?allSections.filter(s=>s.name===row.parameterSectionName&&
    (s.scope||null)===(row.parameterSectionScope||null)):allSections;
  if (!sections.length)return;
  const specs=sections.map(section=>{
    const title=String(section.name||section.trackName||item.name);
    const chosen=sections.length===1||title===row.parameterSectionName;
    const fields=metrics((section.metrics||[]).slice(0,6).map(f=>[f.label,f.value]));
    const times=(section.events||[]).slice(0,3).map(e=>esc(e.label)+" "+esc(e.value)).join(" · ");
    return '<details class="scope-spec"'+(chosen?' open':'')+'><summary>'+esc(title)+'</summary>'+
      '<p class="detail-foot">'+esc([section.trackName,section.scope].filter(Boolean).join(" · "))+'</p>'+
      fields+(times?'<p>'+times+'</p>':"")+'</details>';
  });
  slot.innerHTML='<h3>来源区段的技术参数</h3><p class="detail-foot">各组参数按来源划分的区段展示。</p>'+specs.join("")+
    '<p class="detail-foot">慧伊创新科技（北京）有限公司 · '+sourceURL(item.url,"China-EMU")+
    ' · '+sourceURL("https://creativecommons.org/licenses/by-nc-sa/3.0/cn/","CC BY-NC-SA 3.0 中国大陆")+'</p>';
}
async function loadTrunk(row,slot) {
  datedServices ||= atlasRead("services.json").catch(e=>{datedServices=null;throw e;});
  const [article, serviceData]=await Promise.all([atlasRead("lines/"+encodeURIComponent(row.id)+".json"),datedServices.catch(()=>({services:[]}))]);
  if(!slot.isConnected)return;
  const evidence=[row.passengerSource,...(article.sources||[]).slice(0,2)].filter(Boolean);
  const cover=article.cover;
  const photo=cover?.src?'<figure class="trunk-photo"><img alt="'+esc(cover.caption||article.name)+'" src="'+esc(cover.src)+'"><figcaption>'+esc(cover.caption||"")+' · '+esc(cover.author||"")+' · '+sourceURL(cover.url,"原图")+' '+sourceURL(cover.licenseUrl,cover.license||"许可")+'</figcaption></figure>':"";
  const archived=serviceData.services.filter(s=>s.lineIds.includes(row.id)).map(s=>({
    number:s.number,date:s.date,path:s.path,source:s.sources[0],showArchive:true
  }));
  const services=[...(row.services||[]),...archived].map(t=>{
    const number=t.showArchive?siteLink('explore.html?'+new URLSearchParams({tab:'services',q:t.number,date:t.date}),t.number):esc(t.number);
    return '<li><b>'+number+'</b> · '+esc(t.date)+' · '+esc(t.path)+' · '+sourceURL(t.source.url,t.source.title)+'</li>';
  }).join("");
  const missing=article.sections.filter(s=>!s.bbox && s.statusCode==="operating");
  const traffic=trafficLabel(row);
  const gaps=missing.length?'<p class="notice">待补轨迹的运营区段 · '+missing.map(s=>esc(s.name)).join("、")+'</p>':"";
  slot.innerHTML=photo+'<p>'+esc(article.intro)+'</p>'+
    metrics([["本站分类",typeName(row.type)],["运输性质与速度等级",traffic],["起点",row.start],["终点",row.end],["状态",statusName(row.statusCode)],["资料里程",Number.isFinite(row.lengthKm)?distanceLabel(row.lengthKm):null],["开通节点",row.opened]])+
    (article.scope||article.lengthScope?'<p class="detail-foot">'+esc(article.scope||article.lengthScope)+'</p>':'')+
    gaps+(row.stationNames.length?'<h3>沿线车站 · '+row.stationNames.length+' 座</h3><p>'+row.stationNames.map(esc).join("、")+'</p>':'')+
    (services?'<h3>有日期的客运记录</h3><ul class="record-scopes">'+services+'</ul>':"")+
    '<h3>资料出处</h3><p class="detail-foot">'+evidence.map(s=>sourceURL(s.url,s.title)).join(" · ")+'</p>';
}
function showDetail(entry,focus=false) {
  if(!entry){
    selected=null;
    detailBox.removeAttribute("data-selected");
    detailBox.innerHTML='<h2>线路与区段资料</h2><p>选择目录中的条目，查看区段、参数和相关地图。</p>';
    document.title="全国铁路目录 · 中国铁路图鉴";
    return;
  }
  selected=entry.id;
  if(entry.kind==="networks"){
    showNetworkDetail(entry.data,focus);
    return;
  }
  const d=entry.data, isRoster=entry.kind==="roster", isTrunk=entry.kind==="trunks";
  const links=[];
  if(d.lineId)links.push(siteLink(recordLink(d.lineId),"线路百科"),siteLink("./?"+(isTrunk?"network=passenger-trunks&":"")+"line="+encodeURIComponent(d.lineId),"百科地图"));
  if(d.parameterId)links.push(siteLink("line-parameters.html?id="+encodeURIComponent(d.parameterId),"完整区段参数"));
  if(d.trackId)links.push(siteLink("tracks.html?id="+encodeURIComponent(d.trackId),"查看同名开放轨道"));
  const matchedFacts=isRoster?[...new Set([...(publicNames.get(d.name)||[]),...(publicNames.get(d.canonicalName)||[])])]:[];
  const scopeRows=occurrences(entry);
  const scopeList=scopeRows.map(r=>'<li>'+siteLink("national.html?view=roster&id="+encodeURIComponent(r.id),groups.get(r.bureauId).short+" · "+r.raw)+'</li>').join("");
  const review=d.review&&typeof d.review==="object"?'<aside class="notice"><b>'+esc(d.review.label)+'</b><p>'+esc(d.review.note)+'</p>'+
    (d.review.sources||[]).map(s=>sourceURL(s.url,s.title)).join(" · ")+'</aside>':"";
  detailBox.dataset.selected=entry.id;
  const title=isRoster?d.raw:d.name;
  document.title=title+" · 全国铁路目录 · 中国铁路图鉴";
  detailBox.innerHTML='<p class="detail-kicker">'+esc(isRoster?groups.get(d.bureauId).name+" · 原始清单":isTrunk?"主要客运干线 · "+typeName(d.type):"公开线路资料")+'</p><h2>'+esc(title)+'</h2>'+
    (isRoster?metrics([["清单分组",groups.get(d.bureauId).short],["原列区段",d.scope],["对照名称",d.canonicalName&&d.canonicalName!==d.name?d.canonicalName:null]])+
    '<p class="detail-foot">此项保留提交清单的写法。管辖边界及其适用时期须以相应资料另行核实。</p>'+review:isTrunk?'<div class="trunk-facts">正在读取线路档案…</div>':publicSection(d))+
    (links.length?'<h3>站内档案与地图</h3><p class="detail-links">'+links.join("")+'</p>':"")+
    (d.parameterId?'<div class="inline-parameters"></div>':"")+
    (matchedFacts.length?'<h3>同名公开线路资料</h3>'+matchedFacts.map(f=>publicSection(f)).join(""):"")+
    (scopeRows.length>Number(isRoster)?'<h3>局集团清单中的相关记录</h3><ul class="record-scopes">'+scopeList+'</ul>':"")+
    (!links.length&&isRoster&&!matchedFacts.length?'<p>本站尚缺与此项对应的区段参数和地图档案。</p>':"")+
    '<button class="back-index" type="button">返回结果列表</button>';
  if(isTrunk){const slot=detailBox.querySelector(".trunk-facts");loadTrunk(d,slot).catch(()=>{slot.textContent="资料未载入，可打开线路百科重试。";});}
  if(d.parameterId)inlineParameters(d,detailBox.querySelector(".inline-parameters")).catch(()=>{});
  if(focus){detailBox.focus({preventScroll:true});if(matchMedia("(max-width:740px)").matches)detailBox.scrollIntoView({block:"start"});}
}
function render() {
  const term=searchable(termBox.value.trim()), bureau=bureauBox.value, view=collectionBox.value;
  const isNetwork=view==="networks";
  q("main h1").textContent=isNetwork?"客运线路与八纵八横":view==="trunks"?"主要客运干线":"全国铁路目录";
  q("#network-context").hidden=!isNetwork;
  q("#network-reference").hidden=isNetwork;
  q("#bureau-field").hidden=isNetwork;
  q("#network-group-field").hidden=q("#network-state-field").hidden=!isNetwork;
  q("#trunk-tools").hidden=view!=="trunks";
  termBox.placeholder=view==="trunks"?"干线名称、沿线城市或车站":"线路、站名、局简称或区段";
  for(const button of document.querySelectorAll("[data-nature]"))button.setAttribute("aria-pressed",String(button.dataset.nature===natureFilter));
  filtered=records.filter(r=>(view==="all"||r.kind===view)&&(!natureFilter||r.data.type===natureFilter)&&(!bureau||r.data.bureauId===bureau)&&(!term||r.key.includes(term))&&
    (!isNetwork||((!networkGroup.value||networkGroup.value===r.data.groupId)&&(!networkState.value||networkState.value===r.data.status))));
  const pages=Math.max(1,Math.ceil(filtered.length/pageLength));
  page=Math.max(0,Math.min(page,pages-1));
  q("#result-summary").textContent="匹配 "+fmt(filtered.length)+(view==="trunks"?" 条干线":" 项")+(natureFilter==="highspeed"?" · "+highspeedScope:"");
  resultsBox.innerHTML=filtered.slice(page*pageLength,(page+1)*pageLength).map(r=>{
    const label=r.kind==="networks"?statusName(r.data.status):r.kind==="roster"?groups.get(r.data.bureauId).short:typeName(r.data.siteType || r.data.type);
    const caption=r.kind==="networks"?'<span class="trunk-endpoints">'+esc(networkGroups.get(r.data.groupId)?.name)+'</span>':r.kind==="trunks"?'<span class="trunk-endpoints">'+esc([r.data.start,r.data.end].filter(Boolean).join(" → "))+'</span>':"";
    return '<a href="'+esc(target(r.id))+'" data-entry="'+esc(r.id)+'"'+(selected===r.id?' aria-current="true"':'')+'><span><b>'+esc(r.data.raw||r.data.name)+'</b>'+caption+'</span><small>'+esc(label)+'</small></a>';
  }).join("")||('<p>没有匹配资料。可以缩短关键词或清除筛选。</p>'+
    (view==="trunks"?siteLink("national.html?view=all&q="+encodeURIComponent(termBox.value),"在全部资料中继续查找"):""));
  q("#page-number").textContent=(page+1)+" / "+pages;
  q("#back-page").disabled=page===0;q("#next-page").disabled=page+1>=pages;
}
function restore() {
  const params=new URLSearchParams(location.search);
  termBox.value=params.get("q")||"";bureauBox.value=params.get("bureau")||"";collectionBox.value=params.get("view")||(bureauBox.value?"roster":params.has("q")||params.has("id")?"all":"trunks");
  if(!collectionBox.value)collectionBox.value="all";
  networkGroup.value=collectionBox.value==="networks"?params.get("group")||"":"";
  networkState.value=collectionBox.value==="networks"?params.get("state")||"":"";
  natureFilter=collectionBox.value==="trunks"?params.get("nature")||"":"";
  if(!["highspeed","conventional"].includes(natureFilter))natureFilter="";
  if(bureauBox.value&&collectionBox.value==="facts")collectionBox.value="roster";
  page=Math.max(0,(Number.parseInt(params.get("page"),10)||1)-1);
  const id=params.get("id");
  showDetail(byId.get(id));
  if(id&&!byId.has(id))detailBox.innerHTML="<h2>未找到这条记录</h2><p>请用名称或区段重新搜索。</p>";
  render();
  if(!selected&&!id&&!termBox.value&&collectionBox.value==="trunks"&&filtered[0]&&!matchMedia("(max-width:740px)").matches){showDetail(filtered[page*pageLength]);render();}
  if(selected&&!params.has("page")&&filtered.some(r=>r.id===selected)){
    page=Math.floor(filtered.findIndex(r=>r.id===selected)/pageLength);render();
  }
}
function resetResults(){
  page=0;showDetail(null);render();history.replaceState(null,"",target(null));
}
async function openNational(){
  parameters ||= readData("line-parameters/index.json").catch(e=>{parameters=null;throw e;});
  const [rosterData,facts,atlas,params,trunks,network]=await Promise.all([readData("bureau-roster.json"),readData("national-facts.json").catch(()=>({lines:[],unavailable:true})),atlasIndex(),parameters.catch(()=>({items:[]})),readData("catalog/passenger-trunks.json"),readData("catalog/passenger-network.json").catch(()=>null)]);
  const atlasRows=new Map(atlas.map(r=>[r.id,r])), parameterRows=new Map(params.items.map(r=>[r.id,r]));
  roster=rosterData;
  groups=new Map(roster.bureaus.map(g=>[g.id,g]));
  for(const g of roster.bureaus)bureauBox.add(new Option(g.short+" · "+g.count+" 项",g.id));
  publicNames=new Map();
  const atlasNames = new Map();
  for (const line of atlas) {
    for (const name of new Set([line.name,...line.aliases])) {
      if (!atlasNames.has(name)) atlasNames.set(name,[]);
      atlasNames.get(name).push(line);
    }
  }
  for(const row of facts.lines) {
    const exact = atlasNames.get(row.name) || [];
    if (exact.length === 1) {
      row.siteType = exact[0].type;
      row.mixedTrafficSpeedKmh = exact[0].mixedTrafficSpeedKmh;
      row.lineId = exact[0].id;
    }
    if(!publicNames.has(row.name))publicNames.set(row.name,[]);
    publicNames.get(row.name).push(row);
  }
  const build=(data,kind,terms)=>({id:data.id,data,kind,key:searchable(terms.filter(Boolean).join("|"))});
  const trunkRecords=trunks.lines.map(item=>{
    const line=atlasRows.get(item.id);
    if(!line)throw Error("未知干线 "+item.id);
    const data={...line,lineId:line.id,...item};
    return build(data,"trunks",[line.name,...line.aliases,trafficLabel(line),line.start,line.end,...line.cities,...line.stationNames,...(line.stationAliases||[])]);
  });
  trunkTotal=trunkRecords.length;
  records=[...trunkRecords,...roster.items.map(r=>build(r,"roster",[r.raw,r.name,r.scope,r.canonicalName,atlasRows.get(r.lineId)?.name,...(atlasRows.get(r.lineId)?.aliases||[]),parameterRows.get(r.parameterId)?.name,groups.get(r.bureauId).name,groups.get(r.bureauId).short])),
    ...facts.lines.map(r=>build(r,"facts",[r.name,...(r.aliases||[]),r.start,r.end,...(r.stations||[])]))];
  records.push(...networkDirectory(network, build, atlasRows, facts.lines));
  byId=new Map(records.map(r=>[r.id,r]));
  q("#coverage").textContent="本期选录 "+fmt(trunkTotal)+" 条主要客运干线，含高速铁路及办理客运的普速干线。全国资料另有 "+fmt(groups.size)+" 个局集团清单分组，共 "+fmt(roster.items.length)+" 项线路及区段记录。"+(facts.unavailable?"公开线路资料暂时未载入。":"另可查询 "+fmt(facts.lines.length)+" 个公开线路资料条目。");
  const form=q("#national-form");
  form.onsubmit=e=>e.preventDefault();
  termBox.oninput=resetResults;
  bureauBox.onchange=()=>{networkGroup.value=networkState.value="";if(bureauBox.value)collectionBox.value="roster";natureFilter="";resetResults();};
  networkGroup.onchange=networkState.onchange=resetResults;
  collectionBox.onchange=()=>{networkGroup.value=networkState.value="";if(collectionBox.value!=="roster")bureauBox.value="";natureFilter="";resetResults();};
  form.onreset=()=>{natureFilter="";requestAnimationFrame(resetResults);};
  for(const button of document.querySelectorAll("[data-nature]"))button.onclick=()=>{natureFilter=button.dataset.nature;resetResults();};
  for(const [id,step] of [["back-page",-1],["next-page",1]])q("#"+id).onclick=()=>{
    page+=step;render();history.replaceState(null,"",target(selected));q("#directory-index").scrollIntoView({block:"start"});
  };
  resultsBox.onclick=e=>{
    const link=e.target.closest("[data-entry]");
    if(!link||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;
    e.preventDefault();history.pushState(null,"",link.href);showDetail(byId.get(link.dataset.entry),true);render();
  };
  detailBox.onclick=e=>{if(e.target.closest(".back-index")){termBox.focus({preventScroll:true});q("#directory-index").scrollIntoView();}};
  window.addEventListener("popstate",restore);
  restore();
}
openNational().catch(()=>{q("#coverage").textContent="目录未能加载，请刷新重试。";});
