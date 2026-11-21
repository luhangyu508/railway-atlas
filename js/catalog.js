mountHeader("book");
q("#search-icon").innerHTML = icon("search", 16);

async function openCatalog() {
  const params = new URLSearchParams(location.search);
  q("#catalog-search").value = params.get("q") || "";
  const [rows, manifest, trunks] = await Promise.all([
    atlasIndex(), atlasManifest(), readData("catalog/passenger-trunks.json").catch(() => ({ lines: [] }))
  ]);
  const trunkOrder = new Map(trunks.lines.map((line, index) => [line.id, index]));
  function catalogRank(row) {
    const operating = row.statusCode === "operating" || row.statusCode === "partial";
    if (!operating || row.role !== "trunk") return trunkOrder.size + 1;
    return trunkOrder.get(row.id) ?? trunkOrder.size;
  }
  const form = q("#catalog-options");
  const select = q("#nature");
  select.innerHTML =
    '<option value="">全部性质</option>' +
    Object.entries(manifest.types)
      .map(
        ([id, label]) =>
          '<option value="' +
          esc(id) +
          '">' +
          esc(label) +
          " · " +
          (manifest.stats.byType[id] || 0) +
          "</option>"
      )
      .join("");
  const states = q("#state");
  states.innerHTML =
    '<option value="">全部状态</option>' +
    Object.entries(manifest.statuses)
      .map(([id, label]) => '<option value="' + esc(id) + '">' + esc(label) + "</option>")
      .join("");
  select.value = params.get("type") || "";
  states.value = params.get("state") || "";
  q("#history-only").checked = params.get("history") === "1";
  let page = Math.max(1, parseInt(params.get("page"), 10) || 1);
  const limit = 18;
  const indexed = rows.map((row) => ({
    row,
    text: [
      row.name,
      row.name.replace("高速铁路", "高铁"),
      row.start,
      row.end,
      ...row.aliases, ...(row.searchTerms || []), ...(row.scopeNames || []),
      trafficLabel(row),
      ...row.cities,
      ...row.stationNames, ...(row.stationAliases || [])
    ]
      .join(" ")
      .toLocaleLowerCase()
  }));
  const mainlinesFirst = [...indexed].sort((a, b) => catalogRank(a.row) - catalogRank(b.row));
  function draw() {
    const term = q("#catalog-search").value.trim().toLocaleLowerCase();
    q("#catalog-national").href = "national.html" + (term ? "?q=" + encodeURIComponent(term) : "");
    q("#catalog-track").href = "tracks.html" + (term ? "?q=" + encodeURIComponent(term) : "");
    q("#catalog-reference").href = "line-parameters.html?q=" + encodeURIComponent(term);
    const history = q("#history-only").checked;
    const matches = (term ? indexed : mainlinesFirst).filter(
      ({ row, text }) =>
        (!select.value || row.type === select.value) &&
        (!states.value || states.value === row.statusCode) &&
        (!history || row.historical) &&
        text.includes(term)
    );
    const pages = Math.max(1, Math.ceil(matches.length / limit));
    page = Math.min(page, pages);
    q("#catalog-summary").textContent =
      "地图百科收录 " + fmt(rows.length) + " 条线路，当前匹配 " + fmt(matches.length) + " 条。" + (select.value === "highspeed" ? highspeedScope : "");
    q("#catalog").innerHTML =
      matches
        .slice((page - 1) * limit, page * limit)
        .map(({ row: r }) => {
          const pic = r.cover;
          return (
            '<a class="catalog-card" href="' +
            recordLink(r.id) +
            '">' +
            (pic?.src
              ? '<img loading="lazy" src="' +
                esc(pic.src) +
                '" alt="' +
                esc(pic.caption || r.name) +
                '">'
              : '<div class="catalog-cover-empty">' + icon("route", 44) + "</div>") +
            '<div class="catalog-copy">' +
            flag(r.type) +
            "<h2>" +
            esc(r.name) +
            "</h2><p>" +
            icon("pin", 14) +
            esc(optionalText(r.start)) +
            " — " +
            esc(optionalText(r.end)) +
            '</p><div class="mini"><span>' +
            esc(distanceLabel(r.lengthKm)) +
            "</span><span>" +
            esc([statusName(r.statusCode), trafficLabel(r)].filter(Boolean).join(" · ")) +
            "</span></div></div></a>"
          );
        })
        .join("") || '<p class="empty">没有匹配的档案。可以清除筛选，或更换线路、车站关键词。</p>';
    q("#prev").disabled = page === 1;
    q("#next").disabled = page === pages;
    q("#page-indicator").textContent = "第 " + page + " / " + pages + " 页";
    q("#catalog-pages").hidden = matches.length <= limit;
    const query = new URLSearchParams();
    if (term) query.set("q", term);
    if (select.value) query.set("type", select.value);
    if (states.value) query.set("state", states.value);
    if (history) query.set("history", "1");
    if (page > 1) query.set("page", page);
    window.history.replaceState(null, "", location.pathname + (query.size ? "?" + query : "") + location.hash);
  }
  form.oninput = () => {
    page = 1;
    draw();
  };
  form.onreset = () =>
    requestAnimationFrame(() => {
      page = 1;
      draw();
    });
  form.onsubmit = (e) => e.preventDefault();
  for (const [id, step] of [
    ["prev", -1],
    ["next", 1]
  ]) {
    q("#" + id).onclick = () => {
      page += step;
      draw();
      q("#catalog-summary").scrollIntoView({ block: "start" });
    };
  }
  draw();
}
openCatalog().catch(() => (q("#catalog").textContent = "图鉴索引暂时未能加载，请刷新重试。"));
