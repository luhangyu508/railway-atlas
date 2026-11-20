const icons = {
  train:
    '<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 11h14M12 4v7m-3 4h.01m6 0h.01M8 18l-3 4m11-4 3 4M7 20h10"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1zm0 0v15"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/>',
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  sliders: '<path d="M3 6h8m4 0h6M3 17h3m4 0h11M11 3v6M7 14v6"/>',
  layers: '<path d="m2 9 10-6 10 6-10 6zm0 5 10 6 10-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18m-9-9c-4 4-4 14 0 18 4-4 4-14 0-18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  focus:
    '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.8"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  ruler: '<path d="m3 16 13-13 5 5L8 21zm5-5 2 2m2-6 2 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  route:
    '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a4 4 0 0 0 0-8h-2a2 2 0 0 1 0-4h6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  fold: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/>',
  station: '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>'
};
function icon(n, s = 18) {
  return (
    '<svg width="' +
    s +
    '" height="' +
    s +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    icons[n] +
    "</svg>"
  );
}
const types = {
  highspeed: { label: "高速铁路", color: "#d95c42" },
  conventional: { label: "普速铁路", color: "#4275aa" },
  intercity: { label: "城际铁路", color: "#458669" },
  local: { label: "地方铁路", color: "#9065a2" },
  tourism: { label: "旅游铁路", color: "#bf842c" },
  dedicated: { label: "专用铁路", color: "#886547" },
  other: { label: "其他铁路", color: "#697775" }
};
function flag(code) {
  const type = types[code] || types.other;
  return (
    '<span class="flag" style="--rail:' + type.color + '"><i></i>' + esc(type.label) + "</span>"
  );
}
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString("zh-CN") : "待补充");
const distanceLabel = (n) => (Number.isFinite(n) ? fmt(n) + " km" : "里程待补充");
const statusLabels = {
  operating: "运营中",
  partial: "部分运营",
  construction: "在建",
  planned: "规划",
  suspended: "停运",
  abandoned: "废弃",
  unknown: "待核实"
};
const qualityLabels = {
  verified: "已核实",
  incomplete: "资料待补充",
  disputed: "资料有分歧",
  partial: "资料待补充",
  pending: "资料待补充"
};
function statusName(code) {
  return statusLabels[code] || code || "待核实";
}
const highspeedScope = "本站高速铁路含时速 200 公里级及以上的客货共线铁路。";
function trafficLabel(line) {
  return line.mixedTrafficSpeedKmh ? "客货共线 · " + line.mixedTrafficSpeedKmh + " km/h 级" : "";
}
function typeName(code) {
  return types[code]?.label || code || "其他铁路";
}
function atlasManifest() {
  // A page keeps its first manifest so that its index, detail and track shards match.
  return (manifestRequest ||= readData("catalog/manifest.json").then((manifest) => {
    for (const [code, label] of Object.entries(manifest.types)) {
      types[code] = { label, color: types[code]?.color || types.other.color };
    }
    Object.assign(statusLabels, manifest.statuses);
    return manifest;
  }));
}
let manifestRequest, indexRequest;
async function atlasRead(path) {
  const manifest = await atlasManifest();
  const response = await fetch(manifest.base + path);
  if (!response.ok)
    throw Object.assign(Error(path + " " + response.status), { status: response.status });
  return response.json();
}
function atlasIndex() {
  return (indexRequest ||= atlasRead("index.json"));
}
function junctionLink(id) {
  return "hubs.html?junction=" + encodeURIComponent(id);
}
function parameterLink(ref) {
  const params = new URLSearchParams({id: ref.document});
  if (ref.section) { params.set("section", ref.section); params.set("scope", ref.scope); }
  return "line-parameters.html?" + params;
}
function recordLink(id) {
  return "line.html?id=" + encodeURIComponent(id);
}
function stationLink(id) {
  return "station.html?id=" + encodeURIComponent(id);
}
function optionalText(value) {
  return value === null || value === undefined || value === "" ? "待补充" : String(value);
}
function validLink(value) {
  return /^https?:\/\//i.test(value || "");
}
function sourceLink(source) {
  const title = source.title || source.publisher || source.url || "资料待补充";
  return validLink(source.url)
    ? '<a href="' +
        esc(source.url) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(title) +
        "</a>"
    : esc(title);
}
function mountHeader(active) {
  document.querySelector("header").innerHTML =
    '<a class="brand" href="./" aria-label="中国铁路图鉴首页"><span class="brand-icon">' +
    icon("train", 29) +
    '</span><span><strong>中国铁路图鉴</strong><small>CHINA RAILWAY ATLAS</small></span></a><nav aria-label="主导航">' +
    [
      ["map", "地图探索", "./"],
      ["book", "线路图鉴", "catalog.html"],
      ["globe", "全国目录", "national.html"],
      ["compass", "铁路探索", "explore.html"],
      ["info", "数据与进度", "about.html"]
    ]
      .map(
        ([id, label, url]) =>
          '<a href="' +
          url +
          '" aria-label="' +
          label +
          '" ' +
          (id === (active === "explore" ? "compass" : active) ? 'aria-current="page"' : "") +
          ">" +
          icon(id, 17) +
          "<span>" +
          label +
          "</span></a>"
      )
      .join("") +
    '</nav><span class="header-count"><i></i>地图档案 <b id="site-total">…</b> 条</span>';
  atlasManifest()
    .then((m) => {
      document.getElementById("site-total").textContent = fmt(m.stats.total);
    })
    .catch(() => {
      document.querySelector(".header-count").hidden = true;
    });
}
const q = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
async function readData(path) {
  const res = await fetch("data/" + path);
  if (!res.ok) throw Error(path + " " + res.status);
  return res.json();
}
