"use strict";
mountHeader("map");
document.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
q("#collapse").innerHTML = icon("fold", 17);
const map = newMap("map");
const mobile = matchMedia("(max-width:700px)");
const shell = q(".map-shell");
const sidebar = q(".sidebar");
const typeKeys = ["all", "highspeed", "conventional", "intercity"];
const filterKeys = ["type", "status", "region", "province", "city", "bureau"];
const layerNames = {
  operating: "运营中",
  partial: "部分运营",
  historical: "历史走向",
  suspended: "停运",
  abandoned: "废弃",
  construction: "在建",
  planned: "规划",
  unknown: "待核实"
};
const linePatterns = {
  historical: "7 4",
  suspended: "5 6",
  abandoned: "2 5",
  construction: "9 4",
  planned: "2 4",
  unknown: "1 6"
};
const filters = { type: "all", status: "", region: "", province: "", city: "", bureau: "" };
let trunkIds = new Set();
const enabledStates = new Set(["operating"]);
const pageSize = 20;
let routes = [],
  matches = [],
  page = 0,
  active = null,
  selected = false,
  registry;
const routesById = new Map(),
  sections = new Map(),
  searchText = new Map();
const visible = new Map(),
  coarseGeometry = new Map(),
  fineGeometry = new Map(),
  pending = new Map();
const maxFineCache = 192,
  maxFineRequestsInView = 64;
let renderGeneration = 0,
  stationRecords,
  stationLoading,
  overviewLoaded = false;
const draw = L.canvas({ padding: 0.12, tolerance: 5 });
const paths = L.layerGroup().addTo(map),
  ends = L.layerGroup().addTo(map),
  stations = L.layerGroup().addTo(map);
