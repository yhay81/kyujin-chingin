import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type RecordRow = {
  placeId: string;
  industryId: string;
  fullTime: { reception: Array<number | null>; workplace: Array<number | null> };
  partTime: { reception: Array<number | null>; workplace: Array<number | null> };
};
const root = process.cwd();
const index = JSON.parse(readFileSync(resolve(root, "public/data/index.json"), "utf8"));
const records = JSON.parse(
  readFileSync(resolve(root, "public/data/wages.json"), "utf8"),
) as RecordRow[];
const find = (placeId: string, industryId: string) =>
  records.find((item) => item.placeId === placeId && item.industryId === industryId);

describe("official average job-offer wage table", () => {
  it("retains verified source metadata and dimensions", () => {
    expect(index).toMatchObject({
      asOf: "2026-08-02",
      edition: "2025年度（令和7年度）",
      years: [2024, 2025],
      placeCount: 48,
      prefectureCount: 47,
      industryCount: 19,
      recordCount: 912,
    });
    expect(index.sourceSha256).toBe(
      "7f2e27eed0d96d3f27a9f914d91d99caf4e057b8dfe74e3f9514f66e578024b9",
    );
  });
  it("contains one unique row for every place and industry", () => {
    expect(records).toHaveLength(912);
    expect(new Set(records.map((item) => `${item.placeId}|${item.industryId}`)).size).toBe(912);
    expect(index.places).toHaveLength(48);
    expect(index.industries).toHaveLength(19);
  });
  it("retains the nationwide 2024 and 2025 values", () => {
    expect(find("JP-00", "ALL")).toMatchObject({
      fullTime: { reception: [251, 259], workplace: [253, 261] },
      partTime: { reception: [1206, 1261], workplace: [1212, 1265] },
    });
  });
  it("retains known detailed rows", () => {
    expect(find("JP-14", "G")?.fullTime.workplace).toEqual([335, 348]);
    expect(find("JP-29", "L")?.fullTime.workplace).toEqual([360, 369]);
    expect(find("JP-01", "C")?.partTime.workplace).toEqual([1509, 1971]);
  });
  it("keeps suppressed cells as null and all series length two", () => {
    const missing = {
      fullTimeReception: 0,
      fullTimeWorkplace: 0,
      partTimeReception: 0,
      partTimeWorkplace: 0,
    };
    for (const record of records) {
      expect(Object.keys(record).sort()).toEqual(["fullTime", "industryId", "partTime", "placeId"]);
      for (const series of [
        record.fullTime.reception,
        record.fullTime.workplace,
        record.partTime.reception,
        record.partTime.workplace,
      ])
        expect(series).toHaveLength(2);
      missing.fullTimeReception += record.fullTime.reception.filter(
        (value) => value === null,
      ).length;
      missing.fullTimeWorkplace += record.fullTime.workplace.filter(
        (value) => value === null,
      ).length;
      missing.partTimeReception += record.partTime.reception.filter(
        (value) => value === null,
      ).length;
      missing.partTimeWorkplace += record.partTime.workplace.filter(
        (value) => value === null,
      ).length;
    }
    expect(missing).toEqual({
      fullTimeReception: 2,
      fullTimeWorkplace: 2,
      partTimeReception: 19,
      partTimeWorkplace: 15,
    });
    expect(statSync(resolve(root, "public/data/wages.json")).size).toBeLessThan(180000);
  });
});
