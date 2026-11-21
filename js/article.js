mountHeader("book");

function block(id, title, content) {
  return '<section class="article-pane" id="' + id + '"><h2>' + title + "</h2>" + content + "</section>";
}
function note(text) {
  return '<p class="archive-note">' + esc(text) + "</p>";
}
function credit(p) {
  return (
    sourceLink({ url: p.url, title: p.author || p.title }) +
    " · " +
    sourceLink({ url: p.licenseUrl || p.url, title: p.license })
  );
}
function facts(entries) {
  return (
    '<dl class="info-grid">' +
    entries
      .map(([k, v]) => "<div><dt>" + esc(k) + "</dt><dd>" + esc(optionalText(v)) + "</dd></div>")
      .join("") +
    "</dl>"
  );
}
function sources(items) {
  return (
    '<ul class="references">' +
    (items || [])
      .map((s) => {
        const dates = [
          s.publishedAt && "发布 " + s.publishedAt,
          s.checkedAt && "核验 " + s.checkedAt
        ].filter(Boolean);
        return (
          "<li>" +
          sourceLink(s) +
          (dates.length ? " <small>" + esc(dates.join(" · ")) + "</small>" : "") +
          "</li>"
        );
      })
      .join("") +
    "</ul>"
  );
}
function verificationHistory(review) {
  if (!review) return "";
  const list = (rows) => "<ul>" + rows.map((text) => "<li>" + esc(text) + "</li>").join("") + "</ul>";
  return '<section id="verification"><h3>资料核验 · ' + esc(review.checkedAt) + "</h3>" +
    list(review.added) +
    (review.remaining.length ? '<details class="section-row"><summary>尚缺哪些资料</summary>' + list(review.remaining) + "</details>" : "") +
    '<details class="section-row"><summary>查看本次核验来源</summary>' + sources(review.sources) + "</details></section>";
}
function sourceDetails(r) {
  const labels = {
    stationIds: "车站与站序",
    history: "建设与运营历史",
    scope: "资料适用范围",
    technicalFeatures: "技术特点",
    endpoints: "线路端点",
    grade: "铁路等级",
    lengthScope: "里程口径",
    features: "线路特点",
    bureaus: "管理机构",
    lengthKm: "资料里程",
    statusCode: "线路状态",
    openingDate: "开通日期",
    opened: "开通节点",
    speed: "速度",
    designSpeed: "设计速度",
    operatingSpeed: "运营速度",
    name: "线路名称"
  };
  const fields = Object.entries(r.evidence || {}).filter(
    ([, refs]) => Array.isArray(refs) && refs.length
  );
  return (
    sources(r.sources) +
    (fields.length
      ? '<details class="section-row"><summary>按字段查看证据</summary>' +
        fields.map(([k, refs]) => "<h3>" + esc(labels[k] || k) + "</h3>" + sources(refs)).join("") +
        "</details>"
      : "")
  );
}
function technicalTables(groups = []) {
  return groups
    .map(
      (group) =>
        "<h3>" +
        esc(group.name) +
        "</h3>" +
        note(group.scope) +
        facts(group.rows.map((item) => [item.label, item.value])) +
        sources(group.sources)
    )
    .join("");
}
function routePointTable(table) {
  if (!table?.points?.length) return "";
  const body = table.points
    .map((p) => {
      const name = p.stationId
        ? '<a href="' + stationLink(p.stationId) + '">' + esc(p.name) + "</a>"
        : esc(p.name);
      return (
        '<tr><th scope="row">' +
        name +
        "</th><td>" +
        esc(p.kind) +
        "</td><td>" +
        esc(p.km == null ? "—" : fmt(p.km)) +
        "</td></tr>"
      );
    })
    .join("");
  return (
    "<h3>沿线节点与计价里程</h3>" +
    note(table.scope) +
    '<table class="rail-distance"><thead><tr><th>节点</th><th>类别</th><th>累计 km</th></tr></thead><tbody>' +
    body +
    "</tbody></table>" +
    sources(table.sources)
  );
}
function management(r) {
  const rows = r.managementRecords || [];
  return rows.length
    ? '<details class="section-row"><summary>管理机构与适用时期</summary>' +
        rows
          .map(
            (m) =>
              "<h3>" +
              esc(m.unit) +
              "</h3><p>" +
              esc(
                [m.role, m.validFrom && "自 " + m.validFrom, m.validTo && "至 " + m.validTo]
                  .filter(Boolean)
                  .join(" · ")
              ) +
              "</p>" +
              sources(m.sources)
          )
          .join("") +
        "</details>"
    : "";
}
function infoSection(section) {
  const reverse = section.direction === "reverse";
  const start = reverse ? section.end : section.start;
  const end = reverse ? section.start : section.end;
  const name = reverse && section.name === section.start + "—" + section.end ? start + "—" + end : section.name;
  const mark = (section.historical ? "历史线位 · " : "") + statusName(section.statusCode);
  const range = [section.validFrom, section.validTo].some(Boolean)
    ? [section.validFrom || "起始日期待补充", section.validTo || "结束日期未载"].join(" 至 ")
    : "待补充";
  const history = (section.phaseHistory || [])
    .map((e) => "<p>" + esc(e.date) + " · " + esc(e.event) + "</p>")
    .join("");
  return (
    '<details class="section-row" id="section-' +
    esc(section.id) +
    '" open><summary>' +
    esc(name) +
    '<span class="section-meta">' +
    esc(mark) +
    "</span></summary><p>" +
    esc(optionalText(start)) +
    " — " +
    esc(optionalText(end)) +
    "</p>" +
    facts([
      ["资料里程", distanceLabel(section.lengthKm)],
      ["有效期", range],
      ["轨迹", section.bbox ? "已收录" : "走向待补充"]
    ]) +
    (section.scope ? "<p>" + esc(section.scope) + "</p>" : "") +
    (section.notes ? note(section.notes) : "") +
    history +
    sources(section.sources) +
    "</details>"
  );
}
function relationContent(r) {
  return r.connections.length
    ? '<div class="related-list">' +
        r.connections
          .map((c) => {
            const station = c.stationName || r.stationRefs.find((s) => s.id === c.stationId)?.name;
            return (
              '<div class="related-entry"><a href="' +
              recordLink(c.lineId) +
              '"><b>' +
              esc(c.lineName || c.lineId) +
              "</b></a><small>" +
              esc([c.kind, station].filter(Boolean).join(" · ")) +
              (c.text ? " · " + esc(c.text) : "") +
              "</small>" +
              (c.junctionId ? '<a class="context-link" href="' + junctionLink(c.junctionId) + '">' + esc(c.junctionName) + '</a>' : '') +
              (c.sources?.length ? sources(c.sources) : "") +
              "</div>"
            );
          })
          .join("") +
        "</div>"
    : note("该条目的跨线接轨或共线关系待补充。可进入车站档案查看已收录关联。");
}
function serviceContent(r, dataset) {
  const trips = (dataset.services || []).filter((t) => t.lineIds?.includes(r.id));
  const url = "explore.html?tab=services&line=" + encodeURIComponent(r.id);
  const listed = trips.length
    ? '<div class="related-list">' +
      trips
        .map(
          (t) =>
            '<a class="related-entry" href="' +
            url +
            "&amp;q=" +
            encodeURIComponent(t.number) +
            "&amp;date=" +
            encodeURIComponent(t.date) +
            '"><b>' +
            esc(t.number) +
            "</b><small>" +
            esc(t.date) +
            " · " +
            esc(
              t.stops
                .map((s) => s.name || s.stationName || s.station)
                .filter(Boolean)
                .join(" — ")
            ) +
            "</small></a>"
        )
        .join("") +
      "</div>"
    : "";
  readData("timetables/observations.json").then((archive) => {
    const host = q("#line-observed-services");
    if (!host) return;
    const paths = (archive.paths?.records || []).filter((path) => path.lineId === r.id);
    if (!paths.length) {
      host.innerHTML = trips.length ? "" : note("当前资料库尚无关联该线路的带日期车次记录。");
      return;
    }
    host.innerHTML = "<h3>经由本线的动车组</h3>" + note("点选车次可查看标注日期的车组号、车型和计划停站。") +
      '<div class="related-list">' + paths.map((path) => {
        const date = path.dates[path.dates.length - 1];
        const url = new URLSearchParams({tab: "services", q: path.train, date});
        return '<a class="related-entry" href="explore.html?' + esc(url.toString()) + '"><b>' +
          esc(path.displayNumber) + '</b><small>' + esc(date) + ' · 本线图定停站 ' +
          esc(path.stations.map((stop) => stop.name).join(" — ")) + '</small></a>';
      }).join("") + "</div>";
  }).catch(() => {
    const host = q("#line-observed-services");
    if (host) host.innerHTML = note("带车型的车次记录暂时无法读取。");
  });
  return (
    listed + '<div id="line-observed-services" aria-live="polite"></div>' +
    '<a class="context-link" href="explore.html?tab=travel&amp;line=' +
    encodeURIComponent(r.id) +
    '">沿这条线路探索旅行</a>'
  );
}
function gallery(photos) {
  if (!photos.length) return note("本条目正在补充经授权的实景影像。");
  return (
    '<div class="gallery">' +
    photos
      .map(
        (p, i) =>
          '<figure><button data-photo="' +
          i +
          '" aria-label="放大 ' +
          esc(p.caption || p.title) +
          '"><img loading="lazy" src="' +
          esc(p.src) +
          '" alt="' +
          esc(p.caption || p.title) +
          '"></button><figcaption>' +
          esc(p.caption || p.title) +
          "<small>" +
          credit(p) +
          "</small></figcaption></figure>"
      )
      .join("") +
    "</div>"
  );
}
function stationContent(r) {
  if (!r.stationRefs.length && r.startJunctionId && r.endJunctionId) return note("本档案的两个端点均为线路所。") +
    '<div class="chips">' + [r.startJunctionId, r.endJunctionId].map(id => '<a class="context-link" href="' + junctionLink(id) + '">' + esc(r.junctions?.find(j => j.id === id)?.name || id) + '</a>').join('') + '</div>';
  if (!r.stationRefs.length) return note("已核实车站待补充。");
  const roster = r.extensions?.stationRoster || {};
  const stationRow = (s) => {
    const details = [roster.notes?.[s.name], r.stations.find((item) => item.name === s.name)?.text].filter(Boolean);
    return '<li><a href="' + stationLink(s.id) + '">' + esc(s.name) + '</a>' +
      [...new Set(details)].map((detail) => '<p>' + esc(detail) + '</p>').join('') + '</li>';
  };
  const stationList = stops => '<ol class="station-sequence">' + stops.map(stationRow).join('') + '</ol>';
  const lookup = new Map(r.stationRefs.map(s => [s.id,s]));
  const sequence = roster.groups?.length
    ? roster.groups.map(group => '<h3>' + esc(group.name) + '</h3>' + stationList(group.stationIds.map(id => lookup.get(id)))).join('')
    : stationList(r.stationRefs);
  const connections = (roster.connections || []).map((s) =>
    '<p>' + (s.stationId ? '<a href="' + stationLink(s.stationId) + '">' + esc(s.name) + '</a>' : esc(s.name)) +
    ' · ' + esc(s.note) + '</p>').join('');
  return '<p class="station-count">已收录 ' + r.stationRefs.length + ' 座车站</p>' +
    (roster.scope ? note(roster.scope) : '') +
    sequence +
    (connections ? '<h3>联络线接入站</h3>' + connections : '') +
    (roster.auxiliaryStations?.length ? '<h3>另列技术节点</h3><p>' + esc(roster.auxiliaryStations.join('、')) + '</p>' : '') +
    (roster.sources?.length ? '<details class="section-row"><summary>查看站表依据</summary>' + sources(roster.sources) + '</details>' : '');
}
async function drawArticleMap(r) {
  const located = r.sections.filter((s) => s.bbox);
  if (!located.length) return;
  const results = await Promise.allSettled(
    located.map((s) => atlasRead("geometry/" + encodeURIComponent(s.id) + ".geojson"))
  );
  const map = newMap("detail-map");
  addBase(map);
  const lines = L.featureGroup().addTo(map),
    captions = [];
  const gaps = r.sections.filter((section) => !section.bbox && section.statusCode === 'operating');
  if (gaps.length) captions.push('下列运营区段的轨迹待核实：' + gaps.map((section) => section.name).join('、') + '。');
  const plottedStations = r.stationRefs.filter((s) => s.coordinate);
  const plottedNames = new Set(plottedStations.map((s) => s.name));
  for (const node of r.junctions || []) {
    if (!node.coordinate) continue;
    const [lon, lat] = node.coordinate;
    plottedNames.add(node.name);
    L.marker([lat, lon], {title:node.name, icon:L.divIcon({className:'junction-pin',html:'<span></span>',iconSize:[20,20],iconAnchor:[10,10]})})
      .bindTooltip(esc(node.name))
      .bindPopup('<a href="' + junctionLink(node.id) + '">' + esc(node.name) + ' · 查看线路所档案</a>')
      .addTo(lines);
  }
  for (const [i, res] of results.entries()) {
    if (res.status !== "fulfilled") {
      captions.push(located[i].name + "轨迹加载失败");
      continue;
    }
    const s = located[i],
      f = res.value,
      isCurrent = !s.historical && s.statusCode === "operating";
    L.geoJSON(f, {
      style: {
        color: isCurrent ? types[r.type].color : "#7c6966",
        weight: 3.7,
        dashArray: isCurrent ? null : "6 5",
        smoothFactor: 0.5
      }
    })
      .bindTooltip(esc(s.name) + " · " + esc(s.historical ? "历史线位" : statusName(s.statusCode)))
      .addTo(lines);
    for (const [k, name] of [
      ["startCoordinate", s.start],
      ["endCoordinate", s.end]
    ]) {
      const c = s[k] || f.properties[k];
      if (!c || !name || plottedNames.has(name)) continue;
      L.circleMarker([c[1], c[0]], {
        color: "#fff",
        fillColor: isCurrent ? types[r.type].color : "#7c6966",
        fillOpacity: 1,
        radius: 5.5,
        weight: 2
      })
        .addTo(lines)
        .bindTooltip(esc(name), { permanent: located.length === 1, direction: "top" });
    }
    if (f.properties.geometryMethod) captions.push(f.properties.geometryMethod);
    if (f.properties.snapshot) captions.push("轨迹快照 " + f.properties.snapshot);
  }
  for (const station of plottedStations) {
    const [lon, lat] = station.coordinate;
    L.circleMarker([lat, lon], {className: 'atlas-station-dot', radius: 4.5, color: '#244c42', weight: 1.5, fillColor: '#fff', fillOpacity: 1})
      .addTo(lines)
      .bindTooltip(esc(station.name), {direction: 'top'})
      .bindPopup('<a href="' + stationLink(station.id) + '">' + esc(station.name) + ' · 查看车站档案</a>');
  }
  if (plottedStations.length) captions.unshift('图中标出 ' + plottedStations.length + ' 座有坐标的沿线车站。');
  const bounds = lines.getBounds();
  if (!bounds.isValid()) {
    map.remove();
    q("#detail-map").textContent = "轨迹暂时未能加载，请刷新重试。";
    return;
  }
  map.fitBounds(bounds, { padding: [36, 36], maxZoom: 8 });
  labels(map);
  L.control.zoom({ position: "topright", zoomInTitle: "放大", zoomOutTitle: "缩小" }).addTo(map);
  map.scrollWheelZoom.disable();
  q("#geometry-caption").textContent = [...new Set(captions)].join(" ");
}
function addSectionParameters(line) {
  const panel = q("#section-specs");
  const content = panel.querySelector(".section-spec-facts");
  let loading = false;
  panel.addEventListener("toggle", async () => {
    if (!panel.open || loading || content.dataset.ready) return;
    loading = true;
    try {
      const index = await readData("line-parameters/index.json");
      const names = [line.name, ...(line.aliases || [])];
      const ref = line.parameterRef;
      const match = index.items.find((x) => x.status === "available" && (ref ? x.id === ref.document : names.includes(x.name)));
      if (!match) {
        content.textContent = "该档案尚未与来源库中的同名线路建立精确对应。可按名称查其他区段。";
        return;
      }
      const shard = await readData("line-parameters/" + index.version + "/" + match.shard + ".json");
      const record = shard[match.id];
      const sections = ref?.section ? record.sections.filter((s) => s.name === ref.section && s.scope === ref.scope) : record.sections;
      if (!sections.length) throw new Error("找不到核实的参数区段");
      content.innerHTML =
        sections
          .map(
            (section) =>
              "<h3>" +
              esc(section.name || record.name) +
              "</h3><p>" +
              esc([section.trackName, section.scope].filter(Boolean).join(" · ")) +
              "</p>" +
              facts([...section.events, ...section.metrics].map(({ label, value }) => [label, value]))
          )
          .join("") +
        '<p class="archive-note">' +
        sourceLink({ title: index.license.publisher, url: record.url }) +
        " · " +
        sourceLink({ title: index.license.name, url: index.license.url }) +
        " · 参数查阅日期 " +
        esc(index.asOf) +
        "</p>";
      content.dataset.ready = "1";
    } catch {
      content.textContent = "区段参数暂时未能加载，收起后可重新打开。";
    } finally {
      loading = false;
    }
  });
}
async function article() {
  const id = new URLSearchParams(location.search).get("id") || "";
  let r;
  try {
    if (/^[a-zA-Z0-9_-]+$/.test(id)) r = await atlasRead("lines/" + encodeURIComponent(id) + ".json");
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  if (!r || r.id !== id) {
    q("#article").innerHTML =
      '<div class="missing"><h1>未找到这条线路</h1><a class="primary" href="catalog.html">浏览线路图鉴</a></div>';
    return;
  }
  const serviceDB = await atlasRead("services.json");
  const photos = r.photos || [],
    p = photos[0],
    mapped = r.sections.some((s) => s.bbox);
  const mapLink = "./?line=" + encodeURIComponent(id);
  document.title = r.name + " · 中国铁路图鉴";
  const stationList = stationContent(r);
  const entries = [
    [
      "overview",
      "线路概览",
      (r.intro ? "<p>" + esc(r.intro) + "</p>" : note("线路简介待补充。")) +
        (r.scope
          ? '<div class="scope">' + icon("info", 16) + "<span>" + esc(r.scope) + "</span></div>"
          : "") +
        facts([
          ["本站分类", typeName(r.type)],
          ...(r.extensions?.mixedTraffic ? [
            ["运输性质", r.extensions.mixedTraffic.appliesTo === "section" ? "所列区段客货共线" : "客货共线"],
            [r.extensions.mixedTraffic.speedBasis === "design" ? "分类所据设计速度" : "分类所据客车最高速度", r.extensions.mixedTraffic.speedKmh + " km/h"],
            ["适用范围", r.extensions.mixedTraffic.scope]
          ] : []),
          ["别名", (r.aliases || []).join("、")],
          ["设计速度", r.designSpeed],
          ["运营速度", r.operatingSpeed],
          ["铁路等级", r.grade],
          ["里程统计范围", r.lengthScope],
          ["相关管理机构", (r.bureaus || []).join("、")],
          ["资料状态", r.extensions?.verification && r.quality === "已核实" && r.extensions.verification.remaining.length ? "主要字段已核实，细项见下方核验记录" : qualityLabels[r.quality] || r.quality],
          ["更新时间", r.updatedAt]
        ]) +
        (r.stationRefs.length ? '<p><a class="context-link" href="#stations">查看沿线 ' + r.stationRefs.length + ' 座车站</a></p>' : '') +
        (r.notes ? note(r.notes) : "") + verificationHistory(r.extensions?.verification) +
        management(r) + '<div id="line-checklist"></div>' +
        (r.extensions?.operatingRoutes?.length ? "<h3>组成线路</h3>" + r.extensions.operatingRoutes.map(branch => {
          const stations = r.stationRefs;
          const start = stations.find(s => s.id === branch.fromStationId)?.name;
          const end = stations.find(s => s.id === branch.toStationId)?.name;
          return "<p>" + esc(branch.name) + " · " + esc([start, end].filter(Boolean).join(" — ")) + "</p>";
        }).join("") : "") +
        (r.networkNames?.length ? "<p>所属网络：" + esc(r.networkNames.join("、")) + "</p>" : "") +
        '<h3>沿途省区市</h3><div class="chips">' +
        r.provinces.map((v) => "<span>" + esc(v) + "</span>").join("") +
        '</div><h3>主要城市</h3><p class="city-seq">' +
        esc(r.cities.join("　·　") || "待补充") +
        "</p>"
    ],
    [
      "geography",
      "线路走向",
      mapped
        ? '<div id="detail-map" aria-label="' +
          esc(r.name) +
          '线路地图"></div><div class="map-note"><span id="geometry-caption"></span><a href="' +
          mapLink +
          '">在全国地图中定位</a></div>'
        : note("走向待补充。已收录的文字和来源见下方档案。")
    ],
    [
      "sections",
      "已收录区段",
      r.sections.length
        ? '<div class="section-rows">' + r.sections.map(infoSection).join("") + "</div>"
        : note("区段资料待补充。")
    ],
    [
      "history",
      "建设与运营历史",
      r.history.length
        ? '<ol class="timeline">' + r.history.map((h) => "<li>" + esc(h) + "</li>").join("") + "</ol>"
        : note("建设历史待补充。")
    ],
    [
      "technology",
      "线路特点",
      (r.features.length
        ? r.features.map((t) => "<p>" + esc(t) + "</p>").join("")
        : r.extensions?.technicalTables?.length
          ? ""
          : note("技术资料待补充。")) +
        (r.extensions?.mixedTraffic ? "<h3>客货共线与分类依据</h3>" +
          note(r.extensions.mixedTraffic.note) + sources(r.extensions.mixedTraffic.sources) : "") +
        technicalTables(r.extensions?.technicalTables) +
        '<details class="section-row" id="section-specs"><summary>查看分区段技术参数</summary><div class="section-spec-facts">正在读取参数…</div></details><p><a class="inline" href="' +
        esc(r.parameterRef ? parameterLink(r.parameterRef) : "line-parameters.html?q=" + encodeURIComponent(r.name)) +
        '">查阅本站区段参数表</a></p>'
    ],
    ["stations", "沿线车站", stationList + routePointTable(r.extensions?.routePoints)],
    ["connections", "线路交会", relationContent(r) +
      (r.connectorHubs?.length ? '<h3>所属枢纽</h3>' + r.connectorHubs.map(h =>
        '<p><a class="context-link" href="hubs.html?hub=' + encodeURIComponent(h.id) + '">' + esc(h.name) + '</a></p>').join('') : '') +
      (r.junctions?.length ? '<h3>沿线线路所</h3><div class="chips">' + r.junctions.map(j =>
        '<a class="context-link" href="' + junctionLink(j.id) + '">' + esc(j.name) + '</a>').join('') + '</div>' : '')],
    ["services", "相关车次与旅行", serviceContent(r, serviceDB)],
    ["images", "铁路影像", gallery(photos)],
    ["sources", "参考资料", sourceDetails(r)]
  ];
  q("#article").innerHTML =
    '<div class="breadcrumbs"><a href="./">地图探索</a>' +
    icon("chevron", 12) +
    '<a href="catalog.html">线路图鉴</a>' +
    icon("chevron", 12) +
    "<span>" +
    esc(r.name) +
    '</span></div><section class="hero">' +
    (p ? '<img src="' + esc(p.src) + '" alt="' + esc(p.caption || p.title) + '">' : "") +
    '<div class="hero-copy">' +
    flag(r.type) +
    "<h1>" +
    esc(r.name) +
    "</h1><p>" +
    icon("route", 20) +
    esc(optionalText(r.start)) +
    "<span>—</span>" +
    esc(optionalText(r.end)) +
    "</p></div></section>" +
    (p ? '<p class="hero-credit">' + esc(p.caption || p.title) + " · " + credit(p) + "</p>" : "") +
    '<div class="facts">' +
    [
      ["ruler", "资料里程", distanceLabel(r.lengthKm)],
      ["train", "速度及适用范围", optionalText(r.speed)],
      ["calendar", "开通节点", optionalText(r.opened)],
      ["station", "线路状态", r.status || statusName(r.statusCode)]
    ]
      .map(([ic, k, v]) => "<div><small>" + icon(ic, 15) + k + "</small><b>" + esc(v) + "</b></div>")
      .join("") +
    '</div><div class="article-grid"><div>' +
    entries.map(([anchor, title, html]) => block(anchor, title, html)).join("") +
    '</div><aside class="article-nav"><strong>本页目录</strong>' +
    entries.map(([anchor, title]) => '<a href="#' + anchor + '">' + title + "</a>").join("") +
    '<a class="primary" href="' +
    mapLink +
    '">' +
    icon("map", 16) +
    "返回线路地图</a></aside></div>";
  const dialog = q("#photo-view");
  document.querySelectorAll("[data-photo]").forEach(
    (btn) =>
      (btn.onclick = () => {
        const img = photos[Number(btn.dataset.photo)];
        dialog.querySelector("img").src = img.src;
        dialog.querySelector("img").alt = img.caption || img.title;
        dialog.querySelector("p").innerHTML = esc(img.caption || img.title) + " · " + credit(img);
        dialog.showModal();
      })
  );
  dialog.querySelector("button").onclick = () => dialog.close();
  dialog.onclick = (e) => {
    if (e.target === dialog) dialog.close();
  };
  addSectionParameters(r);
  readData("catalog/passenger-network.json").then(data=>{
    const related=data.items.filter(item=>item.lineId===r.id||item.members?.some(member=>member.lineId===r.id));
    if(!related.length)return;
    const label=new Map(data.groups.map(g=>[g.id,g.name]));
    const host=q("#line-checklist");
    host.innerHTML="<h3>客运清单中的线路与区段</h3>"+related.map(item=>
      '<p><a class="inline" href="national.html?view=networks&amp;id='+encodeURIComponent(item.id)+'">'+esc(label.get(item.groupId))+" · "+esc(item.raw)+'</a></p>'
    ).join("");
  }).catch(()=>{});
  if (mapped) await drawArticleMap(r);
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView();
  }
}
article().catch((e) => {
  console.error(e);
  q("#article").innerHTML =
    '<div class="missing"><h1>暂时无法加载线路资料</h1><p>请刷新重试，或从线路图鉴重新选择条目。</p><a class="primary" href="catalog.html">返回图鉴</a></div>';
});
