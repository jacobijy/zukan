#!/usr/bin/env python3
"""
从 pokeapi CSV 生成前端枚举 JSON（英文 slug → id 映射）。

用法：
    python3 tools/gen_enums.py [--pokeapi PATH] [--out PATH]

默认从 /home/jacobi/Code/pokeapi/data/v2/csv 读取，产物写到 src/static/enums/。
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

# (csv_filename, out_filename)
# 都是 key_col='identifier', value_col='id'
TABLES: list[tuple[str, str]] = [
    ("abilities.csv", "abilities.json"),
    ("types.csv", "types.json"),
    ("moves.csv", "moves.json"),
    ("items.csv", "items.json"),
    ("natures.csv", "natures.json"),
    ("egg_groups.csv", "egg_groups.json"),
    ("stats.csv", "stats.json"),
    ("move_damage_classes.csv", "move_damage_classes.json"),
    ("move_flags.csv", "move_flags.json"),
    ("move_meta_ailments.csv", "move_meta_ailments.json"),
    ("move_meta_categories.csv", "move_meta_categories.json"),
    ("move_targets.csv", "move_targets.json"),
    ("pokemon_move_methods.csv", "pokemon_move_methods.json"),
    ("contest_types.csv", "contest_types.json"),
]


def convert(csv_path: Path, out_path: Path) -> tuple[int, int]:
    """读一份 CSV → 写一份 { identifier: id } JSON。返回 (行数, 字节数)。"""
    with csv_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        raise RuntimeError(f"{csv_path.name}: 空表")

    if "id" not in rows[0] or "identifier" not in rows[0]:
        raise RuntimeError(
            f"{csv_path.name}: 缺 id/identifier 列（现有: {list(rows[0].keys())}）"
        )

    # 按 id 升序 → 输出 JSON 有稳定顺序，便于 diff
    rows.sort(key=lambda r: int(r["id"]))

    mapping: dict[str, int] = {}
    for r in rows:
        ident = r["identifier"]
        rid = int(r["id"])
        if ident in mapping:
            raise RuntimeError(f"{csv_path.name}: identifier 冲突 {ident!r}")
        mapping[ident] = rid

    # 自检：value 唯一
    values = list(mapping.values())
    if len(set(values)) != len(values):
        raise RuntimeError(f"{csv_path.name}: id 出现重复")

    payload = json.dumps(mapping, ensure_ascii=False, indent=2) + "\n"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(payload, encoding="utf-8")
    return len(mapping), len(payload.encode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--pokeapi",
        type=Path,
        default=Path("/home/jacobi/Code/pokeapi/data/v2/csv"),
        help="pokeapi CSV 根目录",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "src" / "static" / "enums",
        help="JSON 输出目录",
    )
    args = parser.parse_args()

    if not args.pokeapi.is_dir():
        parser.error(f"--pokeapi 目录不存在: {args.pokeapi}")

    print(f"pokeapi: {args.pokeapi}")
    print(f"out:     {args.out}\n")

    total_rows = 0
    total_bytes = 0
    for csv_name, out_name in TABLES:
        csv_path = args.pokeapi / csv_name
        out_path = args.out / out_name
        if not csv_path.is_file():
            print(f"  ⚠  跳过（缺文件）: {csv_name}")
            continue
        rows, size = convert(csv_path, out_path)
        total_rows += rows
        total_bytes += size
        print(f"  {out_name:32s}  {rows:>5d} 行  {size:>7d} B")

    print(f"\n合计: {total_rows} 行  {total_bytes} 字节  ({total_bytes / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
