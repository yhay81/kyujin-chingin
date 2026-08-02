import { Hono } from "hono";
import type { Context } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";

type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message);
  }
}

const origin = "https://kyujin-chingin.yhay81.com";
const dataPage = "https://www.mhlw.go.jp/toukei/list/114-1d.html";
const sourceWorkbook = "https://www.mhlw.go.jp/toukei/list/xls/114-1d-09.xlsx";
const termsPage = "https://www.mhlw.go.jp/toukei/list/114-1_yougo.html";
const useTerms = "https://www.mhlw.go.jp/chosakuken/index.html";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "searched",
  "no_result",
  "region_changed",
  "sort_changed",
  "filter_changed",
  "compared",
  "copied",
]);

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  if (Number(c.req.header("content-length") ?? "0") > 512)
    throw new ApiError("invalid_payload", 400);
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-kyujin-chingin-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-kyujin-chingin-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const nav = [
  { href: "/", label: "くらべる" },
  { href: "/guide", label: "数字の見方" },
  { href: "/source", label: "出典" },
  { href: "/privacy", label: "保存" },
];

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="ja_JP" property="og:locale" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#24362f" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
    </head>
    <body>
      <header class="site-header">
        <a aria-label="求人賃金くらべ ホーム" class="brand" href="/">
          <span aria-hidden="true" class="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>求人賃金くらべ</span>
        </a>
        <nav aria-label="主なページ">
          {nav.map((item) => (
            <a href={item.href}>{item.label}</a>
          ))}
        </nav>
      </header>
      {children}
      <footer>
        <div>
          <strong>求人賃金くらべ</strong>
          <p>厚生労働省「職業安定業務統計 雇用関係指標」を加工して作成</p>
        </div>
        <div class="footer-links">
          <a href="/source">出典と注意</a>
          <a href="/privacy">保存と計測</a>
          <a href="https://github.com/yhay81/kyujin-chingin">ソースコード</a>
        </div>
      </footer>
    </body>
  </html>
);

