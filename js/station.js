mountHeader("book");
async function station() {
  const id = new URLSearchParams(location.search).get("id");
  const [network, rows] = await Promise.all([atlasRead("network.json"), atlasIndex()]);
  const stop = network.stations.find((s) => s.id === (network.stationRedirects?.[id] || id));
  if (!stop) {
    q("#station").innerHTML =
      '<h1>未找到车站档案</h1><a class="context-link" href="catalog.html">浏览线路图鉴</a>';
    return;
  }
  document.title = stop.name + "站 · 中国铁路图鉴";
  const lines = rows.filter((r) => stop.lineIds.includes(r.id));
  const hubs = network.hubs.filter((h) => h.stationIds.includes(stop.id));
  const card = (href, label, detail = "") =>
    '<a class="related-entry" href="' +
    href +
    '"><b>' +
    esc(label) +
    "</b>" +
    (detail ? "<small>" + esc(detail) + "</small>" : "") +
    "</a>";
  const references = (s) =>
    s?.length
      ? '<ul class="references">' +
        s.map((ref) => "<li>" + sourceLink(ref) + "</li>").join("") +
        "</ul>"
      : "";
  const pos = stop.coordinate;
  q("#station").innerHTML =
    '<div class="breadcrumbs"><a href="./">地图探索</a> / <a href="catalog.html">线路图鉴</a> / 车站档案</div><div class="station-heading">' +
    icon("station", 30) +
    "<h1>" +
    esc(stop.name) +
    '站</h1></div><p class="about-intro">' +
    esc(stop.city || "城市待补充") +
    " · 本库关联 " +
    lines.length +
    " 条线路</p>" + (stop.aliases?.length ? '<p>曾用名或别名 · ' + esc(stop.aliases.join('、')) + '</p>' : '') +
    (stop.intro ? '<p class="about-intro">' + esc(stop.intro) + '</p>' : '') +
    '<section class="about-block" id="station-plans"><h2>站场配线图</h2><div class="station-plan-content"><p>正在加载本站图件…</p></div></section>' +
    '<section class="about-block"><h2>本站关联线路</h2><div class="related-list">' +
    lines
      .map((r) =>
        card(recordLink(r.id) + "#stations", r.name, [r.start, r.end].filter(Boolean).join(" — "))
      )
      .join("") +
    "</div></section>" +
    (stop.accessLines?.length ? '<section class="about-block"><h2>经枢纽或联络线接入</h2><div class="related-list">' +
      stop.accessLines.map((link) => card(recordLink(link.lineId) + '#stations',rows.find((r) => r.id === link.lineId)?.name || link.lineId,link.note)).join('') + '</div></section>' : '') +
    hubs
      .map(
        (h) =>
          '<section class="about-block"><h2><a href="hubs.html?hub=' +
          encodeURIComponent(h.id) + '">' + esc(h.name) +
          '</a></h2><p>已收录的枢纽成员如下。换站行程需另行核实市内交通与接续时间。</p><div class="chips">' +
          network.stations
            .filter((s) => s.id !== stop.id && h.stationIds.includes(s.id))
            .map(
              (s) =>
                '<a class="context-link" href="' + stationLink(s.id) + '">' + esc(s.name) + "站</a>"
            )
            .join("") +
          "</div>" +
          references(h.sources) +
          "</section>"
      )
      .join("") +
    '<section class="about-block"><h2>车站位置</h2><div id="station-position"><p>正在核对车站位置…</p></div>' +
    '</section><section class="about-block"><h2>资料与探索</h2>' +
    references(stop.sources) +
    '<a class="primary" href="explore.html?tab=travel&amp;station=' +
    encodeURIComponent(stop.name) +
    '">从本站探索铁路旅行</a></section>';
  if (location.hash === "#station-plans") q("#station-plans").scrollIntoView();
  const verified = await showStationPlans(stop);
  const point = verified?.coordinate || pos;
  q("#station-position").innerHTML = point
    ? '<div class="station-map" id="station-map"></div><p class="subtle-note">WGS84 · ' +
      point.map(v => Number(v).toFixed(5)).join(", ") +
      (verified ? ' · ' + sourceLink({title:"站位来源",url:verified.url}) : '') + '</p>'
    : '<p>车站坐标待补充。</p>';
  if (point) {
    const map = newMap("station-map").setView([point[1], point[0]], 7);
    addBase(map);
    labels(map);
    L.circleMarker([point[1], point[0]], {
      radius: 7,
      color: "#fff",
      weight: 3,
      fillColor: "#234f42",
      fillOpacity: 1
    })
      .addTo(map)
      .bindTooltip(esc(stop.name) + "站", { permanent: true, direction: "top" });
    L.control.zoom({ position: "topright", zoomInTitle: "放大", zoomOutTitle: "缩小" }).addTo(map);
    map.scrollWheelZoom.disable();
  }
}
station().catch((e) => {
  console.error(e);
  q("#station").textContent = "车站资料加载失败，请刷新重试。";
});
