"use strict";

const timetableRequests = new Map();
function timetableData(path) {
  if (!timetableRequests.has(path)) {
    timetableRequests.set(path, readData(path).catch((error) => {
      timetableRequests.delete(path);
      throw error;
    }));
  }
  return timetableRequests.get(path);
}

function matchesTrainNumber(number, {prefix, digits}) {
  return number.toUpperCase().split("/").some((part) => {
    if (prefix === "numeric") return /^\d/.test(part) && part.startsWith(digits);
    if (prefix) return part.startsWith(prefix + digits);
    return !digits || part.replace(/^[A-Z]+/, "").startsWith(digits);
  });
}

async function loadTrainTimetable(host, filters) {
  host.innerHTML = '<section class="exp-record parameter-library"><h3>列车停站时刻</h3><p role="status">正在读取时刻表…</p></section>';
  const box = host.firstElementChild;
  const params = new URLSearchParams(location.search);
  const selected = params.get("trip");
  const term = filters.term.trim().toUpperCase();
  let observedTrain = "";
  let matchingTimetableNumbers = new Set();
  function queryUrl(changes) {
    const query = new URLSearchParams(params);
    query.set("tab", "services");
    if (Object.hasOwn(changes, "q")) query.delete("searchBy");
    for (const [key, value] of Object.entries(changes)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    return "explore.html?" + query.toString();
  }
  function queryLink(changes, text) {
    return '<a class="exp-link" href="' + esc(queryUrl(changes)) + '">' + esc(text) + '</a>';
  }
  function clock(minutes) {
    const day = Math.floor(minutes / 1440);
    const hh = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    return (day ? "+" + day + "日 " : "") + hh + ":" + mm;
  }
  function stamp(ranges) {
    return ranges.map(([start, end]) => start === end ? start : start + " 至 " + end).join("、");
  }
  try {
    const meta = await timetableData("timetables/manifest.json");
    const base = "timetables/" + encodeURIComponent(meta.version) + "/";
    const db = await timetableData(base + "index.json");
    if (box.parentElement !== host) return;
    const includesDay = (key) => !filters.date || db.calendars[key].some(
      ([start, end]) => start <= filters.date && filters.date <= end
    );
    const attribution = '<details class="exp-sources"><summary>来源、日期与覆盖范围</summary><p class="spec-credit">' +
      '此版收录 ' + fmt(meta.trips) + ' 条车次时刻、' + fmt(meta.stops) + ' 条停站记录。' +
      '原版包含 ' + fmt(meta.sourceTrips) + ' 条车次，' + fmt(meta.heldForReview) + ' 条有待复核。' +
      '发车日使用来源日历，实际调整以铁路公告为准。站序可用于查阅停靠站，所经铁路线和配属须另有依据。</p>' +
      '<p class="spec-credit">时刻资料由 ' + esc(meta.author) + ' 发布，运行数据来自 ' + esc(meta.upstream) +
      '。本站校验站序与时间，转换为分页索引和逐站时刻。' +
      '<a rel="noopener noreferrer" href="' + esc(meta.source) + '">原始发行版</a> · ' +
      '<a rel="license noopener noreferrer" href="' + esc(meta.licenseUrl) + '">' + esc(meta.license) + '</a></p></details>';
    const renumbering=meta.releaseDate==="2026-11-20" && (!filters.date || filters.date>="2026-11-25") ?
      '<p class="spec-scope">11 月 25 日零时起始发的普速客车启用新车次。本快照采用变更前的数据，其中部分日期跨越调整日，N、V 字头尚待补录。<a class="inline" href="https://www.12306.cn/mormhweb/zxdt/202611/t20261105_46591.html">查看铁路 12306 公告</a></p>':"";
    const header = '<h3>列车停站时刻</h3><p class="spec-scope">快照发布于 ' + esc(meta.releaseDate) +
      '，覆盖发车日期 ' + esc(meta.from) + ' 至 ' + esc(meta.to) + '。时间为北京时间。</p>'+renumbering;
    const byStation = filters.prefix === "station";
    const matchesTerm = (r) => byStation
      ? [db.stations[r[2]], db.stations[r[3]]].some((station) => station.toUpperCase().includes(term))
      : matchesTrainNumber(r[1], filters);
    let matches = db.rows.filter((r) => matchesTerm(r) && includesDay(r[4]));
    const exact = byStation || !filters.prefix ? [] : matches.filter((r) => r[1].toUpperCase() === term);
    if (exact.length) matches = exact;
    matchingTimetableNumbers = new Set(matches.map((row) => row[1]));
    const detail = selected ? matches.find((r) => r[0] === selected) : matches.length === 1 ? matches[0] : null;
    if (detail) {
      const [id, number, start, end, calendarId, shard] = detail;
      observedTrain = number;
      const trips = await timetableData(base + "trips-" + shard + ".json");
      if (box.parentElement !== host) return;
      const stops = trips[id];
      const rows = stops.map(([station, arrival, departure], i) => {
        const name = db.stations[station];
        const travel = new URLSearchParams({tab: "travel", station: name});
        return '<tr><td>' + (i + 1) + '</td><th scope="row"><a class="inline" title="按此站名探索线路" href="explore.html?' +
          esc(travel.toString()) + '">' + esc(name) + '</a></th><td>' + (i ? clock(arrival) : '始发') +
          '</td><td>' + (i + 1 < stops.length ? clock(departure) : '终到') + '</td></tr>';
      }).join("");
      const range = stamp(db.calendars[calendarId]);
      const duration = stops[stops.length - 1][1] - stops[0][2];
      document.title = number + " 停站时刻 · 中国铁路图鉴";
      box.innerHTML = header + '<h4>' + esc(number) + '　' + esc(db.stations[start]) + ' → ' + esc(db.stations[end]) +
        '</h4><p class="spec-scope">' + stops.length + ' 站 · 全程 ' + Math.floor(duration / 60) + ' 小时 ' +
        duration % 60 + ' 分钟' + (filters.date ? ' · 发车日 ' + esc(filters.date) : '') + '</p>' +
        '<details class="fleet-row"><summary>查看本车开行日历</summary><p>' + esc(range) + '</p></details>' +
        '<div class="fleet-scroll"><table class="fleet-table" aria-label="有序停站及到发时刻"><thead><tr>' +
        '<th>站序</th><th>车站</th><th>到达</th><th>出发</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="exp-actions">' + queryLink({q: null, trip: null, timetablePage: null}, "返回车次目录") +
        queryLink({trip: id, timetablePage: null}, "本车时刻表独立链接") + '</div>' + attribution;
      return;
    }
    if (selected || !matches.length) {
      const message = selected ? '该车次不在所选条件内。' : '此版时刻表中没有符合条件的记录。';
      box.innerHTML = header + '<p role="status">' + message + '</p><div class="exp-actions">' +
        queryLink({trip: null, q: null, date: null, timetablePage: null}, "查看全部车次") + '</div>' + attribution;
      return;
    }
    const size = 12;
    const pages = Math.ceil(matches.length / size);
    const page = Math.min(pages, Math.max(1, parseInt(params.get("timetablePage"), 10) || 1));
    const tableRows = matches.slice((page - 1) * size, page * size).map(([id, number, start, end]) =>
      '<tr><th scope="row">' + queryLink({trip: id}, number) + '</th><td>' +
      esc(db.stations[start]) + '</td><td>' + esc(db.stations[end]) + '</td></tr>'
    ).join("");
    box.innerHTML = header + '<p role="status">查到 ' + fmt(matches.length) + ' 条车次，点选车次号查看各站时刻。</p>' +
      '<div class="fleet-scroll"><table class="fleet-table"><thead><tr><th>车次</th><th>始发站</th><th>终到站</th></tr></thead><tbody>' +
      tableRows + '</tbody></table></div><div class="exp-actions" id="timetable-pages">第 ' + page + ' / ' + pages + ' 页　' +
      (page > 1 ? queryLink({timetablePage: page - 1}, "上一页") : "") +
      (page < pages ? queryLink({timetablePage: page + 1}, "下一页") : "") + '</div>' + attribution;
    addPageJump(box.querySelector("#timetable-pages"), page, pages, (target) => {
      if (target !== page) location.assign(queryUrl({timetablePage: target}));
    });
  } catch (error) {
    if (box.parentElement !== host) return;
    console.error(error);
    box.innerHTML = '<h3>列车停站时刻</h3><p role="alert">本版时刻表读取失败，请刷新重试。</p>';
  } finally {
    if (box.parentElement !== host) return;
    const fleet = document.createElement("section");
    fleet.className = "exp-record parameter-library";
    fleet.setAttribute("aria-label", "动车组运用记录");
    if (observedTrain || /^[A-Z]\d{1,5}$/.test(term)) host.prepend(fleet);
    else host.append(fleet);
    await showTrainObservations(fleet, {
      ...filters, term, train: observedTrain, selectedTrip: selected, matchingTimetableNumbers
    }, queryLink);
  }
}

async function showTrainObservations(host, filters, queryLink) {
  host.innerHTML = '<h3>动车组运用记录</h3><p role="status">正在读取有日期的车型记录…</p>';
  try {
    const data = await timetableData("timetables/observations.json");
    if (!host.isConnected) return;
    const all = data.records;
    const numbers = [...new Set(all.map((r) => r.train))].sort((a, b) => a.localeCompare(b, "en", {numeric: true}));
    const hasExact = filters.train || (filters.prefix && filters.prefix !== "station" && numbers.includes(filters.term));
    const matches = all.filter((r) => {
      if (filters.date && !r.observedAt.startsWith(filters.date + " ")) return false;
      if (filters.train) return r.train === filters.train;
      if (filters.selectedTrip) return false;
      if (hasExact) return r.train === filters.term;
      return filters.prefix === "station" ? filters.matchingTimetableNumbers.has(r.train) : matchesTrainNumber(r.train, filters);
    });
    const open = (r, label) => queryLink({q: r.train, date: r.observedAt.slice(0, 10), trip: null, timetablePage: null}, label);
    const visibleTrain = filters.train || (hasExact && filters.term);
    const paths = (data.paths?.records || []).filter((path) => path.train === visibleTrain &&
      (!filters.date || path.dates.includes(filters.date)));
    const connections = paths.map((path) => {
      const stops = path.stations.map((s) => '<a class="inline" href="' + stationLink(s.id) + '">' + esc(s.name) + '</a>');
      const evidence = path.sources.map((key) => data.paths.sources[key]).filter(Boolean);
      return '<h4><a class="inline" href="' + recordLink(path.lineId) + '#services">' + esc(path.lineName) +
        '</a></h4><p>' + esc(path.displayNumber) + ' · 本线图定停站　' + stops.join(" → ") + '</p>' +
        '<p class="spec-scope">已核对发车日 ' + esc((filters.date ? [filters.date] : path.dates).join("、")) + '。</p>' +
        '<details class="exp-sources"><summary>经由和停站依据</summary><ul>' +
        evidence.map((source) => '<li>' + sourceLink(source) + ' · ' + esc(source.publishedAt) + '</li>').join("") +
        '</ul><p>铁路调图资料说明经由线路，时刻表给出停站。车组观测见上表。</p></details>';
    }).join("");
    let body;
    if (!filters.term && !filters.prefix && !filters.date && !filters.selectedTrip) {
      const examples = numbers.map((n) => all.find((r) => r.train === n));
      body = '<p class="spec-scope">选择车次查看最近一次已收录的车型与车组号。</p><div class="exp-actions">' +
        examples.map((r) => open(r, r.train + " · " + r.observedAt.slice(5, 10))).join("") + '</div>';
    } else if (matches.length) {
      const groups = new Map();
      for (const row of matches) {
        const key = row.train + "|" + row.observedAt;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }
      const rows = [...groups.values()].map((sample) => {
        const first = sample[0];
        const modelLinks = [...new Map(sample.map(({unit}) => [unit.spec, unit.model])).entries()]
          .map(([spec, model]) => '<a class="inline" href="explore.html?tab=models&amp;spec=' +
            encodeURIComponent(spec) + '">' + esc(model) + '</a>').join('、');
        const units = sample.map(({unit}) => '<a class="inline" title="查询该车组的配属资料" href="explore.html?tab=allocations&amp;q=' +
          encodeURIComponent(unit.label) + '">' + esc(unit.label) + '</a>').join('、');
        return '<tr><th scope="row">' + open(first, first.train) + '</th><td>' + esc(first.observedAt) +
          '</td><td>' + modelLinks + '</td><td>' + units + '</td><td><a class="inline" href="' +
          esc(first.source) + '" rel="noopener noreferrer">Rail.re</a></td></tr>';
      }).join("");
      body = '<div class="fleet-scroll"><table class="fleet-table" aria-label="历史车型与车组号"><thead>' +
        '<tr><th>车次</th><th>来源记录时间</th><th>车型图鉴</th><th>车组号</th><th>出处</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>';
    } else {
      body = '<p role="status">所选车次或日期暂无已收录的车组观测。</p>';
      const latest = all.find((r) => r.train === (filters.train || filters.term));
      if (latest) body += '<div class="exp-actions">' + open(latest, "查看 " + latest.train + " 最近收录的记录") + '</div>';
    }
    host.innerHTML = '<h3>动车组运用记录</h3><p class="spec-scope">Rail.re 历史观测，已收录 ' + fmt(all.length) +
      ' 条车组记录，覆盖 ' + fmt(numbers.length) + ' 个车次。核验于 ' + esc(data.checkedAt) + '。</p>' +
      body + connections + '<p class="spec-credit">此处按来源的记录日期筛选。同一车次同一时刻出现多个车组时逐个列出。' +
      '停站时刻按始发日查询，其他日期的车型、编组和配属须另行核实。' +
      '<a class="inline" rel="noopener noreferrer" href="https://rail.re/links/">Rail.re 来源说明</a></p>';
  } catch (error) {
    console.error(error);
    host.innerHTML = '<h3>动车组运用记录</h3><p role="alert">车组记录暂时无法读取，请刷新重试。</p>';
  }
}
