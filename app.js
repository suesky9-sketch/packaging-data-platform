let rawData = window.PACKAGING_DATA || { items: [], sourceFile: "数据表" };
let allItems = rawData.items || [];
let worldMapChart = null;
let worldMapZoom = 1.08;
let uploadedImageObjectUrls = [];
const countryPositions = {
  中国: [73, 47],
  日本: [82, 48],
  韩国: [79, 47],
  美国: [21, 45],
  加拿大: [22, 30],
  墨西哥: [18, 56],
  英国: [45, 37],
  法国: [47, 43],
  德国: [50, 40],
  意大利: [51, 47],
  希腊: [53, 49],
  瑞士: [49, 43],
  西班牙: [45, 48],
  俄罗斯: [68, 31],
  澳大利亚: [79, 72],
  新西兰: [87, 78],
  泰国: [71, 58],
  越南: [73, 60],
  印度: [65, 56],
  印度尼西亚: [75, 65],
  中国香港: [75, 52],
  巴西: [34, 68],
  阿根廷: [31, 78],
  南非: [53, 75],
};
const countryNameMap = {
  中国: ["China"],
  日本: ["Japan"],
  韩国: ["South Korea", "Korea"],
  美国: ["United States", "United States of America"],
  加拿大: ["Canada"],
  墨西哥: ["Mexico"],
  英国: ["United Kingdom", "England"],
  法国: ["France"],
  德国: ["Germany"],
  意大利: ["Italy"],
  希腊: ["Greece"],
  瑞士: ["Switzerland"],
  西班牙: ["Spain"],
  俄罗斯: ["Russia", "Russian Federation"],
  澳大利亚: ["Australia"],
  新西兰: ["New Zealand"],
  泰国: ["Thailand"],
  越南: ["Vietnam"],
  印度: ["India"],
  印度尼西亚: ["Indonesia"],
  中国香港: ["China"],
  巴西: ["Brazil"],
  阿根廷: ["Argentina"],
  南非: ["South Africa"],
};

const PACKAGE_FILTER_OPTIONS = [
  "PP注塑杯",
  "PP注塑勺",
  "PET吸塑盖",
  "PP注塑盖",
  "伸缩吸管",
  "PS吸塑杯",
  "纸塑复合杯",
  "PP吸塑杯",
];

const state = {
  type: "杯类",
  search: "",
  filters: { markets: new Set(), brands: new Set(), packages: new Set(), crafts: new Set(), specs: new Set() },
  customMin: "",
  customMax: "",
  openFilter: null,
  resultSubsetIds: null,
  currentView: "home",
  currentIndex: 0,
  detailImageIndex: 0,
  cupScatterPackage: "",
  bottleScatterMaterial: "",
  tableSearch: "",
  tableFilterColumn: "",
  tableFilterOperator: "contains",
  tableFilterValue: "",
  tableSortColumn: "",
  tableSortDirection: "asc",
  recommend: {
    type: "杯类",
    min: 80,
    max: 200,
    mouthMin: "",
    mouthMax: "",
    markets: new Set(),
    packages: new Set(),
    crafts: new Set(),
    surfaces: new Set(),
    note: "",
    generated: false,
    sort: "capacity",
  },
  preview: { images: [], index: 0, zoom: 1 },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const uniq = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
const compactText = (value) => {
  if (Array.isArray(value)) return value.length ? value.join("、") : "未记录";
  return value || "未记录";
};

function firstProductImage(item) {
  return (item.productImages || []).find(Boolean) || item.productImage || "";
}

function imageList(value) {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.filter(isImagePath))];
}

function isImagePath(value) {
  return typeof value === "string" && (/^(data:image\/|blob:)/i.test(value) || /\.(png|jpe?g|gif|webp|bmp)(\?.*)?$/i.test(value));
}

function imageSrc(value) {
  if (!value) return "";
  return window.PACKAGING_IMAGE_DATA?.[value] || value;
}

function imageBox(src, alt, className) {
  if (!src) return `<div class="${className}">${escapeHtml(alt || "产品图")}</div>`;
  return `<div class="${className} has-image"><img src="${escapeHtml(imageSrc(src))}" alt="${escapeHtml(alt || "产品图")}" loading="lazy"></div>`;
}

function detailValue(value) {
  const values = Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
  const images = values.filter(isImagePath);
  const texts = values.filter((entry) => !isImagePath(entry));
  const imageHtml = images.length
    ? `<div class="image-strip">${images.map((src, index) => `<button class="image-thumb preview-trigger" type="button" ${previewAttrs(images, index)}><img src="${escapeHtml(imageSrc(src))}" alt="产品图片" loading="lazy"></button>`).join("")}</div>`
    : "";
  const textHtml = texts.length ? escapeHtml(texts.join("、")) : "";
  return imageHtml + (textHtml || (!imageHtml ? "未记录" : ""));
}

function previewAttrs(images, index) {
  return `data-preview-images="${escapeHtml(images.join("|"))}" data-preview-index="${index}"`;
}

function detailGallery(item) {
  const images = imageList(item.productImages || item.productImage);
  if (!images.length) return imageBox("", item.type, "detail-image");
  const activeIndex = Math.min(state.detailImageIndex, images.length - 1);
  const activeImage = images[activeIndex];
  const thumbs = images.length > 1
    ? `<div class="detail-thumbs" aria-label="产品图片缩略图">${images.map((src, index) => `
        <button class="detail-thumb ${index === activeIndex ? "active" : ""}" type="button" data-detail-thumb="${index}" aria-label="查看第 ${index + 1} 张产品图">
          <img src="${escapeHtml(imageSrc(src))}" alt="产品图 ${index + 1}" loading="lazy">
        </button>
      `).join("")}</div>`
    : "";
  return `
    <div class="detail-gallery">
      <button class="detail-image has-image preview-trigger" type="button" ${previewAttrs(images, activeIndex)} aria-label="放大查看产品图">
        <img src="${escapeHtml(imageSrc(activeImage))}" alt="${escapeHtml(item.name || item.type)}" loading="lazy">
      </button>
      ${thumbs}
    </div>
  `;
}

function parseNumber(value) {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function cleanUploadCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return /^(nan|nat|none)$/i.test(text) ? "" : text;
}

function firstNumberFromUpload(...values) {
  for (const value of values) {
    const number = parseNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function uploadCell(row, index) {
  return cleanUploadCell(row[index]);
}

function uniqueUploadValues(values) {
  const seen = new Set();
  return values.map(cleanUploadCell).filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function uploadImageMapKey(sheetIndex, excelRow, excelCol) {
  return `${sheetIndex}:${excelRow}:${excelCol}`;
}

function uploadEmbeddedImages(imageMap, sheetIndex, itemIndex, indexes) {
  if (!imageMap) return [];
  const excelRow = itemIndex + 3;
  return indexes.flatMap((index) => imageMap.get(uploadImageMapKey(sheetIndex, excelRow, index + 1)) || []);
}

function uploadImages(row, indexes, imageMap, sheetIndex, itemIndex) {
  return uniqueUploadValues([
    ...uploadEmbeddedImages(imageMap, sheetIndex, itemIndex, indexes),
    ...indexes.map((index) => uploadCell(row, index)),
  ]).filter(isImagePath);
}

function uploadSheetRows(workbook, sheetIndex) {
  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName || !workbook.Sheets[sheetName]) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }).slice(2).filter((row) => row.some((cell) => cleanUploadCell(cell)));
}

function buildCupUploadItem(row, index, imageMap) {
  const productImages = uploadImages(row, [4, 5, 6, 7], imageMap, 0, index);
  const bottomImages = uploadImages(row, [22], imageMap, 0, index);
  const lidImages = uploadImages(row, [23], imageMap, 0, index);
  const specialImages = uploadImages(row, [34, 35], imageMap, 0, index);
  return {
    id: `cup-upload-${index + 1}`,
    type: "杯类",
    date: uploadCell(row, 0),
    market: uploadCell(row, 1),
    brand: uploadCell(row, 2),
    name: uploadCell(row, 3),
    productImages,
    productImage: productImages[0] || "",
    packageForm: uploadCell(row, 8),
    spec: uploadCell(row, 9),
    specValue: parseNumber(uploadCell(row, 9)),
    fillLineHeight: uploadCell(row, 10),
    cupBody: {
      "厚度 杯身/杯底（mm）": uploadCell(row, 11),
      "杯身重量（g）": uploadCell(row, 12),
      "口径（mm）": uploadCell(row, 13),
      "落杯直径（mm）": uploadCell(row, 14),
      "杯沿宽度(mm)": uploadCell(row, 15),
      "杯沿厚度（mm）": uploadCell(row, 16),
      "高度（mm）": uploadCell(row, 17),
      "底部直径/宽度（mm）": uploadCell(row, 18),
      "堆叠高度（mm）": uploadCell(row, 19),
      "杯底类型": uploadCell(row, 20),
      "底部抬高(mm)": uploadCell(row, 21),
      "杯底图片": bottomImages,
    },
    lid: {
      "盖、勺等其他配件组合方式": lidImages,
      "杯盖热封宽度（mm）": uploadCell(row, 24),
      "杯盖重量（g）": uploadCell(row, 25),
      "杯盖厚度（mm）": uploadCell(row, 26),
      "杯盖高度（mm）": uploadCell(row, 27),
    },
    material: {
      "模内贴/套标": uploadCell(row, 28),
      "盖膜": uploadCell(row, 29),
      "表面处理工艺": uploadCell(row, 30),
    },
    experience: {
      "握持手感": uploadCell(row, 31),
      "开启便捷性": uploadCell(row, 32),
      "饮用体验": uploadCell(row, 33),
    },
    special: {
      "图片": specialImages,
      "描述": uploadCell(row, 36),
      "借鉴点": uploadCell(row, 37),
    },
    mouthDiameter: parseNumber(uploadCell(row, 13)),
    heightValue: parseNumber(uploadCell(row, 17)),
    rimWidth: parseNumber(uploadCell(row, 15)),
    bottomType: uploadCell(row, 20),
    labelCraft: uploadCell(row, 28),
    filmFeature: uploadCell(row, 29),
  };
}

function buildBottleUploadItem(row, index, imageMap) {
  const productImages = uploadImages(row, [4, 5], imageMap, 1, index);
  const bottomImages = uploadImages(row, [13, 14], imageMap, 1, index);
  const specialImages = uploadImages(row, [24, 25], imageMap, 1, index);
  const material = uploadCell(row, 19);
  const label = uploadCell(row, 20);
  const surface = uploadCell(row, 21);
  const packageForm = [material, label].filter(Boolean).join(" / ");
  return {
    id: `bottle-upload-${index + 1}`,
    type: "瓶类",
    date: uploadCell(row, 0),
    market: uploadCell(row, 1),
    brand: uploadCell(row, 2),
    name: uploadCell(row, 3),
    productImages,
    productImage: productImages[0] || "",
    packageForm,
    spec: uploadCell(row, 6),
    specValue: parseNumber(uploadCell(row, 6)),
    mouthDiameterRaw: uploadCell(row, 7),
    nonScrewMouth: {
      "瓶口直径": uploadCell(row, 8),
      "瓶口外沿厚度": uploadCell(row, 9),
      "热封宽度": uploadCell(row, 10),
    },
    preformWeight: uploadCell(row, 11),
    openingTorque: uploadCell(row, 12),
    bottomImages,
    bottomImage: bottomImages[0] || "",
    fillLineHeight: uploadCell(row, 15),
    heightRaw: uploadCell(row, 16),
    widthDiameterRaw: uploadCell(row, 17),
    thicknessDistribution: uploadCell(row, 18),
    bodySize: {
      "高度（mm）": uploadCell(row, 16),
      "宽/直径(mm)": uploadCell(row, 17),
      "瓶身厚度分布 下/中/上（mm）": uploadCell(row, 18),
    },
    materialName: material,
    label,
    surface,
    experience: {
      "握持手感": uploadCell(row, 22),
      "饮用体验": uploadCell(row, 23),
    },
    special: {
      "图片": specialImages,
      "描述": uploadCell(row, 26),
      "借鉴点": uploadCell(row, 27),
    },
    mouthDiameter: firstNumberFromUpload(uploadCell(row, 7), uploadCell(row, 8)),
    heightValue: parseNumber(uploadCell(row, 16)),
    rimWidth: null,
    bottomType: bottomImages.length ? "有瓶底图" : "",
    labelCraft: label,
    filmFeature: "",
  };
}

function runtimeImageKey(item) {
  return [item.type, item.market, item.brand, item.name, item.spec].map((value) => cleanUploadCell(value)).join("|");
}

function mergeExistingImages(nextItems, previousItems) {
  const fallback = new Map(previousItems.map((item) => [runtimeImageKey(item), item]));
  nextItems.forEach((item) => {
    const previous = fallback.get(runtimeImageKey(item));
    if (!previous) return;
    if (!item.productImages?.length && previous.productImages?.length) {
      item.productImages = [...previous.productImages];
      item.productImage = item.productImages[0] || "";
    }
    if (item.type === "杯类") {
      if (!imageList(item.cupBody?.["杯底图片"]).length && imageList(previous.cupBody?.["杯底图片"]).length) item.cupBody["杯底图片"] = previous.cupBody["杯底图片"];
      if (!imageList(item.lid?.["盖、勺等其他配件组合方式"]).length && imageList(previous.lid?.["盖、勺等其他配件组合方式"]).length) item.lid["盖、勺等其他配件组合方式"] = previous.lid["盖、勺等其他配件组合方式"];
      if (!imageList(item.special?.["图片"]).length && imageList(previous.special?.["图片"]).length) item.special["图片"] = previous.special["图片"];
    } else {
      if (!item.bottomImages?.length && previous.bottomImages?.length) {
        item.bottomImages = [...previous.bottomImages];
        item.bottomImage = item.bottomImages[0] || "";
      }
      if (!imageList(item.special?.["图片"]).length && imageList(previous.special?.["图片"]).length) item.special["图片"] = previous.special["图片"];
    }
  });
  return nextItems;
}

function xmlNodesByLocalName(root, localName) {
  return Array.from(root.getElementsByTagName("*")).filter((node) => node.localName === localName);
}

function xmlFirstText(root, localName) {
  const node = xmlNodesByLocalName(root, localName)[0];
  return node ? node.textContent : "";
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, "application/xml");
}

function zipResolvePath(basePath, target) {
  if (!target) return "";
  if (/^\//.test(target)) return target.replace(/^\/+/, "");
  const parts = basePath.split("/");
  parts.pop();
  target.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}

function relsPathFor(partPath) {
  const parts = partPath.split("/");
  const file = parts.pop();
  return `${parts.join("/")}/_rels/${file}.rels`;
}

function parseRelsXml(xmlText) {
  const rels = new Map();
  const doc = parseXml(xmlText);
  xmlNodesByLocalName(doc, "Relationship").forEach((node) => {
    rels.set(node.getAttribute("Id"), node.getAttribute("Target"));
  });
  return rels;
}

function mimeFromPath(path) {
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.webp$/i.test(path)) return "image/webp";
  if (/\.bmp$/i.test(path)) return "image/bmp";
  return "image/png";
}

async function zipText(zip, path) {
  const file = zip.file(path);
  return file ? file.async("text") : "";
}

async function zipImageObjectUrl(zip, path) {
  const file = zip.file(path);
  if (!file) return "";
  const buffer = await file.async("arraybuffer");
  return URL.createObjectURL(new Blob([buffer], { type: mimeFromPath(path) }));
}

