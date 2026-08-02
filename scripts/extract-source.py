"""Extract the published 2024–2025 MHLW average job-offer wage tables."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import openpyxl

YEARS = [2024, 2025]
SOURCE_URL = "https://www.mhlw.go.jp/toukei/list/xls/114-1d-09.xlsx"
SHEETS = {
    1: ("fullTime", "reception"),
    3: ("fullTime", "workplace"),
    5: ("partTime", "reception"),
    7: ("partTime", "workplace"),
}
PREFECTURES = [
    ("JP-01", "北海道", "北海道"),
    ("JP-02", "青森", "東北"),
    ("JP-03", "岩手", "東北"),
    ("JP-04", "宮城", "東北"),
    ("JP-05", "秋田", "東北"),
    ("JP-06", "山形", "東北"),
    ("JP-07", "福島", "東北"),
    ("JP-08", "茨城", "関東"),
    ("JP-09", "栃木", "関東"),
    ("JP-10", "群馬", "関東"),
    ("JP-11", "埼玉", "関東"),
    ("JP-12", "千葉", "関東"),
    ("JP-13", "東京", "関東"),
    ("JP-14", "神奈川", "関東"),
    ("JP-15", "新潟", "北陸甲信越"),
    ("JP-16", "富山", "北陸甲信越"),
    ("JP-17", "石川", "北陸甲信越"),
    ("JP-18", "福井", "北陸甲信越"),
    ("JP-19", "山梨", "北陸甲信越"),
    ("JP-20", "長野", "北陸甲信越"),
    ("JP-21", "岐阜", "東海"),
    ("JP-22", "静岡", "東海"),
    ("JP-23", "愛知", "東海"),
    ("JP-24", "三重", "東海"),
    ("JP-25", "滋賀", "近畿"),
    ("JP-26", "京都", "近畿"),
    ("JP-27", "大阪", "近畿"),
    ("JP-28", "兵庫", "近畿"),
    ("JP-29", "奈良", "近畿"),
    ("JP-30", "和歌山", "近畿"),
    ("JP-31", "鳥取", "中国"),
    ("JP-32", "島根", "中国"),
    ("JP-33", "岡山", "中国"),
    ("JP-34", "広島", "中国"),
    ("JP-35", "山口", "中国"),
    ("JP-36", "徳島", "四国"),
    ("JP-37", "香川", "四国"),
    ("JP-38", "愛媛", "四国"),
    ("JP-39", "高知", "四国"),
    ("JP-40", "福岡", "九州・沖縄"),
    ("JP-41", "佐賀", "九州・沖縄"),
    ("JP-42", "長崎", "九州・沖縄"),
    ("JP-43", "熊本", "九州・沖縄"),
    ("JP-44", "大分", "九州・沖縄"),
    ("JP-45", "宮崎", "九州・沖縄"),
    ("JP-46", "鹿児島", "九州・沖縄"),
    ("JP-47", "沖縄", "九州・沖縄"),
]
INDUSTRIES = [
    ("ALL", "産業計"),
    ("AB", "農林漁業"),
    ("C", "鉱業"),
    ("D", "建設業"),
    ("E", "製造業"),
    ("F", "電気・ガ・熱"),
    ("G", "情報通信"),
    ("H", "運輸業"),
    ("I", "卸売・小売"),
    ("J", "金融・保険"),
    ("K", "不動産"),
    ("L", "学術研究"),
    ("M", "飲食・宿泊"),
    ("N", "生活関連・娯楽"),
    ("O", "教育・学習"),
    ("P", "医療・福祉"),
    ("Q", "複合サービス"),
    ("R", "サービス"),
    ("ST", "公務・その他"),
]


def numeric(value: object) -> int | None:
    return int(value) if isinstance(value, (int, float)) else None


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract-source.py SOURCE.xlsx OUTPUT_DIRECTORY")
    source_path = Path(sys.argv[1])
    output_directory = Path(sys.argv[2])
    workbook = openpyxl.load_workbook(source_path, read_only=True, data_only=True)

    places = [{"id": "JP-00", "name": "全国", "region": "全国"}] + [
        {"id": item_id, "name": name, "region": region}
        for item_id, name, region in PREFECTURES
    ]
    place_ids = {"全国計": "JP-00"} | {
        f"{name}労働局": item_id for item_id, name, _region in PREFECTURES
    }
    industry_ids = {name: item_id for item_id, name in INDUSTRIES}
    records: dict[tuple[str, str], dict[str, object]] = {}
    unknown_industries: set[str] = set()

    for sheet_index, (employment, basis) in SHEETS.items():
        sheet = workbook.worksheets[sheet_index]
        current_place_id: str | None = None
        for row in sheet.iter_rows(min_row=3, values_only=True):
            if row[0] in place_ids:
                current_place_id = place_ids[str(row[0])]
            if current_place_id is None:
                continue
            source_industry = str(row[1]) if row[1] is not None else ""
            source_name = source_industry.split("　", 1)[-1]
            industry_id = industry_ids.get(source_name)
            if industry_id is None:
                if source_name:
                    unknown_industries.add(source_name)
                continue
            key = (current_place_id, industry_id)
            record = records.setdefault(
                key,
                {
                    "placeId": current_place_id,
                    "industryId": industry_id,
                    "fullTime": {},
                    "partTime": {},
                },
            )
            record[employment][basis] = [numeric(row[2]), numeric(row[3])]

    expected = len(places) * len(INDUSTRIES)
    if len(records) != expected:
        raise ValueError(
            f"expected {expected} records, got {len(records)}; unknown={sorted(unknown_industries)}"
        )
    for record in records.values():
        for employment in ("fullTime", "partTime"):
            if set(record[employment]) != {"reception", "workplace"}:
                raise ValueError(f"missing series: {record}")

    source_sha = hashlib.sha256(source_path.read_bytes()).hexdigest()
    index = {
        "asOf": "2026-08-02",
        "edition": "2025年度（令和7年度）",
        "years": YEARS,
        "placeCount": len(places),
        "prefectureCount": 47,
        "industryCount": len(INDUSTRIES),
        "recordCount": len(records),
        "places": places,
        "industries": [
            {"id": item_id, "name": name} for item_id, name in INDUSTRIES
        ],
        "sourceUrl": SOURCE_URL,
        "sourceSha256": source_sha,
    }
    output_directory.mkdir(parents=True, exist_ok=True)
    (output_directory / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    ordered_records = [
        records[(place["id"], industry_id)]
        for place in places
        for industry_id, _name in INDUSTRIES
    ]
    (output_directory / "wages.json").write_text(
        json.dumps(ordered_records, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "industries": len(INDUSTRIES),
                "places": len(places),
                "records": len(ordered_records),
                "sha256": source_sha,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