function setSidebar(open) {
  shell.classList.toggle("closed", !open);
  q("#expand").hidden = open;
}
let awaitingMapSize = false;
function homeView() {
  const size = map.getSize();
  if (!size.x || !size.y) {
    awaitingMapSize = true;
    map.setView([35, 105], 3.5, { animate: false });
    return;
  }
  awaitingMapSize = false;
  const left = !mobile.matches && !shell.classList.contains("closed") ? sidebar.offsetWidth + 36 : 24;
  map.fitBounds(
    mobile.matches
      ? [
          [21, 88],
          [47, 129]
        ]
      : [
          [19.4, 85.5],
          [48.8, 131.5]
        ],
    {
      paddingTopLeft: [left, mobile.matches ? 55 : 24],
      paddingBottomRight: [mobile.matches ? 20 : 47, mobile.matches ? 80 : 48],
      animate: false
    }
  );
}
q("#collapse").onclick = () => {
  setSidebar(false);
  if (selected) focusRoute(routesById.get(active));
  else homeView();
};
q("#expand").onclick = () => {
  if (mobile.matches && active) closeCard();
  setSidebar(true);
  if (!mobile.matches) homeView();
  q("#search").focus();
};
setSidebar(!mobile.matches);
homeView();
addBase(map);
const places = labels(map);
L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
const toBounds = (b) => L.latLngBounds([b[1], b[0]], [b[3], b[2]]);
const stateFor = (s) => (s.historical ? "historical" : s.statusCode);
const lineType = (key) => types[key] || { label: "其他铁路", color: "#66736a" };
const endpointText = (r) => (r.start || "待补充") + " — " + (r.end || "待补充");
const nonempty = (item) => typeof item === "string" && item.length;
const option = (value, label) => '<option value="' + esc(value) + '">' + esc(label) + "</option>";
function options(items, baseline = "不限") {
  return option("", baseline) + items.map(([key, label]) => option(key, label)).join("");
}
function fillFilters() {
  q("#filter-type").innerHTML =
    option("all", "全部性质") +
    Object.entries(registry.types)
      .map(([k, n]) => option(k, n))
      .join("");
  q("#filter-status").innerHTML = options(Object.entries(registry.statuses));
  for (const [key, field] of [
    ["region", "regions"],
    ["province", "provinces"],
    ["city", "cities"],
    ["bureau", "bureaus"]
  ]) {
    const values = [...new Set(routes.flatMap((r) => r[field] || []).filter(nonempty))].sort((a, b) =>
      a.localeCompare(b, "zh-CN")
    );
    q("#filter-" + key).innerHTML = options(
      values.map((v) => [v, v]),
      key === "bureau" && !values.length ? "暂无已核实机构" : "不限"
    );
  }
}
function renderButtons() {
  const keys = [...typeKeys];
  if (!keys.includes(filters.type)) keys.push(filters.type);
  const pool=q("#passenger-only").checked?routes.filter(r=>trunkIds.has(r.id)):routes;
  const counts={};
  for (const route of pool) counts[route.type]=(counts[route.type]||0)+1;
  q("#filters").innerHTML = keys
    .map((key) => {
      const all = key === "all",
        label = all ? "全部线路" : lineType(key).label,
        chosen = key === filters.type;
      return (
        '<button class="filter' +
        (chosen ? " active" : "") +
        '" data-type="' +
        esc(key) +
        '" style="--rail:' +
        lineType(key).color +
        '" aria-pressed="' +
        chosen +
        '">' +
        (all ? icon("layers", 14) : "<i></i>") +
        esc(label) +
        "<small>" +
        (all ? pool.length : counts[key] || 0) +
        "</small></button>"
      );
    })
    .join("");
  const count = filterKeys.filter((k) => filters[k] && filters[k] !== "all").length;
  q("#filter-summary").textContent = count ? "筛选条件 · " + count : "更多筛选";
}
function row(r) {
  return (
    '<button class="row' +
    (r.id === active ? " chosen" : "") +
    '" data-id="' +
    esc(r.id) +
    '" style="--rail:' +
    lineType(r.type).color +
    '"><span class="row-icon">' +
    icon("train", 18) +
    '</span><span class="row-copy"><strong>' +
    esc(r.name) +
    "</strong><small>" +
    esc(endpointText(r)) +
    (r.historical ? " · 历史" : "") +
    "</small></span>" +
    icon("chevron", 13) +
    "</button>"
  );
}
function renderList(resetScroll = false) {
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  page = Math.max(0, Math.min(page, pages - 1));
  q("#result-count").textContent = matches.length + " 条";
  q("#route-list").innerHTML = matches.length
    ? matches
        .slice(page * pageSize, (page + 1) * pageSize)
        .map(row)
        .join("")
    : '<div class="empty"><b>没有符合条件的线路</b><a href="tracks.html?q=' +
      encodeURIComponent(q("#search").value.trim()) +
      '">检索开放轨道</a><button data-clear>清除筛选和搜索</button></div>';
  updateNationalMapSearch(q("#search").value.trim());
  searchJunctions(q("#search").value.trim());
  const lookup = q("#map-parameters");
  lookup.href = "line-parameters.html?q=" + encodeURIComponent(q("#search").value.trim());
  if (resetScroll) q("#routes-scroll").scrollTop = 0;
  q("#previous").disabled = !page;
  q("#next").disabled = page + 1 >= pages;
  q("#page-status").textContent = matches.length ? "第 " + (page + 1) + " / " + pages + " 页" : "0 条";
}
function applyFilters() {
  const term = q("#search").value.trim().toLowerCase();
  matches = routes.filter(
    (r) =>
      (!q("#passenger-only").checked || trunkIds.has(r.id)) &&
      (filters.type === "all" || r.type === filters.type) &&
      (!filters.status ||
        r.statusCode === filters.status ||
        r.sections.some((s) => s.statusCode === filters.status)) &&
      (!filters.region || r.regions.includes(filters.region)) &&
      (!filters.province || r.provinces.includes(filters.province)) &&
      (!filters.city || r.cities.includes(filters.city)) &&
      (!filters.bureau || r.bureaus.includes(filters.bureau)) &&
      (!term || searchText.get(r.id).includes(term))
  );
  if (active && !matches.some((r) => r.id === active)) closeCard(false);
  page = 0;
  renderButtons();
  renderList(true);
  scheduleDraw();
}
function updateLayers() {
  q("#state-layers").innerHTML =
    "<legend>区段图层</legend>" +
    Object.entries(layerNames)
      .map(
        ([key, label]) =>
          '<label><input type="checkbox" data-layer="' +
          key +
          '" ' +
          (enabledStates.has(key) ? "checked" : "") +
          '><i class="state-swatch" data-state="' +
          key +
          '"></i>' +
          label +
          "</label>"
      )
      .join("");
}
function sectionInScope(r, s) {
  return !filters.status || r.statusCode === filters.status || s.statusCode === filters.status;
}
function desiredSections() {
  const viewport = map.getBounds().pad(0.06),
    zoom = map.getZoom(),
    result = new Map();
  if (!q("#rail-on").checked) {
    q("#density-note").hidden = true;
    return result;
  }
  for (const r of matches) {
    for (const ref of r.sections) {
      const s = sections.get(ref.id),
        zoomVisible = zoom >= s.minZoom || (selected && active === r.id);
      if (
        !sectionInScope(r, s) ||
        !s.bounds ||
        !zoomVisible ||
        !enabledStates.has(stateFor(s)) ||
        !s.bounds.intersects(viewport)
      )
        continue;
      const owners = result.get(s.id);
      if (owners) owners.push(r.id);
      else result.set(s.id, [r.id]);
    }
  }
  // Regions with many overlapping secondary railways can exceed the useful path density at this scale.
  // Preserve all overview paths and the whole selected railway, then prefer nearby secondary sections.
  const center = map.getCenter();
  const regional = [...result.keys()].filter(
    (id) => !coarseGeometry.has(id) && !(selected && result.get(id).includes(active))
  );
  if (regional.length > maxFineRequestsInView) {
    const distances = new Map(
      regional.map((id) => [id, center.distanceTo(sections.get(id).bounds.getCenter())])
    );
    regional.sort((a, b) => distances.get(a) - distances.get(b) || a.localeCompare(b));
  }
  const omitted = regional.slice(maxFineRequestsInView);
  omitted.forEach((id) => result.delete(id));
  const density = q("#density-note");
  density.hidden = !omitted.length;
  if (omitted.length) density.textContent = "当前视野优先显示邻近区段，选择线路可查看完整走向。";
  return result;
}
function geometry(id) {
  if (fineGeometry.has(id)) {
    const feature = fineGeometry.get(id);
    fineGeometry.delete(id);
    fineGeometry.set(id, feature);
    return Promise.resolve(feature);
  }
  if (!pending.has(id)) {
    const req = atlasRead("geometry/" + encodeURIComponent(id) + ".geojson")
      .then((f) => {
        fineGeometry.set(id, f);
        while (fineGeometry.size > maxFineCache) fineGeometry.delete(fineGeometry.keys().next().value);
        return f;
      })
      .finally(() => pending.delete(id));
    pending.set(id, req);
  }
  return pending.get(id);
}
function linePicker(ids, latlng, title) {
  const div = document.createElement("div");
  div.className = "map-popup-lines";
  const h = document.createElement("strong");
  h.textContent = title;
  div.append(h);
  for (const id of ids) {
    const r = routesById.get(id);
    if (!r) continue;
    const b = document.createElement("button");
    b.textContent = r.name;
    b.onclick = () => {
      map.closePopup();
      if (!matches.includes(r)) resetFilters();
      showCard(id);
    };
    div.append(b);
  }
  L.popup().setLatLng(latlng).setContent(div).openOn(map);
}
function drawSection(id, owners, feature, detail) {
  const chosen = selected && owners.includes(active),
    r = routesById.get(chosen ? active : owners[0]),
    s = sections.get(id);
  const style = {
    color: lineType(r.type).color,
    weight: chosen ? 4.3 : 2.6,
    opacity: selected && !chosen ? 0.38 : 0.93,
    dashArray: linePatterns[stateFor(s)] || null
  };
  let slot = visible.get(id);
  if (!slot || slot.detail !== detail) {
    if (slot) paths.removeLayer(slot.layer);
    const layer = L.geoJSON(feature, { renderer: draw, style, smoothFactor: 0.5 }).addTo(paths);
    slot = { layer, owners, detail };
    visible.set(id, slot);
    layer.on("click", (e) => {
      const current = visible.get(id).owners;
      current.length === 1
        ? showCard(current[0])
        : linePicker(current, e.latlng, "共用区段 · " + s.name);
    });
  }
  const signature = [...owners, active, selected].join("/");
  if (slot.signature === signature) return;
  slot.signature = signature;
  slot.owners = owners;
  slot.layer.setStyle(style);
  slot.layer
    .unbindTooltip()
    .bindTooltip(esc(r.name) + (s.historical ? " · 历史走向" : ""), { sticky: true });
  if (chosen) slot.layer.bringToFront();
}
function reportError(message) {
  q("#errors").hidden = false;
  q("#errors").textContent = message;
}
function clearError() {
  q("#errors").hidden = true;
}
async function drawNetwork() {
  if (!overviewLoaded) return;
  const generation = ++renderGeneration,
    needed = desiredSections(),
    fineRequests = [];
  for (const [id, slot] of visible)
    if (!needed.has(id)) {
      paths.removeLayer(slot.layer);
      visible.delete(id);
    }
  const detailView = map.getZoom() >= 6.7 && needed.size <= maxFineRequestsInView;
  for (const [id, owners] of needed) {
    const coarse = coarseGeometry.get(id);
    const wantFine = (selected && owners.includes(active)) || detailView || !coarse;
    if (wantFine && fineGeometry.has(id)) drawSection(id, owners, fineGeometry.get(id), true);
    else if (coarse) drawSection(id, owners, coarse, false);
    if (wantFine && !fineGeometry.has(id)) fineRequests.push([id, owners]);
  }
  let next = 0;
  async function fetchNext() {
    while (next < fineRequests.length && generation === renderGeneration) {
      const [id, owners] = fineRequests[next++];
      try {
        const feature = await geometry(id);
        if (generation === renderGeneration) drawSection(id, owners, feature, true);
      } catch (e) {
        if (generation === renderGeneration) reportError("部分区段图形未能加载，请平移地图重试。");
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, fineRequests.length) }, fetchNext));
  // A fine track can arrive after the stations. Keep station hit targets reachable at shared pixels.
  if (generation === renderGeneration) stations.eachLayer((marker) => marker.bringToFront());
}
let scheduled;
function scheduleDraw() {
  if (!registry) return;
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => {
    clearError();
    drawNetwork().catch(() => reportError("区段数据加载失败，请刷新重试。"));
    drawStations().catch(() => reportError("车站坐标暂时无法加载。"));
    endPins();
    drawJunctions();
  });
}
// Stations and tracks share one hit surface, so transparent canvas areas stay clickable.
async function drawStations() {
  stations.clearLayers();
  if ((!selected && map.getZoom() < 6.7) || !q("#places-on").checked) return;
  if (!stationRecords) {
    if (!stationLoading)
      stationLoading = atlasRead("network.json").finally(() => (stationLoading = null));
    stationRecords = (await stationLoading).stations;
    if ((!selected && map.getZoom() < 6.7) || !q("#places-on").checked) return;
    stations.clearLayers();
  }
  const viewport = map.getBounds(),
    drawn = new Set(),
    selectedLine = selected ? active : null;
  const validIds = new Set(matches.map((r) => r.id));
  const selectedStations = selectedLine ? stationRecords.filter((s) => s.lineIds.includes(selectedLine)) : [];
  const background = map.getZoom() >= 6.7 ? stationRecords.filter((s) => !selectedLine || !s.lineIds.includes(selectedLine)) : [];
  for (const s of [...selectedStations, ...background]) {
    if (
      !s.coordinate ||
      !s.lineIds.some((id) => validIds.has(id)) ||
      !viewport.contains([s.coordinate[1], s.coordinate[0]])
    )
      continue;
    const xy = map.latLngToContainerPoint([s.coordinate[1], s.coordinate[0]]),
      cell = Math.floor(xy.x / 18) + "," + Math.floor(xy.y / 18);
    if (!s.lineIds.includes(selectedLine) && drawn.has(cell)) continue;
    drawn.add(cell);
    const marker = L.circleMarker([s.coordinate[1], s.coordinate[0]], {
      renderer: draw,
      weight: 1.5,
      color: "#2e5a50",
      fillColor: "#fff",
      fillOpacity: 1,
      radius: selectedLine && s.lineIds.includes(selectedLine) ? 4.8 : 3.4
    })
      .addTo(stations)
      .bindTooltip(esc(s.name), { className: "station-label", direction: "top" });
    marker.bindPopup(
      "<strong>" +
        esc(s.name) +
        '</strong><p><a href="station.html?id=' +
        encodeURIComponent(s.id) +
        '">查看车站与沿线铁路</a></p>'
    );
  }
}
function renderLegend() {
  const legend = q("#map-legend");
  legend.innerHTML =
    "<b>图例</b>" +
    Object.keys(registry.types)
      .filter((t) => registry.stats.byType[t] > 0)
      .map(
        (t) =>
          '<span><i class="line-symbol" style="background:' +
          lineType(t).color +
          '"></i>' +
          esc(lineType(t).label) +
          "</span>"
      )
      .join("") +
    '<span><i class="hub-symbol"></i>铁路枢纽</span>' +
    (registry.stats.junctions ? '<span><i class="junction-symbol"></i>线路所</span>' : '');
}
function focusRoute(r) {
  const refs = r.sections.filter(
    (s) => sectionInScope(r, s) && enabledStates.has(stateFor(s))
  );
  const bounds = L.latLngBounds([]);
  for (const section of refs) {
    if (section.bbox) bounds.extend(toBounds(section.bbox));
    for (const point of [section.startCoordinate, section.endCoordinate]) {
      if (point) bounds.extend([point[1], point[0]]);
    }
  }
  if (!bounds.isValid()) return;
  const panel = shell.classList.contains("closed") ? 0 : sidebar.offsetWidth + 26;
  const card = q("#card"),
    size = map.getSize(),
    stack = mobile.matches || size.x - panel - card.offsetWidth < 270;
  // Endpoint labels sit above their markers. Reserve the mobile toolbar and label height together.
  const shellRect = shell.getBoundingClientRect();
  const top = mobile.matches ? q("#expand").getBoundingClientRect().bottom - shellRect.top + 43 : 65;
  const left = mobile.matches ? 35 : panel + 30;
  const right = mobile.matches
    ? shellRect.right - q(".map-controls").getBoundingClientRect().left + 36
    : stack
      ? 36
      : card.offsetWidth + 43;
  const bottom = stack ? card.offsetHeight + 36 : 62;
  map.fitBounds(bounds, {
    paddingTopLeft: [left, top],
    paddingBottomRight: [right, Math.min(bottom, size.y * 0.53)],
    maxZoom: 8.8,
    animate: false
  });
}
function endPins() {
  ends.clearLayers();
  if (!selected || !active || !q("#rail-on").checked) return;
  const route = routesById.get(active);
  const refs = route.sections.filter(
    (s) => sectionInScope(route, s) && enabledStates.has(stateFor(s)) && (s.startCoordinate || s.endCoordinate)
  );
  if (!refs.length) return;
  const first = refs[0],
    last = refs.at(-1);
  const dirStart = first.direction === "reverse" ? "endCoordinate" : "startCoordinate",
    dirEnd = last.direction === "reverse" ? "startCoordinate" : "endCoordinate";
  const titleStart =
      (first.direction === "reverse" ? first.end : first.start) ||
      (first === route.sections[0] ? route.start : "可见区段起点"),
    titleEnd =
      (last.direction === "reverse" ? last.start : last.end) ||
      (last === route.sections.at(-1) ? route.end : "可见区段终点");
  const pins = [[first[dirStart], titleStart], [last[dirEnd], titleEnd]];
  const visibleSections = new Map(refs.map(section => [section.id, section]));
  for (const terminalId of route.branchTerminalSections || []) {
    const segment = visibleSections.get(terminalId);
    if (segment) pins.push(segment.direction === "reverse"
      ? [segment.startCoordinate, segment.start] : [segment.endCoordinate, segment.end]);
  }
  const positions = new Set();
  for (const [c, place] of pins) {
    if (!c || !place || positions.has(c.join(","))) continue;
    positions.add(c.join(","));
    L.marker([c[1], c[0]], {
      interactive: false,
      keyboard: false,
      zIndexOffset: 850,
      icon: L.divIcon({
        className: "end-label",
        html: "<i></i><span>" + esc(place) + "</span>",
        iconSize: [0, 0]
      })
    }).addTo(ends);
  }
}
function locationLine(id) {
  const url = new URL(location.href);
  url.searchParams.delete("junction");
  if (id) url.searchParams.set("line", id);
  else url.searchParams.delete("line");
  history.replaceState(null, "", url);
}
function showCard(id, focus = true) {
  const r = routesById.get(id);
  if (!r) return;
  active = id;
  selected = focus;
  const card = q("#card"),
    link = "line.html?id=" + encodeURIComponent(id),
    photo = r.cover;
  if (focus) {
    focusedNode = null;
    if (mobile.matches) setSidebar(false);
    q("#rail-on").checked = true;
    const mapped = r.sections.filter((s) => sectionInScope(r, s) && s.bbox);
    // Selecting a fully historical line reveals its labelled layer explicitly in the controls.
    if (mapped.length && !mapped.some((s) => enabledStates.has(stateFor(s)))) {
      for (const s of mapped) enabledStates.add(stateFor(s));
      updateLayers();
    }
    locationLine(id);
  }
  const eligible = r.sections.filter((s) => sectionInScope(r, s));
  const missing = !eligible.some((s) => s.bbox);
  const subjects = eligible.filter((s) => s.bbox && enabledStates.has(stateFor(s)));
  const subject = subjects.length === 1 && subjects[0].name !== r.name ? subjects[0].name : null;
  const info = [r.status, trafficLabel(r), subject].filter(nonempty).join(" · ");
  card.classList.toggle("has-no-photo", !photo);
  card.innerHTML =
    '<div class="card-photo"><a href="' +
    link +
    '" aria-label="' +
    esc(r.name) +
    '图鉴">' +
    (photo
      ? '<img src="' + esc(photo.src) + '" alt="' + esc(photo.caption || r.name + "相关实景") + '">'
      : "") +
    '</a><span class="photo-tag">' +
    icon(focus ? "route" : "book", 12) +
    (focus ? "已选线路" : "精选线路") +
    '</span><button class="card-close" aria-label="关闭线路卡片">' +
    icon("close", 13) +
    '</button></div><div class="card-body"><div class="card-title"><h2><a href="' +
    link +
    '">' +
    esc(r.name) +
    "</a></h2>" +
    flag(r.type) +
    '</div><p class="card-path">' +
    icon("pin", 13) +
    esc(endpointText(r)) +
    '</p><p class="status-note">' +
    esc(info) +
    "</p>" +
    (missing ? '<p class="map-warning">走向待补充</p>' : "") +
    (r.scope && (focus || r.statusCode === "partial" || r.historical)
      ? '<details class="card-scope"><summary>里程与开通范围</summary><p>' +
        esc(r.scope) +
        "</p></details>"
      : "") +
    '<div class="card-stats"><div><small>资料里程</small><b>' +
    (r.lengthKm == null ? "待补充" : fmt(r.lengthKm) + "<small>km</small>") +
    "</b></div><div><small>开通节点</small><b>" +
    esc(r.opened || "待补充") +
    '</b></div></div><a class="primary" href="' +
    link +
    '">' +
    icon("book", 15) +
    "查看线路详情</a></div>";
  card.hidden = false;
  card.classList.toggle("featured", !focus);
  q(".card-close").onclick = () => closeCard();
  card.onclick = (e) => {
    if (!e.target.closest("a,button,details")) location.assign(link);
  };
  const scope = card.querySelector(".card-scope");
  if (scope)
    scope.ontoggle = () => {
      if (selected && active === id) focusRoute(r);
    };
  if (focus) {
    const i = matches.findIndex((m) => m.id === id);
    if (i >= 0) page = Math.floor(i / pageSize);
    focusRoute(r);
  }
  renderList();
  scheduleDraw();
}
function closeCard(repaint = true) {
  focusedNode = null;
  active = null;
  selected = false;
  q("#card").hidden = true;
  ends.clearLayers();
  if (["line","junction"].some(key=>new URL(location.href).searchParams.has(key))) locationLine(null);
  if (repaint) {
    renderList();
    scheduleDraw();
  }
}
function setTrunkMode(enabled) {
  q("#passenger-only").checked=enabled;
  const url=new URL(location.href);
  if(enabled)url.searchParams.set("network","passenger-trunks");else url.searchParams.delete("network");
  history.replaceState(null,"",url);
}
function syncTypeInAddress() {
  const url = new URL(location.href);
  if (filters.type === "all") url.searchParams.delete("type");
  else url.searchParams.set("type", filters.type);
  history.replaceState(null, "", url);
}
function resetFilters() {
  setTrunkMode(false);
  Object.assign(filters, { type: "all", status: "", region: "", province: "", city: "", bureau: "" });
  q("#search").value = "";
  syncTypeInAddress();
  applyFilters();
}
function startEvents() {
  q("#passenger-only").onchange=e=>{setTrunkMode(e.target.checked);applyFilters();};
  q("#filters").onclick = (e) => {
    const b = e.target.closest("[data-type]");
    if (b) {
      filters.type = b.dataset.type;
      syncTypeInAddress();
      applyFilters();
    }
  };
  q("#open-filters").onclick = () => {
    filterKeys.forEach((k) => (q("#filter-" + k).value = filters[k]));
    q("#filter-dialog").showModal();
  };
  q("#close-filters").onclick = () => q("#filter-dialog").close();
  q("#clear-filters").onclick = () => {
    for (const k of filterKeys) q("#filter-" + k).value = k === "type" ? "all" : "";
    q("#search").value = "";
    resetFilters();
    q("#filter-dialog").close();
  };
  q("#filter-form").onsubmit = (e) => {
    e.preventDefault();
    filterKeys.forEach((k) => (filters[k] = q("#filter-" + k).value));
    syncTypeInAddress();
    if (filters.status && layerNames[filters.status]) enabledStates.add(filters.status);
    updateLayers();
    q("#filter-dialog").close();
    applyFilters();
  };
  q("#route-list").onclick = (e) => {
    if (e.target.closest("[data-clear]")) {
      resetFilters();
      return;
    }
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (id) showCard(id);
  };
  q("#previous").onclick = () => {
    page--;
    renderList(true);
  };
  q("#next").onclick = () => {
    page++;
    renderList(true);
  };
  q("#search").oninput = applyFilters;
  q("#search").onkeydown = (e) => {
    if (e.key === "Enter" && matches.length) showCard(matches[0].id);
  };
  q("#plus").onclick = () => map.zoomIn();
  q("#minus").onclick = () => map.zoomOut();
  q("#reset").onclick = () => {
    closeCard(false);
    enabledStates.clear();
    enabledStates.add("operating");
    q("#rail-on").checked = true;
    updateLayers();
    resetFilters();
    homeView();
  };
  q("#layer-button").onclick = () => {
    const pop = q("#layers-pop");
    pop.hidden = !pop.hidden;
    q("#layer-button").setAttribute("aria-expanded", !pop.hidden);
  };
  q("#state-layers").onchange = (e) => {
    const key = e.target.dataset.layer;
    if (!key) return;
    if (e.target.checked) enabledStates.add(key);
    else enabledStates.delete(key);
    scheduleDraw();
  };
  q("#places-on").onchange = (e) => {
    if (e.target.checked) places.addTo(map);
    else places.remove();
    scheduleDraw();
  };
  q("#rail-on").onchange = scheduleDraw;
  q("#junction-on").onchange = drawJunctions;
  document.addEventListener("keydown", (e) => {
    if (q("#filter-dialog").open) return;
    if (e.key === "/" && e.target.tagName !== "INPUT") {
      e.preventDefault();
      setSidebar(true);
      q("#search").focus();
    }
    if (e.key === "Escape") {
      q("#layers-pop").hidden = true;
      q("#layer-button").setAttribute("aria-expanded", "false");
      closeCard();
      if (mobile.matches) setSidebar(false);
    }
  });
  mobile.addEventListener("change", () => {
    setSidebar(!mobile.matches);
    if (selected) focusRoute(routesById.get(active));
    else homeView();
  });
  map.on("resize", () => {
    if (awaitingMapSize) {
      if (selected) focusRoute(routesById.get(active));
      else homeView();
    }
  });
  map.on("moveend", scheduleDraw);
}
async function start() {
  [registry, routes] = await Promise.all([atlasManifest(), atlasIndex()]);
  for (const r of routes) {
    routesById.set(r.id, r);
    r.sections.sort((a, b) => a.order - b.order);
    searchText.set(
      r.id,
      [
        r.name,
        r.name.replace("高速铁路", "高铁"),
        r.start,
        r.end,
        ...r.aliases,
        trafficLabel(r),
        ...r.cities,
        ...r.stationNames,
        ...(r.junctions || []).map(j => j.name),
        ...(r.stationAliases || []),
        ...r.sections.map((s) => s.name)
      ]
        .filter(nonempty)
        .join(" ")
        .toLowerCase()
    );
    for (const ref of r.sections)
      if (!sections.has(ref.id))
        sections.set(ref.id, { ...ref, bounds: ref.bbox ? toBounds(ref.bbox) : null });
  }
  const trunkCatalog=await readData("catalog/passenger-trunks.json");
  trunkIds=new Set(trunkCatalog.lines.map(r=>r.id));
  const order=new Map(trunkCatalog.lines.map((r,index)=>[r.id,index]));
  routes=[...routes].sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity));
  q("#passenger-only").checked=new URLSearchParams(location.search).get("network")==="passenger-trunks";
  const initialQuery = new URLSearchParams(location.search);
  const initialType = initialQuery.get("type");
  if (Object.hasOwn(registry.types, initialType)) filters.type = initialType;
  fillFilters();
  renderLegend();
  updateLayers();
  startEvents();
  applyFilters();
  const initial = new URLSearchParams(location.search).get("line");
  if (initial && routesById.has(initial)) {
    const target = routesById.get(initial);
    if (filters.type !== "all" && target.type !== filters.type) {
      filters.type = "all";
      syncTypeInAddress();
    }
    if (q("#passenger-only").checked && !trunkIds.has(initial)) setTrunkMode(false);
    applyFilters();
    showCard(initial);
  } else if (!initialQuery.has("junction") && !mobile.matches && matches.some(r => r.id === "r01")) showCard("r01", false);
  initJunctions().catch(() => reportError("枢纽节点暂时无法读取，请刷新重试。"));
  const overview = await atlasRead("overview.geojson");
  for (const feature of overview.features) coarseGeometry.set(feature.properties.sectionId, feature);
  overviewLoaded = true;
  scheduleDraw();
}
start().catch((e) => {
  console.error(e);
  reportError("线路资料加载失败，请刷新页面重试。");
});
