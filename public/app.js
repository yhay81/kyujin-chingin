const MAX_COMPARE = 4;
const STORAGE_KEY = "kyujin-chingin:compare:v1";

const search = document.querySelector("#search");
const region = document.querySelector("#region");
const sort = document.querySelector("#sort");
const employment = document.querySelector("#employment");
const basis = document.querySelector("#basis");
const industry = document.querySelector("#industry");
const results = document.querySelector("#results");
const resultCount = document.querySelector("#result-count");
const dataStatus = document.querySelector("#data-status");
const compareList = document.querySelector("#compare-list");
const compareCount = document.querySelector("#compare-count");
const copyCompare = document.querySelector("#copy-compare");

let index = null;
let records = [];
let recordMap = new Map();
let selected = loadSelected();
let searchTimer;
let noResultReported = false;

const isPrivacyEnabled = () =>
  navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
const isQa = () => navigator.webdriver === true || new URLSearchParams(location.search).has("qa");
const getSession = () => {
  const key = "kyujin-chingin:session:v1";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
};
const track = (name) => {
  if (isPrivacyEnabled()) return;
  fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kyujin-chingin-session": getSession(),
      "x-kyujin-chingin-qa": isQa() ? "1" : "0",
    },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => undefined);
};

function loadSelected() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string").slice(0, MAX_COMPARE)
      : [];
  } catch {
    return [];
  }
}
function saveSelected() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    // Comparison remains available for the current page view.
  }
}

const normalize = (value) => value.normalize("NFKC").toLocaleLowerCase("ja").replaceAll(/\s/gu, "");
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const number = new Intl.NumberFormat("ja-JP");
const selectedIndustry = () => index.industries.find((item) => item.id === industry.value);
const selectedRecord = (placeId) => recordMap.get(`${placeId}|${industry.value}`);
const seriesFor = (record) => record?.[employment.value]?.[basis.value] ?? [null, null];
const valuesFor = (placeId) => seriesFor(selectedRecord(placeId));
const currentValue = (placeId) => valuesFor(placeId)[1];
const displayValue = (value) => {
  if (value === null) return "—";
  return employment.value === "fullTime"
    ? `¥${number.format(value * 1000)}`
    : `¥${number.format(value)}`;
};
const shortValue = (value) => {
  if (value === null) return "—";
  return employment.value === "fullTime"
    ? `${number.format(value)}千円`
    : `${number.format(value)}円`;
};
const unitLabel = () => (employment.value === "fullTime" ? "/ 月" : "/ 時間");
const employmentLabel = () =>
  employment.value === "fullTime" ? "パートを除く常用" : "常用的パート";
const basisLabel = () => (basis.value === "workplace" ? "就業地" : "受理地");
const changeOf = (placeId) => {
  const [previous, current] = valuesFor(placeId);
  return previous === null || current === null ? null : current - previous;
};
const changePercent = (placeId) => {
  const [previous, current] = valuesFor(placeId);
  return previous === null || current === null || previous === 0
    ? null
    : ((current - previous) / previous) * 100;
};

function metricRange() {
  const values = index.places
    .map((place) => currentValue(place.id))
    .filter((value) => typeof value === "number");
  return { min: Math.min(...values), max: Math.max(...values) };
}
function wageBar(placeId, label) {
  const [previous, current] = valuesFor(placeId);
  if (current === null)
    return `<div class="missing-bar" aria-label="${escapeHtml(label)}は非公表">非公表</div>`;
  const range = metricRange();
  const span = Math.max(1, range.max - range.min);
  const width = Math.max(5, ((current - range.min) / span) * 95 + 5);
  const marker =
    previous === null ? null : Math.max(0, Math.min(100, ((previous - range.min) / span) * 95 + 5));
  return `<svg aria-label="${escapeHtml(label)}" class="wage-bar" preserveAspectRatio="none" role="img" viewBox="0 0 100 18">
    <rect class="wage-track" height="8" rx="4" width="100" x="0" y="5"></rect>
    <rect class="wage-fill" height="8" rx="4" width="${width.toFixed(2)}" x="0" y="5"></rect>
    ${marker === null ? "" : `<line class="previous-marker" x1="${marker.toFixed(2)}" x2="${marker.toFixed(2)}" y1="2" y2="16"></line>`}
    <title>${escapeHtml(label)}。2024年度 ${shortValue(previous)}</title>
  </svg>`;
}

