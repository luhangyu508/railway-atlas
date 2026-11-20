mountHeader("info");
atlasManifest()
  .then((m) => {
    const s = m.stats;
    const metrics = [
      ["地图百科线路", s.total],
      ["可绘制线路", s.mapped],
      ["独立区段", s.sections],
      ...(s.stations != null ? [["独立车站", s.stations], ["有坐标车站", s.locatedStations]] : []),
      ...(s.junctions != null ? [["线路所", s.junctions], ["联络线档案",s.connectors]] : []),
      ["资料待补充", s.incomplete]
    ];
    q("#as-of").textContent = "资料更新于 " + m.updatedAt + " · 数据版本 " + m.version;
    q("#progress").innerHTML =
      '<div class="metric-grid">' +
      metrics
        .map(
          ([label, n]) =>
            '<div class="metric"><strong>' + fmt(n) + "</strong><span>" + label + "</span></div>"
        )
        .join("") +
      '</div><div class="counts-grid">' +
      Object.entries(m.types)
        .map(
          ([code, name]) =>
            '<a href="catalog.html?type=' +
            encodeURIComponent(code) +
            '">' +
            esc(name) +
            " " +
            fmt(s.byType[code] || 0) +
            "</a>"
        )
        .join("") +
      '<a href="catalog.html?history=1">历史线路 ' +
      fmt(s.historical) +
      "</a></div>";
    q("#active-index").href = m.base + "index.json";
    q("#active-index").download = "线路索引.json";
    q("#active-index").hidden = false;
  })
  .catch(() => (q("#progress").textContent = "无法读取当前统计，请刷新重试。"));

(async function showParameterCoverage() {
  const box = q("#parameter-coverage");
  const jobs = [
    ["timetables/observations.json", "explore.html?tab=services",
      (x) => fmt(x.records.length) + " 条带日期的车组记录 · " + fmt(new Set(x.records.map((r) => r.train)).size) + " 个车次"],
    ["timetables/manifest.json","explore.html?tab=services",
      (m)=>fmt(m.trips)+" 趟车次 · "+m.releaseDate+" 版时刻表"],
    [
      "line-parameters/index.json",
      "line-parameters.html",
      (x) => fmt(x.summary.available) + " 条线路参数资料"
    ],
    [
      "model-parameters/index.json",
      "explore.html?tab=models",
      (x) => fmt(x.items.filter((m) => m.parameterCount > 0).length) + " 个车型参数页"
    ],
    [
      "fleet-lookup/index.json",
      "explore.html?tab=allocations",
      (x) => fmt(x.records.length) + " 条配属查询记录"
    ]
  ];
  const results = await Promise.allSettled(
    jobs.map(async ([file, href, text]) => {
      const data = await readData(file);
      return '<a href="' + href + '">' + esc(text(data)) + "</a>";
    })
  );
  box.innerHTML = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .join("");
})();

Promise.all([readData("bureau-roster.json"),readData("national-facts.json"),readData("catalog/passenger-trunks.json")]).then(([roster,facts,trunks])=>{
  const box=q("#nation-coverage");
  const counts=[
    ["主要客运干线",trunks.lines.length,"trunks"],["局集团分组",roster.bureaus.length,"roster"],["清单原项",roster.items.length,"roster"],
    ["公开线路资料",facts.lines.length,"facts"]
  ];
  box.innerHTML=counts.map(([label,count,view])=>'<a href="national.html?view='+view+'">'+label+' '+fmt(count)+'</a>').join("");
}).catch(()=>{q("#nation-coverage").textContent="全国目录统计暂时无法读取。";});

readData("catalog/passenger-network.json").then(data=>{
  q("#network-count").textContent="客运线路清单共 "+fmt(data.stats.entries)+" 项，分属 "+fmt(data.stats.groups)+" 个原始分组。其中 "+
    fmt(data.stats.atlasLines)+" 条独立线路已关联地图百科。";
}).catch(()=>{q("#network-count").textContent="本批清单统计暂时无法读取。";});
