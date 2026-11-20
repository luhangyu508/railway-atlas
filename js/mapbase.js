const atlasBounds = [
  [0, 40],
  [65, 165]
];
function newMap(id) {
  return L.map(id, {
    attributionControl: false,
    zoomControl: false,
    minZoom: 3.3,
    maxZoom: 10,
    zoomSnap: 0.1,
    zoomDelta: 1,
    maxBounds: atlasBounds,
    maxBoundsViscosity: 1
  });
}
function addBase(map) {
  const image = L.imageOverlay("assets/terrain.webp", atlasBounds, {
    pane: "tilePane",
    interactive: false,
    alt: "中国及周边地形晕渲图"
  }).addTo(map);
  L.control
    .attribution({ prefix: false, position: "bottomright" })
    .addTo(map)
    .addAttribution(
      '<a href="https://www.naturalearthdata.com/">Natural Earth</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'
    );
  return image;
}
const cityData = [
  ["北京", 39.904, 116.407, 1],
  ["上海", 31.23, 121.47, 1],
  ["天津", 39.12, 117.2, 2],
  ["哈尔滨", 45.76, 126.63, 1],
  ["长春", 43.82, 125.32, 1],
  ["沈阳", 41.8, 123.43, 1],
  ["石家庄", 38.04, 114.51, 2],
  ["太原", 37.87, 112.55, 2],
  ["济南", 36.65, 117.12, 1],
  ["郑州", 34.75, 113.62, 1],
  ["武汉", 30.59, 114.3, 1],
  ["长沙", 28.23, 112.94, 1],
  ["广州", 23.13, 113.26, 1],
  ["深圳", 22.55, 114.06, 2],
  ["南京", 32.06, 118.8, 1],
  ["杭州", 30.27, 120.15, 2],
  ["福州", 26.08, 119.3, 1],
  ["南昌", 28.68, 115.86, 1],
  ["合肥", 31.82, 117.23, 2],
  ["徐州", 34.21, 117.28, 2],
  ["西安", 34.34, 108.94, 1],
  ["兰州", 36.06, 103.83, 1],
  ["西宁", 36.62, 101.78, 2],
  ["乌鲁木齐", 43.83, 87.62, 1],
  ["拉萨", 29.65, 91.14, 1],
  ["格尔木", 36.4, 94.9, 2],
  ["成都", 30.57, 104.07, 1],
  ["重庆", 29.56, 106.55, 1],
  ["贵阳", 26.65, 106.63, 1],
  ["昆明", 25.04, 102.71, 1],
  ["南宁", 22.82, 108.32, 1],
  ["柳州", 24.33, 109.42, 2],
  ["包头", 40.66, 109.84, 2],
  ["呼和浩特", 40.82, 111.65, 2],
  ["厦门", 24.48, 118.09, 2],
  ["青岛", 36.07, 120.38, 2],
  ["香港", 22.32, 114.17, 3],
  ["台北", 25.04, 121.57, 2],
  ["海口", 20.04, 110.2, 2],
  ["银川", 38.49, 106.23, 2],
  ["宜昌", 30.7, 111.29, 2],
  ["盐城", 33.35, 120.16, 3],
  ["宝鸡", 34.36, 107.24, 3],
  ["攀枝花", 26.58, 101.72, 3],
  ["桂林", 25.27, 110.29, 3],
  ["张掖", 38.93, 100.45, 3],
  ["敦煌", 40.14, 94.66, 3],
  ["山海关", 40.01, 119.76, 3],
  ["焦作", 35.22, 113.24, 3],
  ["鹰潭", 28.26, 117.07, 3],
  ["洛阳", 34.62, 112.45, 3],
  ["九江", 29.7, 116.0, 3],
  ["大理", 25.6, 100.27, 3],
  ["哈密", 42.82, 93.51, 2],
  ["嘉峪关", 39.77, 98.29, 3]
];
const regionData = [
  ["新疆", 41.9, 84.3],
  ["西藏", 31.2, 86.1],
  ["青海", 34.5, 95.4],
  ["甘肃", 38.45, 100.8],
  ["内蒙古", 42.8, 112],
  ["四川", 31.3, 101.5],
  ["云南", 24.3, 100.4],
  ["贵州", 26.4, 108.6],
  ["广西", 23.7, 107.6],
  ["广东", 23.7, 115.4],
  ["湖南", 27, 111.3],
  ["江西", 27.4, 116.4],
  ["福建", 25.7, 117.6],
  ["湖北", 31.4, 112],
  ["安徽", 31.1, 116.45],
  ["浙江", 29, 120.2],
  ["江苏", 33.4, 119.5],
  ["河南", 33.7, 113.0],
  ["陕西", 36.0, 108.65],
  ["山西", 36.75, 111.4],
  ["河北", 39.3, 114.6],
  ["山东", 36.1, 118.9],
  ["辽宁", 41.58, 121.3],
  ["吉林", 43.1, 127.4],
  ["黑龙江", 47.6, 128.6],
  ["台湾", 23.7, 121.0],
  ["海南", 19, 109.8],
  ["宁夏", 37.4, 105.8],
  ["蒙古", 46.4, 102.3, "country"],
  ["俄罗斯", 51.8, 125, "country"],
  ["印度", 25.1, 80.3, "country"],
  ["缅甸", 22.4, 96.5, "country"],
  ["越南", 18.2, 105.5, "country"],
  ["朝鲜", 40.0, 126.4, "country"],
  ["韩国", 36.8, 128.3, "country"],
  ["日本", 36.3, 138.7, "country"],
  ["尼泊尔", 28.0, 83.3, "country"],
  ["孟加拉国", 23.5, 89.7, "country"],
  ["黄 海", 34.2, 123.8, "water"],
  ["东 海", 28.8, 125.1, "water"],
  ["南 海", 16.6, 113.8, "water"],
  ["孟 加 拉 湾", 18.9, 89.1, "water"],
  ["青 藏 高 原", 32.2, 91.2, "mountain"],
  ["塔 里 木 盆 地", 38.2, 83.5, "mountain"],
  ["天 山 山 脉", 43.15, 83.2, "mountain"]
];
function labels(map, showRegions = true) {
  const group = L.layerGroup().addTo(map);
  const regional = L.layerGroup().addTo(map);
  const label = (name, lat, lng, css, group, content) =>
    L.marker([lat, lng], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: "geo-label " + css,
        html: content || name,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      }),
      zIndexOffset: css.startsWith("city") ? 300 : 0
    }).addTo(group);
  if (showRegions)
    regionData.forEach(([name, lat, lng, t]) =>
      label(name, lat, lng, "regional " + (t || "province"), regional, "<span>" + name + "</span>")
    );
  function refresh() {
    group.clearLayers();
    const z = map.getZoom(),
      occupied = [];
    for (const [name, lat, lng, priority] of cityData) {
      if ((priority === 3 && z < 5.7) || (priority === 2 && z < 4.35)) continue;
      const px = map.latLngToContainerPoint([lat, lng]),
        w = name.length * 12 + 7;
      const box = [px.x - 4, px.y - 9, px.x + w + 9, px.y + 9];
      const overlap = occupied.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
      if (!overlap) {
        occupied.push(box);
        label(
          name,
          lat,
          lng,
          "city " + (priority === 1 ? "major" : ""),
          group,
          "<i></i><span>" + name + "</span>"
        );
      }
    }
  }
  map.on("zoomend", refresh);
  refresh();
  return group;
}
