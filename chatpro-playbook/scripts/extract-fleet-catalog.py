"""Rebuilds data/fleet-catalog.json from listaDePatrimonios.xls column F.

Does not copy status, client, location or quantity. The bot may only search
whether Acesso works with a type — never availability.

Requires: pip install xlrd==1.2.0
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import date
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLS = Path.home() / "Downloads" / "listaDePatrimonios.xls"
DEFAULT_OUT = ROOT / "data" / "fleet-catalog.json"


def fold(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def extract(xls_path: Path) -> dict:
    book = xlrd.open_workbook(str(xls_path))
    sheet = book.sheet_by_index(0)
    by_name: dict[str, dict] = {}
    for row in range(1, sheet.nrows):
        name = str(sheet.cell_value(row, 5)).strip()
        if not name:
            continue
        key = fold(name).upper()
        brand = str(sheet.cell_value(row, 10)).strip()
        model = str(sheet.cell_value(row, 11)).strip()
        rec = by_name.setdefault(key, {"name": name, "brands": set(), "models": set()})
        if len(name) > len(rec["name"]):
            rec["name"] = name
        if brand:
            rec["brands"].add(brand)
        if model:
            rec["models"].add(model)

    items = [
        {
            "name": rec["name"],
            "brands": sorted(rec["brands"])[:8],
            "models": sorted(rec["models"])[:8],
        }
        for rec in by_name.values()
    ]
    items.sort(key=lambda item: fold(item["name"]).upper())
    return {
        "source": xls_path.name,
        "extractedOn": str(date.today()),
        "rule": "never-check-availability",
        "items": items,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("xls", nargs="?", default=str(DEFAULT_XLS))
    parser.add_argument("-o", "--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()
    payload = extract(Path(args.xls))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out} ({len(payload['items'])} types)")


if __name__ == "__main__":
    main()