const JobBoardFigure = () => (
  <div aria-label="産業別の求人票を留めた掲示板" class="job-board" role="img">
    <div class="board-grid" />
    <div class="pin pin-one" />
    <article class="job-slip slip-main">
      <span>就業地 · 産業計</span>
      <strong>月給 261千円</strong>
      <div class="slip-rule">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <p>全国 · パートを除く常用</p>
    </article>
    <div class="pin pin-two" />
    <article class="job-slip slip-side">
      <span>常用的パート</span>
      <strong>時給 1,265円</strong>
      <p>2025年度</p>
    </article>
    <div class="industry-tabs" aria-hidden="true">
      <span>製造</span>
      <span>情報</span>
      <span>医療</span>
      <span>建設</span>
    </div>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="厚生労働省の2025年度平均求人賃金を、全国・47労働局、19産業、雇用区分、受理地・就業地から選び、最大4地域で比較できます。"
    title="地域と産業で平均求人賃金を比較 | 求人賃金くらべ"
  >
    <main>
      <section class="hero-shell">
        <div class="hero-copy">
          <p class="eyebrow">2025年度 · ハローワーク求人</p>
          <h1>求人票の賃金を、地域と産業で。</h1>
          <p class="lead">
            働く場所、産業、雇用区分をそろえて、求人票に記載された平均賃金を横に並べます。
          </p>
          <div aria-label="収録内容" class="hero-facts">
            <span>
              <b>48</b> 全国・労働局
            </span>
            <span>
              <b>19</b> 産業区分
            </span>
            <span>
              <b>最大4</b> 地域比較
            </span>
          </div>
        </div>
        <JobBoardFigure />
      </section>

      <section aria-labelledby="compare-title" class="compare-panel">
        <div class="section-heading compare-heading">
          <div>
            <p class="eyebrow">JOB BOARD</p>
            <h2 id="compare-title">条件をそろえて並べる</h2>
          </div>
          <div class="compare-actions">
            <span id="compare-count">0 / 4</span>
            <button disabled id="copy-compare" type="button">
              比較をコピー
            </button>
          </div>
        </div>
        <div class="metric-controls">
          <label>
            <span>雇用区分</span>
            <select id="employment">
              <option value="fullTime">パートを除く常用 · 月給</option>
              <option value="partTime">常用的パート · 時給</option>
            </select>
          </label>
          <label>
            <span>地域の基準</span>
            <select id="basis">
              <option value="workplace">就業地（働く場所）</option>
              <option value="reception">受理地（求人を受け付けた場所）</option>
            </select>
          </label>
          <label>
            <span>産業</span>
            <select id="industry" />
          </label>
        </div>
        <p class="metric-note">
          2025年度の平均と2024年度差を表示します。値が非公表の組合せは「—」のまま扱います。
        </p>
        <div class="empty-compare" id="compare-list">
          一覧の「比較に追加」から、2〜4地域を選んでください。
        </div>
      </section>

      <section aria-labelledby="finder-title" class="finder">
        <div class="section-heading">
          <div>
            <p class="eyebrow">LABOUR BUREAU INDEX</p>
            <h2 id="finder-title">地域を選ぶ</h2>
          </div>
          <p id="data-status" role="status">
            公式表を読み込んでいます
          </p>
        </div>
        <div class="controls">
          <label class="search-field">
            <span>都道府県・全国</span>
            <input
              autocomplete="off"
              id="search"
              placeholder="例：東京、福岡、全国"
              type="search"
            />
          </label>
          <label>
            <span>地域</span>
            <select id="region">
              <option value="all">すべて</option>
            </select>
          </label>
          <label>
            <span>並び順</span>
            <select id="sort">
              <option value="source">都道府県コード順</option>
              <option value="value-desc">2025年度が高い順</option>
              <option value="change-desc">上げ幅が大きい順</option>
              <option value="name">名前順</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="results-title" class="results-section">
        <div class="results-heading">
          <h2 id="results-title">平均求人賃金</h2>
          <p>
            <b id="result-count">—</b> 地域
          </p>
        </div>
        <div class="wage-grid" id="results" />
      </section>

      <aside class="boundary">
        <span aria-hidden="true">票</span>
        <div>
          <strong>実際に支払われた賃金ではありません</strong>
          <p>
            ハローワークが扱った求人票の基本給と定額手当に基づく平均です。全求人市場、在職者賃金、中央値、手取り、採用時の確定額を示しません。地域や産業の優劣・生活しやすさの順位にも使えません。
          </p>
        </div>
      </aside>
    </main>
    <script defer src="/app.js" />
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="平均求人賃金の雇用区分、月給・時給、受理地・就業地、非公表値の読み方を説明します。"
    title="数字の見方 | 求人賃金くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">READ THE JOB SLIP</p>
        <h1>そろえるのは、雇用区分と場所。</h1>
        <p>月給と時給、受理地と就業地を混ぜず、同じ条件だけを比較します。</p>
      </div>
      <section class="guide-grid">
        <article class="guide-full">
          <span>MONTHLY</span>
          <h2>パートを除く常用</h2>
          <p>
            期間の定めがないか4か月以上の雇用期間があり、季節労働とパートタイムを除く求人です。単位は月給・千円です。
          </p>
        </article>
        <article class="guide-part">
          <span>HOURLY</span>
          <h2>常用的パート</h2>
          <p>
            通常の労働者より週の所定労働時間が短く、期間の定めがないか4か月以上の求人です。単位は時給・円です。
          </p>
        </article>
        <article class="guide-place">
          <span>WORKPLACE</span>
          <h2>就業地と受理地</h2>
          <p>
            就業地は働く場所、受理地はハローワークが求人を受け付けた場所です。既定では地域比較に向く就業地を使います。
          </p>
        </article>
        <article class="guide-missing">
          <span>NOT ZERO</span>
          <h2>「—」は0円ではない</h2>
          <p>
            公式表で「-」「x」など数値でない組合せは非公表として保持し、並び順の末尾へ置きます。
          </p>
        </article>
      </section>
      <section class="note-panel">
        <h2>平均の範囲</h2>
        <p>
          求人票に記載された基本給と、採用者全員へ毎月定額で支払われる手当を対象にした平均求人賃金です。求人件数、分布、中央値、個別求人の上限・下限はこの表から分かりません。
        </p>
        <a href={termsPage}>厚生労働省 用語の解説</a>
      </section>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="求人賃金くらべが利用する厚生労働省の職業安定業務統計、加工内容、確認日、利用条件を示します。"
    title="出典とデータ | 求人賃金くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">SOURCE</p>
        <h1>4つの表、912の組合せ。</h1>
        <p>全国と47労働局、19産業を、雇用区分と地域基準ごとに分けて収録しています。</p>
      </div>
      <section class="source-ledger">
        <div>
          <span>提供元</span>
          <strong>厚生労働省</strong>
          <a href={dataPage}>雇用関係指標（年度）</a>
        </div>
        <div>
          <span>収録年度</span>
          <strong>2024・2025年度</strong>
          <a href={sourceWorkbook}>第9表 平均求人賃金 Excel</a>
        </div>
        <div>
          <span>組合せ</span>
          <strong>48地域 × 19産業</strong>
          <a href={termsPage}>職業安定業務統計 用語</a>
        </div>
        <div>
          <span>利用条件</span>
          <strong>公共データ利用規約 第1.0版</strong>
          <a href={useTerms}>厚生労働省の利用規約</a>
        </div>
      </section>
      <section class="prose-section">
        <h2>行った加工</h2>
        <ul>
          <li>第9表の4シートから2024・2025年度値を抽出しました。</li>
          <li>労働局名を都道府県名へ短縮し、9地域と全国に分類しました。</li>
          <li>産業名に安定IDを付け、2025年度値と2024年度差をブラウザで表示します。</li>
          <li>数値でない公表記号はnullへ変換し、0円として補完しません。</li>
          <li>出典：厚生労働省「職業安定業務統計 雇用関係指標（年度）第9表」を加工して作成。</li>
        </ul>
      </section>
      <section class="prose-section">
        <h2>収録範囲</h2>
        <p>
          公共職業安定所が扱った求人票の平均求人賃金です。民間求人媒体だけの求人、在職者の実支給額、賞与、変動手当、求人件数、中央値、生活費は収録していません。
        </p>
      </section>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="求人賃金くらべの端末保存、匿名利用計測、保持期間、追跡拒否への対応を示します。"
    title="保存と計測 | 求人賃金くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">PRIVACY</p>
        <h1>選んだ地域は、端末に。</h1>
        <p>検索語、地域名、産業、雇用区分をサーバーへ記録しません。</p>
      </div>
      <section class="privacy-grid">
        <article>
          <h2>端末に保存</h2>
          <p>比較に選んだ公開地域IDを最大4件だけブラウザへ保存します。アカウントは不要です。</p>
        </article>
        <article>
          <h2>操作名だけを計測</h2>
          <p>
            訪問、検索、0件、絞り込み・条件・並び順の変更、比較追加、コピーの操作名だけを計測します。
          </p>
        </article>
        <article>
          <h2>35日で削除</h2>
          <p>
            ランダムなセッションIDをSHA-256で変換し、操作名、QA区分、時刻とともにD1へ保存します。
          </p>
        </article>
        <article>
          <h2>追跡拒否を尊重</h2>
          <p>
            Do Not TrackまたはGlobal Privacy
            Controlが有効な場合は計測しません。広告・外部解析・Cookieは使いません。
          </p>
        </article>
      </section>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.use(
  "*",
  jsxRenderer(({ children }) => <>{children}</>),
);
app.get("/", (c) => c.html(<HomePage />));
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_payload", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!eventNames.has(name)) throw new ApiError("invalid_event", 400);
  await record(c, name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ asOf: "2026-08-02", ok: row?.ok === 1, records: 912, service: "kyujin-chingin" });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=300,s-maxage=300");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 求人賃金くらべ"
    >
      <main class="text-page">
        <div class="page-intro">
          <p class="eyebrow">404</p>
          <h1>この求人票は見つかりません。</h1>
          <p>
            <a href="/">地域の比較へ戻る</a>
          </p>
        </div>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.message, requestId: c.get("requestId") }, error.status);
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};

export default app;
