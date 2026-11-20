"use strict";
let junctionIndex = [], junctionLayer, focusedNode, junctionToOpen;
const visibleJunctions = new Map();
function searchJunctions(term) {
  const host = q("#junction-hits");
  const results = term ? junctionIndex.filter(j => j.name.includes(term) || j.aliases?.includes(term)) : [];
  host.hidden = !results.length;
  host.innerHTML = results.slice(0,8).map(j => '<a class="junction-hit" href="' +
    (j.coordinate ? './?junction=' + encodeURIComponent(j.id) : junctionLink(j.id)) + '">' +
    esc(j.name) + ' · ' + (j.coordinate ? '地图定位' : '查看档案') + '</a>').join('');
}
function drawJunctions() {
  if (!junctionLayer) return;
  const allowed = new Set(matches.map(r => r.id));
  const bounds = map.getBounds(), visible = new Set();
  const enabled = q("#junction-on").checked;
  for (const j of junctionIndex) {
    if (!enabled || !j.coordinate || !enabledStates.has(j.statusCode)) continue;
    const focus = focusedNode === j.id;
    if (!focus && (!j.lineIds.some(k => allowed.has(k)) || (map.getZoom() < 7.2 && !(selected && j.lineIds.includes(active))))) continue;
    const position = [j.coordinate[1], j.coordinate[0]];
    if (!bounds.contains(position)) continue;
    visible.add(j.id);
    let marker = visibleJunctions.get(j.id);
    if (!marker) {
      marker = L.marker(position, {title:j.name, icon:L.divIcon({className:'junction-pin',html:'<span></span>',iconSize:[20,20],iconAnchor:[10,10]})});
      marker.bindTooltip(esc(j.name) + (j.statusCode === 'operating' ? '' : ' · ' + esc(statusName(j.statusCode))), {direction:'top'});
      marker.bindPopup('<strong>'+esc(j.name)+'</strong><p>'+esc(statusName(j.statusCode))+'</p><p><a href="'+junctionLink(j.id)+'">查看接入线路与所属枢纽</a></p>', {autoPan:false});
      marker.addTo(junctionLayer);
      visibleJunctions.set(j.id, marker);
    }
    if (junctionToOpen === j.id) {
      junctionToOpen = null;
      marker.openPopup();
    }
  }
  for (const [id, marker] of visibleJunctions) {
    if (visible.has(id)) continue;
    junctionLayer.removeLayer(marker);
    visibleJunctions.delete(id);
  }
}
async function initJunctions() {
  if (registry.stats.junctions == null) return;
  junctionIndex = (await atlasRead('junctions.json')).junctions;
  junctionLayer = L.layerGroup().addTo(map);
  searchJunctions(q("#search").value.trim());
  const id = new URLSearchParams(location.search).get('junction');
  const node = junctionIndex.find(j => j.id === id);
  if (node?.coordinate) {
    focusedNode = id;
    junctionToOpen = id;
    if (!enabledStates.has(node.statusCode)) { enabledStates.add(node.statusCode); updateLayers(); }
    map.setView([node.coordinate[1],node.coordinate[0]],9,{animate:false});
    if (mobile.matches) setSidebar(false);
    map.once('dragstart',()=>{focusedNode = null;});
  }
  drawJunctions();
}
