#!/usr/bin/env python3
"""
调整数据结构：移除全局 string_pool → 各资源独立 ID + CSV 多语言名称查找
"""
import json
from pathlib import Path
import csv

JSON_DIR = Path('src/core/data/json')
CSV_DIR = Path('src/core/data/csv')


def load_csv_name_to_id_map(filename):
    """从 CSV 加载 名称 -> ID 的映射（用于反向查找）"""
    mapping = {}
    with open(CSV_DIR / filename, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row['flavor_text']
            label = row['label']
            id_num = int(label.split('_')[-1])
            mapping[name] = id_num
    return mapping


def adjust_moves():
    """调整技能数据：name 使用 num，zMove_effect 使用技能 ID"""
    with open(JSON_DIR / 'moves.json') as f:
        moves = json.load(f)

    # 技能名称到 ID 的映射
    move_name_to_id = {v['num']: k for k, v in moves.items()}

    count = 0
    for key, move in moves.items():
        # name 改为 num（或移除 name，直接使用 num
        if 'name' in move:
            move['name'] = move['num']
            count += 1

        # zMove_effect 暂不处理，保留原始值

    with open(JSON_DIR / 'moves.json', 'w') as f:
        json.dump(moves, f, indent=2, ensure_ascii=False)

    print(f"✅ moves.json: name → num，调整 {count} 个技能")
    return moves


def adjust_items():
    """调整道具数据：name 使用 num"""
    with open(JSON_DIR / 'items.json') as f:
        items = json.load(f)

    count = 0
    for key, item in items.items():
        if 'name' in item and 'num' in item:
            item['name'] = item['num']
            count += 1

    with open(JSON_DIR / 'items.json', 'w') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)

    print(f"✅ items.json: name → num，调整 {count} 个道具")
    return items


def adjust_abilities():
    """调整特性数据：name 使用 num"""
    with open(JSON_DIR / 'abilities.json') as f:
        abilities = json.load(f)

    count = 0
    for key, ability in abilities.items():
        if 'name' in ability and 'num' in ability:
            ability['name'] = ability['num']
            count += 1

    with open(JSON_DIR / 'abilities.json', 'w') as f:
        json.dump(abilities, f, indent=2, ensure_ascii=False)

    print(f"✅ abilities.json: name → num，调整 {count} 个特性")
    return abilities


def adjust_natures():
    """调整性格数据：name 使用 num"""
    with open(JSON_DIR / 'natures.json') as f:
        natures = json.load(f)

    count = 0
    for key, nature in natures.items():
        if 'name' in nature and 'num' in nature:
            nature['name'] = nature['num']
            count += 1

    with open(JSON_DIR / 'natures.json', 'w') as f:
        json.dump(natures, f, indent=2, ensure_ascii=False)

    print(f"✅ natures.json: name → num，调整 {count} 个性格")
    return natures


def adjust_conditions():
    """调整状态数据：name 使用 num（或 key）"""
    with open(JSON_DIR / 'conditions.json') as f:
        conditions = json.load(f)

    count = 0
    # 为 conditions 分配 num（如果没有）
    for idx, (key, cond) in enumerate(conditions.items(), 1):
        if 'num' not in cond:
            cond['num'] = idx
        cond['name'] = cond['num']
        count += 1

    with open(JSON_DIR / 'conditions.json', 'w') as f:
        json.dump(conditions, f, indent=2, ensure_ascii=False)

    print(f"✅ conditions.json: name → num，调整 {count} 个状态")
    return conditions


def adjust_rulesets():
    """调整规则集：name 保留原样（不需要 ID 化）"""
    print("ℹ️  rulesets.json: name 不调整（不需要 ID 化）")


def remove_string_pool():
    """删除全局字符串池"""
    pool_path = JSON_DIR / 'string_pool.json'
    if pool_path.exists():
        import os
        os.remove(pool_path)
        print("✅ 已删除 string_pool.json")


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 调整：移除全局 string_pool，使用各资源独立 ID + CSV")
    print("=" * 60)

    adjust_moves()
    adjust_items()
    adjust_abilities()
    adjust_natures()
    adjust_conditions()
    adjust_rulesets()
    remove_string_pool()

    print("\n✅ 调整完成！")
    print("\n📊 名称查找方式:")
    print("   - 技能名称: wazaname.csv + move.name → WAZANAME_XXX")
    print("   - 道具名称: itemname.csv + item.name → ITEMNAME_XXX")
    print("   - 特性名称: tokusei.csv + ability.name → TOKUSEI_XXX")
    print("   - 性格名称: seikaku.csv + nature.name → SEIKAKU_XXX")
    print("   - 宝可梦名称: monsname.csv + pokemon.name → MONSNAME_XXX")
    print("   - 属性名称: typename.csv + type_id → TYPENAME_XXX")