function renderCompare() {
  const places = selected
    .map((id) => index.places.find((place) => place.id === id))
    .filter(Boolean);
  compareCount.textContent = `${places.length} / ${MAX_COMPARE}`;
  copyCompare.disabled = places.length === 0;
  if (places.length === 0) {
    compareList.className = "empty-compare";
    compareList.textContent = "一覧の「比較に追加」から、2〜4地域を選んでください。";
    return;
  }
  compareList.className = "compare-list";
  compareList.innerHTML = places
    .map((place) => {
      const [previous, current] = valuesFor(place.id);
      const change = changeOf(place.id);
      const percent = changePercent(place.id);
      return `<article class="compare-row">
      <div class="compare-place"><span>${escapeHtml(place.region)}</span><strong>${escapeHtml(place.name)}</strong></div>
      <div class="compare-wage"><strong>${displayValue(current)}</strong><span>${unitLabel()}</span>${wageBar(place.id, `${place.name} ${shortValue(current)}`)}</div>
      <dl class="compare-stats">
        <div><dt>2024年度</dt><dd>${shortValue(previous)}</dd></div>
        <div><dt>前年差</dt><dd>${change === null ? "—" : `${change >= 0 ? "+" : ""}${shortValue(change)}`} ${percent === null ? "" : `<small>${percent.toFixed(1)}%</small>`}</dd></div>
        <div><dt>条件</dt><dd>${escapeHtml(basisLabel())} · ${escapeHtml(selectedIndustry().name)}</dd></div>
      </dl>
      <button aria-label="${escapeHtml(place.name)}を比較から外す" class="remove-button" data-remove="${place.id}" type="button">×</button>
    </article>`;
    })
    .join("");
}

function visiblePlaces() {
  const term = normalize(search.value);
  const selectedRegion = region.value;
  const filtered = index.places.filter((place) => {
    const haystack = normalize(`${place.name}${place.region}`);
    return (
      (!term || haystack.includes(term)) &&
      (selectedRegion === "all" || place.region === selectedRegion)
    );
  });
  const sorted = [...filtered];
  const numericSort = (getter) => (a, b) => {
    const aValue = getter(a.id);
    const bValue = getter(b.id);
    if (aValue === null && bValue === null) return a.id.localeCompare(b.id);
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return bValue - aValue || a.id.localeCompare(b.id);
  };
  if (sort.value === "value-desc") sorted.sort(numericSort(currentValue));
  if (sort.value === "change-desc") sorted.sort(numericSort(changeOf));
  if (sort.value === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return sorted;
}

function renderResults() {
  const visible = visiblePlaces();
  resultCount.textContent = number.format(visible.length);
  const range = metricRange();
  if (visible.length === 0) {
    results.innerHTML =
      '<div class="no-results"><span>0</span><h3>一致する地域がありません</h3><p>都道府県名を短くするか、地域を「すべて」に戻してください。</p></div>';
    if (!noResultReported) {
      noResultReported = true;
      track("no_result");
    }
    return;
  }
  noResultReported = false;
  results.innerHTML = visible
    .map((place) => {
      const [previous, current] = valuesFor(place.id);
      const change = changeOf(place.id);
      const percent = changePercent(place.id);
      const active = selected.includes(place.id);
      const disabled = !active && selected.length >= MAX_COMPARE;
      return `<article class="wage-card">
      <div class="wage-heading"><div><p>${escapeHtml(place.region)} · ${escapeHtml(place.id)}</p><h3>${escapeHtml(place.name)}</h3></div><strong>${displayValue(current)}<small>${unitLabel()}</small></strong></div>
      ${wageBar(place.id, `${place.name}の2025年度平均求人賃金 ${shortValue(current)}`)}
      <div class="scale-labels"><span>${shortValue(range.min)}</span><span>${shortValue(range.max)}</span></div>
      <dl class="wage-meta"><div><dt>2024年度</dt><dd>${shortValue(previous)}</dd></div><div><dt>前年差</dt><dd>${change === null ? "—" : `${change >= 0 ? "+" : ""}${shortValue(change)}`}<small>${percent === null ? "" : `${percent.toFixed(1)}%`}</small></dd></div><div><dt>条件</dt><dd>${escapeHtml(basisLabel())}</dd></div></dl>
      <button class="compare-button${active ? " is-selected" : ""}" data-select="${place.id}" ${disabled ? "disabled" : ""} type="button">${active ? "比較中" : disabled ? "4地域を選択済み" : "比較に追加"}</button>
    </article>`;
    })
    .join("");
}

function renderAll() {
  renderCompare();
  renderResults();
}
function toggleSelected(id) {
  if (selected.includes(id)) selected = selected.filter((item) => item !== id);
  else if (selected.length < MAX_COMPARE) {
    selected = [...selected, id];
    track("compared");
  }
  saveSelected();
  renderAll();
}

results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select]");
  if (button) toggleSelected(button.dataset.select);
});
compareList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (button) toggleSelected(button.dataset.remove);
});
search.addEventListener("input", () => {
  renderResults();
  clearTimeout(searchTimer);
  if (search.value.trim()) searchTimer = setTimeout(() => track("searched"), 650);
});
region.addEventListener("change", () => {
  renderResults();
  track("region_changed");
});
sort.addEventListener("change", () => {
  renderResults();
  track("sort_changed");
});
for (const control of [employment, basis, industry])
  control.addEventListener("change", () => {
    renderAll();
    track("filter_changed");
  });
