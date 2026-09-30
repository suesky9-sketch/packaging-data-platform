const rawData = window.PACKAGING_DATA || { items: [], sourceFile: "数据表" };
const allItems = rawData.items || [];

const state = {
  openPreference: null,
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
    showAll: false,
    shapeProfile: "regular",
  },
  preview: { images: [], index: 0, zoom: 1 },
};

const $ = (selector) => document.querySelector(selector);
const uniq = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));

function compactText(value) {
  if (Array.isArray(value)) return value.length ? value.join("、") : "未记录";
  return value || "未记录";
}

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

function parseNumber(value) {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
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

function numericValues(value) {
  if (Array.isArray(value)) return value.flatMap(numericValues);
  return String(value || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(values, percentile) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function iqrFiltered(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length < 4) return sorted;
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const filtered = sorted.filter((value) => value >= q1 - 1.5 * iqr && value <= q3 + 1.5 * iqr);
  return filtered.length ? filtered : sorted;
}

function firstDimension(value) {
  return numericValues(value)[0] ?? null;
}

function maxDimension(value) {
  const values = numericValues(value);
  return values.length ? Math.max(...values) : null;
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

function parseDateValue(value) {
  const timestamp = Date.parse(String(value || "").replace(/\//g, "-"));
  return Number.isFinite(timestamp) ? timestamp : 0;
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
  $("#recSort").value = rec.sort;

  const items = allItems.filter((item) => item.type === rec.type);
  setMultiSelectOptions("#recMarkets", uniq(items.map((item) => item.market)), rec.markets);
  renderRecommendChips("#recPackages", recommendPackageOptions(items), rec.packages, "packages");
  renderRecommendChips("#recCrafts", recommendCraftOptions(items), rec.crafts, "crafts");
  renderRecommendChips("#recSurfaces", recommendSurfaceOptions(items), rec.surfaces, "surfaces");
  syncPreferenceDropdowns();
}

function setMultiSelectOptions(selector, values, selectedSet) {
  const select = $(selector);
  select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}" ${selectedSet.has(value) ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function renderRecommendChips(selector, values, selectedSet, group) {
  $(selector).innerHTML = values.length
    ? values.map((value) => `<button class="chip${selectedSet.has(value) ? " active" : ""}" data-rec-group="${group}" data-value="${escapeHtml(value)}" type="button" aria-pressed="${selectedSet.has(value) ? "true" : "false"}">${escapeHtml(value)}</button>`).join("")
    : '<span class="muted-text">暂无可选项</span>';
}

function syncPreferenceDropdowns() {
  document.querySelectorAll(".recommend-multiselect").forEach((dropdown) => {
    const group = dropdown.dataset.preference;
    const selected = state.recommend[group];
    const open = state.openPreference === group;
    const summary = selected.size === 0
      ? "全部"
      : selected.size === 1
        ? [...selected][0]
        : `已选 ${selected.size} 项`;
    dropdown.classList.toggle("open", open);
    dropdown.querySelector(".recommend-multiselect-trigger").setAttribute("aria-expanded", String(open));
    dropdown.querySelector(".recommend-multiselect-trigger small").textContent = summary;
  });
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

function recommendationItems(rangeOverride = null) {
  const rec = state.recommend;
  if (!recommendationRangeValid() || !recommendationMouthRangeValid()) return [];
  const capacityMin = rangeOverride?.min ?? rec.min;
  const capacityMax = rangeOverride?.max ?? rec.max;
  return allItems.filter((item) => {
    if (item.type !== rec.type) return false;
    if (item.specValue === null || item.specValue === undefined) return false;
    if (item.specValue < capacityMin || item.specValue > capacityMax) return false;
    if (!recommendationMouthMatches(item)) return false;
    if (rec.markets.size && !rec.markets.has(item.market)) return false;
    if (rec.packages.size && ![...rec.packages].some((value) => splitTerms(item.packageForm).includes(value))) return false;
    if (rec.crafts.size && ![...rec.crafts].some((value) => splitTerms(recommendCraftValue(item)).includes(value))) return false;
    if (rec.surfaces.size && ![...rec.surfaces].some((value) => surfaceTerms(recommendSurfaceValue(item)).includes(value))) return false;
    return true;
  });
}

function itemShapeDimensions(item) {
  if (item.type === "杯类") {
    return {
      height: firstDimension(item.cupBody?.["高度（mm）"]),
      diameter: maxDimension(item.cupBody?.["口径（mm）"]),
      bottomDiameter: maxDimension(item.cupBody?.["底部直径/宽度（mm）"]),
    };
  }
  return {
    height: firstDimension(item.bodySize?.["高度（mm）"]),
    diameter: maxDimension(item.bodySize?.["宽/直径(mm)"]),
    bottomDiameter: null,
  };
}

function itemShapeRatio(item) {
  const { height, diameter } = itemShapeDimensions(item);
  return height > 0 && diameter > 0 ? height / diameter : null;
}

function shapeRows(items) {
  return items.map((item) => ({ item, ratio: itemShapeRatio(item) })).filter((row) => Number.isFinite(row.ratio));
}

function shapeSubset(items, profile) {
  const rows = shapeRows(items);
  const ratios = rows.map((row) => row.ratio);
  const p25 = quantile(ratios, 0.25);
  const p75 = quantile(ratios, 0.75);
  const selectedRows = profile === "tall"
    ? rows.filter((row) => row.ratio >= p75)
    : profile === "short"
      ? rows.filter((row) => row.ratio <= p25)
      : rows;
  return { rows: selectedRows, p25, p75 };
}

function shapeRecommendationContext(baseItems) {
  const requestedProfile = state.recommend.shapeProfile;
  let poolItems = baseItems;
  let selection = shapeSubset(poolItems, requestedProfile);
  let expanded = false;
  let fallback = false;

  if (requestedProfile !== "regular" && selection.rows.length < 5) {
    const rangeWidth = Math.max(0, Number(state.recommend.max) - Number(state.recommend.min));
    const expansion = Math.max(25, rangeWidth * 0.25);
    const expandedRange = {
      min: Math.max(0, Number(state.recommend.min) - expansion),
      max: Math.min(1000, Number(state.recommend.max) + expansion),
    };
    const expandedItems = recommendationItems(expandedRange);
    const expandedSelection = shapeSubset(expandedItems, requestedProfile);
    if (expandedSelection.rows.length >= 5) {
      poolItems = expandedItems;
      selection = expandedSelection;
      expanded = true;
    } else {
      selection = shapeSubset(baseItems, "regular");
      fallback = true;
    }
  }

  const sampleItems = requestedProfile === "regular" || fallback
    ? baseItems
    : selection.rows.map((row) => row.item);
  const sampleRatios = shapeRows(sampleItems).map((row) => row.ratio);
  return {
    requestedProfile,
    effectiveProfile: fallback ? "regular" : requestedProfile,
    baseItems,
    poolItems,
    sampleItems,
    p25: selection.p25,
    p75: selection.p75,
    ratioMin: sampleRatios.length ? Math.min(...sampleRatios) : null,
    ratioMax: sampleRatios.length ? Math.max(...sampleRatios) : null,
    expanded,
    fallback,
  };
}

function recommendCraftValue(item) {
  return item.type === "杯类" ? compactText(item.labelCraft || item.material?.["模内贴/套标"]) : compactText(item.label);
}

function recommendSurfaceValue(item) {
  return item.type === "杯类" ? compactText(item.material?.["表面处理工艺"]) : compactText(item.surface);
}

function renderRecommendationOutput(items) {
  const shapeContext = shapeRecommendationContext(items);
  $("#recommendOutput").innerHTML = `
    ${state.recommend.note ? `<section class="recommend-section"><h3>需求备注</h3><p class="recommend-note-preview">${escapeHtml(state.recommend.note)}</p></section>` : ""}
    <section class="recommend-section">
      <h3>结构参数推荐</h3>
      ${shapeProfileControls(shapeContext)}
      ${parameterBarChart(recommendParamDefs(state.recommend.type), shapeContext)}
    </section>
    <section class="recommend-section">
      <h3>其他选型参考</h3>
      <div class="distribution-grid">${recommendDistributionBlocks(items).join("")}</div>
    </section>
    <section class="recommend-section">
      <div class="recommend-section-heading">
        <h3>相关竞品参照</h3>
        <small>${state.recommend.showAll ? `展示全部 ${items.length} 个` : "默认展示与推荐值最相似的前 9 个"}</small>
      </div>
      <div class="reference-list">${recommendReferenceRows(items, shapeContext).join("") || '<div class="recommend-empty compact">暂无匹配竞品。</div>'}</div>
      ${items.length > 9 ? `<button class="ghost-button view-all-reference" type="button" data-rec-all="true">${state.recommend.showAll ? "收起参照竞品" : `查看全部 ${items.length} 条竞品`}</button>` : ""}
    </section>
    <section class="recommend-section">
      <h3>结构创新参考</h3>
      <div class="innovation-grid">${recommendInnovationCards(items).join("") || '<div class="recommend-empty compact">当前条件下暂无特殊点或借鉴点记录。</div>'}</div>
    </section>
  `;
}

function shapeProfileControls(context) {
  const labels = { regular: "常规型", tall: "瘦高型", short: "矮胖型" };
  const risk = context.effectiveProfile === "tall"
    ? state.recommend.type === "杯类"
      ? "瘦高杯需关注杯身抗压、壁厚和堆叠稳定性。"
      : "瘦高瓶重心偏高，需关注灌装和运输稳定性。"
    : context.effectiveProfile === "short"
      ? state.recommend.type === "杯类"
        ? "矮胖杯口径较大，需关注杯沿刚性和封口面积。"
        : "矮胖瓶需关注肩部形态与瓶身径比例。"
      : "";
  const notice = context.fallback
    ? "该类型样本不足，已回退至常规型。"
    : context.expanded
      ? "原容量区间样本不足，已放宽一档计算。"
      : risk;
  return `
    <div class="shape-profile-controls" role="group" aria-label="产品形态类型">
      ${Object.entries(labels).map(([value, label]) => `<button class="chip${state.recommend.shapeProfile === value ? " active" : ""}" type="button" data-shape-profile="${value}" aria-pressed="${state.recommend.shapeProfile === value ? "true" : "false"}">${label}</button>`).join("")}
    </div>
    <div class="shape-profile-summary${context.fallback ? " warning" : ""}">
      <b>${labels[context.effectiveProfile]} · 当前子集 ${context.sampleItems.length} 条</b>
      ${notice ? `<small>${escapeHtml(notice)}</small>` : ""}
    </div>
  `;
}

function recommendParamDefs(type) {
  const cupValue = (field) => (item) => item.cupBody?.[field];
  const lidValue = (field) => (item) => item.lid?.[field];
  const bottleValue = (field) => (item) => item.bodySize?.[field];
  const nonScrewValue = (field) => (item) => item.nonScrewMouth?.[field];
  if (type === "杯类") {
    return [
      { key: "height", name: "高度", source: "杯身尺寸数据_高度（mm）", getter: cupValue("高度（mm）") },
      { key: "diameter", name: "杯口径", source: "杯身尺寸数据_口径（mm）", getter: (item) => maxDimension(item.cupBody?.["口径（mm）"]) },
      { key: "bottomDiameter", name: "底部直径", source: "杯身尺寸数据_底部直径/宽度（mm）", getter: (item) => maxDimension(item.cupBody?.["底部直径/宽度（mm）"]) },
      { key: "shapeRatio", name: "高径比 R", source: "杯高 ÷ 杯口外径", getter: itemShapeRatio },
      { key: "dropDiameter", name: "落杯直径", source: "杯身尺寸数据_落杯直径（mm）", getter: cupValue("落杯直径（mm）") },
      { key: "rimWidth", name: "杯沿宽度", source: "杯身尺寸数据_杯沿宽度(mm)", getter: cupValue("杯沿宽度(mm)"), scope: "base" },
      { key: "rimThickness", name: "杯沿厚度", source: "杯身尺寸数据_杯沿厚度（mm）", getter: cupValue("杯沿厚度（mm）"), scope: "base" },
      { key: "stackHeight", name: "堆叠高度", source: "杯身尺寸数据_堆叠高度（mm）", getter: cupValue("堆叠高度（mm）") },
      { key: "bodyWeight", name: "杯身重量", source: "杯身尺寸数据_杯身重量（g）", getter: cupValue("杯身重量（g）"), mode: "lightweight" },
      { key: "bodyThickness", name: "杯身壁厚", source: "杯身尺寸数据_厚度 杯身/杯底（mm）", getter: cupValue("厚度 杯身/杯底（mm）") },
      { key: "lidHeight", name: "杯盖高度", source: "杯盖尺寸数据_杯盖高度（mm）", getter: lidValue("杯盖高度（mm）"), scope: "base" },
      { key: "lidWeight", name: "杯盖重量", source: "杯盖尺寸数据_杯盖重量（g）", getter: lidValue("杯盖重量（g）"), mode: "lightweight", scope: "base" },
      { key: "fillLineHeight", name: "液位线高度", source: "液位线高度（mm）", getter: (item) => item.fillLineHeight },
    ];
  }
  return [
    { key: "height", name: "瓶身高度", source: "瓶身尺寸数据_高度（mm）", getter: bottleValue("高度（mm）") },
    { key: "diameter", name: "瓶身直径/宽度", source: "瓶身尺寸数据_最大宽/直径(mm)", getter: (item) => maxDimension(item.bodySize?.["宽/直径(mm)"]) },
    { key: "shapeRatio", name: "高径比 R", source: "瓶高 ÷ 瓶身最大外径（或宽）", getter: itemShapeRatio },
    { key: "mouthDiameter", name: "瓶口径", source: "旋盖或非旋盖瓶口直径", getter: (item) => maxDimension(item.mouthDiameterRaw) ?? maxDimension(item.nonScrewMouth?.["瓶口直径"]), scope: "base" },
    { key: "sealWidth", name: "热封宽度", source: "非旋盖类瓶口_热封宽度", getter: nonScrewValue("热封宽度"), scope: "base" },
    { key: "preformWeight", name: "瓶胚克重", source: "瓶胚克重（g）", getter: (item) => item.preformWeight, mode: "lightweight" },
    { key: "bodyThickness", name: "瓶身厚度分布", source: "瓶身尺寸数据_瓶身厚度分布 下/中/上", getter: bottleValue("瓶身厚度分布 下/中/上（mm）") },
  ];
}

function parameterStats(def, items) {
  const sourceRows = items.map((item) => ({ item, values: numericValues(def.getter(item)) })).filter((row) => row.values.length);
  const values = iqrFiltered(sourceRows.flatMap((row) => row.values));
  if (!values.length) return null;
  return {
    sourceRows,
    values,
    min: Math.min(...values),
    max: Math.max(...values),
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
    recommended: def.mode === "lightweight" ? Math.min(...values) : median(values),
  };
}

function volumeAdjustment(type, context, statsByKey) {
  if (context.effectiveProfile === "regular") return { overrides: new Map(), notice: "" };
  const height = statsByKey.get("height")?.recommended;
  const diameter = statsByKey.get("diameter")?.recommended;
  const ratio = statsByKey.get("shapeRatio")?.recommended;
  const target = (Number(state.recommend.min) + Number(state.recommend.max)) / 2;
  if (!(height > 0 && diameter > 0 && ratio > 0 && target > 0)) return { overrides: new Map(), notice: "" };

  let estimated = 0;
  let correctedDiameter = diameter;
  let correctedHeight = height;
  let correctedBottom = null;
  if (type === "杯类") {
    const bottom = statsByKey.get("bottomDiameter")?.recommended;
    if (!(bottom > 0)) return { overrides: new Map(), notice: "" };
    estimated = Math.PI * height * (diameter ** 2 + diameter * bottom + bottom ** 2) / 12000;
    if (Math.abs(estimated - target) / target <= 0.05) return { overrides: new Map(), notice: "" };
    const bottomRatioValues = context.sampleItems.map((item) => {
      const dims = itemShapeDimensions(item);
      return dims.bottomDiameter > 0 && dims.diameter > 0 ? dims.bottomDiameter / dims.diameter : null;
    }).filter(Number.isFinite);
    const bottomRatio = median(iqrFiltered(bottomRatioValues)) || bottom / diameter;
    correctedDiameter = Math.cbrt(target * 12000 / (Math.PI * ratio * (1 + bottomRatio + bottomRatio ** 2)));
    correctedHeight = ratio * correctedDiameter;
    correctedBottom = bottomRatio * correctedDiameter;
  } else {
    const factors = context.sampleItems.map((item) => {
      const dims = itemShapeDimensions(item);
      const cylinder = dims.height > 0 && dims.diameter > 0 ? Math.PI * dims.diameter ** 2 * dims.height / 4000 : 0;
      return cylinder > 0 && item.specValue > 0 ? item.specValue / cylinder : null;
    }).filter(Number.isFinite);
    const shapeFactor = median(iqrFiltered(factors));
    if (!(shapeFactor > 0)) return { overrides: new Map(), notice: "" };
    estimated = shapeFactor * Math.PI * diameter ** 2 * height / 4000;
    if (Math.abs(estimated - target) / target <= 0.05) return { overrides: new Map(), notice: "" };
    correctedDiameter = Math.cbrt(target * 4000 / (shapeFactor * Math.PI * ratio));
    correctedHeight = ratio * correctedDiameter;
  }

  const overrides = new Map([
    ["height", correctedHeight],
    ["diameter", correctedDiameter],
  ]);
  if (correctedBottom !== null) overrides.set("bottomDiameter", correctedBottom);
  return {
    overrides,
    notice: `容量校验：估算 ${formatNumber(estimated)} ml，与目标 ${formatNumber(target)} ml 偏差超过 ±5%，已保持 R 不变修正高度和直径。`,
  };
}

function parameterBarChart(defs, context) {
  const statsByKey = new Map(defs.map((def) => [def.key, parameterStats(def, def.scope === "base" ? context.baseItems : context.sampleItems)]));
  const adjustment = volumeAdjustment(state.recommend.type, context, statsByKey);
  return `
    <div class="parameter-bar-chart" role="img" aria-label="结构参数推荐条形图">
      <div class="parameter-bar-head">
        <span>参数</span>
        <span>推荐范围与推荐值</span>
        <span>结论</span>
      </div>
      ${defs.map((def) => parameterBarRow(def, statsByKey.get(def.key), adjustment.overrides.get(def.key))).join("")}
    </div>
  `;
}

function parameterBarRow(def, stats, recommendedOverride) {
  if (!stats) {
    return `
      <article class="parameter-bar-row empty">
        <h4>${escapeHtml(def.name)}</h4>
        <div class="parameter-bar-empty">暂无有效数据</div>
        <small title="${escapeHtml(def.source)}">来源：${escapeHtml(def.source)}</small>
      </article>
    `;
  }
  const recommended = recommendedOverride ?? stats.recommended;
  const assist = def.mode === "lightweight" ? `轻量化下限 ${formatNumber(recommended)}` : `推荐值 ${formatNumber(recommended)}`;
  const tooltip = stats.sourceRows.map(({ item }) => `${item.name || "未命名"}｜${item.brand || "未知品牌"}｜${item.market || "未知市场"}`).join("\n");
  const markerLeft = stats.p75 === stats.p25 ? 50 : ((recommended - stats.p25) / (stats.p75 - stats.p25)) * 100;
  const fillWidth = Math.max(8, Math.min(100, markerLeft));
  return `
    <article class="parameter-bar-row" title="${escapeHtml(tooltip)}">
      <h4>${escapeHtml(def.name)}</h4>
      <div class="parameter-bar-body">
        <div class="parameter-bar-track">
          <span style="width:${Math.max(0, Math.min(100, fillWidth))}%"></span>
          <i style="left:${Math.max(0, Math.min(100, markerLeft))}%"></i>
        </div>
        <div class="range-labels"><span>P25 ${formatNumber(stats.p25)}</span><b>${formatNumber(recommended)}</b><span>P75 ${formatNumber(stats.p75)}</span></div>
      </div>
      <div class="parameter-bar-meta">
        <b class="parameter-value-tip" tabindex="0">
          ${escapeHtml(assist)}
          <small role="tooltip">基于 ${stats.sourceRows.length} 条竞品数据，已执行 1.5×IQR 异常值剔除<br>${escapeHtml(def.source)}</small>
        </b>
      </div>
    </article>
  `;
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

function recommendReferenceRows(items, shapeContext) {
  const sorted = sortRecommendationItemsByRecommendedValues(items, shapeContext);
  const rows = state.recommend.showAll ? sorted : sorted.slice(0, 9);
  return rows.map((item) => {
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
            ${hasSpecial ? `<details class="special-detail"><summary>有特殊结构</summary><p>${escapeHtml(specialText)}</p></details>` : ""}
          </div>
        </div>
      </article>
    `;
  });
}

function sortRecommendationItemsByRecommendedValues(items, shapeContext) {
  const defs = recommendParamDefs(state.recommend.type);
  const parameterItems = shapeContext?.sampleItems || items;
  const stats = defs.map((def) => recommendationParamStats(def, def.scope === "base" ? items : parameterItems)).filter(Boolean);
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
  const values = iqrFiltered(items.flatMap((item) => numericValues(def.getter(item))));
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const recommended = def.mode === "lightweight" ? min : median(values);
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

function resetRecommendationState() {
  state.openPreference = null;
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
    showAll: false,
    shapeProfile: "regular",
  };
}

function updateRecommendationNumber(key, value) {
  const next = Math.max(0, Math.min(1000, Number(value) || 0));
  state.recommend[key] = next;
  state.recommend.showAll = false;
  renderRecommendation();
}

function updateRecommendationMouth(key, value) {
  state.recommend[key] = value;
  state.recommend.showAll = false;
  renderRecommendation();
}

function openReferenceDetail(id) {
  const item = allItems.find((entry) => entry.id === id);
  if (!item) return;
  const images = imageList([
    ...(item.productImages || []),
    item.productImage,
    ...(item.cupBody?.["杯底图片"] || []),
    ...(item.lid?.["盖、勺等其他配件组合方式"] || []),
    ...(item.special?.["图片"] || []),
  ]);
  $("#referenceDetailTitle").textContent = item.name || "竞品详情";
  $("#referenceDetailBody").innerHTML = referenceDetailHtml(item, images);
  $("#referenceDetail").hidden = false;
}

function closeReferenceDetail() {
  $("#referenceDetail").hidden = true;
}

function referenceDetailHtml(item, images) {
  const mainImage = images[0] || firstProductImage(item);
  const bodyMetrics = item.type === "杯类"
    ? [
      ["口径", item.cupBody?.["口径（mm）"]],
      ["高度", item.cupBody?.["高度（mm）"]],
      ["落杯直径", item.cupBody?.["落杯直径（mm）"]],
      ["杯沿宽度", item.cupBody?.["杯沿宽度(mm)"]],
      ["杯身重量", item.cupBody?.["杯身重量（g）"]],
      ["堆叠高度", item.cupBody?.["堆叠高度（mm）"]],
      ["杯底类型", item.bottomType || item.cupBody?.["杯底类型"]],
    ]
    : [
      ["瓶身高度", item.bodySize?.["高度（mm）"]],
      ["瓶身直径/宽度", item.bodySize?.["宽/直径(mm)"]],
      ["瓶身厚度", item.bodySize?.["瓶身厚度分布 下/中/上（mm）"]],
      ["瓶口直径", item.mouthDiameterRaw || item.nonScrewMouth?.["瓶口直径"]],
      ["热封宽度", item.nonScrewMouth?.["热封宽度"]],
      ["瓶胚克重", item.preformWeight],
      ["瓶身材质", item.materialName],
    ];
  const craftRows = item.type === "杯类"
    ? [
      ["包装形式", item.packageForm],
      ["标签工艺", recommendCraftValue(item)],
      ["表面处理", recommendSurfaceValue(item)],
      ["盖膜特性", item.filmFeature || item.material?.["盖膜"]],
      ["杯盖高度", item.lid?.["杯盖高度（mm）"]],
      ["杯盖重量", item.lid?.["杯盖重量（g）"]],
    ]
    : [
      ["包装形式", item.packageForm],
      ["标签类型", recommendCraftValue(item)],
      ["表面处理", recommendSurfaceValue(item)],
      ["瓶盖类型", item.capType],
      ["瓶口类型", item.mouthType],
      ["瓶身材质", item.materialName],
    ];
  const tags = uniq([item.type, item.market, item.brand, item.spec, recommendCraftValue(item), recommendSurfaceValue(item)].filter((value) => value && value !== "未记录"));
  const specialRows = [
    item.special?.描述 ? `<p><b>特殊点：</b>${escapeHtml(item.special.描述)}</p>` : "",
    item.special?.借鉴点 ? `<p><b>借鉴点：</b>${escapeHtml(item.special.借鉴点)}</p>` : "",
  ].join("");

  return `
    <div class="reference-detail-hero">
      <button class="reference-detail-image${mainImage ? " has-image" : ""}" type="button" ${mainImage ? previewAttrs(images.length ? images : [mainImage], 0) : ""}>
        ${mainImage ? `<img src="${escapeHtml(imageSrc(mainImage))}" alt="${escapeHtml(item.name || "产品图")}" loading="lazy">` : "暂无产品图"}
      </button>
      <div class="reference-detail-meta">
        <h3>${escapeHtml(item.name || "未命名产品")}</h3>
        <div class="reference-detail-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <p class="muted-text">记录日期：${escapeHtml(compactText(item.date))}</p>
        ${specialRows ? `<div class="reference-detail-special">${specialRows}</div>` : ""}
      </div>
    </div>
    <div class="reference-detail-grid">
      ${detailMetricCard("基础信息", [
        ["类别", item.type],
        ["市场", item.market],
        ["品牌", item.brand],
        ["规格", item.spec],
        ["容量数值", item.specValue],
      ])}
      ${detailMetricCard("结构参数", bodyMetrics)}
      ${detailMetricCard("工艺与材料", craftRows)}
      ${images.length > 1 ? detailImagesCard(images) : detailMetricCard("图片", [["产品图", mainImage ? "点击主图可放大查看" : "暂无"]])}
    </div>
  `;
}

function detailMetricCard(title, rows) {
  const content = rows
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(compactText(value))}</dd>`)
    .join("");
  return `<article><h4>${escapeHtml(title)}</h4><dl>${content || "<dt>暂无</dt><dd>未记录</dd>"}</dl></article>`;
}

function detailImagesCard(images) {
  return `
    <article>
      <h4>相关图片</h4>
      <div class="reference-detail-tags">
        ${images.map((src, index) => `<button class="chip" type="button" ${previewAttrs(images, index)}>图片 ${index + 1}</button>`).join("")}
      </div>
    </article>
  `;
}

function previewAttrs(images, index = 0) {
  const encoded = images.map((src) => encodeURIComponent(src)).join("|");
  return `data-preview-images="${encoded}" data-preview-index="${index}"`;
}

function openPreview(images, index = 0) {
  state.preview.images = images.map((src) => decodeURIComponent(src)).filter(Boolean);
  state.preview.index = Math.max(0, Math.min(index, state.preview.images.length - 1));
  state.preview.zoom = 1;
  renderPreview();
  $("#imagePreview").hidden = false;
}

function closePreview() {
  $("#imagePreview").hidden = true;
  state.preview = { images: [], index: 0, zoom: 1 };
}

function renderPreview() {
  const total = state.preview.images.length;
  const src = total ? state.preview.images[state.preview.index] : "";
  $("#previewImage").src = imageSrc(src);
  $("#previewCounter").textContent = total ? `${state.preview.index + 1} / ${total}` : "0 / 0";
  $("#previewPrev").disabled = total <= 1;
  $("#previewNext").disabled = total <= 1;
  const zoom = state.preview.zoom;
  $("#previewImage").style.transform = `scale(${zoom})`;
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
  $("#recMinSlider").addEventListener("input", (event) => updateRecommendationNumber("min", event.target.value));
  $("#recMaxSlider").addEventListener("input", (event) => updateRecommendationNumber("max", event.target.value));
  $("#recMinInput").addEventListener("input", (event) => updateRecommendationNumber("min", event.target.value));
  $("#recMaxInput").addEventListener("input", (event) => updateRecommendationNumber("max", event.target.value));
  $("#recMouthMinInput").addEventListener("input", (event) => updateRecommendationMouth("mouthMin", event.target.value));
  $("#recMouthMaxInput").addEventListener("input", (event) => updateRecommendationMouth("mouthMax", event.target.value));
  $("#recMarkets").addEventListener("change", (event) => {
    state.recommend.markets = new Set([...event.target.selectedOptions].map((option) => option.value));
    state.recommend.showAll = false;
    renderRecommendation();
  });
  $("#recNote").addEventListener("input", (event) => {
    state.recommend.note = event.target.value;
    if (state.recommend.generated) renderRecommendation();
  });
  $("#recSort").addEventListener("change", (event) => {
    state.recommend.sort = event.target.value;
    renderRecommendation();
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
  document.addEventListener("click", (event) => {
    const preferenceTrigger = event.target.closest(".recommend-multiselect-trigger");
    if (preferenceTrigger) {
      event.preventDefault();
      const group = preferenceTrigger.closest(".recommend-multiselect").dataset.preference;
      state.openPreference = state.openPreference === group ? null : group;
      syncPreferenceDropdowns();
      return;
    }
    if (state.openPreference && !event.target.closest(".recommend-multiselect")) {
      state.openPreference = null;
      syncPreferenceDropdowns();
    }

    const recType = event.target.closest("[data-rec-type]");
    if (recType) {
      event.preventDefault();
      state.recommend.type = recType.dataset.recType;
      state.recommend.markets.clear();
      state.recommend.packages.clear();
      state.recommend.crafts.clear();
      state.recommend.surfaces.clear();
      state.recommend.showAll = false;
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
      state.recommend.showAll = false;
      renderRecommendation();
      return;
    }

    const shapeProfile = event.target.closest("[data-shape-profile]");
    if (shapeProfile) {
      event.preventDefault();
      state.recommend.shapeProfile = shapeProfile.dataset.shapeProfile;
      state.recommend.showAll = false;
      renderRecommendation();
      return;
    }

    const recAll = event.target.closest("[data-rec-all]");
    if (recAll) {
      event.preventDefault();
      state.recommend.showAll = !state.recommend.showAll;
      renderRecommendation();
      return;
    }

    const recDetail = event.target.closest("[data-rec-detail]");
    if (recDetail) {
      if (event.target.closest(".special-detail")) return;
      event.preventDefault();
      openReferenceDetail(recDetail.dataset.recDetail);
      return;
    }

    const previewTrigger = event.target.closest("[data-preview-images]");
    if (previewTrigger) {
      event.preventDefault();
      const images = (previewTrigger.dataset.previewImages || "").split("|").filter(Boolean);
      openPreview(images, Number(previewTrigger.dataset.previewIndex) || 0);
      return;
    }

    if (event.target.id === "referenceDetail") closeReferenceDetail();
    if (event.target.id === "imagePreview") closePreview();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.openPreference) {
      state.openPreference = null;
      syncPreferenceDropdowns();
      return;
    }
    const recDetail = event.target.closest?.("[data-rec-detail]");
    if (recDetail && !event.target.closest(".special-detail") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openReferenceDetail(recDetail.dataset.recDetail);
      return;
    }
    if (!$("#imagePreview").hidden) {
      if (event.key === "Escape") closePreview();
      if (event.key === "ArrowLeft") movePreview(-1);
      if (event.key === "ArrowRight") movePreview(1);
      if (event.key === "+" || event.key === "=") zoomPreview(0.25);
      if (event.key === "-") zoomPreview(-0.25);
      return;
    }
    if (!$("#referenceDetail").hidden && event.key === "Escape") closeReferenceDetail();
  });
  $("#referenceDetailClose").addEventListener("click", closeReferenceDetail);
  $("#previewClose").addEventListener("click", closePreview);
  $("#previewPrev").addEventListener("click", () => movePreview(-1));
  $("#previewNext").addEventListener("click", () => movePreview(1));
  $("#previewZoomIn").addEventListener("click", () => zoomPreview(0.25));
  $("#previewZoomOut").addEventListener("click", () => zoomPreview(-0.25));
  $("#previewZoomReset").addEventListener("click", () => {
    state.preview.zoom = 1;
    renderPreview();
  });

  // --- URL parameter auto-fill (from AI concept generator) ---
  try {
    const params = new URLSearchParams(window.location.search);
    const urlType = params.get("type");
    const urlMin = parseInt(params.get("min") || "", 10);
    const urlMax = parseInt(params.get("max") || "", 10);
    const urlMarket = params.get("market");
    const urlSource = params.get("source");
    const urlShape = params.get("shape");

    if (urlType === "杯类" || urlType === "瓶类") {
      state.recommend.type = urlType;
    }
    if (Number.isFinite(urlMin) && urlMin > 0) state.recommend.min = urlMin;
    if (Number.isFinite(urlMax) && urlMax > 0) state.recommend.max = Math.max(urlMax, state.recommend.min + 10);
    if (urlMarket) {
      const markets = Array.from($("#recMarkets").options).map(o => o.value);
      urlMarket.split(/[,，]/).map(s => s.trim()).forEach(m => {
        if (markets.includes(m)) state.recommend.markets.add(m);
      });
    }
    if (urlShape === "regular" || urlShape === "slim" || urlShape === "stout") {
      state.recommend.shapeProfile = urlShape;
    }
    if (urlSource) {
      const banner = document.getElementById("sourceBanner");
      const bannerText = document.getElementById("sourceBannerText");
      if (banner && bannerText) {
        banner.style.display = "flex";
        bannerText.textContent = decodeURIComponent(urlSource);
      }
      state.recommend.generated = true;
    }
  } catch (e) { console.warn("URL param parse failed:", e); }

  renderRecommendation();
}

init();