async function extractWorkbookImages(buffer, workbook) {
  if (!window.JSZip || !window.DOMParser) return { imageMap: new Map(), objectUrls: [] };
  const zip = await JSZip.loadAsync(buffer);
  const workbookRelsText = await zipText(zip, "xl/_rels/workbook.xml.rels");
  const workbookXmlText = await zipText(zip, "xl/workbook.xml");
  if (!workbookRelsText || !workbookXmlText) return { imageMap: new Map(), objectUrls: [] };
  const workbookRels = parseRelsXml(workbookRelsText);
  const workbookDoc = parseXml(workbookXmlText);
  const imageMap = new Map();
  const objectUrls = [];

  for (const sheetNode of xmlNodesByLocalName(workbookDoc, "sheet")) {
    const sheetName = sheetNode.getAttribute("name");
    const sheetIndex = workbook.SheetNames.indexOf(sheetName);
    if (sheetIndex < 0) continue;
    const relId = sheetNode.getAttribute("r:id") || sheetNode.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const sheetTarget = workbookRels.get(relId);
    const sheetPath = zipResolvePath("xl/workbook.xml", sheetTarget);
    const sheetXmlText = await zipText(zip, sheetPath);
    const sheetRelsText = await zipText(zip, relsPathFor(sheetPath));
    if (!sheetXmlText || !sheetRelsText) continue;
    const sheetDoc = parseXml(sheetXmlText);
    const sheetRels = parseRelsXml(sheetRelsText);
    const drawingRelId = xmlNodesByLocalName(sheetDoc, "drawing")[0]?.getAttribute("r:id")
      || xmlNodesByLocalName(sheetDoc, "drawing")[0]?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const drawingTarget = sheetRels.get(drawingRelId);
    if (!drawingTarget) continue;
    const drawingPath = zipResolvePath(sheetPath, drawingTarget);
    const drawingXmlText = await zipText(zip, drawingPath);
    const drawingRelsText = await zipText(zip, relsPathFor(drawingPath));
    if (!drawingXmlText || !drawingRelsText) continue;
    const drawingDoc = parseXml(drawingXmlText);
    const drawingRels = parseRelsXml(drawingRelsText);
    const anchors = [
      ...xmlNodesByLocalName(drawingDoc, "twoCellAnchor"),
      ...xmlNodesByLocalName(drawingDoc, "oneCellAnchor"),
    ];

    for (const anchor of anchors) {
      const from = xmlNodesByLocalName(anchor, "from")[0];
      const blip = xmlNodesByLocalName(anchor, "blip")[0];
      if (!from || !blip) continue;
      const row = Number(xmlFirstText(from, "row"));
      const col = Number(xmlFirstText(from, "col"));
      if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
      const embedId = blip.getAttribute("r:embed") || blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
      const mediaTarget = drawingRels.get(embedId);
      if (!mediaTarget) continue;
      const mediaPath = zipResolvePath(drawingPath, mediaTarget);
      const url = await zipImageObjectUrl(zip, mediaPath);
      if (!url) continue;
      objectUrls.push(url);
      const key = uploadImageMapKey(sheetIndex, row + 1, col + 1);
      if (!imageMap.has(key)) imageMap.set(key, []);
      imageMap.get(key).push(url);
    }
  }

  return { imageMap, objectUrls };
}

function disposeUploadedImageUrls(urls = uploadedImageObjectUrls) {
  urls.forEach((url) => URL.revokeObjectURL(url));
  if (urls === uploadedImageObjectUrls) uploadedImageObjectUrls = [];
}

function buildUploadData(workbook, sourceFile, previousItems, imageMap) {
  const cupItems = uploadSheetRows(workbook, 0).map((row, index) => buildCupUploadItem(row, index, imageMap)).filter((item) => item.market || item.brand || item.name);
  const bottleItems = uploadSheetRows(workbook, 1).map((row, index) => buildBottleUploadItem(row, index, imageMap)).filter((item) => item.market || item.brand || item.name);
  return {
    sourceFile,
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    items: mergeExistingImages([...cupItems, ...bottleItems], previousItems),
  };
}

function resetRuntimeStateAfterUpload() {
  state.search = "";
  state.filters = { markets: new Set(), brands: new Set(), packages: new Set(), crafts: new Set(), specs: new Set() };
  state.customMin = "";
  state.customMax = "";
  state.openFilter = null;
  state.resultSubsetIds = null;
  state.currentIndex = 0;
  state.detailImageIndex = 0;
  state.cupScatterPackage = "";
  state.bottleScatterMaterial = "";
  state.tableSearch = "";
  state.tableFilterColumn = "";
  state.tableFilterOperator = "contains";
  state.tableFilterValue = "";
  state.tableSortColumn = "";
  state.tableSortDirection = "asc";
  resetRecommendationState();
  if (!allItems.some((item) => item.type === state.type)) state.type = allItems[0]?.type || "杯类";
  if ($("#searchInput")) $("#searchInput").value = "";
}

function applyUploadedWorkbook(data) {
  rawData = data;
  allItems = data.items || [];
  $("#sourceFile").textContent = data.sourceFile || "竞品包装分析数据表";
  resetRuntimeStateAfterUpload();
  renderAll();
  setView("home");
}

async function handleWorkbookUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!window.XLSX) {
    alert("Excel 解析库未加载，请检查网络后重试，或在本地运行 build_data.py 生成 data.js 后部署。");
    return;
  }
  const sourceLabel = $("#sourceFile");
  const previousLabel = sourceLabel.textContent;
  sourceLabel.textContent = `正在读取：${file.name}`;
  let extractedImages = { imageMap: new Map(), objectUrls: [] };
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    sourceLabel.textContent = `正在读取图片：${file.name}`;
    extractedImages = await extractWorkbookImages(buffer, workbook);
    const data = buildUploadData(workbook, file.name, allItems, extractedImages.imageMap);
    if (!data.items.length) throw new Error("未在数据表前两个工作表中识别到竞品记录");
    disposeUploadedImageUrls();
    uploadedImageObjectUrls = extractedImages.objectUrls;
    applyUploadedWorkbook(data);
    alert(`已在当前页面替换为 ${file.name}，共读取 ${data.items.length} 条竞品数据，提取 ${extractedImages.objectUrls.length} 张内嵌图片。`);
  } catch (error) {
    disposeUploadedImageUrls(extractedImages.objectUrls);
    sourceLabel.textContent = previousLabel;
    alert(`数据表读取失败：${error.message || error}`);
  }
}

function typeItems() {
  return allItems.filter((item) => item.type === state.type);
}

function filteredItems() {
  return typeItems().filter((item) => {
    const searchText = [item.name, item.brand, item.market, item.packageForm, item.spec].join(" ").toLowerCase();
    if (state.search && !searchText.includes(state.search.toLowerCase())) return false;
    if (state.filters.markets.size && !state.filters.markets.has(item.market)) return false;
    if (state.filters.brands.size && !state.filters.brands.has(item.brand)) return false;
    if (state.filters.packages.size && ![...state.filters.packages].some((value) => String(item.packageForm || "").includes(value))) return false;
    if (state.filters.crafts.size && ![...state.filters.crafts].some((value) => splitTerms(item.labelCraft).includes(value))) return false;
    if (state.filters.specs.size && !state.filters.specs.has(specBucket(item.specValue))) return false;
    const min = parseNumber(state.customMin);
    const max = parseNumber(state.customMax);
    if (min !== null && (item.specValue === null || item.specValue < min)) return false;
    if (max !== null && (item.specValue === null || item.specValue > max)) return false;
    if (state.resultSubsetIds && !state.resultSubsetIds.has(item.id)) return false;
    return true;
  });
}

function specBucket(value) {
  if (value === null || value === undefined) return "未记录";
  const start = Math.floor(Math.max(1, value) / 100) * 100 + 1;
  const normalizedStart = value <= 100 ? 1 : start;
  const end = Math.min(1000, normalizedStart === 1 ? 100 : normalizedStart + 99);
  return value > 1000 ? "1000以上" : `${normalizedStart}-${end}`;
}

function counts(items) {
  return {
    market: uniq(items.map((item) => item.market)).length,
    brand: uniq(items.map((item) => item.brand)).length,
    product: items.length,
  };
}

function setView(view) {
  state.currentView = view;
  if (view === "detail") {
    const total = filteredItems().length;
    if (state.currentIndex >= total) state.currentIndex = 0;
    renderDetail();
  }
  $$(".view").forEach((node) => node.classList.toggle("active", node.id === view));
  $$(".tab").forEach((node) => node.classList.toggle("active", node.dataset.view === view));
  if (view === "recommend") renderRecommendation();
  if (view === "visual") renderCharts();
  if (view === "table") renderTable();
}

function button(label, active, onClick, className = "chip") {
  const node = document.createElement("button");
  node.className = `${className}${active ? " active" : ""}`;
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function filterSummary(key) {
  const selected = [...state.filters[key]];
  if (key === "specs") {
    const customRange = [state.customMin, state.customMax].filter(Boolean).join("-");
    if (selected.length || customRange) {
      return [...selected, customRange].filter(Boolean).slice(0, 2).join("、") + (selected.length > 2 ? ` +${selected.length - 2}` : "");
    }
  }
  if (!selected.length) return "全部";
  if (selected.length <= 2) return selected.join("、");
  return `${selected.slice(0, 2).join("、")} +${selected.length - 2}`;
}

function updateFilterTriggerSummary(key) {
  const summary = document.querySelector(`[data-filter="${key}"] .dropdown-trigger small`);
  if (summary) summary.textContent = filterSummary(key);
}

function renderFilters() {
  const typeFilter = $("#typeFilter");
  typeFilter.innerHTML = "";
  ["杯类", "瓶类"].forEach((type) => {
    typeFilter.appendChild(button(type, state.type === type, () => setType(type)));
  });

  const items = allItems.filter((item) => item.type === state.type);
  const groups = [
    ["市场", "markets", uniq(items.map((item) => item.market))],
    ["品牌", "brands", uniq(items.map((item) => item.brand))],
    ["包装形式", "packages", PACKAGE_FILTER_OPTIONS],
    ["标签工艺", "crafts", uniq(items.flatMap((item) => splitTerms(item.labelCraft)))],
    ["规格范围", "specs", ["1-100", "101-200", "201-300", "301-400", "401-500", "501-600", "601-700", "701-800", "801-900", "901-1000", "1000以上"]],
  ];

  $("#dynamicFilters").innerHTML = groups.map(([title, key, values]) => `
    <div class="filter-group dropdown-filter${state.openFilter === key ? " open" : ""}" data-filter="${key}">
      <button class="dropdown-trigger" type="button" aria-haspopup="true" aria-expanded="${state.openFilter === key ? "true" : "false"}">
        <span>
          <b>${title}</b>
          <small>${escapeHtml(filterSummary(key))}</small>
        </span>
        <i>⌄</i>
      </button>
      <div class="dropdown-menu" role="menu" aria-label="${title}">
        <div class="chip-wrap">${values.slice(0, 18).map((value) => `<button class="chip${state.filters[key].has(value) ? " active" : ""}" data-value="${escapeHtml(value)}" type="button">${escapeHtml(value)}</button>`).join("")}</div>
        ${key === "specs" ? '<div class="range-row"><input id="customMin" class="range-input" placeholder="自定义最小值" /><input id="customMax" class="range-input" placeholder="自定义最大值" /></div>' : ""}
      </div>
    </div>
  `).join("");

  $$("#dynamicFilters .dropdown-trigger").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      const key = node.closest("[data-filter]").dataset.filter;
      state.openFilter = state.openFilter === key ? null : key;
      renderFilters();
    });
  });
  $$("#dynamicFilters .chip").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      const key = node.closest("[data-filter]").dataset.filter;
      const value = node.dataset.value;
      state.filters[key].has(value) ? state.filters[key].delete(value) : state.filters[key].add(value);
      renderFilters();
    });
  });
  const minInput = $("#customMin");
  const maxInput = $("#customMax");
  if (minInput && maxInput) {
    minInput.value = state.customMin;
    maxInput.value = state.customMax;
    minInput.addEventListener("input", (event) => {
      state.customMin = event.target.value;
      updateFilterTriggerSummary("specs");
    });
    maxInput.addEventListener("input", (event) => {
      state.customMax = event.target.value;
      updateFilterTriggerSummary("specs");
    });
  }
}

function setType(type) {
  state.type = type;
  state.filters = { markets: new Set(), brands: new Set(), packages: new Set(), crafts: new Set(), specs: new Set() };
  state.customMin = "";
  state.customMax = "";
  state.openFilter = null;
  state.resultSubsetIds = null;
  renderAll();
}

function renderSummary() {
  const items = typeItems();
  const metric = counts(items);
  $("#marketCount").textContent = metric.market;
  $("#productCount").textContent = metric.product;
  $("#brandCount").textContent = metric.brand;
  $$(".big-pill").forEach((node) => node.classList.toggle("active", node.dataset.type === state.type));
}

function renderMap() {
  const map = $("#worldMap");
  const items = typeItems();
  const byMarket = buildMarketStats(items);
  const max = Math.max(1, ...[...byMarket.values()].map((stat) => stat.count));
  if (window.echarts && echarts.getMap && echarts.getMap("world")) {
    renderEChartsWorldMap(map, byMarket, max);
  } else {
    renderMapLoadError(map);
  }
}

function heatColor(level) {
  if (level > 0.75) return "#d8a84a";
  if (level > 0.45) return "#b86f50";
  if (level > 0.22) return "#6fa6a0";
  return "#9ab99c";
}

function buildMarketStats(items) {
  const byMarket = new Map();
  items.forEach((item) => {
    if (!item.market) return;
    const stat = byMarket.get(item.market) || { count: 0, brands: new Set(), items: [] };
    stat.count += 1;
    if (item.brand) stat.brands.add(item.brand);
    stat.items.push(item);
    byMarket.set(item.market, stat);
  });
  return byMarket;
}

function renderEChartsWorldMap(map, byMarket, max) {
  map.classList.add("echarts-ready");
  if (!worldMapChart) {
    map.innerHTML = "";
    worldMapChart = echarts.init(map, null, { renderer: "canvas" });
    window.addEventListener("resize", () => worldMapChart && worldMapChart.resize());
  }

  const mapData = new Map();
  [...byMarket.entries()].forEach(([market, stat]) => {
    const mapNames = countryNameMap[market] || [market];
    mapNames.forEach((name) => {
      const entry = mapData.get(name) || { name, value: 0, markets: [], brands: new Set() };
      entry.value += stat.count;
      entry.markets.push(market);
      stat.brands.forEach((brand) => entry.brands.add(brand));
      mapData.set(name, entry);
    });
  });
  const data = [...mapData.values()].map((entry) => ({
    name: entry.name,
    value: entry.value,
    market: entry.markets.join(" / "),
    brandCount: entry.brands.size,
  }));
  const visualMax = Math.max(max, ...data.map((entry) => entry.value));

  worldMapChart.setOption({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      borderColor: "#d6ccb7",
      backgroundColor: "rgba(255, 253, 247, 0.96)",
      textStyle: { color: "#283126" },
      formatter(params) {
        if (!params.data || !params.data.value) return `${params.name}<br/>暂无竞品数据`;
        return `${params.data.market}<br/>竞品数量：${params.data.value}<br/>品牌总数：${params.data.brandCount}`;
      },
    },
    visualMap: {
      min: 0,
      max: visualMax,
      left: 16,
      bottom: 18,
      calculable: true,
      text: ["高", "低"],
      textStyle: { color: "#4f5a48" },
      inRange: { color: ["#edf2e6", "#b8d7b1", "#70b4a9", "#d8a84a", "#b86f50"] },
      outOfRange: { color: "#edf2e6" },
    },
    series: [
      {
        name: "竞品分布",
        type: "map",
        map: "world",
        roam: true,
        scaleLimit: { min: 1, max: 8 },
        zoom: worldMapZoom,
        emphasis: {
          label: { show: false },
          itemStyle: { areaColor: "#d8a84a", borderColor: "#fffdf7", borderWidth: 1.2 },
        },
        select: {
          itemStyle: { areaColor: "#b86f50" },
          label: { show: false },
        },
        itemStyle: {
          areaColor: "#edf2e6",
          borderColor: "#fffdf7",
          borderWidth: 0.8,
        },
        data,
      },
    ],
  }, true);

  worldMapChart.off("click");
  worldMapChart.on("click", (params) => {
    if (!params.data || !params.data.value) return;
    updateCountryInfo(params.data.market, params.data.value, params.data.brandCount);
  });
  window.setTimeout(() => worldMapChart && worldMapChart.resize(), 0);
}

function renderMapLoadError(map) {
  if (worldMapChart) {
    worldMapChart.dispose();
    worldMapChart = null;
  }
  map.classList.remove("echarts-ready");
  map.innerHTML = '<div class="map-load-error">完整世界地图数据未加载，请确认 assets/vendor/echarts.min.js 与 assets/vendor/world.js 存在。</div>';
}

function updateCountryInfo(market, count, brandCount) {
  const panel = $("#countryInfo");
  if (panel) panel.innerHTML = `<strong>${escapeHtml(market)}</strong><span>竞品数量：${count}</span><span>品牌总数：${brandCount}</span>`;
}

function updateMapZoom(nextZoom) {
  if (!worldMapChart) return;
  worldMapZoom = Math.max(1, Math.min(8, nextZoom));
  worldMapChart.setOption({ series: [{ zoom: worldMapZoom }] });
}

