"use strict";
// Keep the editable field focused while the user browses matching records.
function mountSearchPicker(input, list, onSelect) {
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");
  input.autocomplete = "off";
  const root = list.parentElement;
  let items = [], painted = 0, active = -1;
  function paintMore() {
    const end = Math.min(items.length, painted + 40);
    const fragment = document.createDocumentFragment();
    for (; painted < end; painted++) {
      const item = items[painted];
      const option = document.createElement("div");
      option.id = list.id + "-" + painted;
      option.dataset.index = String(painted);
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.setAttribute("aria-setsize", String(items.length));
      option.setAttribute("aria-posinset", String(painted + 1));
      option.textContent = item.value;
      if (item.kindLabel) {
        const kind = document.createElement("small");
        kind.textContent = item.kindLabel;
        option.append(kind);
      }
      fragment.append(option);
    }
    list.append(fragment);
  }
  function paint() {
    painted = 0; active = -1;
    list.replaceChildren();
    input.removeAttribute("aria-activedescendant");
    list.scrollTop = 0;
    if (items.length) paintMore();
    else list.textContent = "没有匹配项";
  }
  function open() {
    if (!list.hidden) return;
    const box = input.getBoundingClientRect();
    list.classList.toggle("opens-up", innerHeight - box.bottom < 165 && box.top > innerHeight - box.bottom);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    paint();
  }
  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }
  function choose(index) {
    if (!items[index]) return;
    input.value = items[index].value;
    input.focus({preventScroll:true});
    close();
    onSelect(items[index]);
  }
  list.addEventListener("scroll", () => {
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 32 && painted < items.length) paintMore();
  });
  list.addEventListener("mousedown", e => e.preventDefault());
  list.addEventListener("click", e => {
    const row = e.target.closest("[data-index]");
    if (row) choose(Number(row.dataset.index));
  });
  for (const event of ["focus", "click", "input"]) input.addEventListener(event, open);
  input.addEventListener("keydown", e => {
    if (e.isComposing) return;
    if (e.key === "Escape" && !list.hidden) { e.preventDefault(); close(); return; }
    if (e.key === "Enter" && !list.hidden && active >= 0) { e.preventDefault(); choose(active); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    open();
    if (!items.length) return;
    if (active >= 0) list.children[active].setAttribute("aria-selected", "false");
    active = Math.max(0, Math.min(items.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)));
    if (active >= painted) paintMore();
    const row = list.children[active];
    row.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", row.id);
    row.scrollIntoView({block:"nearest"});
  });
  root.addEventListener("focusout", e => { if (!root.contains(e.relatedTarget)) close(); });
  document.addEventListener("pointerdown", e => { if (!root.contains(e.target)) close(); });
  return (options) => { items = options; if (!list.hidden) paint(); };
}
function allocationKey(value) {
  return String(value || "").toLowerCase().replace(/[\s－–—-]/g, "")
    .replace(/中国铁路(?=[\u4e00-\u9fff]+局集团)/g, "")
    .replace(/局集团有限公司/g, "局集团").replace(/动车运用所/g, "动车所");
}
function workshopName(value) {
  if (!value || value === "不适用") return "";
  return /所|段|场|处/.test(value) ? value : value + "动车所";
}
async function loadFleetTable(host, initial, date, model, options = {}) {
  const wrap = document.createElement("section");
  wrap.className = "parameter-library exp-record";
  const labels = { model: "车型", serial: "车号", unit: "单位", manufacturer: "厂家" };
  wrap.innerHTML = `
    <h3>车组配属资料</h3>
    <div class="fleet-filter">
      <label class="exp-field">筛选范围
        <select id="unit-field"><option value="all">全部</option>${Object.entries(labels)
          .map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select>
      </label>
      <div class="exp-field">
        <label for="unit-filter">选择或输入关键词</label>
        <div class="search-picker">
          <input id="unit-filter" type="search" placeholder="选择或输入车型、车号、单位或厂家">
          <div id="unit-options" class="search-options" role="listbox" aria-label="配属筛选候选" hidden></div>
        </div>
      </div>
    </div>
    <p id="unit-count" role="status">正在读取站内配属资料…</p>
    <div id="units"></div><div class="exp-actions" id="unit-pages"></div>`;
  host.replaceChildren(wrap);
  const select = (s) => wrap.querySelector(s);
  const filter = select("#unit-filter");
  const field = select("#unit-field");
  const list = select("#unit-options");
  filter.value = initial || "";
  if (options.kind) field.value = options.kind === "workshop" ? "unit" : options.kind;
  try {
    const db = await readData("fleet-lookup/index.json");
    options.onCatalog?.(db.records);
    const sources = new Map(db.sources.map((s) => [s.id, s]));
    let page = 0;
    const norm = allocationKey;
    function rangeText(value) {
      return Array.isArray(value) ? value.join("–") : value || "";
    }
    const records = db.records.filter((r) =>
      (!model || norm(model) === norm(r.model)) && (!date || r.asOf === date) &&
      (!options.line || r.lineIds?.includes(options.line))
    );
    const groups = Object.fromEntries(Object.keys(labels).map((key) => [key, new Map()]));
    function index(kind, value, record, alias) {
      if (!value) return;
      const entries = groups[kind];
      if (!entries.has(value)) entries.set(value, { kind, kindLabel: labels[kind], value, keys: new Set([norm(value)]), rows: new Set() });
      const entry = entries.get(value);
      if (alias) entry.keys.add(norm(alias));
      entry.rows.add(record);
    }
    for (const r of records) {
      index("model", r.model, r);
      const serial = r.serial || rangeText(r.serialRange);
      if (serial) index("serial", [r.model, serial].filter(Boolean).join(" "), r, serial);
      for (const unit of [r.bureau, r.operator, r.depot]) index("unit", unit, r);
      index("unit", r.workshop, r, workshopName(r.workshop));
      index("manufacturer", r.manufacturer, r);
    }
    function coversSerial(row, serial) {
      return row.serial === serial || (
        row.serialStart?.length === serial.length && row.serialEnd?.length === serial.length &&
        row.serialStart <= serial && serial <= row.serialEnd
      );
    }
    function matchesTerm(kind, entry, term) {
      if (kind === "serial") {
        const row = entry.rows.values().next().value;
        const prefix = norm(row.model);
        const serial = prefix && term.startsWith(prefix) ? term.slice(prefix.length) : term;
        if (/^\d{4,5}$/.test(serial)) {
          return coversSerial(row, serial);
        }
      }
      for (const key of entry.keys) if (key.includes(term)) return true;
      return false;
    }
    let selected = null;
    if (options.kind && initial && field.value === (options.kind === "workshop" ? "unit" : options.kind) && filter.value === initial) {
      const key = norm(initial);
      const direct = [...groups[field.value].values()].find((entry) => entry.keys.has(key));
      if (direct) {
        selected = direct;
      } else {
        const rows = options.kind === "unit" ? records.filter((r) =>
          norm([r.bureau || r.operator, r.depot, workshopName(r.workshop)].filter(Boolean).join("")).includes(key)
        ) : [];
        selected = { kind: field.value, value: initial, rows: new Set(rows) };
      }
    }
    let matches = records;
    const setOptions = mountSearchPicker(filter, list, entry => {
      selected = entry;
      updateFilter();
    });
    function updateFilter() {
      const term = norm(filter.value);
      const results = new Set();
      const options = [];
      for (const [kind, entries] of Object.entries(groups)) {
        if (field.value !== "all" && field.value !== kind) continue;
        for (const entry of entries.values()) {
          if (!selected && term && !matchesTerm(kind, entry, term)) continue;
          if (!selected && term) for (const row of entry.rows) results.add(row);
          if (entry.value === "不适用") continue;
          options.push(entry);
        }
      }
      setOptions(options);
      if (selected) {
        const sample = selected.rows.values().next().value;
        matches = selected.kind === "serial" && sample.serial
          ? records.filter((r) => r.model === sample.model && coversSerial(r, sample.serial))
          : records.filter((r) => selected.rows.has(r));
      } else {
        matches = term ? records.filter((r) => results.has(r)) : records;
      }
      page = 0;
      render();
    }
    const size = 10;
    function render() {
      const pages = Math.max(1, Math.ceil(matches.length / size));
      page = Math.min(pages - 1, page);
      select("#unit-count").textContent =
        "本站配属资料 " +
        fmt(db.records.length) +
        " 条，符合条件 " +
        fmt(matches.length) +
        " 条。区间与单车按原资料分别列出。";
      select("#units").innerHTML = matches.length
        ? matches
            .slice(page * size, (page + 1) * size)
            .map((r) => {
              const linked = (r.sourceIds || []).map((id) => sources.get(id)).filter(Boolean);
              const facts = [
                ["配属路局", r.bureau],
                ["其他运营单位", r.operator],
                ["核实情况", r.confidence],
                ["动车段", r.depot],
                ...(r.depotEvidenceDate ? [["动车段来源资料日期", r.depotEvidenceDate]] : []),
                ["动车运用所", r.workshop],
                ["生产厂家", r.manufacturer],
                ["资料适用日", r.asOf],
                ["查阅日期", r.checkedAt || db.checkedAt]
              ];
              const sourceBlock = linked
                .map(
                  (s) =>
                    '<a href="' +
                    esc(s.url) +
                    '" target="_blank" rel="noopener noreferrer">' +
                    esc((s.publisher || s.title) + (s.revisionDate ? " · " + s.revisionDate : "")) +
                    "</a>" +
                    (s.license && s.licenseUrl
                      ? ' · <a href="' + esc(s.licenseUrl) + '">' + esc(s.license) + "</a>"
                      : "")
                )
                .join(" · ");
              return (
                '<details class="fleet-row" ' +
                (matches.length === 1 ? "open" : "") +
                "><summary><strong>" +
                esc(r.model || "型号待核实") +
                "</strong> <b>" +
                esc(r.serial || rangeText(r.serialRange) || "车号待补") +
                "</b> <span>" +
                esc(
                  [r.bureau || r.operator, r.workshop || r.depot].filter(Boolean).join(" · ") ||
                    "单位待补"
                ) +
                '</span></summary><dl class="exp-facts">' +
                facts
                  .map(([k, v]) => "<div><dt>" + esc(k) + "</dt><dd>" + esc(v || "未载") + "</dd></div>")
                  .join("") +
                "</dl><p>" +
                esc(r.scope || "") +
                '</p><p class="spec-credit">' +
                sourceBlock +
                "</p></details>"
              );
            })
            .join("")
        : "<p>当前条件没有匹配的配属资料。可清空日期或缩短单位名称重试。</p>";
      select("#unit-pages").innerHTML =
        pages > 1
          ? '<button data-step="-1" ' +
            (!page ? "disabled" : "") +
            ">上一页</button><span>" +
            (page + 1) +
            " / " +
            pages +
            '</span><button data-step="1" ' +
            (page + 1 === pages ? "disabled" : "") +
            ">下一页</button>"
          : "";
      addPageJump(select("#unit-pages"), page + 1, pages, (target) => {
        page = target - 1;
        render();
      });
    }
    filter.oninput = () => {
      selected = null;
      updateFilter();
    };
    field.onchange = () => {
      if (selected) filter.value = "";
      selected = null;
      updateFilter();
    };
    select("#unit-pages").onclick = (e) => {
      const step = e.target.closest("[data-step]")?.dataset.step;
      if (step) {
        page += Number(step);
        render();
      }
    };
    updateFilter();
  } catch {
    select("#unit-count").textContent = "暂时无法读取配属资料，请刷新重试。";
  }
}
