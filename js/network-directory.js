"use strict";
const networkGroup = document.querySelector("#network-group");
const networkState = document.querySelector("#network-state");
let networkGroups = new Map(), networkRows = [], networkAtlas = new Map(), networkFacts = new Map();
const kindLabels = {line:"铁路线路",section:"区段",corridor:"组合通道",unknown:"名称待核实"};

function networkDirectory(data, build, atlasRows, facts) {
  networkAtlas=atlasRows;
  networkFacts=new Map(facts.map(r=>[r.id,r]));
  if (!data) {
    q("#network-summary").textContent = "本批资料暂时未能读取。请刷新重试。";
    return [];
  }
  networkRows = data.items;
  networkGroups = new Map(data.groups.map(group=>[group.id,group]));
  for (const group of data.groups) networkGroup.add(new Option(group.name,group.id));
  for (const [code,count] of Object.entries(data.stats.byStatus))
    networkState.add(new Option(statusName(code)+" · "+count,code));
  q("#network-summary").textContent=data.checkedAt+" 核对 · "+data.stats.groups+" 个清单分组，共 "+
    data.stats.entries+" 项。跨通道出现的线路按所在分组分别列出。";
  return networkRows.map(row=>build(row,"networks",[row.raw,row.name,row.scope,networkGroups.get(row.groupId).name,
    ...(row.members||[]).flatMap(member=>[member.name,member.scope,atlasRows.get(member.lineId)?.name]),
    ...(row.aliases||[])]));
}

function networkSources(refs) {
  return '<ol class="network-sources">'+refs.map(ref=>'<li>'+sourceURL(ref.url,ref.title)+
    (ref.date?' · '+esc(ref.date):'')+'</li>').join("")+'</ol>';
}

function showNetworkDetail(row,focus) {
  const group=networkGroups.get(row.groupId);
  const links=[];
  if(row.lineId)links.push(siteLink(recordLink(row.lineId),"相关线路百科"));
  if(row.lineId&&["operating","partial"].includes(row.status))
    links.push(siteLink("./?line="+encodeURIComponent(row.lineId),"查看百科已收录线位"));
  if(row.parameterId){
    const query=new URLSearchParams({id:row.parameterId});
    if(row.sectionOnly){query.set("section",row.parameterSectionName);query.set("scope",row.parameterSectionScope||"");}
    links.push(siteLink("line-parameters.html?"+query,"查看技术参数"));
  }
  if(row.publicId)links.push(siteLink("national.html?view=facts&id="+encodeURIComponent(row.publicId),"公开线路资料"));
  const measurements=(row.facts||[]).map(f=>[f.label,f.value]);
  const sideRows=networkRows.filter(r=>r.id!==row.id&&(
    (row.lineId&&row.lineId===r.lineId)||r.name===row.name));
  const similar=sideRows.map(r=>siteLink("national.html?view=networks&id="+encodeURIComponent(r.id),
    networkGroups.get(r.groupId).name+" · "+r.raw));
  const atlasRow=networkAtlas.get(row.lineId);
  const fact=networkFacts.get(row.publicId);
  const archive=atlasRow?'<h3>'+esc(atlasRow.name)+' · 百科档案口径</h3>'+
    metrics([["本站分类",typeName(atlasRow.type)],["运输性质",trafficLabel(atlasRow)],["起点",atlasRow.start],["终点",atlasRow.end],["档案里程",atlasRow.lengthKm==null?null:distanceLabel(atlasRow.lengthKm)],["开通节点",atlasRow.opened]])+
    (atlasRow.scope?'<p class="detail-foot">'+esc(atlasRow.scope)+'</p>':''):'';
  const members=(row.members||[]).map(member=>
    '<div><h4>'+esc(member.name)+' · '+esc(statusName(member.status))+'</h4><p>'+esc(member.scope||"")+'</p>'+
    (member.lineId?'<p>'+siteLink(recordLink(member.lineId),"查看"+networkAtlas.get(member.lineId).name+"百科")+'</p>':"")+
    (member.opened?'<p>开通节点 · '+esc(member.opened)+'</p>':"")+
    (member.sources?.length?networkSources(member.sources):"")+'</div>'
  ).join("");
  const title=row.raw;
  detailBox.dataset.selected=row.id;
  document.title=title+" · 客运线路与八纵八横 · 中国铁路图鉴";
  detailBox.innerHTML='<p class="detail-kicker">清单分组 · '+esc(group.name)+'</p><h2>'+esc(title)+'</h2>'+
    metrics([["对照名称",row.name!==title?row.name:null],["记录对象",kindLabels[row.kind]],["铁路运营状态",statusName(row.status)],["开通节点",row.opened]])+
    (row.scope?'<h3>核验范围</h3><p>'+esc(row.scope)+'</p>':'')+
    (row.note?'<p>'+esc(row.note)+'</p>':'')+
    (row.passengerScope?'<p><b>客运情况</b>　'+esc(row.passengerScope)+'</p>':'')+
    (measurements.length?metrics(measurements):"")+
    (members?'<section class="network-members"><h3>逐段核验</h3>'+members+'</section>':'')+
    (row.membership==="verified"?'<p class="detail-foot">通道归属已有出处，见下列资料。</p>':'')+
    archive+
    (fact&&!atlasRow?'<details class="scope-spec"><summary>'+esc(fact.name)+' · 公开线路资料</summary>'+publicSection(fact)+'</details>':'')+
    (row.parameterId?'<details class="scope-spec network-parameters"><summary>查看已收录的区段技术参数</summary><div class="parameter-slot"></div></details>':'')+
    (links.length?'<h3>站内资料</h3><p class="detail-links">'+links.join("")+'</p>':'')+
    (similar.length?'<h3>其他分组中的相关记录</h3><p class="detail-links">'+similar.join("")+'</p>':'')+
    (row.sources?.length?'<h3>核验出处</h3>'+networkSources(row.sources):'<p class="detail-foot">本项尚待可靠公开资料核实。</p>')+
    '<button class="back-index" type="button">返回结果列表</button>';
  const parameters=detailBox.querySelector(".network-parameters");
  if(parameters)parameters.addEventListener("toggle",()=>{
    if(!parameters.open||parameters.dataset.loaded)return;
    parameters.dataset.loaded="1";
    const slot=parameters.querySelector(".parameter-slot");
    slot.textContent="正在读取区段参数…";
    inlineParameters(row,slot).catch(()=>{slot.textContent="参数暂时无法加载，可从站内资料打开参数页。";delete parameters.dataset.loaded;});
  });
  if(focus){
    detailBox.focus({preventScroll:true});
    if(matchMedia("(max-width:740px)").matches)detailBox.scrollIntoView({block:"start"});
  }
}