function renderSelected() {
  const selected = [
    ["类别", state.type],
    ["搜索词", state.search],
    ["市场", [...state.filters.markets].join("、")],
    ["品牌", [...state.filters.brands].join("、")],
    ["包装形式", [...state.filters.packages].join("、")],
    ["标签工艺", [...state.filters.crafts].join("、")],
    ["规格范围", [...state.filters.specs].join("、") || [state.customMin, state.customMax].filter(Boolean).join("-")],
    ["推荐条件", state.resultSubsetIds ? `来自开发推荐的 ${state.resultSubsetIds.size} 条参照竞品` : ""],
  ].filter(([, value]) => value);
  $("#selectedFilters").innerHTML = selected.length
    ? selected.map(([label, value]) => `<div class="selected-item"><b>${label}</b><br>${escapeHtml(value)}</div>`).join("")
    : '<div class="selected-item">暂无筛选条件</div>';
}

function renderCards() {
  const items = filteredItems();
  $("#resultCount").textContent = items.length;
  $("#productCards").innerHTML = items.map((item, index) => `
    <button class="product-card ${item.type === "瓶类" ? "bottle-card" : ""}" data-index="${index}">
      ${imageBox(firstProductImage(item), item.name || item.type, `product-art ${item.type === "瓶类" ? "bottle-art" : ""}`)}
      <div>
        <h3>${escapeHtml(item.name || "未命名产品")}</h3>
        <div class="info-list">
          <span><b>市场：</b>${escapeHtml(compactText(item.market))}</span>
          <span><b>品牌：</b>${escapeHtml(compactText(item.brand))}</span>
          <span><b>规格：</b>${escapeHtml(compactText(item.spec))}</span>
          <span><b>包装形式：</b>${escapeHtml(compactText(item.packageForm))}</span>
        </div>
      </div>
    </button>
  `).join("") || '<div class="selected-item">没有匹配结果，请调整筛选条件。</div>';
  $$(".product-card").forEach((card) => card.addEventListener("click", () => {
    state.currentIndex = Number(card.dataset.index);
    state.detailImageIndex = 0;
    renderDetail();
    setView("detail");
  }));
}

function renderDetail() {
  const item = filteredItems()[state.currentIndex] || filteredItems()[0];
  if (!item) {
    $("#detailContent").innerHTML = '<div class="selected-item">暂无产品详情。</div>';
    return;
  }
  const cupBodyImage = valueByKeys(item.cupBody, ["杯底图片", "杯底图片-1"]);
  const cupBodyData = omitKeys(item.cupBody, ["杯底图片", "杯底图片-1"]);
  const cupLidCombo = valueByKeys(item.lid, ["盖、勺等其他配件组合方式", "盖、勺等其他配件组合方式-1"]);
  const cupLidData = omitKeys(item.lid, ["盖、勺等其他配件组合方式", "盖、勺等其他配件组合方式-1"]);
  const cupSpecialImages = valueByKeys(item.special, ["图片", "图片-1/2", "图片-1", "图片-2"]);
  const cupSpecial = {
    图片: cupSpecialImages,
    描述: item.special?.描述,
  };
  const cupBorrow = {
    借鉴点: item.special?.借鉴点,
  };
  const bottleSpecial = {
    图片: valueByKeys(item.special, ["图片"]),
    描述: item.special?.描述,
  };
  const bottleBorrow = {
    借鉴点: item.special?.借鉴点,
  };
  const basic = item.type === "杯类"
    ? { 产品名称: item.name, 市场: item.market, 品牌: item.brand, 包装形式: item.packageForm, 规格: item.spec, 液位线高度: item.fillLineHeight }
    : { 产品名称: item.name, 市场: item.market, 品牌: item.brand, 包装形式: item.packageForm, 规格: item.spec, 液位线高度: item.fillLineHeight, 旋盖瓶口直径: item.mouthDiameterRaw, 瓶胚克重: item.preformWeight, 开启扭力: item.openingTorque, 瓶底图片: item.bottomImages || item.bottomImage };
  $("#detailContent").innerHTML = item.type === "杯类" ? `
    <div class="detail-row hero cup-hero">
      ${detailGallery(item)}
      ${detailCard("基本信息", basic)}
    </div>
    <div class="detail-row two media-row">${detailCard("杯身尺寸数据", cupBodyData)}${mediaCard("杯底图片", cupBodyImage)}</div>
    <div class="detail-row two media-row">${detailCard("杯盖尺寸数据", cupLidData)}${mediaCard("盖、勺等其他配件组合方式", cupLidCombo)}</div>
    <div class="detail-row four">${detailCard("材质与工艺", item.material)}${detailCard("功能与体验", item.experience)}${detailCard("特殊点", cupSpecial)}${detailCard("借鉴点", cupBorrow)}</div>
  ` : `
    <div class="detail-row hero bottle-hero">
      ${detailGallery(item)}
      ${detailCard("基本信息", basic)}
    </div>
    <div class="detail-row three">${detailCard("非旋盖类瓶口", item.nonScrewMouth || { 瓶口直径: item.mouthDiameterRaw, 开启扭力: item.openingTorque })}${detailCard("瓶身尺寸信息", item.bodySize || { 高度: item.heightRaw, "宽/直径": item.widthDiameterRaw, "厚度分布 下/中/上": item.thicknessDistribution })}${detailCard("特殊点", bottleSpecial, "adaptive-image-card")}</div>
    <div class="detail-row three">${detailCard("材质与工艺", { 瓶身材质: item.materialName, 标签: item.label, 表面处理工艺: item.surface })}${detailCard("用户体验", item.experience)}${detailCard("借鉴点", bottleBorrow)}</div>
  `;
  syncHeroImageHeight();
  syncMediaRows();
}

function valueByKeys(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (Array.isArray(value) ? value.length : value) return value;
  }
  return "";
}

function omitKeys(data, keys) {
  const blocked = new Set(keys);
  return Object.fromEntries(Object.entries(data || {}).filter(([key]) => !blocked.has(key)));
}

function detailCard(title, data, className = "") {
  return `<article class="detail-card${className ? ` ${className}` : ""}"><h3>${title}</h3><div class="kv-grid">${Object.entries(data || {}).map(([key, value]) => `<div class="kv"><b>${escapeHtml(key)}：</b>${detailValue(value)}</div>`).join("")}</div></article>`;
}

function mediaCard(title, value) {
  const values = Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
  const images = values.filter(isImagePath);
  const texts = values.filter((entry) => !isImagePath(entry));
  const imageHtml = images.length
    ? `<div class="image-strip media-strip">${images.map((src, index) => `<button class="image-thumb preview-trigger" type="button" ${previewAttrs(images, index)}><img src="${escapeHtml(imageSrc(src))}" alt="${escapeHtml(title)}" loading="lazy"></button>`).join("")}</div>`
    : "";
  const textHtml = texts.length ? `<div class="media-text">${escapeHtml(texts.join("、"))}</div>` : "";
  return `<article class="detail-card media-card adaptive-image-card"><h3>${title}</h3>${imageHtml}${textHtml || (!imageHtml ? '<div class="media-text">未记录</div>' : "")}</article>`;
}

function syncHeroImageHeight() {
  requestAnimationFrame(() => {
    const hero = $("#detailContent .detail-row.hero");
    const basicCard = hero?.querySelector(".detail-card");
    if (!hero || !basicCard) return;
    const height = Math.ceil(basicCard.scrollHeight);
    hero.style.setProperty("--hero-info-height", `${height}px`);
  });
}

function syncMediaRows() {
  requestAnimationFrame(() => {
    $$("#detailContent .detail-row.media-row").forEach((row) => {
      row.style.removeProperty("--media-row-height");
      const dataCard = row.querySelector(".detail-card:not(.media-card)");
      const mediaCard = row.querySelector(".media-card");
      if (!dataCard || !mediaCard || window.innerWidth <= 980) return;
      const height = Math.ceil(dataCard.scrollHeight);
      row.style.setProperty("--media-row-height", `${height}px`);
    });
  });
}

