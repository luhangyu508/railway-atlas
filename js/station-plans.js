async function showStationPlans(stop) {
  const section = document.getElementById("station-plans");
  const content = section.querySelector(".station-plan-content");
  try {
    const manifest = await readData("station-plans/manifest.json");
    const folder = "station-plans/" + manifest.version + "/";
    const first = stop.id.slice(3, 4);
    const shard = /^[0-9a-f]$/.test(first) ? first :
      ([...stop.id].reduce((total, c) => total + c.codePointAt(0), 0) % 16).toString(16);
    const records = await readData(folder + shard + ".json");
    const record = records[stop.id] || {plans: []};
    const plans = record.plans;
    const base = "data/" + folder + "assets/";
    const article = record.article ? sourceLink({title:"维基百科 · " + record.article.title, url:record.article.url}) : "";
    const facts = (record.facts || []).map(f => '<span>' + esc(f.label) + ' <b>' + esc(f.value) + '</b></span>').join("");
    const stationFacts = facts ? '<div class="station-plan-facts">' + facts + '</div>' : "";
    const review = record.review;
    const reviewHTML = review ? '<p>' + esc(review.text) + '</p><p class="subtle-note">' +
        sourceLink({title:review.sourceLabel,url:review.sourceUrl}) +
        (review.relatedStationId ? ' · <a href="' + stationLink(review.relatedStationId) + '#station-plans">' + esc(review.relatedLabel) + '</a>' : '') + '</p>' : '';
    if (!plans.length) {
      content.innerHTML = '<p>本站尚无可核实的站场配线图。</p>' + reviewHTML + stationFacts +
        (article ? '<p class="subtle-note">' + article + '</p>' : "");
      return record.position;
    }
    function choiceLabel(plan) {
      if (plan.src.startsWith("platform-")) return "站台与股道";
      if (plan.kind === "wiki") return "维基配线图";
      if (plan.kind === "construction") return "在建线位";
      return "轨道平面图";
    }
    const choices = plans.map((p,i) => '<button type="button" data-plan="' + i + '" aria-pressed="' +
      (i === 0) + '">' + esc(choiceLabel(p)) + '</button>').join("");
    content.innerHTML = reviewHTML + (plans.length > 1 ? '<div class="plan-switch" role="group" aria-label="选择图件">' + choices + '</div>' : '') +
      '<figure class="plan-figure"><button class="plan-preview" type="button" aria-label="放大车站图件"><img alt=""><span>放大查看</span></button>' +
      '<figcaption></figcaption></figure>' + stationFacts + (article ? '<p class="subtle-note">' + article + '</p>' : '') +
      '<dialog class="plan-dialog" aria-label="车站图件大图"><div class="plan-toolbar"><strong></strong>' +
      '<button type="button" data-zoom aria-pressed="false">放大细节</button><button type="button" data-close autofocus>关闭</button></div>' +
      '<div class="plan-viewport" tabindex="0" aria-label="图件浏览区域"><img alt=""></div></dialog>';
    const figure = content.querySelector(".plan-figure");
    const preview = figure.querySelector("img");
    const dialog = content.querySelector("dialog");
    const large = dialog.querySelector("img");
    const zoom = dialog.querySelector("[data-zoom]");
    const viewport = dialog.querySelector(".plan-viewport");
    function draw(i) {
      const p = plans[i];
      preview.src = base + p.src;
      preview.alt = stop.name + "站 · " + p.title;
      preview.width = p.width;
      preview.height = p.height;
      large.alt = preview.alt;
      dialog.querySelector("strong").textContent = preview.alt;
      figure.querySelector("figcaption").innerHTML = '<strong>' + esc(p.title) + '</strong>' +
        (p.scope ? '<p>' + esc(p.scope) + '</p>' : '') + '<small>' + esc(p.credit) + ' · ' +
        sourceLink({title:p.license, url:p.licenseUrl}) + ' · ' + sourceLink({title:"图形来源", url:p.diagramUrl || p.sourceUrl}) +
        (p.dataFile ? ' · <a download href="data/' + esc(folder + 'source/' + p.dataFile) + '">轨道源数据</a>' : '') +
        (p.scopeSources || []).map((url,n) => ' · ' + sourceLink({title:"图示范围依据 " + (n+1), url})).join('') +
        (p.projectUrl ? ' · ' + sourceLink({title:"项目资料", url:p.projectUrl}) : '') + (p.date ? ' · ' + esc(p.date) : '') + (p.creditsFile ? ' · <a target="_blank" rel="noopener" href="' + esc(base + p.creditsFile) + '">图形署名与许可</a>' : '') + '</small>';
      content.querySelectorAll("[data-plan]").forEach((b,n) => b.setAttribute("aria-pressed", String(i === n)));
    }
    content.querySelectorAll("[data-plan]").forEach((b,i) => b.addEventListener("click", () => draw(i)));
    const resetZoom = () => {
      viewport.classList.remove("enlarged");
      viewport.scrollTo(0,0);
      zoom.setAttribute("aria-pressed", "false");
      zoom.textContent = "放大细节";
    };
    figure.querySelector("button").addEventListener("click", () => {
      large.src = preview.src;
      resetZoom();
      dialog.showModal();
    });
    zoom.addEventListener("click", () => {
      const enlarged = viewport.classList.toggle("enlarged");
      zoom.setAttribute("aria-pressed", String(enlarged));
      zoom.textContent = enlarged ? "适应窗口" : "放大细节";
    });
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    draw(0);
    return record.position;
  } catch (error) {
    console.error(error);
    content.textContent = "图件资料加载失败，请刷新重试。";
  }
}