copyCompare.addEventListener("click", async () => {
  const lines = selected
    .map((id) => index.places.find((place) => place.id === id))
    .filter(Boolean)
    .map((place) => {
      const [previous, current] = valuesFor(place.id);
      const change = changeOf(place.id);
      return `${place.name}｜2025年度 ${shortValue(current)}${unitLabel()}｜2024年度 ${shortValue(previous)}｜前年差 ${change === null ? "—" : `${change >= 0 ? "+" : ""}${shortValue(change)}`}`;
    });
  await navigator.clipboard.writeText(
    [
      `平均求人賃金（2025年度・${employmentLabel()}・${basisLabel()}・${selectedIndustry().name}）`,
      ...lines,
      "ハローワーク取扱求人の平均。実支給額・全求人市場・中央値ではありません。",
      "出典：厚生労働省「職業安定業務統計 雇用関係指標 第9表」",
    ].join("\n"),
  );
  copyCompare.textContent = "コピーしました";
  setTimeout(() => {
    copyCompare.textContent = "比較をコピー";
  }, 1600);
  track("copied");
});

Promise.all([
  fetch("/data/index.json").then((response) => {
    if (!response.ok) throw new Error("index_unavailable");
    return response.json();
  }),
  fetch("/data/wages.json").then((response) => {
    if (!response.ok) throw new Error("data_unavailable");
    return response.json();
  }),
])
  .then(([indexData, wageData]) => {
    index = indexData;
    records = wageData;
    recordMap = new Map(
      records.map((record) => [`${record.placeId}|${record.industryId}`, record]),
    );
    const validIds = new Set(index.places.map((place) => place.id));
    selected = selected.filter((id) => validIds.has(id));
    saveSelected();
    industry.innerHTML = index.industries
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
      .join("");
    const regions = [...new Set(index.places.map((place) => place.region))];
    region.insertAdjacentHTML(
      "beforeend",
      regions
        .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join(""),
    );
    dataStatus.textContent = "全国・47労働局 · 19産業 · 2025年度";
    renderAll();
    track("visited");
  })
  .catch(() => {
    dataStatus.textContent = "データを読み込めませんでした。再読み込みしてください。";
    results.innerHTML =
      '<div class="no-results"><h3>公式表を表示できません</h3><p>通信状態を確認して、ページを再読み込みしてください。</p></div>';
  });