function aggregate(items, key, limit = 8) {
  const map = new Map();
  items.forEach((item) => {
    const value = typeof key === "function" ? key(item) : item[key];
    if (!value) return;
    map.set(value, (map.get(value) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function renderCharts() {
  const items = filteredItems();
  const marketTitle = state.type === "杯类" ? "杯类市场分布框" : "瓶类市场分布情况";
  const charts = [
    marketPieChart(marketTitle, aggregate(items, "market", 99)),
    state.type === "瓶类"
      ? marketPieChart("瓶身材质分布情况", aggregate(items, (item) => item.materialName || "未知", 99), { labelLimit: null, wide: false })
      : marketPieChart("杯身包装形式分布情况", aggregate(items, (item) => cupBodyPackageTerm(item.packageForm), 99), { labelLimit: null, wide: false }),
    fillLineHistogram(items),
    barChart("标签工艺横向条形图", aggregate(items, "labelCraft", 8)),
    state.type === "瓶类"
      ? bottleThicknessScatterChart(items)
      : cupThicknessScatterChart(items),
  ];
  if (state.type === "杯类") {
    charts.splice(
      3,
      0,
      barChart("杯底类型横向条形图", aggregate(items, (item) => bottomTypeKey(item.bottomType), 8)),
      barChart("杯沿宽度分布图表", aggregate(items, (item) => item.rimWidth ? `${Math.floor(item.rimWidth)}-${Math.floor(item.rimWidth) + 1}mm` : "", 8)),
      barChart("杯沿厚度分布图表", numericBucketDistribution(items, (item) => item.cupBody?.["杯沿厚度（mm）"], 0.2, "mm", 8)),
      barChart("底部抬高分布图表", numericBucketDistribution(items, (item) => item.cupBody?.["底部抬高(mm)"], 1, "mm", 8)),
      barChart("盖膜特性统计图表", aggregate(items, "filmFeature", 6)),
    );
  }
  $("#charts").innerHTML = charts.join("");
}

function averageBy(items, groupKey, valueKey) {
  const map = new Map();
  items.forEach((item) => {
    const group = item[groupKey];
    const value = item[valueKey];
    if (!group || value === null || value === undefined) return;
    const data = map.get(group) || { sum: 0, count: 0 };
    data.sum += Number(value);
    data.count += 1;
    map.set(group, data);
  });
  return [...map.entries()].map(([key, value]) => [key, Number((value.sum / value.count).toFixed(1))]).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function barChart(title, rows) {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return `<article class="chart-card"><h3>${title}</h3><div class="chart-body">${rows.map(([label, value]) => `
    <div class="bar-row"><span title="${escapeHtml(label)}">${escapeHtml(label)}</span><div class="bar-track"><div class="bar" style="width:${(value / max) * 100}%"></div></div><b>${value}</b></div>
  `).join("") || "暂无可统计数据"}</div></article>`;
}

function numericBucketDistribution(items, getter, step, unit = "", limit = 8) {
  const counts = new Map();
  items.forEach((item) => {
    const value = parseNumber(getter(item));
    if (value === null) return;
    const start = Math.floor(value / step) * step;
    const end = start + step;
    const label = `${formatNumber(start)}-${formatNumber(end)}${unit}`;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function fillLineHistogram(items) {
  const values = items.map((item) => parseNumber(item.fillLineHeight)).filter((value) => value !== null);
  if (!values.length) {
    return `<article class="chart-card wide histogram-card"><div class="chart-title-row"><h3>液位线</h3><span>仅统计有数据记录</span></div><div class="recommend-empty compact">暂无可统计数据</div></article>`;
  }
  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  const bins = [];
  for (let start = min; start <= max; start += 1) {
    const end = start + 1;
    bins.push({
      label: `${start}mm`,
      count: values.filter((value) => value >= start && value < end).length,
    });
  }
  const peak = Math.max(1, ...bins.map((bin) => bin.count));
  const width = 720;
  const height = 300;
  const plot = { left: 54, top: 30, right: 690, bottom: 220 };
  const step = (plot.right - plot.left) / Math.max(1, bins.length);
  const barWidth = Math.max(5, step * 0.48);
  const yMax = Math.max(5, Math.ceil(peak / 5) * 5);
  const yScale = (value) => plot.bottom - (value / yMax) * (plot.bottom - plot.top);
  const yTicks = Array.from({ length: Math.floor(yMax / 5) + 1 }, (_, index) => index * 5);
  return `<article class="chart-card wide histogram-card"><div class="chart-title-row"><h3>液位线</h3><span>仅统计有数据记录</span></div><svg class="histogram-mini" viewBox="0 0 ${width} ${height}" role="img" aria-label="液位线分布直方图">
    <defs><linearGradient id="fillLineBarGradient" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#4f7d58"/><stop offset="100%" stop-color="#d8a84a"/></linearGradient></defs>
    ${yTicks.map((tick) => `<line x1="${plot.left}" y1="${yScale(tick)}" x2="${plot.right}" y2="${yScale(tick)}" stroke="#e6decf" stroke-width="0.8"/><text x="${plot.left - 12}" y="${yScale(tick) + 3}" text-anchor="end" font-size="10" fill="#9aa097">${formatNumber(tick)}</text>`).join("")}
    ${bins.map((bin, index) => {
    const x = plot.left + index * step + (step - barWidth) / 2;
    const barHeight = plot.bottom - yScale(bin.count);
    const y = yScale(bin.count);
    const centerX = x + barWidth / 2;
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" fill="url(#fillLineBarGradient)"><title>${escapeHtml(bin.label)}：${bin.count}</title></rect>
      ${bin.count ? `<text x="${centerX}" y="${Math.max(plot.top + 10, y - 7)}" text-anchor="middle" font-size="10" font-weight="700" fill="#4f7d58">${bin.count}</text>` : ""}
      <text x="${centerX}" y="${plot.bottom + 28}" text-anchor="end" font-size="10" fill="#8a9187" transform="rotate(-45 ${centerX} ${plot.bottom + 28})">${escapeHtml(bin.label)}</text>`;
  }).join("")}
    <circle cx="${plot.left}" cy="14" r="4" fill="#4f7d58"/><text x="${plot.left + 12}" y="18" font-size="11" fill="#6c7564">计数</text>
    <line x1="${plot.left}" y1="${plot.bottom}" x2="${plot.right}" y2="${plot.bottom}" stroke="#d6ccb7"/>
  </svg></article>`;
}

function pieChart(title, rows) {
  const total = rows.reduce((sum, [, value]) => sum + value, 0) || 1;
  let start = 0;
  const colors = ["#4f7d58", "#d8a84a", "#b86f50", "#6fa6a0", "#9ab99c", "#8a7158", "#8f9b6b"];
  const gradient = rows.map(([, value], index) => {
    const end = start + (value / total) * 100;
    const segment = `${colors[index % colors.length]} ${start}% ${end}%`;
    start = end;
    return segment;
  }).join(",");
  return `<article class="chart-card"><h3>${title}</h3><div class="pie" style="background:conic-gradient(${gradient || "#d6ccb7 0 100%"})"></div><div>${rows.map(([label, value]) => `<span class="chip">${escapeHtml(label)} ${value}</span>`).join(" ")}</div></article>`;
}

function marketPieChart(title, rows, options = {}) {
  const { labelLimit = 6, wide = true } = options;
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  const cardClass = wide ? "chart-card market-pie-card wide" : "chart-card market-pie-card";
  if (!total) return `<article class="${cardClass}"><h3>${title}</h3><div class="recommend-empty compact">暂无可统计数据</div></article>`;
  const colors = ["#f47b4f", "#bfdc5a", "#f1c94d", "#f5a52f", "#5d9b82", "#b6a77e", "#bf774a", "#85a83f", "#8cc5be", "#e49b62", "#4f9319", "#69b8a4", "#d57d00", "#d66a23", "#bd7046", "#9bb25b", "#c6a23f", "#76a7d3"];
  const center = { x: 360, y: 190 };
  const radius = 104;
  let start = 0;
  const slices = rows.map(([label, value], index) => {
    const angle = (value / total) * 360;
    const end = start + angle;
    const mid = start + angle / 2;
    const color = colors[index % colors.length];
    const data = { label, value, color, start, end, mid, percent: (value / total) * 100 };
    start = end;
    return data;
  });
  const paths = slices.map((slice) => `<path d="${piePath(center.x, center.y, radius, slice.start, slice.end)}" fill="${slice.color}" stroke="#fffdf7" stroke-width="2"><title>${escapeHtml(slice.label)}：${slice.value} (${formatPercent(slice.percent)})</title></path>`).join("");
  const labeledSlices = labelLimit === null ? slices : slices.slice(0, labelLimit);
  const labelSlices = labeledSlices.map((slice) => {
    const rightSide = Math.cos((slice.mid - 90) * Math.PI / 180) >= 0;
    const elbow = polarPoint(center.x, center.y, radius + 22, slice.mid);
    return {
      slice,
      side: rightSide ? "right" : "left",
      targetY: Math.max(62, Math.min(320, elbow.y)),
    };
  });
  const spreadLabels = (items) => {
    const minGap = 28;
    const minY = 58;
    const maxY = 322;
    const sorted = [...items].sort((a, b) => a.targetY - b.targetY);
    sorted.forEach((item, index) => {
      item.labelY = index ? Math.max(item.targetY, sorted[index - 1].labelY + minGap) : item.targetY;
    });
    const overflow = sorted.length ? sorted[sorted.length - 1].labelY - maxY : 0;
    if (overflow > 0) {
      sorted.forEach((item) => {
        item.labelY -= overflow;
      });
    }
    sorted.forEach((item, index) => {
      const floor = index ? sorted[index - 1].labelY + minGap : minY;
      item.labelY = Math.max(floor, item.labelY);
    });
    return sorted;
  };
  const positionedLabels = [
    ...spreadLabels(labelSlices.filter((item) => item.side === "left")),
    ...spreadLabels(labelSlices.filter((item) => item.side === "right")),
  ];
  const labels = positionedLabels.map(({ slice, side, labelY }) => {
    const edge = polarPoint(center.x, center.y, radius + 2, slice.mid);
    const elbow = polarPoint(center.x, center.y, radius + 20, slice.mid);
    const rightSide = side === "right";
    const textX = rightSide ? (wide ? 590 : 570) : (wide ? 145 : 170);
    const anchor = rightSide ? "start" : "end";
    const lineEndX = rightSide ? textX - 10 : textX + 10;
    return `
      <polyline points="${edge.x.toFixed(1)},${edge.y.toFixed(1)} ${elbow.x.toFixed(1)},${labelY.toFixed(1)} ${lineEndX},${labelY.toFixed(1)}" fill="none" stroke="#d6ccb7" stroke-width="1"/>
      <text x="${textX}" y="${labelY + 4}" text-anchor="${anchor}" font-size="12" fill="#4f5a48">${escapeHtml(slice.label)}: ${slice.value} (${formatPercent(slice.percent)})</text>
    `;
  }).join("");
  const legend = slices.map((slice) => `<span><i style="background:${slice.color}"></i>${escapeHtml(slice.label)}</span>`).join("");
  return `
    <article class="${cardClass}">
      <h3>${title}</h3>
      <div class="market-pie-legend">${legend}</div>
      <svg class="market-pie" viewBox="0 0 720 360" role="img" aria-label="${escapeHtml(title)}">
        ${paths}
        ${labels}
      </svg>
    </article>
  `;
}

function polarPoint(cx, cy, radius, angle) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function piePath(cx, cy, radius, startAngle, endAngle) {
  if (endAngle - startAngle >= 360) endAngle = startAngle + 359.99;
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

function formatPercent(value) {
  return `${Number(value).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function interpolateColor(start, end, ratio) {
  const parse = (hex) => hex.replace("#", "").match(/.{2}/g).map((part) => parseInt(part, 16));
  const [r1, g1, b1] = parse(start);
  const [r2, g2, b2] = parse(end);
  const mix = (a, b) => Math.round(a + (b - a) * Math.max(0, Math.min(1, ratio))).toString(16).padStart(2, "0");
  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`;
}

function scatterChart(title, items) {
  const points = items
    .filter((item) => item.mouthDiameter && item.heightValue)
    .map((item) => ({ item, x: item.mouthDiameter, y: item.heightValue }));
  return numericScatterChart(title, points, "口径（mm）", "高度（mm）");
}

function cupShapeIndexAnalysisChart(items) {
  const points = items.map((item) => {
    const diameter = parseNumber(item.cupBody?.["口径（mm）"]) ?? item.mouthDiameter;
    const height = parseNumber(item.cupBody?.["高度（mm）"]) ?? item.heightValue;
    const spec = item.specValue ?? parseNumber(item.spec);
    if (!diameter || !height || spec === null) return null;
    return {
      item,
      diameter,
      height,
      spec,
      index: Number((height / diameter).toFixed(2)),
      market: item.market || "未知市场",
    };
  }).filter(Boolean);
  if (!points.length) {
    return `<article class="chart-card full shape-index-card"><h3>杯类竞品产品形态指数分布分析</h3><div class="recommend-empty compact">暂无可统计数据</div></article>`;
  }
  const width = 920;
  const height = 430;
  const hist = { left: 58, top: 54, right: 430, bottom: 335 };
  const scatter = { left: 505, top: 54, right: 880, bottom: 335 };
  const rawMin = Math.min(...points.map((point) => point.index));
  const rawMax = Math.max(...points.map((point) => point.index));
  const minX = Math.floor(rawMin * 10) / 10;
  const maxX = Math.ceil(rawMax * 10) / 10;
  const xScaleHist = (value) => hist.left + ((value - minX) / (maxX - minX || 1)) * (hist.right - hist.left);
  const xScaleScatter = (value) => scatter.left + ((value - minX) / (maxX - minX || 1)) * (scatter.right - scatter.left);
  const specExtent = paddedExtent(points.map((point) => point.spec));
  const yScaleSpec = (value) => scatter.bottom - ((value - specExtent.min) / (specExtent.max - specExtent.min || 1)) * (scatter.bottom - scatter.top);
  const bins = [];
  for (let start = minX; start < maxX; start = Number((start + 0.1).toFixed(1))) {
    const end = Number((start + 0.1).toFixed(1));
    const members = points.filter((point) => point.index >= start && (point.index < end || (end >= maxX && point.index <= end)));
    bins.push({ start, end, members, count: members.length });
  }
  const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
  const yScaleCount = (value) => hist.bottom - (value / maxCount) * (hist.bottom - hist.top);
  const xTicks = axisTicks(minX, maxX);
  const specTicks = axisTicks(specExtent.min, specExtent.max);
  const countTicks = axisTicks(0, maxCount);
  const marketColors = ["#4f7d58", "#b86f50", "#d8a84a", "#6fa6a0", "#8a7158", "#9ab99c", "#bf774a", "#85a83f", "#8cc5be", "#e49b62"];
  const markets = uniq(points.map((point) => point.market));
  const colorForMarket = (market) => marketColors[Math.max(0, markets.indexOf(market)) % marketColors.length];
  const histGrid = [
    ...xTicks.map((tick) => `<line x1="${xScaleHist(tick)}" y1="${hist.top}" x2="${xScaleHist(tick)}" y2="${hist.bottom}" stroke="#fff" stroke-opacity="0.5" stroke-width="0.7"/>`),
    ...countTicks.map((tick) => `<line x1="${hist.left}" y1="${yScaleCount(tick)}" x2="${hist.right}" y2="${yScaleCount(tick)}" stroke="#fff" stroke-opacity="0.5" stroke-width="0.7"/>`),
  ].join("");
  const scatterGrid = [
    ...xTicks.map((tick) => `<line x1="${xScaleScatter(tick)}" y1="${scatter.top}" x2="${xScaleScatter(tick)}" y2="${scatter.bottom}" stroke="#fff" stroke-opacity="0.5" stroke-width="0.7"/>`),
    ...specTicks.map((tick) => `<line x1="${scatter.left}" y1="${yScaleSpec(tick)}" x2="${scatter.right}" y2="${yScaleSpec(tick)}" stroke="#fff" stroke-opacity="0.5" stroke-width="0.7"/>`),
  ].join("");
  const barWidth = Math.max(4, (hist.right - hist.left) / Math.max(1, bins.length) - 2);
  const bars = bins.map((bin) => {
    const x = xScaleHist(bin.start) + 1;
    const y = yScaleCount(bin.count);
    const ratio = (bin.start - minX) / (maxX - minX || 1);
    const color = interpolateColor("#d99058", "#6fa6a0", ratio);
    const names = bin.members.map((point) => point.item.name || "未命名产品").join("、") || "无产品";
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${hist.bottom - y}" fill="${color}" rx="2"><title>${formatNumber(bin.start)}-${formatNumber(bin.end)}：${names}</title></rect>`;
  }).join("");
  const boundaryXHist = xScaleHist(0.75);
  const boundaryXScatter = xScaleScatter(0.75);
  const extremes = [
    ...points.slice().sort((a, b) => a.index - b.index).slice(0, 3).map((point) => ({ ...point, type: "low" })),
    ...points.slice().sort((a, b) => b.index - a.index).slice(0, 3).map((point) => ({ ...point, type: "high" })),
  ];
  const extremeIds = new Set(extremes.map((point) => point.item.id));
  const scatterPoints = points.map((point) => `<circle cx="${xScaleScatter(point.index)}" cy="${yScaleSpec(point.spec)}" r="4.5" fill="${colorForMarket(point.market)}" fill-opacity="0.82" stroke="#fff" stroke-width="0.5">
    <title>${escapeHtml(cupShapeIndexHover(point))}</title>
  </circle>`).join("");
  const labels = extremes.map((point, index) => {
    const x = Math.min(scatter.right - 58, xScaleScatter(point.index) + 8);
    const y = Math.max(scatter.top + 12, Math.min(scatter.bottom - 8, yScaleSpec(point.spec) - 7 + (index % 2) * 14));
    return `<text x="${x}" y="${y}" font-size="9" fill="${point.type === "low" ? "#b86f50" : "#4f7d58"}">${escapeHtml(shortProductLabel(point.item))}</text>`;
  }).join("");
  const tickLabels = [
    ...xTicks.map((tick) => `<text x="${xScaleHist(tick)}" y="353" text-anchor="middle" font-size="9" fill="#6c7564">${formatNumber(tick)}</text>`),
    ...xTicks.map((tick) => `<text x="${xScaleScatter(tick)}" y="353" text-anchor="middle" font-size="9" fill="#6c7564">${formatNumber(tick)}</text>`),
    ...countTicks.map((tick) => `<text x="50" y="${yScaleCount(tick) + 3}" text-anchor="end" font-size="9" fill="#6c7564">${formatNumber(tick)}</text>`),
    ...specTicks.map((tick) => `<text x="497" y="${yScaleSpec(tick) + 3}" text-anchor="end" font-size="9" fill="#6c7564">${formatNumber(tick)}</text>`),
  ].join("");
  return `
    <article class="chart-card full shape-index-card">
      <h3>杯类竞品产品形态指数分布分析</h3>
      <svg class="shape-index-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="杯类竞品产品形态指数分布分析">
        <text x="${(hist.left + hist.right) / 2}" y="27" text-anchor="middle" font-size="12" font-weight="700" fill="#263225">形态指数直方图</text>
        <text x="${(scatter.left + scatter.right) / 2}" y="27" text-anchor="middle" font-size="12" font-weight="700" fill="#263225">形态指数 × 规格散点图</text>
        ${histGrid}
        ${scatterGrid}
        <line x1="${hist.left}" y1="${hist.bottom}" x2="${hist.right}" y2="${hist.bottom}" stroke="#6c7564"/>
        <line x1="${hist.left}" y1="${hist.top}" x2="${hist.left}" y2="${hist.bottom}" stroke="#6c7564"/>
        <line x1="${scatter.left}" y1="${scatter.bottom}" x2="${scatter.right}" y2="${scatter.bottom}" stroke="#6c7564"/>
        <line x1="${scatter.left}" y1="${scatter.top}" x2="${scatter.left}" y2="${scatter.bottom}" stroke="#6c7564"/>
        ${bars}
        <line x1="${boundaryXHist}" y1="${hist.top}" x2="${boundaryXHist}" y2="${hist.bottom}" stroke="#b86f50" stroke-width="1.2" stroke-dasharray="5 5"/>
        <text x="${Math.max(hist.left + 36, boundaryXHist - 58)}" y="${hist.top + 16}" font-size="10" fill="#b86f50">矮胖型</text>
        <text x="${Math.min(hist.right - 48, boundaryXHist + 8)}" y="${hist.top + 16}" font-size="10" fill="#4f7d58">高瘦型</text>
        <line x1="${boundaryXScatter}" y1="${scatter.top}" x2="${boundaryXScatter}" y2="${scatter.bottom}" stroke="#b86f50" stroke-width="1.2" stroke-dasharray="5 5"/>
        ${scatterPoints}
        ${labels}
        ${tickLabels}
        <text x="${(hist.left + hist.right) / 2}" y="382" text-anchor="middle" font-size="11" fill="#263225">形态指数</text>
        <text x="${(scatter.left + scatter.right) / 2}" y="382" text-anchor="middle" font-size="11" fill="#263225">形态指数</text>
        <text x="15" y="${(hist.top + hist.bottom) / 2}" transform="rotate(-90 15 ${(hist.top + hist.bottom) / 2})" text-anchor="middle" font-size="11" fill="#263225">产品数量</text>
        <text x="462" y="${(scatter.top + scatter.bottom) / 2}" transform="rotate(-90 462 ${(scatter.top + scatter.bottom) / 2})" text-anchor="middle" font-size="11" fill="#263225">规格_g</text>
      </svg>
    </article>
  `;
}

function cupThicknessScatterChart(items) {
  const points = items.map((item) => {
    const thickness = cupThicknessPair(item.cupBody?.["厚度 杯身/杯底（mm）"]);
    return {
      item,
      x: thickness.body,
      y: parsePrimaryWeight(item.cupBody?.["杯身重量（g）"]),
      bottomThickness: thickness.bottom,
      spec: item.specValue ?? parseNumber(item.spec),
      market: item.market || "未知市场",
      packageTerm: primaryPackageTerm(item.packageForm),
    };
  }).filter((point) => point.x !== null && point.y !== null);
  return cupWeightThicknessScatter(points);
}

function cupWeightThicknessScatter(points) {
  if (!points.length) {
    return `<article class="chart-card full"><h3>杯身克重 × 壁厚关系散点图</h3><div class="recommend-empty compact">暂无可统计数据</div></article>`;
  }
  const allPackageTerms = uniq(points.map((point) => point.packageTerm));
  const selectedPackage = state.cupScatterPackage && allPackageTerms.includes(state.cupScatterPackage) ? state.cupScatterPackage : "";
  const visiblePoints = selectedPackage ? points.filter((point) => point.packageTerm === selectedPackage) : points;
  const plot = { left: 72, top: 58, right: 690, bottom: 340 };
  const width = 920;
  const height = 430;
  const legendX = 748;
  const xExtent = paddedExtent(visiblePoints.map((point) => point.x));
  const yExtent = paddedExtent(visiblePoints.map((point) => point.y));
  const xScale = (value) => plot.left + ((value - xExtent.min) / (xExtent.max - xExtent.min || 1)) * (plot.right - plot.left);
  const yScale = (value) => plot.bottom - ((value - yExtent.min) / (yExtent.max - yExtent.min || 1)) * (plot.bottom - plot.top);
  const markets = uniq(visiblePoints.map((point) => point.market));
  const marketColors = ["#4f7d58", "#b86f50", "#d8a84a", "#6fa6a0", "#8a7158", "#9ab99c", "#bf774a", "#85a83f", "#8cc5be", "#e49b62", "#4f9319", "#69b8a4", "#d57d00", "#c6a23f", "#76a7d3"];
  const colorFor = (market) => marketColors[Math.max(0, markets.indexOf(market)) % marketColors.length];
  const shapeMap = {
    "PP注塑杯": "circle",
    "PP吸塑杯": "diamond",
    "PS吸塑杯": "square",
    "PET吸塑杯": "pentagon",
    "纸塑复合杯": "triangle-up",
    "PET吸塑盖": "triangle-down",
    "PP注塑盖": "cross",
    "PP注塑勺": "plus",
    "伸缩吸管": "star",
  };
  const shapeFor = (term) => shapeMap[term] || "circle";
  const specValues = points.map((point) => point.spec).filter((value) => value !== null && value !== undefined);
  const specExtent = specValues.length ? { min: Math.min(...specValues), max: Math.max(...specValues) } : { min: 0, max: 400 };
  const radiusFor = (spec) => {
    if (spec === null || spec === undefined) return 5;
    const ratio = specExtent.max === specExtent.min ? 0.5 : (spec - specExtent.min) / (specExtent.max - specExtent.min);
    return 2 + Math.sqrt(Math.max(0, Math.min(1, ratio))) * 6;
  };
  const regression = linearRegression(visiblePoints);
  const trendStart = { x: xExtent.min, y: regression.intercept + regression.slope * xExtent.min };
  const trendEnd = { x: xExtent.max, y: regression.intercept + regression.slope * xExtent.max };
  const outliers = visiblePoints
    .map((point) => ({ ...point, residual: Math.abs(point.y - (regression.intercept + regression.slope * point.x)) }))
    .sort((a, b) => b.residual - a.residual)
    .slice(0, 5);
  const outlierIds = new Set(outliers.map((point) => point.item.id));
  const xTicks = axisTicks(xExtent.min, xExtent.max);
  const yTicks = axisTicks(yExtent.min, yExtent.max);
  const grid = [
    ...xTicks.map((tick) => `<line x1="${xScale(tick)}" y1="${plot.top}" x2="${xScale(tick)}" y2="${plot.bottom}" stroke="#fff" stroke-opacity="0.55" stroke-width="0.8"/>`),
    ...yTicks.map((tick) => `<line x1="${plot.left}" y1="${yScale(tick)}" x2="${plot.right}" y2="${yScale(tick)}" stroke="#fff" stroke-opacity="0.55" stroke-width="0.8"/>`),
  ].join("");
  const tickLabels = [
    ...xTicks.map((tick) => `<text x="${xScale(tick)}" y="358" text-anchor="middle" font-size="10" fill="#6c7564">${formatNumber(tick)}</text>`),
    ...yTicks.map((tick) => `<text x="62" y="${yScale(tick) + 3}" text-anchor="end" font-size="10" fill="#6c7564">${formatNumber(tick)}</text>`),
  ].join("");
  const markers = visiblePoints.map((point) => scatterMarker({
    cx: xScale(point.x),
    cy: yScale(point.y),
    r: radiusFor(point.spec),
    shape: shapeFor(point.packageTerm),
    color: colorFor(point.market),
    title: cupScatterHover(point),
    highlighted: outlierIds.has(point.item.id),
  })).join("");
  const outlierLabels = outliers.map((point, index) => {
    const x = Math.min(plot.right - 64, xScale(point.x) + 9);
    const y = Math.max(plot.top + 10, Math.min(plot.bottom - 8, yScale(point.y) - 8 + index % 2 * 16));
    return `<text x="${x}" y="${y}" font-size="9" fill="#344336">${escapeHtml(shortProductLabel(point.item))}</text>`;
  }).join("");
  const marketGap = 21;
  const shapeStartY = 266;
  const shapeGap = 22;
  const visiblePackageTerms = allPackageTerms.slice(0, 8);
  const sizeLegendTitleY = shapeStartY + visiblePackageTerms.length * shapeGap + 20;
  const sizeLegendCircleY = sizeLegendTitleY + 24;
  const sizeLegendTextY = sizeLegendCircleY + 28;
  const svgHeight = Math.max(height, sizeLegendTextY + 18);
  const marketLegend = markets.map((market, index) => `
    <g transform="translate(${legendX + Math.floor(index / 8) * 86}, ${70 + (index % 8) * marketGap})">
      <circle cx="0" cy="0" r="4" fill="${colorFor(market)}"/>
      <text x="8" y="3" font-size="10" fill="#4f5a48">${escapeHtml(String(market).slice(0, 6))}</text>
    </g>
  `).join("");
  const shapeLegend = visiblePackageTerms.map((term, index) => `<g class="scatter-shape-legend-item${selectedPackage === term ? " active" : ""}" data-scatter-package="${escapeHtml(term)}" transform="translate(0, ${index * shapeGap})">
    <rect x="${legendX - 12}" y="${shapeStartY - 8}" width="142" height="16" rx="8" fill="transparent"/>
    ${scatterMarker({
    cx: legendX,
    cy: shapeStartY,
    r: 5,
    shape: shapeFor(term),
    color: "#6fa6a0",
    title: term,
  })}
    <text x="${legendX + 14}" y="${shapeStartY + 4}" font-size="10" fill="#4f5a48">${escapeHtml(String(term).slice(0, 8))}</text>
  </g>`).join("");
  const sizeLegend = [100, 200, 300, 400].map((spec, index) => {
    const r = radiusFor(spec);
    const x = legendX + 10 + index * 34;
    return `<circle cx="${x}" cy="${sizeLegendCircleY}" r="${r}" fill="#8a7158" fill-opacity="0.45" stroke="#fff" stroke-width="0.5" stroke-opacity="0.15"/>
      <text x="${x}" y="${sizeLegendTextY}" text-anchor="middle" font-size="9" fill="#4f5a48">${spec}g</text>`;
  }).join("");
  return `
    <article class="chart-card full enhanced-scatter-card" data-cup-scatter-card>
      <h3>杯身克重 × 壁厚关系散点图</h3>
      <p class="scatter-subtitle">气泡大小 = 规格容量，颜色 = 市场，形状 = 包装形式</p>
      <svg class="scatter enhanced-scatter" viewBox="0 0 ${width} ${svgHeight}" role="img" aria-label="杯类竞品杯身克重与壁厚关系散点图">
        <rect data-scatter-reset x="0" y="0" width="${width}" height="${svgHeight}" fill="transparent"/>
        ${grid}
        <line x1="${plot.left}" y1="${plot.bottom}" x2="${plot.right}" y2="${plot.bottom}" stroke="#6c7564"/>
        <line x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${plot.bottom}" stroke="#6c7564"/>
        ${tickLabels}
        <line x1="${xScale(trendStart.x)}" y1="${yScale(trendStart.y)}" x2="${xScale(trendEnd.x)}" y2="${yScale(trendEnd.y)}" stroke="#fff" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="6 5"/>
        ${markers}
        ${outlierLabels}
        <text x="${(plot.left + plot.right) / 2}" y="382" text-anchor="middle" font-size="12" fill="#263225">杯身壁厚（mm）</text>
        <text x="15" y="${(plot.top + plot.bottom) / 2}" transform="rotate(-90 15 ${(plot.top + plot.bottom) / 2})" text-anchor="middle" font-size="12" fill="#263225">杯身克重（g）</text>
        <text x="${legendX - 5}" y="44" font-size="11" font-weight="700" fill="#263225">市场</text>
        ${marketLegend}
        <text x="${legendX - 5}" y="${shapeStartY - 18}" font-size="11" font-weight="700" fill="#263225">包装形式</text>
        ${shapeLegend}
        <text x="${legendX - 5}" y="${sizeLegendTitleY}" font-size="11" font-weight="700" fill="#263225">规格容量</text>
        ${sizeLegend}
      </svg>
    </article>
  `;
}

function cupThicknessPair(value) {
  const values = String(value || "").replace(/(\d)\.\.(\d)/g, "$1.$2").match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
  return { body: values.length ? values[0] : null, bottom: values.length >= 2 ? values[1] : null };
}

function parsePrimaryWeight(value) {
  return parseNumber(String(value || "").split("+")[0]);
}

function primaryPackageTerm(value) {
  const preferred = ["PP注塑杯", "PP吸塑杯", "PS吸塑杯", "PET吸塑杯", "纸塑复合杯", "PET吸塑盖", "PP注塑盖", "PP注塑勺", "伸缩吸管"];
  const terms = splitTerms(value);
  return preferred.find((term) => terms.includes(term) || String(value || "").includes(term)) || terms[0] || "未记录";
}

function cupBodyPackageTerm(value) {
  const preferred = ["PP注塑杯", "PP吸塑杯", "PS吸塑杯", "PET吸塑杯", "纸塑复合杯"];
  const text = String(value || "");
  const terms = splitTerms(value);
  return preferred.find((term) => terms.includes(term) || text.includes(term))
    || terms.find((term) => term.includes("杯"))
    || "未记录";
}

function bottomTypeKey(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) return "";
  const preferred = ["局部内凹", "内凹（平）", "内凹（拱形）", "异形底", "平底（凸起小支撑）"];
  const aliases = [
    ["局部内凹", /局部内凹/],
    ["内凹（平）", /内凹[（(]?平[）)]?/],
    ["内凹（拱形）", /内凹[（(]?拱形[）)]?/],
    ["异形底", /异形底/],
    ["平底（凸起小支撑）", /平底[（(]?凸起小支撑[）)]?/],
  ];
  const found = aliases.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  if (found.length) return preferred.filter((label) => found.includes(label)).join(" + ");
  return value;
}

function linearRegression(points) {
  const n = points.length;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / n;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / n;
  const numerator = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const slope = denominator ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  const ssTot = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  const ssRes = points.reduce((sum, point) => sum + (point.y - (intercept + slope * point.x)) ** 2, 0);
  return { slope, intercept, r2: ssTot ? Math.max(0, 1 - ssRes / ssTot) : 0 };
}

function scatterMarker({ cx, cy, r, shape, color, title, highlighted = false }) {
  const stroke = `stroke="#fff" stroke-width="0.5"`;
  const common = `fill="${color}" fill-opacity="0.82" ${stroke}`;
  const marker = {
    circle: `<circle cx="${cx}" cy="${cy}" r="${r}" ${common}/>`,
    diamond: `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" ${common}/>`,
    square: `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="1.5" ${common}/>`,
    pentagon: `<polygon points="${regularPolygonPoints(cx, cy, r, 5, -Math.PI / 2)}" ${common}/>`,
    "triangle-up": `<polygon points="${cx},${cy - r} ${cx + r * 0.9},${cy + r * 0.75} ${cx - r * 0.9},${cy + r * 0.75}" ${common}/>`,
    "triangle-down": `<polygon points="${cx - r * 0.9},${cy - r * 0.75} ${cx + r * 0.9},${cy - r * 0.75} ${cx},${cy + r}" ${common}/>`,
    cross: `<path d="M ${cx - r} ${cy - r} L ${cx + r} ${cy + r} M ${cx + r} ${cy - r} L ${cx - r} ${cy + r}" stroke="${color}" stroke-width="${Math.max(2, r / 2)}" stroke-linecap="round" opacity="0.82"/>`,
    plus: `<path d="M ${cx - r} ${cy} L ${cx + r} ${cy} M ${cx} ${cy - r} L ${cx} ${cy + r}" stroke="${color}" stroke-width="${Math.max(2, r / 2)}" stroke-linecap="round" opacity="0.82"/>`,
    star: `<polygon points="${starPoints(cx, cy, r)}" ${common}/>`,
  }[shape] || `<circle cx="${cx}" cy="${cy}" r="${r}" ${common}/>`;
  const halo = highlighted ? `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="#263225" stroke-opacity="0.32" stroke-width="1"/>` : "";
  return `<g>${escapeHtml(title) ? `<title>${escapeHtml(title)}</title>` : ""}${halo}${marker}</g>`;
}

function regularPolygonPoints(cx, cy, radius, sides, startAngle = 0) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = startAngle + index * Math.PI * 2 / sides;
    return `${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(" ");
}

function starPoints(cx, cy, radius) {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const r = index % 2 ? radius * 0.45 : radius;
    return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
  }).join(" ");
}

function cupScatterHover(point) {
  return [
    point.item.name || "未命名产品",
    `${compactText(point.item.brand)} | ${compactText(point.market)}`,
    `规格：${point.spec !== null && point.spec !== undefined ? formatNumber(point.spec) : "未记录"} g`,
    `杯身厚度：${formatNumber(point.x)} mm | 杯底厚度：${point.bottomThickness !== null ? formatNumber(point.bottomThickness) : "未记录"} mm`,
    `杯身克重：${formatNumber(point.y)} g`,
  ].join("\n");
}

function cupShapeIndexHover(point) {
  return [
    point.item.name || "未命名产品",
    compactText(point.item.brand),
    `口径：${formatNumber(point.diameter)} mm`,
    `高度：${formatNumber(point.height)} mm`,
    `规格：${formatNumber(point.spec)} g`,
    `形态指数：${formatNumber(point.index)}`,
  ].join("\n");
}

function bottleScatterHover(point) {
  return [
    point.item.name || "未命名产品",
    `${compactText(point.item.brand)} | ${compactText(point.market)}`,
    `规格：${compactText(point.item.spec)}`,
    `瓶身厚度：${formatNumber(point.x)} mm`,
    `瓶身克重：${formatNumber(point.y)} g`,
  ].join("\n");
}

function shortProductLabel(item) {
  const label = `${item.brand || ""}${item.name || ""}`.replace(/\s+/g, "");
  return label.length > 10 ? `${label.slice(0, 10)}…` : label || "未命名";
}

function bottleThicknessScatterChart(items) {
  const points = items.map((item) => ({
    item,
    x: middleThicknessValue(item.thicknessDistribution || item.bodySize?.["瓶身厚度分布 下/中/上（mm）"]),
    y: parseNumber(item.preformWeight),
    spec: item.specValue ?? parseNumber(item.spec),
    market: item.market || "未知市场",
    material: item.materialName || "未知",
  })).filter((point) => point.x !== null && point.y !== null);
  return bottleWeightThicknessScatter(points);
}

function bottleWeightThicknessScatter(points) {
  if (!points.length) {
    return `<article class="chart-card full"><h3>瓶身克重 × 壁厚关系散点图</h3><div class="recommend-empty compact">暂无可统计数据</div></article>`;
  }
  const allMaterials = uniq(points.map((point) => point.material));
  const selectedMaterial = state.bottleScatterMaterial && allMaterials.includes(state.bottleScatterMaterial) ? state.bottleScatterMaterial : "";
  const visiblePoints = selectedMaterial ? points.filter((point) => point.material === selectedMaterial) : points;
  const plot = { left: 72, top: 58, right: 690, bottom: 340 };
  const width = 920;
  const height = 430;
  const legendX = 748;
  const xExtent = paddedExtent(visiblePoints.map((point) => point.x));
  const yExtent = paddedExtent(visiblePoints.map((point) => point.y));
  const xScale = (value) => plot.left + ((value - xExtent.min) / (xExtent.max - xExtent.min || 1)) * (plot.right - plot.left);
  const yScale = (value) => plot.bottom - ((value - yExtent.min) / (yExtent.max - yExtent.min || 1)) * (plot.bottom - plot.top);
  const markets = uniq(visiblePoints.map((point) => point.market));
  const marketColors = ["#4f7d58", "#b86f50", "#d8a84a", "#6fa6a0", "#8a7158", "#9ab99c", "#bf774a", "#85a83f", "#8cc5be", "#e49b62", "#4f9319", "#69b8a4", "#d57d00", "#c6a23f", "#76a7d3"];
  const colorFor = (market) => marketColors[Math.max(0, markets.indexOf(market)) % marketColors.length];
  const shapeMap = { PET: "circle", PP: "diamond", HDPE: "square", PS: "pentagon" };
  const shapeFor = (material) => shapeMap[material] || "circle";
  const specValues = points.map((point) => point.spec).filter((value) => value !== null && value !== undefined);
  const specExtent = specValues.length ? { min: Math.min(...specValues), max: Math.max(...specValues) } : { min: 0, max: 400 };
  const radiusFor = (spec) => {
    if (spec === null || spec === undefined) return 5;
    const ratio = specExtent.max === specExtent.min ? 0.5 : (spec - specExtent.min) / (specExtent.max - specExtent.min);
    return 2 + Math.sqrt(Math.max(0, Math.min(1, ratio))) * 6;
  };
  const regression = linearRegression(visiblePoints);
  const trendStart = { x: xExtent.min, y: regression.intercept + regression.slope * xExtent.min };
  const trendEnd = { x: xExtent.max, y: regression.intercept + regression.slope * xExtent.max };
  const outliers = visiblePoints
    .map((point) => ({ ...point, residual: Math.abs(point.y - (regression.intercept + regression.slope * point.x)) }))
    .sort((a, b) => b.residual - a.residual)
    .slice(0, 5);
  const outlierIds = new Set(outliers.map((point) => point.item.id));
  const xTicks = axisTicks(xExtent.min, xExtent.max);
  const yTicks = axisTicks(yExtent.min, yExtent.max);
  const grid = [
    ...xTicks.map((tick) => `<line x1="${xScale(tick)}" y1="${plot.top}" x2="${xScale(tick)}" y2="${plot.bottom}" stroke="#fff" stroke-opacity="0.55" stroke-width="0.8"/>`),
    ...yTicks.map((tick) => `<line x1="${plot.left}" y1="${yScale(tick)}" x2="${plot.right}" y2="${yScale(tick)}" stroke="#fff" stroke-opacity="0.55" stroke-width="0.8"/>`),
  ].join("");
  const tickLabels = [
    ...xTicks.map((tick) => `<text x="${xScale(tick)}" y="358" text-anchor="middle" font-size="10" fill="#6c7564">${formatNumber(tick)}</text>`),
    ...yTicks.map((tick) => `<text x="62" y="${yScale(tick) + 3}" text-anchor="end" font-size="10" fill="#6c7564">${formatNumber(tick)}</text>`),
  ].join("");
  const markers = visiblePoints.map((point) => scatterMarker({
    cx: xScale(point.x),
    cy: yScale(point.y),
    r: radiusFor(point.spec),
    shape: shapeFor(point.material),
    color: colorFor(point.market),
    title: bottleScatterHover(point),
    highlighted: outlierIds.has(point.item.id),
  })).join("");
  const outlierLabels = outliers.map((point, index) => {
    const x = Math.min(plot.right - 64, xScale(point.x) + 9);
    const y = Math.max(plot.top + 10, Math.min(plot.bottom - 8, yScale(point.y) - 8 + index % 2 * 16));
    return `<text x="${x}" y="${y}" font-size="9" fill="#344336">${escapeHtml(shortProductLabel(point.item))}</text>`;
  }).join("");
  const marketGap = 21;
  const shapeStartY = 266;
  const shapeGap = 22;
  const visibleMaterials = allMaterials.slice(0, 8);
  const sizeLegendTitleY = shapeStartY + visibleMaterials.length * shapeGap + 20;
  const sizeLegendCircleY = sizeLegendTitleY + 24;
  const sizeLegendTextY = sizeLegendCircleY + 28;
  const svgHeight = Math.max(height, sizeLegendTextY + 18);
  const marketLegend = markets.map((market, index) => `
    <g transform="translate(${legendX + Math.floor(index / 8) * 86}, ${70 + (index % 8) * marketGap})">
      <circle cx="0" cy="0" r="4" fill="${colorFor(market)}"/>
      <text x="8" y="3" font-size="10" fill="#4f5a48">${escapeHtml(String(market).slice(0, 6))}</text>
    </g>
  `).join("");
  const shapeLegend = visibleMaterials.map((material, index) => `<g class="scatter-shape-legend-item${selectedMaterial === material ? " active" : ""}" data-scatter-material="${escapeHtml(material)}" transform="translate(0, ${index * shapeGap})">
    <rect x="${legendX - 12}" y="${shapeStartY - 8}" width="142" height="16" rx="8" fill="transparent"/>
    ${scatterMarker({
    cx: legendX,
    cy: shapeStartY,
    r: 5,
    shape: shapeFor(material),
    color: "#6fa6a0",
    title: material,
  })}
    <text x="${legendX + 14}" y="${shapeStartY + 4}" font-size="10" fill="#4f5a48">${escapeHtml(String(material).slice(0, 8))}</text>
  </g>`).join("");
  const sizeLegend = [100, 200, 300, 400].map((spec, index) => {
    const r = radiusFor(spec);
    const x = legendX + 10 + index * 34;
    return `<circle cx="${x}" cy="${sizeLegendCircleY}" r="${r}" fill="#8a7158" fill-opacity="0.45" stroke="#fff" stroke-width="0.5" stroke-opacity="0.15"/>
      <text x="${x}" y="${sizeLegendTextY}" text-anchor="middle" font-size="9" fill="#4f5a48">${spec}g</text>`;
  }).join("");
  return `
    <article class="chart-card full enhanced-scatter-card" data-bottle-scatter-card>
      <h3>瓶身克重 × 壁厚关系散点图</h3>
      <p class="scatter-subtitle">气泡大小 = 规格容量，颜色 = 市场，形状 = 瓶身材质</p>
      <svg class="scatter enhanced-scatter" viewBox="0 0 ${width} ${svgHeight}" role="img" aria-label="瓶类竞品瓶身克重与壁厚关系散点图">
        <rect data-scatter-reset x="0" y="0" width="${width}" height="${svgHeight}" fill="transparent"/>
        ${grid}
        <line x1="${plot.left}" y1="${plot.bottom}" x2="${plot.right}" y2="${plot.bottom}" stroke="#6c7564"/>
        <line x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${plot.bottom}" stroke="#6c7564"/>
        ${tickLabels}
        <line x1="${xScale(trendStart.x)}" y1="${yScale(trendStart.y)}" x2="${xScale(trendEnd.x)}" y2="${yScale(trendEnd.y)}" stroke="#fff" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="6 5"/>
        ${markers}
        ${outlierLabels}
        <text x="${(plot.left + plot.right) / 2}" y="382" text-anchor="middle" font-size="12" fill="#263225">瓶身壁厚（mm）</text>
        <text x="15" y="${(plot.top + plot.bottom) / 2}" transform="rotate(-90 15 ${(plot.top + plot.bottom) / 2})" text-anchor="middle" font-size="12" fill="#263225">瓶身克重（g）</text>
        <text x="${legendX - 5}" y="44" font-size="11" font-weight="700" fill="#263225">市场</text>
        ${marketLegend}
        <text x="${legendX - 5}" y="${shapeStartY - 18}" font-size="11" font-weight="700" fill="#263225">瓶身材质</text>
        ${shapeLegend}
        <text x="${legendX - 5}" y="${sizeLegendTitleY}" font-size="11" font-weight="700" fill="#263225">规格容量</text>
        ${sizeLegend}
      </svg>
    </article>
  `;
}

function firstThicknessValue(value) {
  const values = String(value || "").replace(/(\d)\.\.(\d)/g, "$1.$2").match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
  return values.length ? values[0] : null;
}

function middleThicknessValue(value) {
  const values = String(value || "").replace(/(\d)\.\.(\d)/g, "$1.$2").match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
  return values.length >= 2 ? values[1] : null;
}

function numericScatterChart(title, points, xLabel, yLabel) {
  if (!points.length) return `<article class="chart-card wide"><h3>${title}</h3><div class="recommend-empty compact">暂无可统计数据</div></article>`;
  const plot = { left: 58, top: 28, right: 498, bottom: 208 };
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const xExtent = paddedExtent(xValues);
  const yExtent = paddedExtent(yValues);
  const xScale = (value) => plot.left + ((value - xExtent.min) / (xExtent.max - xExtent.min || 1)) * (plot.right - plot.left);
  const yScale = (value) => plot.bottom - ((value - yExtent.min) / (yExtent.max - yExtent.min || 1)) * (plot.bottom - plot.top);
  const colors = ["#4f7d58", "#b86f50", "#d8a84a", "#6fa6a0", "#8a7158", "#9ab99c"];
  const markets = uniq(points.map((point) => point.item.market));
  const xTicks = axisTicks(xExtent.min, xExtent.max);
  const yTicks = axisTicks(yExtent.min, yExtent.max);
  const grid = [
    ...xTicks.map((tick) => `<line x1="${xScale(tick)}" y1="${plot.top}" x2="${xScale(tick)}" y2="${plot.bottom}" stroke="#eee7d8" stroke-width="0.7"/>`),
    ...yTicks.map((tick) => `<line x1="${plot.left}" y1="${yScale(tick)}" x2="${plot.right}" y2="${yScale(tick)}" stroke="#eee7d8" stroke-width="0.7"/>`),
  ].join("");
  const tickLabels = [
    ...xTicks.map((tick) => `<text x="${xScale(tick)}" y="224" text-anchor="middle" font-size="9" fill="#6c7564">${formatNumber(tick)}</text>`),
    ...yTicks.map((tick) => `<text x="46" y="${yScale(tick) + 3}" text-anchor="end" font-size="9" fill="#6c7564">${formatNumber(tick)}</text>`),
  ].join("");
  const circles = points.map((point) => {
    const color = colors[markets.indexOf(point.item.market) % colors.length];
    return `<circle cx="${xScale(point.x)}" cy="${yScale(point.y)}" r="5" fill="${color}"><title>${escapeHtml(point.item.name)} ${xLabel}：${formatNumber(point.x)} / ${yLabel}：${formatNumber(point.y)}</title></circle>`;
  }).join("");
  return `<article class="chart-card wide"><h3>${title}</h3><svg class="scatter" viewBox="0 0 520 250" role="img" aria-label="${escapeHtml(title)}">
    ${grid}
    <line x1="${plot.left}" y1="${plot.bottom}" x2="${plot.right}" y2="${plot.bottom}" stroke="#6c7564"/>
    <line x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${plot.bottom}" stroke="#6c7564"/>
    ${tickLabels}
    ${circles}
    <text x="${(plot.left + plot.right) / 2}" y="244" text-anchor="middle" font-size="11">${escapeHtml(xLabel)}</text>
    <text x="8" y="20" font-size="11">${escapeHtml(yLabel)}</text>
  </svg></article>`;
}

function paddedExtent(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, Math.abs(max) * 0.2);
  return { min: Math.max(0, min - span * 0.12), max: max + span * 0.12 };
}

function axisTicks(min, max) {
  const step = (max - min) / 4 || 1;
  return Array.from({ length: 5 }, (_, index) => min + step * index);
}

function renderRecommendation() {
  renderRecommendationInputs();
  const items = recommendationItems();
  const invalidRange = !recommendationRangeValid();
  const invalidMouthRange = !recommendationMouthRangeValid();
  $("#generateRecommendation").disabled = invalidRange || invalidMouthRange;
  $("#recEstimate").textContent = invalidRange
    ? "请确认容量范围：最小值需小于或等于最大值"
    : invalidMouthRange
      ? "请确认口径/瓶口直径范围：最小值需小于或等于最大值"
      : `当前条件下共找到 ${items.length} 条参照竞品`;
  if (!state.recommend.generated) {
    $("#recommendOutput").innerHTML = `
      <div class="recommend-empty">
        <h3>输入新品开发条件后生成推荐</h3>
        <p>系统会基于当前竞品数据库计算结构参数范围、工艺分布、参照竞品与可借鉴结构点。</p>
      </div>
    `;
    return;
  }
  renderRecommendationOutput(items);
}

function renderRecommendationInputs() {
  const rec = state.recommend;
  $("#recType").innerHTML = ["杯类", "瓶类"].map((type) => `<button class="chip${rec.type === type ? " active" : ""}" data-rec-type="${type}" type="button">${type}</button>`).join("");
  $("#recMinSlider").value = rec.min;
  $("#recMaxSlider").value = rec.max;
  $("#recMinInput").value = rec.min;
  $("#recMaxInput").value = rec.max;
  $("#recMouthMinInput").value = rec.mouthMin;
  $("#recMouthMaxInput").value = rec.mouthMax;
  $("#recNote").value = rec.note;

  const items = allItems.filter((item) => item.type === rec.type);
  setMultiSelectOptions("#recMarkets", uniq(items.map((item) => item.market)), rec.markets);
  renderRecommendChips("#recPackages", recommendPackageOptions(items), rec.packages, "packages");
  renderRecommendChips("#recCrafts", recommendCraftOptions(items), rec.crafts, "crafts");
  renderRecommendChips("#recSurfaces", recommendSurfaceOptions(items), rec.surfaces, "surfaces");
}

function setMultiSelectOptions(selector, values, selectedSet) {
  const select = $(selector);
  select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}" ${selectedSet.has(value) ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function renderRecommendChips(selector, values, selectedSet, group) {
  $(selector).innerHTML = values.length
    ? values.map((value) => `<button class="chip${selectedSet.has(value) ? " active" : ""}" data-rec-group="${group}" data-value="${escapeHtml(value)}" type="button">${escapeHtml(value)}</button>`).join("")
    : '<span class="muted-text">暂无可选项</span>';
}

function recommendPackageOptions(items) {
  return uniq(items.flatMap((item) => splitTerms(item.packageForm))).filter((value) => value !== "未记录");
}

function recommendCraftOptions(items) {
  return uniq(items.flatMap((item) => splitTerms(recommendCraftValue(item)))).filter((value) => value && value !== "未记录");
}

function recommendSurfaceOptions(items) {
  return uniq(items.flatMap((item) => surfaceTerms(recommendSurfaceValue(item))));
}

function splitTerms(value) {
  return String(value || "")
    .split(/[、,\s/]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function surfaceTerms(value) {
  const terms = splitTerms(value).filter((entry) => entry !== "未记录");
  return terms.length ? terms : ["无特殊处理"];
}

function recommendationRangeValid() {
  const min = Number(state.recommend.min);
  const max = Number(state.recommend.max);
  return Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max <= 1000 && min <= max;
}

function recommendationMouthRangeValid() {
  const min = parseNumber(state.recommend.mouthMin);
  const max = parseNumber(state.recommend.mouthMax);
  return min === null || max === null || min <= max;
}

function recommendationMouthValues(item) {
  if (item.type === "杯类") {
    const value = parseNumber(item.cupBody?.["口径（mm）"]);
    return value === null ? [] : [value];
  }
  return [
    parseNumber(item.mouthDiameterRaw),
    parseNumber(item.nonScrewMouth?.["瓶口直径"]),
  ].filter((value) => value !== null);
}

function recommendationMouthMatches(item) {
  const min = parseNumber(state.recommend.mouthMin);
  const max = parseNumber(state.recommend.mouthMax);
  if (min === null && max === null) return true;
  const values = recommendationMouthValues(item);
  if (!values.length) return false;
  return values.some((value) => (min === null || value >= min) && (max === null || value <= max));
}

function recommendationItems() {
  const rec = state.recommend;
  if (!recommendationRangeValid() || !recommendationMouthRangeValid()) return [];
  return allItems.filter((item) => {
    if (item.type !== rec.type) return false;
    if (item.specValue === null || item.specValue === undefined) return false;
    if (item.specValue < rec.min || item.specValue > rec.max) return false;
    if (!recommendationMouthMatches(item)) return false;
    if (rec.markets.size && !rec.markets.has(item.market)) return false;
    if (rec.packages.size && ![...rec.packages].some((value) => splitTerms(item.packageForm).includes(value))) return false;
    if (rec.crafts.size && ![...rec.crafts].some((value) => splitTerms(recommendCraftValue(item)).includes(value))) return false;
    if (rec.surfaces.size && ![...rec.surfaces].some((value) => surfaceTerms(recommendSurfaceValue(item)).includes(value))) return false;
    return true;
  });
}

function recommendCraftValue(item) {
  return item.type === "杯类" ? compactText(item.labelCraft || item.material?.["模内贴/套标"]) : compactText(item.label);
}

function recommendSurfaceValue(item) {
  return item.type === "杯类" ? compactText(item.material?.["表面处理工艺"]) : compactText(item.surface);
}

function renderRecommendationOutput(items) {
  $("#recommendOutput").innerHTML = `
    ${state.recommend.note ? `<section class="recommend-section"><h3>需求备注</h3><p class="recommend-note-preview">${escapeHtml(state.recommend.note)}</p></section>` : ""}
    <section class="recommend-section">
      <h3>结构参数推荐</h3>
      ${parameterBarChart(recommendParamDefs(state.recommend.type), items)}
    </section>
    <section class="recommend-section">
      <h3>其他选型参考</h3>
      <div class="distribution-grid">${recommendDistributionBlocks(items).join("")}</div>
    </section>
    <section class="recommend-section">
      <div class="recommend-section-heading">
        <h3>相关竞品参照</h3>
        <small>默认展示与推荐值最相似的前 9 个</small>
      </div>
      <div class="reference-list">${recommendReferenceRows(items).join("") || '<div class="recommend-empty compact">暂无匹配竞品。</div>'}</div>
      ${items.length > 9 ? `<button class="ghost-button view-all-reference" type="button" data-rec-all="true">查看全部 ${items.length} 条竞品</button>` : ""}
    </section>
    <section class="recommend-section">
      <h3>结构创新参考</h3>
      <div class="innovation-grid">${recommendInnovationCards(items).join("") || '<div class="recommend-empty compact">当前条件下暂无特殊点或借鉴点记录。</div>'}</div>
    </section>
  `;
}

function recommendParamDefs(type) {
  const cupValue = (field) => (item) => item.cupBody?.[field];
  const lidValue = (field) => (item) => item.lid?.[field];
  const bottleValue = (field) => (item) => item.bodySize?.[field];
  const nonScrewValue = (field) => (item) => item.nonScrewMouth?.[field];
  if (type === "杯类") {
    return [
      { name: "高度", source: "杯身尺寸数据_高度（mm）", getter: cupValue("高度（mm）"), mode: "recommend" },
      { name: "落杯直径", source: "杯身尺寸数据_落杯直径（mm）", getter: cupValue("落杯直径（mm）") },
      { name: "杯沿宽度", source: "杯身尺寸数据_杯沿宽度(mm)", getter: cupValue("杯沿宽度(mm)"), mode: "mainstream" },
      { name: "杯沿厚度", source: "杯身尺寸数据_杯沿厚度（mm）", getter: cupValue("杯沿厚度（mm）") },
      { name: "底部直径", source: "杯身尺寸数据_底部直径/宽度（mm）", getter: cupValue("底部直径/宽度（mm）") },
      { name: "堆叠高度", source: "杯身尺寸数据_堆叠高度（mm）", getter: cupValue("堆叠高度（mm）") },
      { name: "杯身重量", source: "杯身尺寸数据_杯身重量（g）", getter: cupValue("杯身重量（g）"), mode: "lightweight" },
      { name: "杯身壁厚", source: "杯身尺寸数据_厚度 杯身/杯底（mm）", getter: cupValue("厚度 杯身/杯底（mm）") },
      { name: "杯盖高度", source: "杯盖尺寸数据_杯盖高度（mm）", getter: lidValue("杯盖高度（mm）") },
      { name: "杯盖重量", source: "杯盖尺寸数据_杯盖重量（g）", getter: lidValue("杯盖重量（g）") },
      { name: "液位线高度", source: "液位线高度（mm）", getter: (item) => item.fillLineHeight },
    ];
  }
  return [
    { name: "瓶身高度", source: "瓶身尺寸数据_高度（mm）", getter: bottleValue("高度（mm）"), mode: "recommend" },
    { name: "瓶身直径/宽度", source: "瓶身尺寸数据_宽/直径(mm)", getter: bottleValue("宽/直径(mm)") },
    { name: "热封宽度", source: "非旋盖类瓶口_热封宽度", getter: nonScrewValue("热封宽度") },
    { name: "瓶胚克重", source: "瓶胚克重（g）", getter: (item) => item.preformWeight, mode: "lightweight" },
    { name: "瓶身厚度分布", source: "瓶身尺寸数据_瓶身厚度分布 下/中/上", getter: bottleValue("瓶身厚度分布 下/中/上（mm）") },
  ];
}

function parameterBarChart(defs, items) {
  return `
    <div class="parameter-bar-chart" role="img" aria-label="结构参数推荐条形图">
      <div class="parameter-bar-head">
        <span>参数</span>
        <span>推荐范围与推荐值</span>
        <span>结论</span>
      </div>
      ${defs.map((def) => parameterBarRow(def, items)).join("")}
    </div>
  `;
}

function parameterBarRow(def, items) {
  const sourceRows = items.map((item) => ({ item, values: numericValues(def.getter(item)) })).filter((row) => row.values.length);
  const values = sourceRows.flatMap((row) => row.values);
  if (!values.length) {
    return `
      <article class="parameter-bar-row empty">
        <h4>${escapeHtml(def.name)}</h4>
        <div class="parameter-bar-empty">暂无有效数据</div>
        <small title="${escapeHtml(def.source)}">来源：${escapeHtml(def.source)}</small>
      </article>
    `;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = median(values);
  const mode = modeValue(values);
  const recommended = def.mode === "mainstream" ? mode : mid;
  const assist = def.mode === "lightweight" ? `轻量化下限 ${formatNumber(min)}` : def.mode === "mainstream" ? `主流值 ${formatNumber(mode)}` : `推荐值 ${formatNumber(recommended)}`;
  const tooltip = sourceRows.map(({ item }) => `${item.name || "未命名"}｜${item.brand || "未知品牌"}｜${item.market || "未知市场"}`).join("\n");
  const markerLeft = max === min ? 100 : ((recommended - min) / (max - min)) * 100;
  const fillWidth = max <= 0 ? 0 : (recommended / max) * 100;
  return `
    <article class="parameter-bar-row" title="${escapeHtml(tooltip)}">
      <h4>${escapeHtml(def.name)}</h4>
      <div class="parameter-bar-body">
        <div class="parameter-bar-track">
          <span style="width:${Math.max(0, Math.min(100, fillWidth))}%"></span>
          <i style="left:${Math.max(0, Math.min(100, markerLeft))}%"></i>
        </div>
        <div class="range-labels"><span>${formatNumber(min)}</span><b>${formatNumber(recommended)}</b><span>${formatNumber(max)}</span></div>
      </div>
      <div class="parameter-bar-meta">
        <b class="parameter-value-tip" tabindex="0">
          ${escapeHtml(assist)}
          <small role="tooltip">基于 ${sourceRows.length} 条竞品数据<br>${escapeHtml(def.source)}</small>
        </b>
      </div>
    </article>
  `;
}

function numericValues(value) {
  if (Array.isArray(value)) return value.flatMap(numericValues);
  return String(value || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function modeValue(values) {
  const countsByValue = new Map();
  values.forEach((value) => {
    const key = formatNumber(value);
    countsByValue.set(key, (countsByValue.get(key) || 0) + 1);
  });
  const [value] = [...countsByValue.entries()].sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0] || [median(values)];
  return Number(value);
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, "");
}

function recommendDistributionBlocks(items) {
  const blocks = state.recommend.type === "杯类"
    ? [
      ["包装形式分布", aggregateDistribution(items, (item) => item.packageForm)],
      ["盖膜特性分布", aggregateDistribution(items, (item) => item.filmFeature || item.material?.["盖膜"] || "未知")],
      ["标签工艺分布", aggregateDistribution(items, recommendCraftValue)],
      ["表面处理工艺分布", aggregateDistribution(items, recommendSurfaceValue)],
      ["杯底类型分布", aggregateDistribution(items, (item) => item.bottomType || item.cupBody?.["杯底类型"] || "未知")],
    ]
    : [
      ["瓶身材质分布", aggregateDistribution(items, (item) => item.materialName || "未知")],
      ["标签类型分布", aggregateDistribution(items, recommendCraftValue)],
      ["表面处理工艺分布", aggregateDistribution(items, recommendSurfaceValue)],
    ];
  return blocks.map(([title, rows]) => distributionBlock(title, rows, items.length));
}

function aggregateDistribution(items, getter) {
  const map = new Map();
  items.forEach((item) => {
    const values = splitTerms(getter(item) || "未知");
    (values.length ? values : ["未知"]).forEach((value) => map.set(value, (map.get(value) || 0) + 1));
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function distributionBlock(title, rows, total) {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return `
    <article class="distribution-card">
      <h4>${escapeHtml(title)}</h4>
      ${rows.slice(0, 6).map(([label, value]) => `
        <div class="mini-bar-row">
          <span>${escapeHtml(label)}</span>
          <div class="mini-bar-track"><i style="width:${(value / max) * 100}%"></i></div>
          <b>${total ? Math.round((value / total) * 100) : 0}%</b>
        </div>
      `).join("") || '<p class="muted-text">暂无数据</p>'}
    </article>
  `;
}

function recommendReferenceRows(items) {
  return sortRecommendationItemsByRecommendedValues(items).slice(0, 9).map((item) => {
    const param = item.type === "杯类"
      ? `口径 ${compactText(item.cupBody?.["口径（mm）"])} / 高度 ${compactText(item.cupBody?.["高度（mm）"])}`
      : `高度 ${compactText(item.bodySize?.["高度（mm）"])} / 直径 ${compactText(item.bodySize?.["宽/直径(mm)"])}`;
    const tags = uniq([recommendCraftValue(item), recommendSurfaceValue(item), item.filmFeature, item.bottomType, item.materialName].filter((value) => value && value !== "未记录")).slice(0, 4);
    const hasSpecial = Boolean(item.special?.描述 || item.special?.借鉴点);
    const specialText = [item.special?.描述, item.special?.借鉴点].filter(Boolean).join(" / ");
    const image = firstProductImage(item);
    return `
      <article class="reference-row reference-card" data-rec-detail="${escapeHtml(item.id)}" tabindex="0">
        <div class="reference-image${image ? " has-image" : ""}">
          ${image ? `<img src="${escapeHtml(imageSrc(image))}" alt="${escapeHtml(item.name || "产品图")}" loading="lazy">` : "产品图"}
        </div>
        <div class="reference-card-main">
          <h4>${escapeHtml(item.name || "未命名产品")}</h4>
          <p>${escapeHtml(compactText(item.brand))} · ${escapeHtml(compactText(item.market))} · ${escapeHtml(compactText(item.spec))}</p>
          <small>${escapeHtml(param)}</small>
          <div class="reference-tags">
            ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
            ${hasSpecial ? `<details class="special-detail"><summary>⭐ 有特殊结构</summary><p>${escapeHtml(specialText)}</p></details>` : ""}
          </div>
        </div>
      </article>
    `;
  });
}

function sortRecommendationItemsByRecommendedValues(items) {
  const defs = recommendParamDefs(state.recommend.type);
  const stats = defs.map((def) => recommendationParamStats(def, items)).filter(Boolean);
  if (!stats.length) return sortRecommendationItems(items);
  const rec = state.recommend;
  const selectedMarkets = [...rec.markets];
  return [...items].sort((a, b) => {
    if (rec.sort === "market" && selectedMarkets.length) {
      const marketScore = Number(selectedMarkets.includes(b.market)) - Number(selectedMarkets.includes(a.market));
      if (marketScore) return marketScore;
    }
    if (rec.sort === "date") return parseDateValue(b.date) - parseDateValue(a.date);
    return recommendationSimilarityScore(a, stats) - recommendationSimilarityScore(b, stats);
  });
}

function recommendationParamStats(def, items) {
  const values = items.flatMap((item) => numericValues(def.getter(item)));
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mode = modeValue(values);
  const recommended = def.mode === "mainstream" ? mode : median(values);
  return { def, min, max, recommended };
}

function recommendationSimilarityScore(item, stats) {
  const scores = stats.flatMap((stat) => {
    const values = numericValues(stat.def.getter(item));
    if (!values.length) return [];
    const value = median(values);
    const range = Math.max(1, stat.max - stat.min);
    return Math.abs(value - stat.recommended) / range;
  });
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : Number.POSITIVE_INFINITY;
}

function sortRecommendationItems(items) {
  const rec = state.recommend;
  const center = (Number(rec.min) + Number(rec.max)) / 2;
  const selectedMarkets = [...rec.markets];
  return [...items].sort((a, b) => {
    if (rec.sort === "market" && selectedMarkets.length) {
      const marketScore = Number(selectedMarkets.includes(b.market)) - Number(selectedMarkets.includes(a.market));
      if (marketScore) return marketScore;
    }
    if (rec.sort === "date") return parseDateValue(b.date) - parseDateValue(a.date);
    return Math.abs((a.specValue || 0) - center) - Math.abs((b.specValue || 0) - center);
  });
}

function parseDateValue(value) {
  const timestamp = Date.parse(String(value || "").replace(/\//g, "-"));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function recommendInnovationCards(items) {
  return items.flatMap((item) => {
    const rows = [];
    if (item.special?.描述) rows.push({ type: "特殊点", text: item.special.描述 });
    if (item.special?.借鉴点) rows.push({ type: "借鉴点", text: item.special.借鉴点 });
    return rows.map((row) => `
      <article class="innovation-card" data-rec-detail="${escapeHtml(item.id)}" tabindex="0">
        <span>${escapeHtml(row.type)} · ${escapeHtml(innovationTag(row.text))}</span>
        <p>${escapeHtml(row.text)}</p>
        <b>${escapeHtml(item.name || "未命名产品")} · ${escapeHtml(compactText(item.brand))}</b>
      </article>
    `);
  }).slice(0, 24);
}

function innovationTag(text) {
  const value = String(text || "");
  if (/底|杯底|瓶底/.test(value)) return "杯底结构";
  if (/盖|膜|封/.test(value)) return "杯盖设计";
  if (/勺|吸管|配件|组合/.test(value)) return "配件创新";
  if (/标|贴|印刷|工艺/.test(value)) return "标签工艺";
  if (/开|撕|握|饮/.test(value)) return "开启体验";
  return "结构参考";
}

function applyRecommendationToFilters() {
  const rec = state.recommend;
  const matchedIds = recommendationItems().map((item) => item.id);
  state.type = rec.type;
  state.search = "";
  state.filters = { markets: new Set(rec.markets), brands: new Set(), packages: new Set(rec.packages), crafts: new Set(rec.crafts), specs: new Set() };
  state.customMin = String(rec.min);
  state.customMax = String(rec.max);
  state.openFilter = null;
  state.resultSubsetIds = new Set(matchedIds);
  $("#searchInput").value = "";
  renderAll();
}

function openRecommendationDetail(id) {
  applyRecommendationToFilters();
  const items = filteredItems();
  state.currentIndex = Math.max(0, items.findIndex((item) => item.id === id));
  state.detailImageIndex = 0;
  setView("detail");
}

function resetRecommendationState() {
  state.recommend = {
    type: "杯类",
    min: 80,
    max: 200,
    mouthMin: "",
    mouthMax: "",
    markets: new Set(),
    packages: new Set(),
    crafts: new Set(),
    surfaces: new Set(),
    note: "",
    generated: false,
    sort: "capacity",
  };
}

function updateRecommendationNumber(key, value) {
  const next = Math.max(0, Math.min(1000, Number(value) || 0));
  state.recommend[key] = next;
  renderRecommendation();
}

function updateRecommendationMouth(key, value) {
  state.recommend[key] = value;
  renderRecommendation();
}

function renderTable() {
  const columns = tableColumnsForType(state.type);
  renderTableControls(columns);
  const query = state.tableSearch.toLowerCase();
  const filterColumn = columns.find((column) => column.key === state.tableFilterColumn);
  const sortColumn = columns.find((column) => column.key === state.tableSortColumn);
  let items = filteredItems().filter((item) => {
    const rowText = columns.map((column) => tableText(column.value(item))).join(" ").toLowerCase();
    if (query && !rowText.includes(query)) return false;
    if (!filterColumn) return true;
    return tableFilterMatches(filterColumn.value(item), state.tableFilterOperator, state.tableFilterValue);
  });
  if (sortColumn) {
    items = [...items].sort((a, b) => compareTableValues(sortColumn.value(a), sortColumn.value(b), state.tableSortDirection));
  }
  $("#tableCount").textContent = items.length;
  $("#resultTable").innerHTML = `
    <thead><tr>${columns.map((column) => `<th title="${escapeHtml(column.label)}">${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
    <tbody>${items.map((item) => `<tr>${columns.map((column) => `<td>${tableCell(column.value(item))}</td>`).join("")}</tr>`).join("")}</tbody>
  `;
}

function tableColumnsForType(type) {
  const imageAt = (field, index) => (item) => imageList(item[field] || [])[index] || "";
  const mapValue = (field, key) => (item) => item[field]?.[key] || "";
  if (type === "杯类") {
    return [
      col("type", "类别", (item) => item.type),
      col("market", "国家（市场）", (item) => item.market),
      col("brand", "品牌", (item) => item.brand),
      col("name", "产品名称", (item) => item.name),
      col("productImage1", "产品图-1", imageAt("productImages", 0)),
      col("productImage2", "产品图-2", imageAt("productImages", 1)),
      col("productImage3", "产品图-3", imageAt("productImages", 2)),
      col("productImage4", "产品图-4", imageAt("productImages", 3)),
      col("packageForm", "包装形式", (item) => item.packageForm),
      col("spec", "规格(净含量）", (item) => item.spec),
      col("fillLineHeight", "液位线高度（mm）", (item) => item.fillLineHeight),
      col("cupThickness", "厚度 杯身/杯底（mm）", mapValue("cupBody", "厚度 杯身/杯底（mm）")),
      col("cupWeight", "杯身重量（g）", mapValue("cupBody", "杯身重量（g）")),
      col("cupMouth", "口径（mm）", mapValue("cupBody", "口径（mm）")),
      col("cupDropDiameter", "落杯直径（mm）", mapValue("cupBody", "落杯直径（mm）")),
      col("cupRimWidth", "杯沿宽度(mm)", mapValue("cupBody", "杯沿宽度(mm)")),
      col("cupRimThickness", "杯沿厚度（mm）", mapValue("cupBody", "杯沿厚度（mm）")),
      col("cupHeight", "高度（mm）", mapValue("cupBody", "高度（mm）")),
      col("cupBottomDiameter", "底部直径/宽度（mm）", mapValue("cupBody", "底部直径/宽度（mm）")),
      col("cupStackHeight", "堆叠高度（mm）", mapValue("cupBody", "堆叠高度（mm）")),
      col("cupBottomType", "杯底类型", mapValue("cupBody", "杯底类型")),
      col("cupBottomRaised", "底部抬高(mm)", mapValue("cupBody", "底部抬高(mm)")),
      col("cupBottomImage1", "杯底图片-1", mapValue("cupBody", "杯底图片")),
      col("cupLidCombo1", "盖、勺等其他配件组合方式-1", mapValue("lid", "盖、勺等其他配件组合方式")),
      col("cupLidSealWidth", "杯盖热封宽度（mm）", mapValue("lid", "杯盖热封宽度（mm）")),
      col("cupLidWeight", "杯盖重量（g）", mapValue("lid", "杯盖重量（g）")),
      col("cupLidThickness", "杯盖厚度（mm）", mapValue("lid", "杯盖厚度（mm）")),
      col("cupLidHeight", "杯盖高度（mm）", mapValue("lid", "杯盖高度（mm）")),
      col("cupLabelCraft", "模内贴/套标", mapValue("material", "模内贴/套标")),
      col("cupFilm", "盖膜", mapValue("material", "盖膜")),
      col("cupSurface", "表面处理工艺", mapValue("material", "表面处理工艺")),
      col("cupGrip", "握持手感", mapValue("experience", "握持手感")),
      col("cupOpen", "开启便捷性", mapValue("experience", "开启便捷性")),
      col("cupDrink", "饮用体验", mapValue("experience", "饮用体验")),
      col("cupSpecialImage1", "特殊点图片-1", (item) => imageList(item.special?.图片)[0] || ""),
      col("cupSpecialImage2", "特殊点图片-2", (item) => imageList(item.special?.图片)[1] || ""),
      col("cupSpecialDescription", "特殊点描述", mapValue("special", "描述")),
      col("cupBorrow", "借鉴点", mapValue("special", "借鉴点")),
    ];
  }
  return [
    col("type", "类别", (item) => item.type),
    col("market", "国家（市场）", (item) => item.market),
    col("brand", "品牌", (item) => item.brand),
    col("name", "产品名称", (item) => item.name),
    col("productImage1", "产品图-1", imageAt("productImages", 0)),
    col("productImage2", "产品图-2", imageAt("productImages", 1)),
    col("spec", "规格(净含量）", (item) => item.spec),
    col("screwMouth", "旋盖瓶口直径", (item) => item.mouthDiameterRaw),
    col("nonScrewMouthDiameter", "瓶口直径", mapValue("nonScrewMouth", "瓶口直径")),
    col("nonScrewOuter", "瓶口外沿厚度", mapValue("nonScrewMouth", "瓶口外沿厚度")),
    col("nonScrewSeal", "热封宽度", mapValue("nonScrewMouth", "热封宽度")),
    col("preformWeight", "瓶胚克重（g）", (item) => item.preformWeight),
    col("openingTorque", "开启扭力（N.m）", (item) => item.openingTorque),
    col("bottomImage1", "瓶底图片-1", imageAt("bottomImages", 0)),
    col("bottomImage2", "瓶底图片-2", imageAt("bottomImages", 1)),
    col("fillLineHeight", "液位线高度", (item) => item.fillLineHeight),
    col("bottleHeight", "高度（mm）", mapValue("bodySize", "高度（mm）")),
    col("bottleWidth", "宽/直径(mm)", mapValue("bodySize", "宽/直径(mm)")),
    col("bottleThickness", "瓶身厚度分布 下/中/上（mm）", mapValue("bodySize", "瓶身厚度分布 下/中/上（mm）")),
    col("bottleMaterial", "瓶身材质", (item) => item.materialName),
    col("bottleLabel", "标签", (item) => item.label),
    col("bottleSurface", "表面处理工艺", (item) => item.surface),
    col("bottleGrip", "握持手感", mapValue("experience", "握持手感")),
    col("bottleDrink", "饮用体验", mapValue("experience", "饮用体验")),
    col("bottleSpecialImage1", "特殊点图片-1", (item) => imageList(item.special?.图片)[0] || ""),
    col("bottleSpecialImage2", "特殊点图片-2", (item) => imageList(item.special?.图片)[1] || ""),
    col("bottleSpecialDescription", "特殊点描述", mapValue("special", "描述")),
    col("bottleBorrow", "借鉴点", mapValue("special", "借鉴点")),
  ];
}

function col(key, label, value) {
  return { key, label, value };
}

function renderTableControls(columns) {
  const columnOptions = [`<option value="">全部列</option>`].concat(columns.map((column) => `<option value="${escapeHtml(column.key)}">${escapeHtml(column.label)}</option>`)).join("");
  const sortOptions = [`<option value="">不排序</option>`].concat(columns.map((column) => `<option value="${escapeHtml(column.key)}">${escapeHtml(column.label)}</option>`)).join("");
  setSelectOptions("#tableFilterColumn", columnOptions, state.tableFilterColumn, "");
  setSelectOptions("#tableSortColumn", sortOptions, state.tableSortColumn, "");
  $("#tableFilterOperator").value = state.tableFilterOperator;
  $("#tableFilterValue").value = state.tableFilterValue;
  $("#tableSortDirection").value = state.tableSortDirection;
}

function setSelectOptions(selector, html, value, fallback) {
  const select = $(selector);
  if (select.innerHTML !== html) select.innerHTML = html;
  select.value = [...select.options].some((option) => option.value === value) ? value : fallback;
}

function tableText(value) {
  if (Array.isArray(value)) return value.map(tableText).join(" ");
  return compactText(value);
}

function tableCell(value) {
  const images = imageList(value);
  if (images.length) {
    return `<div class="table-images">${images.map((src, index) => `<button class="table-image preview-trigger" type="button" ${previewAttrs(images, index)}><img src="${escapeHtml(imageSrc(src))}" alt="表格图片" loading="lazy"></button>`).join("")}</div>`;
  }
  return escapeHtml(compactText(value));
}

function tableFilterMatches(value, operator, expected) {
  const text = tableText(value).trim();
  const target = expected.trim();
  if (operator === "not-empty") return text && text !== "未记录";
  if (operator === "empty") return !text || text === "未记录";
  if (!target) return true;
  if (operator === "equals") return text.toLowerCase() === target.toLowerCase();
  return text.toLowerCase().includes(target.toLowerCase());
}

function compareTableValues(a, b, direction) {
  const textA = tableText(a);
  const textB = tableText(b);
  const numberA = parseNumber(textA);
  const numberB = parseNumber(textB);
  const modifier = direction === "desc" ? -1 : 1;
  if (numberA !== null && numberB !== null) return (numberA - numberB) * modifier;
  return textA.localeCompare(textB, "zh-CN", { numeric: true }) * modifier;
}

function renderAll() {
  renderFilters();
  renderSummary();
  renderMap();
  renderSelected();
  renderCards();
  if (state.currentView === "recommend") renderRecommendation();
  if (state.currentView === "visual") renderCharts();
  if (state.currentView === "table") renderTable();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function openPreview(images, index = 0) {
  const validImages = imageList(images);
  if (!validImages.length) return;
  state.preview = {
    images: validImages,
    index: Math.max(0, Math.min(index, validImages.length - 1)),
    zoom: 1,
  };
  $("#imagePreview").hidden = false;
  document.body.classList.add("preview-open");
  renderPreview();
}

function closePreview() {
  $("#imagePreview").hidden = true;
  document.body.classList.remove("preview-open");
}

function renderPreview() {
  const { images, index, zoom } = state.preview;
  const image = images[index];
  $("#previewImage").src = imageSrc(image) || "";
  $("#previewImage").alt = `放大查看图片 ${index + 1}`;
  $("#previewImage").style.transform = `scale(${zoom})`;
  $("#previewCounter").textContent = `${index + 1} / ${images.length}`;
  $("#previewPrev").disabled = images.length <= 1;
  $("#previewNext").disabled = images.length <= 1;
  $("#previewZoomValue").textContent = `${Math.round(zoom * 100)}%`;
}

function movePreview(step) {
  const total = state.preview.images.length;
  if (!total) return;
  state.preview.index = (state.preview.index + step + total) % total;
  state.preview.zoom = 1;
  renderPreview();
}

function zoomPreview(delta) {
  state.preview.zoom = Math.max(0.5, Math.min(3, Number((state.preview.zoom + delta).toFixed(2))));
  renderPreview();
}

function init() {
  $("#sourceFile").textContent = rawData.sourceFile || "竞品包装分析数据表";
  $("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
  });
  $("#searchInput").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    state.search = event.target.value.trim();
    state.currentIndex = 0;
    state.resultSubsetIds = null;
    renderSelected();
    renderCards();
    setView("results");
  });
  $("#applyFilters").addEventListener("click", () => {
    state.openFilter = null;
    state.currentIndex = 0;
    state.resultSubsetIds = null;
    renderSelected();
    renderCards();
    renderFilters();
    setView("results");
  });
  $("#resetFilters").addEventListener("click", () => {
    state.search = "";
    state.filters = { markets: new Set(), brands: new Set(), packages: new Set(), crafts: new Set(), specs: new Set() };
    state.customMin = "";
    state.customMax = "";
    state.openFilter = null;
    state.resultSubsetIds = null;
    $("#searchInput").value = "";
    renderAll();
  });
  $$(".big-pill").forEach((node) => node.addEventListener("click", () => setType(node.dataset.type)));
  $$(".tab").forEach((node) => node.addEventListener("click", () => setView(node.dataset.view)));
  $("#recMinSlider").addEventListener("input", (event) => updateRecommendationNumber("min", event.target.value));
  $("#recMaxSlider").addEventListener("input", (event) => updateRecommendationNumber("max", event.target.value));
  $("#recMinInput").addEventListener("input", (event) => updateRecommendationNumber("min", event.target.value));
  $("#recMaxInput").addEventListener("input", (event) => updateRecommendationNumber("max", event.target.value));
  $("#recMouthMinInput").addEventListener("input", (event) => updateRecommendationMouth("mouthMin", event.target.value));
  $("#recMouthMaxInput").addEventListener("input", (event) => updateRecommendationMouth("mouthMax", event.target.value));
  $("#recMarkets").addEventListener("change", (event) => {
    state.recommend.markets = new Set([...event.target.selectedOptions].map((option) => option.value));
    renderRecommendation();
  });
  $("#recNote").addEventListener("input", (event) => {
    state.recommend.note = event.target.value;
    if (state.recommend.generated) renderRecommendation();
  });
  $("#generateRecommendation").addEventListener("click", () => {
    if (!recommendationRangeValid() || !recommendationMouthRangeValid()) return;
    state.recommend.generated = true;
    renderRecommendation();
  });
  $("#resetRecommendation").addEventListener("click", () => {
    resetRecommendationState();
    renderRecommendation();
  });
  $("#showVisual").addEventListener("click", () => setView("visual"));
  $("#showTable").addEventListener("click", () => setView("table"));
  $("#backResults").addEventListener("click", () => setView("results"));
  $("#prevProduct").addEventListener("click", () => {
    const total = filteredItems().length;
    state.currentIndex = total ? (state.currentIndex - 1 + total) % total : 0;
    state.detailImageIndex = 0;
    renderDetail();
  });
  $("#nextProduct").addEventListener("click", () => {
    const total = filteredItems().length;
    state.currentIndex = total ? (state.currentIndex + 1) % total : 0;
    state.detailImageIndex = 0;
    renderDetail();
  });
  $$("[data-jump]").forEach((node) => node.addEventListener("click", () => setView(node.dataset.jump)));
  $("#tableSearch").addEventListener("input", (event) => {
    state.tableSearch = event.target.value;
    renderTable();
  });
  $("#tableFilterColumn").addEventListener("change", (event) => {
    state.tableFilterColumn = event.target.value;
    renderTable();
  });
  $("#tableFilterOperator").addEventListener("change", (event) => {
    state.tableFilterOperator = event.target.value;
    renderTable();
  });
  $("#tableFilterValue").addEventListener("input", (event) => {
    state.tableFilterValue = event.target.value;
    renderTable();
  });
  $("#tableSortColumn").addEventListener("change", (event) => {
    state.tableSortColumn = event.target.value;
    renderTable();
  });
  $("#tableSortDirection").addEventListener("change", (event) => {
    state.tableSortDirection = event.target.value;
    renderTable();
  });
  $("#clearTableFilters").addEventListener("click", () => {
    state.tableSearch = "";
    state.tableFilterColumn = "";
    state.tableFilterOperator = "contains";
    state.tableFilterValue = "";
    state.tableSortColumn = "";
    state.tableSortDirection = "asc";
    $("#tableSearch").value = "";
    renderTable();
  });
  document.addEventListener("click", (event) => {
    const recType = event.target.closest("[data-rec-type]");
    if (recType) {
      event.preventDefault();
      state.recommend.type = recType.dataset.recType;
      state.recommend.markets.clear();
      state.recommend.packages.clear();
      state.recommend.crafts.clear();
      state.recommend.surfaces.clear();
      renderRecommendation();
      return;
    }

    const recChip = event.target.closest("[data-rec-group]");
    if (recChip) {
      event.preventDefault();
      const group = recChip.dataset.recGroup;
      const value = recChip.dataset.value;
      const selected = state.recommend[group];
      selected.has(value) ? selected.delete(value) : selected.add(value);
      renderRecommendation();
      return;
    }

    const earlyPreviewTrigger = event.target.closest("[data-preview-images]");
    if (earlyPreviewTrigger) {
      event.preventDefault();
      const images = (earlyPreviewTrigger.dataset.previewImages || "").split("|").filter(Boolean);
      openPreview(images, Number(earlyPreviewTrigger.dataset.previewIndex) || 0);
      return;
    }

    const recDetail = event.target.closest("[data-rec-detail]");
    if (recDetail) {
      if (event.target.closest(".special-detail")) return;
      event.preventDefault();
      openRecommendationDetail(recDetail.dataset.recDetail);
      return;
    }

    const recAll = event.target.closest("[data-rec-all]");
    if (recAll) {
      event.preventDefault();
      applyRecommendationToFilters();
      state.currentIndex = 0;
      setView("results");
      return;
    }

    const scatterPackage = event.target.closest("[data-scatter-package]");
    if (scatterPackage) {
      event.preventDefault();
      state.cupScatterPackage = scatterPackage.dataset.scatterPackage || "";
      renderCharts();
      return;
    }

    const scatterMaterial = event.target.closest("[data-scatter-material]");
    if (scatterMaterial) {
      event.preventDefault();
      state.bottleScatterMaterial = scatterMaterial.dataset.scatterMaterial || "";
      renderCharts();
      return;
    }

    const scatterReset = event.target.closest("[data-scatter-reset]");
    if (scatterReset && (state.cupScatterPackage || state.bottleScatterMaterial)) {
      state.cupScatterPackage = "";
      state.bottleScatterMaterial = "";
      renderCharts();
      return;
    }

    const detailThumb = event.target.closest("[data-detail-thumb]");
    if (detailThumb) {
      event.preventDefault();
      state.detailImageIndex = Number(detailThumb.dataset.detailThumb) || 0;
      renderDetail();
      syncHeroImageHeight();
      syncMediaRows();
      return;
    }

    const previewTrigger = event.target.closest("[data-preview-images]");
    if (previewTrigger) {
      event.preventDefault();
      const images = (previewTrigger.dataset.previewImages || "").split("|").filter(Boolean);
      openPreview(images, Number(previewTrigger.dataset.previewIndex) || 0);
      return;
    }

    if (event.target.id === "imagePreview") {
      closePreview();
    }
  });
  document.addEventListener("keydown", (event) => {
    const recDetail = event.target.closest?.("[data-rec-detail]");
    if (!recDetail || event.target.closest(".special-detail")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openRecommendationDetail(recDetail.dataset.recDetail);
  });
  $("#previewClose").addEventListener("click", closePreview);
  $("#previewPrev").addEventListener("click", () => movePreview(-1));
  $("#previewNext").addEventListener("click", () => movePreview(1));
  $("#previewZoomIn").addEventListener("click", () => zoomPreview(0.25));
  $("#previewZoomOut").addEventListener("click", () => zoomPreview(-0.25));
  $("#previewZoomReset").addEventListener("click", () => {
    state.preview.zoom = 1;
    renderPreview();
  });
  document.addEventListener("keydown", (event) => {
    if ($("#imagePreview").hidden) return;
    if (event.key === "Escape") closePreview();
    if (event.key === "ArrowLeft") movePreview(-1);
    if (event.key === "ArrowRight") movePreview(1);
    if (event.key === "+" || event.key === "=") zoomPreview(0.25);
    if (event.key === "-") zoomPreview(-0.25);
  });
  window.addEventListener("resize", () => {
    syncHeroImageHeight();
    syncMediaRows();
  });
  document.addEventListener("load", (event) => {
    if (event.target.closest?.(".detail-row.hero")) syncHeroImageHeight();
    if (event.target.closest?.(".detail-row.media-row")) syncMediaRows();
  }, true);
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if (!state.openFilter || event.target.closest("#dynamicFilters")) return;
    state.openFilter = null;
    renderFilters();
  });
  $("#zoomInMap").addEventListener("click", () => updateMapZoom(worldMapZoom * 1.25));
  $("#zoomOutMap").addEventListener("click", () => updateMapZoom(worldMapZoom / 1.25));
  $("#resetMapView").addEventListener("click", () => {
    worldMapZoom = 1.08;
    renderMap();
  });
  $("#xlsxInput").addEventListener("change", handleWorkbookUpload);
  renderAll();
}

init();
