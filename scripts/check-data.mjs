import { readFile } from "node:fs/promises";

const index = JSON.parse(
  await readFile(new URL("../public/data/index.json", import.meta.url), "utf8"),
);
const records = JSON.parse(
  await readFile(new URL("../public/data/wages.json", import.meta.url), "utf8"),
);
const employments = ["fullTime", "partTime"];
const bases = ["reception", "workplace"];

if (index.placeCount !== 48 || index.prefectureCount !== 47)
  throw new Error("Expected nationwide total and 47 labour bureaus");
if (index.industryCount !== 19 || index.recordCount !== 912 || records.length !== 912)
  throw new Error("Unexpected table dimensions");
if (JSON.stringify(index.years) !== JSON.stringify([2024, 2025]))
  throw new Error("Unexpected years");
if (new Set(index.places.map((item) => item.id)).size !== 48) throw new Error("Duplicate place id");
if (new Set(index.industries.map((item) => item.id)).size !== 19)
  throw new Error("Duplicate industry id");
const placeIds = new Set(index.places.map((item) => item.id));
const industryIds = new Set(index.industries.map((item) => item.id));
const keys = new Set();
for (const record of records) {
  if (!placeIds.has(record.placeId) || !industryIds.has(record.industryId))
    throw new Error("Unknown record dimension");
  const key = `${record.placeId}|${record.industryId}`;
  if (keys.has(key)) throw new Error(`Duplicate record: ${key}`);
  keys.add(key);
  for (const employment of employments) {
    for (const basis of bases) {
      const series = record[employment][basis];
      if (!Array.isArray(series) || series.length !== 2) throw new Error(`${key}: invalid series`);
      if (series.some((value) => value !== null && (!Number.isInteger(value) || value <= 0)))
        throw new Error(`${key}: invalid value`);
    }
  }
}
if (!/^[0-9a-f]{64}$/u.test(index.sourceSha256)) throw new Error("Invalid source SHA-256");
const national = records.find(
  (record) => record.placeId === "JP-00" && record.industryId === "ALL",
);
if (
  JSON.stringify(national.fullTime) !==
  JSON.stringify({ reception: [251, 259], workplace: [253, 261] })
)
  throw new Error("National full-time values changed");
if (
  JSON.stringify(national.partTime) !==
  JSON.stringify({ reception: [1206, 1261], workplace: [1212, 1265] })
)
  throw new Error("National part-time values changed");

const missing = Object.fromEntries(
  employments.flatMap((employment) =>
    bases.map((basis) => [
      `${employment}.${basis}`,
      records.flatMap((record) => record[employment][basis]).filter((value) => value === null)
        .length,
    ]),
  ),
);
console.log(
  JSON.stringify({
    asOf: index.asOf,
    industries: index.industryCount,
    missing,
    places: index.placeCount,
    records: records.length,
  }),
);
