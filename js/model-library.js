"use strict";

async function loadModelParameters(host, initialTerm, initiallySelected, onCatalog) {
  const section = document.createElement("section");
  section.className = "parameter-library exp-record";
  section.innerHTML =
    '<h3>车型技术参数</h3>' +
    '<div class="spec-model-lookup"><label class="exp-field">选择车型<select id="spec-select" disabled></select></label>' +
    '<label class="exp-field">查找型号、变型或别名<input id="spec-query" type="search" placeholder="例如 CR400AF、CRH2A"></label></div>' +
    '<div class="spec-grid" id="spec-choices"></div><div class="exp-actions" id="spec-paging"></div><div id="spec-detail" aria-live="polite">正在读取本站车型资料…</div>';
  host.replaceChildren(section);
  const find = (selector) => section.querySelector(selector);
  const input = find("#spec-query");
  const picker = find("#spec-select");
  input.value = initialTerm;
  const normalize = (v) => (v || "").normalize("NFKC").toUpperCase().replace(/[\s－–—-]/g, "");
  const query = new URL(location.href);
  let selected,
    page = 0,
    sequence = 0;
  const size = 12;
  try {
    const db = await readData("model-parameters/index.json");
    onCatalog?.(db.items);
    const byId = new Map(db.items.map((v) => [v.id, v]));
    const attribution = db.attribution;
    let options;
    function filterOptions() {
      const term = normalize(input.value);
      options = db.items.filter((x) =>
        [x.name, ...(x.aliases || [])].some((n) => normalize(n).includes(term))
      );
      picker.replaceChildren(...options.map(item =>
        new Option(item.name + (item.disambiguation ? " · " + item.disambiguation : ""), item.id)
      ));
      picker.disabled = !options.length;
      if (!options.length) picker.add(new Option("无匹配车型", ""));
    }
    function renderChoices() {
      const pages = Math.max(1, Math.ceil(options.length / size));
      page = Math.min(page, pages - 1);
      find("#spec-choices").innerHTML = options
        .slice(page * size, (page + 1) * size)
        .map(
          (x) =>
            '<button type="button" data-model="' +
            esc(x.id) +
            '" aria-pressed="' +
            (selected === x.id) +
            '"><b>' +
            esc(x.name) +
            "</b><small>" +
            (x.disambiguation ? esc(x.disambiguation) + " · " : "") +
            (x.parameterCount ? fmt(x.parameterCount) + " 项参数" : "资料待补") +
            "</small></button>"
        )
        .join("");
      find("#spec-paging").innerHTML =
        pages > 1
          ? '<button data-step="-1" ' +
            (page === 0 ? "disabled" : "") +
            ">上一页</button><span>" +
            (page + 1) +
            " / " +
            pages +
            '</span><button data-step="1" ' +
            (page === pages - 1 ? "disabled" : "") +
            ">下一页</button>"
          : "";
      addPageJump(find("#spec-paging"), page + 1, pages, (target) => {
        page = target - 1;
        renderChoices();
      });
    }
    async function show(item, reflectUrl) {
      const token = ++sequence;
      selected = item?.id;
      picker.value = selected || "";
      renderChoices();
      const area = find("#spec-detail");
      if (reflectUrl) {
        const loc = new URL(location.href);
        if (item) loc.searchParams.set("spec", item.id);
        else loc.searchParams.delete("spec");
        history.replaceState(null, "", loc);
      }
      if (!item) {
        area.textContent = "没有查到这个型号，可以输入更短的型号名称。";
        return;
      }
      const unresolved = (item.unmatchedNames || []).some(
        (n) => normalize(n) === normalize(input.value)
      );
      if (unresolved) {
        area.textContent = input.value + " 的独立参数尚待核实。原资料目录把这个名称指向另一车型。";
        return;
      }
      area.textContent = "正在读取 " + item.name + " 的规格…";
      try {
        const record = await readData(item.file.replace(/^data\//, ""));
        if (token !== sequence) return;
        const groups = record.groups || [];
        const source =
          '<a href="' +
          esc(record.source) +
          '" rel="noopener noreferrer" target="_blank">来源：中国动车组 · 慧伊创新科技（北京）有限公司</a>';
        const license =
          '<a href="' +
          esc(attribution.licenseUrl) +
          '" rel="noopener noreferrer" target="_blank">' +
          esc(attribution.license) +
          "</a>";
        area.innerHTML =
          "<h4>" +
          esc(record.name) +
          (item.disambiguation ? " · " + esc(item.disambiguation) : "") +
          "</h4>" +
          (record.note ? '<p class="spec-scope">' + esc(record.note) + "</p>" : "") +
          (item.unmatchedNames?.length
            ? '<p class="spec-scope">以下名称与本页技术表的对应关系待核实：' +
              esc(item.unmatchedNames.join("、")) +
              "。</p>"
            : "") +
          groups
            .map(
              (g) =>
                '<section class="spec-group"><h5>' +
                esc(g.name) +
                "</h5>" +
                (g.scope ? '<p class="spec-scope">' + esc(g.scope) + "</p>" : "") +
                '<dl class="exp-facts">' +
                g.fields
                  .map((f) => "<div><dt>" + esc(f.label) + "</dt><dd>" + esc(f.value) + "</dd></div>")
                  .join("") +
                "</dl></section>"
            )
            .join("") +
          (groups.length ? "" : "<p>此来源页尚缺可核对的规格表。</p>") +
          '<p class="spec-credit">' +
          source +
          " · " +
          license +
          " · 核对日期 " +
          esc(record.asOf) +
          "</p>";
      } catch {
        if (token === sequence) area.textContent = "这份规格暂时未能读取，可重新点选型号。";
      }
    }
    function reveal(item, reflectUrl) {
      const index = options.findIndex(option => option.id === item?.id);
      page = index < 0 ? 0 : Math.floor(index / size);
      show(item, reflectUrl);
    }
    function byName(name) {
      if (!name) return;
      const exact = name.trim().toUpperCase();
      return options.find(x => x.name.toUpperCase() === exact) ||
        options.find(x => [x.name, ...(x.aliases || [])].some(v => normalize(v) === normalize(name)));
    }
    input.oninput = () => {
      filterOptions();
      reveal(byName(input.value) || options.find((x) => x.parameterCount) || options[0], true);
    };
    picker.onchange = () => reveal(byId.get(picker.value), true);
    find("#spec-choices").onclick = (e) => {
      const id = e.target.closest("[data-model]")?.dataset.model;
      if (id) show(byId.get(id), true);
    };
    find("#spec-paging").onclick = (e) => {
      const step = e.target.closest("[data-step]")?.dataset.step;
      if (step) {
        page += Number(step);
        renderChoices();
      }
    };
    filterOptions();
    const direct = query.searchParams.get("spec");
    const initial = direct
      ? byId.get(direct)
      : byName(initiallySelected || initialTerm || "CR400AF") ||
        options.find((x) => x.parameterCount) ||
        options[0];
    if (initial && direct && !options.some((x) => x.id === direct)) {
      input.value = "";
      filterOptions();
    }
    reveal(initial, false);
  } catch {
    find("#spec-detail").textContent = "车型参数索引暂时未能读取，请刷新重试。";
  }
}
