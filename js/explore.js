function addPageJump(pager, page, pages, goToPage) {
  if (pages <= 1) return;
  const form = document.createElement("form");
  form.className = "page-jump";
  form.innerHTML = '<label>页码 <input name="page" type="number" inputmode="numeric" required min="1" step="1"></label>' +
    '<button type="submit">跳转</button>';
  const input = form.elements.namedItem("page");
  input.max = String(pages);
  input.value = String(page);
  input.onfocus = () => input.select();
  input.oninput = () => input.setCustomValidity("");
  input.oninvalid = () => input.setCustomValidity("请输入 1 至 " + pages + " 之间的整数页码。");
  form.onsubmit = (event) => {
    event.preventDefault();
    goToPage(input.valueAsNumber);
    if (!form.isConnected) pager.querySelector('input[name="page"]')?.focus({preventScroll:true});
  };
  pager.append(form);
}

(() => {
  "use strict";
  mountHeader("explore");
  const modes = {
    services: ["车次查询", "train"],
    models: ["车型图鉴", "book"],
    allocations: ["配属查询", "fold"],
    travel: ["旅行探索", "compass"]
  };
  const params = new URLSearchParams(location.search);
  const tab = Object.hasOwn(modes, params.get("tab")) ? params.get("tab") : "services";
  const term = (params.get("q") || "").trim();
  const date = params.get("date") || "";
  const selectedLine = params.get("line") || "";
  const selectedModel = params.get("model") || "";
  let catalog = [];
  let network;
  let records;
  let lines;
  let models;
  function url(options) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) {
      if (value || key === "place") search.set(key, value);
    }
    return "explore.html?" + esc(search.toString());
  }
  function anchor(href, body, className = "exp-link") {
    return '<a class="' + className + '" href="' + href + '">' + body + "</a>";
  }
  const details = (id) =>
    lines.has(id) ? anchor(recordLink(id), icon("book", 14) + esc(lines.get(id).name)) : "";
  const numberLink = (service) =>
    anchor(
      url({ tab: "services", q: service.number, date: service.date }),
      esc(service.number) + " · " + esc(service.date)
    );
  function field(label, input) {
    return '<label class="exp-field">' + label + input + "</label>";
  }
  function input(name, value, type = "search", placeholder = "") {
    return (
      '<input type="' +
      type +
      '" name="' +
      name +
      '" value="' +
      esc(value) +
      '" placeholder="' +
      esc(placeholder) +
      '">'
    );
  }
  function select(name, options, value) {
    return (
      '<select name="' +
      name +
      '">' +
      options
        .map(
          ([key, label]) =>
            '<option value="' +
            esc(key) +
            '"' +
            (key === value ? " selected" : "") +
            ">" +
            esc(label) +
            "</option>"
        )
        .join("") +
      "</select>"
    );
  }
  function controls(description, fields, hidden = {}) {
    const hiddenInputs = Object.entries({ tab, ...hidden })
      .filter(([, v]) => v)
      .map(([key, value]) => '<input type="hidden" name="' + esc(key) + '" value="' + esc(value) + '">')
      .join("");
    q("#inquiry").innerHTML =
      "<h2>" +
      modes[tab][0] +
      '</h2><p class="exp-summary">' +
      esc(description) +
      '</p><form class="exp-form" action="explore.html" method="get">' +
      hiddenInputs +
      fields +
      '<button class="exp-submit" type="submit">' +
      icon("search", 16) +
      "查询</button></form>";
    if (selectedLine || selectedModel) {
      const text = [
        selectedLine && (lines.get(selectedLine)?.name || selectedLine),
        selectedModel && (models.get(selectedModel)?.name || selectedModel)
      ]
        .filter(Boolean)
        .join(" · ");
      q("#inquiry").insertAdjacentHTML(
        "beforeend",
        '<div class="exp-line-filter">当前范围　' +
          esc(text) +
          " " +
          anchor(url({ tab }), "清除限定", "inline") +
          "</div>"
      );
    }
  }
  const http = (value) => /^https?:\/\//.test(value || "");
  function citation(source) {
    return http(source.url)
      ? '<a target="_blank" rel="noopener noreferrer" href="' +
          esc(source.url) +
          '">' +
          esc(source.title) +
          "</a>"
      : esc(source.title);
  }
  function sourceList(sources) {
    if (!sources?.length) return "";
    return (
      '<details class="exp-sources"><summary>资料来源（' +
      sources.length +
      "）</summary><ul>" +
      sources
        .map(
          (s) =>
            "<li>" +
            citation(s) +
            (s.publisher ? " · " + esc(s.publisher) : "") +
            (s.publishedAt ? " · " + esc(s.publishedAt) : "") +
            "</li>"
        )
        .join("") +
      "</ul></details>"
    );
  }
  function collection(cards, noun, empty) {
    q("#explore-results").innerHTML =
      '<div class="exp-collection-head"><span>查询结果</span><span>' +
      cards.length +
      " " +
      noun +
      "</span></div>" +
      (cards.join("") ||
        '<div class="exp-empty"><h3>暂未收录匹配记录</h3><p>' +
          esc(empty) +
          "</p>" +
          anchor(url({ tab }), "查看本类全部资料") +
          "</div>");
  }
  function serviceCard(s) {
    const stops = s.stops
      .map((stop) => {
        const clock = [stop.arrival && "到 " + stop.arrival, stop.departure && "开 " + stop.departure]
          .filter(Boolean)
          .join(" / ");
        const station = stop.stationId
          ? anchor(stationLink(stop.stationId), esc(stop.name), "inline")
          : esc(stop.name);
        return (
          "<li><strong>" + station + "</strong><span>" + esc(clock || "时刻待补充") + "</span></li>"
        );
      })
      .join("");
    const model = models.get(s.modelId);
    const modelLink = model
      ? anchor(url({ tab: "models", model: model.id }), esc(model.name) + " 车型")
      : "";
    return (
      '<article class="exp-record"><div class="exp-lead"><h3>' +
      esc(s.number) +
      ' 次</h3><span class="exp-date">' +
      esc(s.date) +
      '</span></div><ol class="exp-stops" aria-label="依资料记录的站序">' +
      stops +
      '</ol><p class="exp-muted">' +
      esc(s.scope) +
      "</p>" +
      "<h4>已证实径路</h4><p>" +
      esc(s.path || "径路待补充") +
      "</p>" +
      (s.crew ? "<h4>当日乘务担当</h4><p>" + esc(s.crew) + "</p>" : "") +
      '<div class="exp-actions">' +
      s.lineIds.map(details).join("") +
      modelLink +
      (model ? anchor(url({ tab: "allocations", model: model.id }), "查询该车型配属") : "") +
      "</div>" +
      sourceList(s.sources) +
      "</article>"
    );
  }
  function showServices() {
    const initial = term.toUpperCase().match(/^([A-Z]?)(\d*)(?:\/[A-Z]?\d+)*$/);
    const prefix = params.get("searchBy") === "station" || !initial ? "station" :
      params.get("searchBy") === "all" ? "" :
      initial[1] || (initial[2] || params.get("searchBy") === "numeric" ? "numeric" : "");
    const digit = prefix === "station" ? term : initial[2];
    const prefixes = ["G", "D", "C", "Z", "T", "K", "S", "Y", "N", "V"];
    if (/^[A-Z]$/.test(prefix) && !prefixes.includes(prefix)) prefixes.push(prefix);
    const options = [["", "全部字头"], ...prefixes.map(p => [p, p + " 字头"]),
      ["numeric", "无字头（纯数字）"], ["station", "按起讫站查询"]];
    controls(
      "选择车次字头并输入数字，或按起讫站查询。结果随输入更新，日期按始发站发车日筛选。",
      field("车次字头", select("prefix", options, prefix)) +
        field('<span id="service-query-label"></span>', '<input type="search" name="number" autocomplete="off">') +
        field("适用日期", input("date", date, "date")) +
        field("乘务担当", input("crew", params.get("crew") || "", "search", "如 沈阳客运段")),
      { line: selectedLine, model: selectedModel }
    );
    const form = q("#inquiry form");
    const fields = form.elements;
    const value = fields.namedItem("number");
    const choice = fields.namedItem("prefix");
    choice.setAttribute("aria-label", "车次字头");
    const host = q("#parameter-workspace");
    let stationMode = choice.value === "station";
    function configureValue() {
      stationMode = choice.value === "station";
      q("#service-query-label").textContent = stationMode ? "始发站或终到站" : "车次数字";
      value.inputMode = stationMode ? "search" : "numeric";
      value.placeholder = stationMode ? "如 北京南" : "如 1413";
    }
    configureValue();
    value.value = digit;
    function refresh(updateUrl = true) {
      const crew = fields.namedItem("crew").value.trim();
      const date = fields.namedItem("date").value;
      if (!stationMode) {
        const digits = value.value.normalize("NFKC").replace(/\D/g, "");
        if (value.value !== digits) value.value = digits;
      }
      const term = (/^[A-Z]$/.test(choice.value) ? choice.value : "") + value.value.trim();
      const filters = {term, date, prefix: choice.value, digits: value.value.trim()};
      if (updateUrl) {
        const address = new URL(location.href);
        const query = address.searchParams;
        const mode = stationMode ? "station" : choice.value === "numeric" ? "numeric" :
          !choice.value && term ? "all" : "";
        for (const [key, setting] of Object.entries({q: term, date, crew, searchBy: mode})) {
          if (setting) query.set(key, setting);
          else query.delete(key);
        }
        query.delete("trip");
        query.delete("timetablePage");
        history.replaceState(history.state, "", address);
      }
      const match = records.services.filter((s) => {
        const ends = [s.stops[0], s.stops[s.stops.length - 1]];
        return (stationMode ? ends.some(stop => stop?.name.includes(term)) : matchesTrainNumber(s.number, filters)) &&
          (!date || s.date === date) && (!crew || s.crew?.includes(crew)) &&
          (!selectedLine || s.lineIds.includes(selectedLine)) && (!selectedModel || s.modelId === selectedModel);
      });
      collection(match.map(serviceCard), "条车次记录", "可清空日期或更换车次号。当前查询仅包含已核验的历史记录。");
      q("#explore-results .exp-collection-head span").textContent = "有日期的历史报道";
      document.title = modes.services[0] + " · 中国铁路图鉴";
      if (!crew && !selectedLine && !selectedModel) return loadTrainTimetable(host, filters);
      host.replaceChildren();
    }
    choice.onchange = () => {
      if (stationMode !== (choice.value === "station")) value.value = "";
      configureValue();
      refresh();
    };
    for (const control of [value, fields.namedItem("date"), fields.namedItem("crew")]) {
      control.oninput = (event) => { if (!event.isComposing) refresh(); };
      control.oncompositionend = () => refresh();
    }
    form.onsubmit = (event) => { event.preventDefault(); refresh(); };
    return refresh(false);
  }
  function pageOf(matches, render, noun, empty) {
    const size = 12;
    const pages = Math.max(1, Math.ceil(matches.length / size));
    const page = Math.min(pages, Math.max(1, parseInt(params.get("page"), 10) || 1));
    collection(matches.slice((page - 1) * size, page * size).map(render), noun, empty);
    const position = q("#explore-results .exp-collection-head span:last-child");
    position.textContent = matches.length + " " + noun;
    if (pages > 1) {
      const link = (step) =>
        anchor(
          url({ ...Object.fromEntries(params), tab, page: page + step }),
          step > 0 ? "下一页" : "上一页"
        );
      q("#explore-results").insertAdjacentHTML(
        "beforeend",
        '<div class="exp-actions">第 ' +
          page +
          " / " +
          pages +
          " 页 " +
          (page > 1 ? link(-1) : "") +
          (page < pages ? link(1) : "") +
          "</div>"
      );
    }
  }
  function modelCard(m) {
    const p = m.photo;
    const trains = records.services.filter((s) => s.modelId === m.id).map(numberLink);
    let photo = "";
    if (p && /^assets\/photos\/[\w.-]+$/.test(p.src)) {
      photo =
        '<img class="exp-model-img" loading="lazy" src="' +
        esc(p.src) +
        '" alt="' +
        esc(p.caption) +
        '"><div class="exp-caption">' +
        esc(p.caption) +
        "　" +
        citation({ title: p.author, url: p.url }) +
        " · " +
        citation({ title: p.license, url: p.licenseUrl }) +
        "</div>";
    }
    return (
      '<article class="exp-record">' +
      photo +
      "<h3>" +
      esc(m.name) +
      " · " +
      esc(m.title) +
      "</h3><p>" +
      esc(m.intro) +
      '</p><dl class="exp-facts">' +
      m.facts
        .map((f) => "<div><dt>" + esc(f.label) + "</dt><dd>" + esc(f.value) + "</dd></div>")
        .join("") +
      '</dl><h4>有据可查的担当车次</h4><div class="exp-links">' +
      (trains.join("") || '<p class="exp-muted">尚无带日期的对应车次记录。</p>') +
      '</div><div class="exp-actions">' +
      anchor(url({ tab: "allocations", model: m.id }), "查询配属单位") +
      (!selectedModel ? anchor(url({ tab: "models", model: m.id }), "车型独立链接") : "") +
      (m.lineIds || []).map(details).join("") +
      "</div>" +
      sourceList(m.sources) +
      "</article>"
    );
  }
  function showModels() {
    controls(
      "查速度、编组、定员、车辆尺寸和各批次差异。专题档案还收录了有来源的配图和车次。",
      field("从名单选择车型", '<select id="model-name-choice"><option value="">选择车型</option></select>') +
        field("车型名称", input("q", term, "search", "输入型号或别名")),
      { model: selectedModel, line: selectedLine }
    );
    const picker = q("#model-name-choice");
    const form = picker.form;
    const keyword = form.elements.namedItem("q");
    const spec = document.createElement("input");
    spec.type = "hidden";
    spec.name = "spec";
    spec.disabled = true;
    form.append(spec);
    const key = (name) => name.toUpperCase().replace(/[\s－–—-]/g, "");
    let entries = [];
    function updateNames(typed) {
      const query = key(typed);
      const options = [new Option("选择车型", "")];
      entries.forEach((item, index) => {
        if (!query || [item.name, ...(item.aliases || [])].some(name => key(name).includes(query))) {
          const label = item.name + (item.disambiguation ? " · " + item.disambiguation : "");
          options.push(new Option(label, String(index)));
        }
      });
      picker.replaceChildren(...options);
    }
    function useCatalog(items) {
      const names = new Set(items.map(item => key(item.name)));
      entries = [...items, ...records.models.filter(m => !names.has(key(m.name)))];
      updateNames(keyword.value === term ? "" : keyword.value);
      const currentSpec = keyword.value === term && params.get("spec");
      const current = entries.findIndex(item => currentSpec ? item.id === currentSpec : key(item.name) === key(keyword.value));
      if (current >= 0) picker.value = String(current);
    }
    picker.onchange = () => {
      if (!picker.value) return;
      const item = entries[Number(picker.value)];
      keyword.value = item.name;
      spec.disabled = !item.file;
      spec.value = item.id;
      form.requestSubmit();
    };
    keyword.addEventListener("input", () => {
      spec.disabled = true;
      updateNames(keyword.value);
    });
    form.addEventListener("submit", () => {
      const scope = form.elements.namedItem("model");
      if (scope && key(keyword.value) !== key(models.get(selectedModel)?.name || "")) scope.disabled = true;
    });
    useCatalog([]);
    const match = records.models.filter(
      (m) =>
        (!selectedModel || selectedModel === m.id) &&
        (!selectedLine || m.lineIds?.includes(selectedLine)) &&
        (m.name + " " + m.title).toUpperCase().includes(term.toUpperCase())
    );
    pageOf(match, modelCard, "种车型", "该型号尚无专题档案，本站收录的技术数据请查看上方参数表。");
    q("#explore-results .exp-collection-head span").textContent = "专题档案与实景";
    loadModelParameters(q("#parameter-workspace"), term, models.get(selectedModel)?.name, useCatalog);
  }
  function allocationCard(a) {
    const m = models.get(a.modelId);
    return (
      '<article class="exp-record"><div class="exp-lead"><h3>' +
      esc(a.unit) +
      '</h3><span class="exp-date">资料适用日　' +
      esc(a.asOf) +
      "</span></div><h4>配属对象</h4><p>" +
      esc(a.object) +
      '</p><p class="exp-muted">' +
      esc(a.scope) +
      '</p><div class="exp-actions">' +
      (m ? anchor(url({ tab: "models", model: m.id }), esc(m.name) + " 车型") : "") +
      (a.lineIds || []).map(details).join("") +
      "</div>" +
      sourceList(a.sources) +
      "</article>"
    );
  }
  function showAllocations() {
    const kind = ["model", "unit", "workshop"].includes(params.get("allocationKind")) ? params.get("allocationKind") : "";
    const scopedModel = models.get(selectedModel)?.name || selectedModel;
    controls(
      "按车组号、车型或单位查询车辆配属。每条记录注明资料适用日期和所引报道覆盖的车辆范围。",
      '<div class="exp-field"><label for="allocation-name-input">选择或输入车型、配属单位或车组号</label><div class="search-picker">' +
        '<input id="allocation-name-input" name="q" type="search" autocomplete="off" value="' + esc(term) +
        '" placeholder="如 2190、沈阳局、CR400BF-GS">' +
        '<div id="allocation-name-options" class="search-options" role="listbox" hidden></div></div></div>' +
        field("资料适用日期", input("date", date, "date")),
      { model: selectedModel, line: selectedLine }
    );
    const keyword = q("#allocation-name-input");
    const form = keyword.form;
    const when = form.elements.namedItem("date");
    const chosenKind = document.createElement("input");
    chosenKind.type = "hidden";
    chosenKind.name = "allocationKind";
    chosenKind.value = kind;
    chosenKind.disabled = !kind;
    form.append(chosenKind);
    const setOptions = mountSearchPicker(keyword, q("#allocation-name-options"), (item) => {
      chosenKind.value = item.kind;
      chosenKind.disabled = false;
      form.requestSubmit();
    });
    const reports = records.allocations.filter((a) =>
      (!selectedModel || a.modelId === selectedModel) && (!selectedLine || a.lineIds?.includes(selectedLine))
    );
    let fleet = [];
    let choices = [];
    function narrowChoices() {
      const key = allocationKey(chosenKind.disabled ? keyword.value : "");
      setOptions(choices.filter((item) => !key || allocationKey(item.value).includes(key)));
    }
    function updateChoices() {
      const unique = new Map();
      function add(type, value) {
        if (!value || value === "不适用") return;
        const id = type + ":" + allocationKey(value);
        if (!unique.has(id)) unique.set(id, {
          kind: type, kindLabel: { model: "车型", unit: "配属单位", workshop: "运用所及设施" }[type], value
        });
      }
      for (const r of fleet) {
        if ((when.value && r.asOf !== when.value) || (selectedLine && !r.lineIds?.includes(selectedLine)) ||
          (scopedModel && allocationKey(r.model) !== allocationKey(scopedModel))) continue;
        add("model", r.model);
        for (const unit of [r.bureau, r.operator, r.depot]) add("unit", unit);
        add("workshop", r.workshop);
      }
      for (const a of reports) {
        if (when.value && a.asOf !== when.value) continue;
        add("model", models.get(a.modelId)?.name);
        add("unit", a.unit);
      }
      choices = [...unique.values()].sort((a, b) =>
        a.kind.localeCompare(b.kind) || a.value.localeCompare(b.value, "zh-CN", { numeric: true })
      );
      narrowChoices();
    }
    keyword.addEventListener("input", () => { chosenKind.disabled = true; narrowChoices(); });
    when.addEventListener("input", updateChoices);
    updateChoices();
    const key = allocationKey(kind === "workshop" ? workshopName(term) : term);
    const match = reports.filter((a) => {
      if (date && a.asOf !== date) return false;
      const name = models.get(a.modelId)?.name;
      if (kind === "model") return allocationKey(name) === key;
      if (kind === "unit" || kind === "workshop") return allocationKey(a.unit).includes(key);
      return [a.unit, a.serial, a.object, name].some((v) => allocationKey(v).includes(key));
    });
    pageOf(match, allocationCard, "条配属记录", "可清空日期，或查看上方按车组检索的配属资料。");
    q("#explore-results .exp-collection-head span").textContent = "有日期的配属报道";
    loadFleetTable(q("#parameter-workspace"), term, date, scopedModel, {
      kind, line: selectedLine, onCatalog(items) { fleet = items; updateChoices(); }
    });
  }
  function travelCard(r, byStation) {
    const stations = byStation.get(r.id) || [];
    const listed = (r.stationNames || [])
      .map((name) => stations.find((s) => s.name === name))
      .filter(Boolean);
    const displayed = [...new Set([...listed, ...stations])];
    const stops = displayed
      .map((s) => {
        const peers = s.lineIds.filter((id) => id !== r.id && lines.has(id));
        const station = anchor(stationLink(s.id), esc(s.name), "inline");
        return (
          "<li><span>" +
          station +
          (s.city ? " <small>· " + esc(s.city) + "</small>" : "") +
          "</span>" +
          (peers.length
            ? "<small>同站线路　" +
              peers.map((id) => anchor(recordLink(id), esc(lines.get(id).name), "inline")).join("，") +
              "</small>"
            : "") +
          "</li>"
        );
      })
      .join("");
    const services = records.services.filter((s) => s.lineIds.includes(r.id));
    return (
      '<article class="exp-record"><div class="exp-lead"><h3>' +
      esc(r.name) +
      "</h3>" +
      flag(r.type) +
      '</div><p class="exp-muted">' +
      esc(r.start || "起点待核实") +
      " — " +
      esc(r.end || "终点待核实") +
      '</p><div class="exp-actions">' +
      details(r.id) +
      (r.sections?.some((s) => s.bbox || s.hasGeometry || s.geometry) || r.hasGeometry
        ? anchor("./?line=" + encodeURIComponent(r.id), icon("map", 14) + " 地图定位")
        : "") +
      "</div><h4>已收录的沿线车站</h4>" +
      (stops
        ? '<ul class="exp-station-list">' + stops + "</ul>"
        : '<p class="exp-muted">车站信息待补充。</p>') +
      (services.length
        ? '<h4>历史车次记录</h4><div class="exp-links">' + services.map(numberLink).join("") + "</div>"
        : "") +
      "</article>"
    );
  }
  async function showTravel() {
    network = await atlasRead("network.json");
    const kind = params.get("city") || params.get("kind") === "city" ? "city" : "station";
    const place = (
      params.get("station") ||
      params.get("city") ||
      (params.has("place") ? params.get("place") : selectedLine ? "" : "北京南")
    ).trim();
    const names = {
      city: [...new Set(catalog.flatMap((r) => r.cities))].sort(),
      station: [...new Set(network.stations.flatMap((s) => [s.name, ...(s.aliases || [])]))].sort()
    };
    function suggestions(mode, prefix) {
      const choices = [];
      for (const name of names[mode]) {
        if (name.includes(prefix)) choices.push('<option value="' + esc(name) + '"></option>');
        if (choices.length === 40) break;
      }
      return choices.join("");
    }
    const fieldHtml =
      '<input list="place-names" type="search" name="place" aria-label="城市或车站名称" value="' +
      esc(place) +
      '" placeholder="如 北京南、天津"><datalist id="place-names">' +
      suggestions(kind, place) +
      "</datalist>";
    controls(
      "从城市或车站筛选沿线档案，再通过同一座车站探索相邻线路。出行时刻以铁路当日运行图为准。",
      field(
        "出发地类型",
        select(
          "kind",
          [
            ["station", "车站"],
            ["city", "城市"]
          ],
          kind
        )
      ) + field("城市或车站名称", fieldHtml),
      { line: selectedLine }
    );
    const byStation = new Map();
    for (const s of network.stations)
      for (const id of s.lineIds || []) {
        if (!byStation.has(id)) byStation.set(id, []);
        byStation.get(id).push(s);
      }
    const selectedStations = network.stations.filter(
      (s) => s.name === place || s.aliases?.includes(place)
    );
    const routeIds = new Set(selectedStations.flatMap((s) => s.lineIds));
    const match = catalog.filter(
      (r) =>
        (!selectedLine || r.id === selectedLine) &&
        (!place || (kind === "city" ? r.cities.includes(place) : routeIds.has(r.id)))
    );
    const pageSize = 12,
      lastPage = Math.max(1, Math.ceil(match.length / pageSize)),
      page = Math.max(1, Math.min(lastPage, parseInt(params.get("page"), 10) || 1));
    const cards = match
      .slice((page - 1) * pageSize, page * pageSize)
      .map((r) => travelCard(r, byStation));
    collection(
      cards,
      "条线路",
      "请使用完整的站名或城市名，再选择对应类型。也可以清空地名查看当前线路。"
    );
    const links = [
      page > 1 && anchor(url({ tab, kind, place, line: selectedLine, page: page - 1 }), "上一页"),
      page < lastPage && anchor(url({ tab, kind, place, line: selectedLine, page: page + 1 }), "下一页")
    ].filter(Boolean);
    if (links.length)
      q("#explore-results").insertAdjacentHTML(
        "beforeend",
        '<div class="exp-actions">共 ' +
          match.length +
          " 条 · 第 " +
          page +
          " / " +
          lastPage +
          " 页　" +
          links.join("") +
          "</div>"
      );
    const kindInput = q('select[name="kind"]');
    const placeInput = q('input[name="place"]');
    kindInput.onchange = () => {
      placeInput.value = "";
      q("#place-names").innerHTML = suggestions(kindInput.value, "");
    };
    placeInput.oninput = () => {
      q("#place-names").innerHTML = suggestions(kindInput.value, placeInput.value.trim());
    };
  }
  q("#mode-nav").innerHTML = Object.entries(modes)
    .map(
      ([id, [label, ic]]) =>
        '<a href="' +
        url({ tab: id }) +
        '" ' +
        (id === tab ? 'aria-current="page"' : "") +
        ">" +
        icon(ic, 17) +
        esc(label) +
        "</a>"
    )
    .join("");
  document.title = modes[tab][0] + " · 中国铁路图鉴";
  async function load() {
    [catalog, records] = await Promise.all([atlasIndex(), atlasRead("services.json")]);
    lines = new Map(catalog.map((r) => [r.id, r]));
    models = new Map(records.models.map((m) => [m.id, m]));
    const actions = {
      services: showServices,
      models: showModels,
      allocations: showAllocations,
      travel: showTravel
    };
    await actions[tab]();
  }
  load().catch((error) => {
    console.error(error);
    q("#explore-results").innerHTML =
      '<div class="exp-empty"><h3>关联资料暂时无法读取</h3><p>请刷新页面重试。</p></div>';
  });
})();
