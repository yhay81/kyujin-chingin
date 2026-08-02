# 求人賃金くらべ

厚生労働省の平均求人賃金を、全国・47労働局、19産業、雇用区分、受理地・就業地から探し、最大4地域で比較する日本語Webサービスです。

- Production: <https://kyujin-chingin.yhay81.com>
- Source: 厚生労働省「一般職業紹介状況（職業安定業務統計）」平均求人賃金（2025年度）
- Runtime: Cloudflare Workers + Hono JSX + Vite+ + D1
- Account: 不要

## Commands

```powershell
npm install
npm run data:check
npm run check
npm test
npm run build
npm run dev
```

公開前は`npm run release:check`を実行します。D1 migrationを適用してから`npm run deploy`で配信します。

## Data boundary

ハローワークが扱った求人票の基本給と定額手当の平均を収録します。実際に支払われた賃金、中央値、手取り、民間求人を含む労働市場全体の相場ではありません。非公表セルは0円にせず、欠測のまま表示します。

コードはMIT Licenseです。データの利用条件は[SOURCE.md](SOURCE.md)を参照してください。
