#!/usr/bin/env python3
"""
FlatBuffers 数据结构优化脚本
阶段 1：字符串枚举化
"""
import json
from pathlib import Path

JSON_DIR = Path('src/core/data/json')

# ========================================
# 枚举定义
# ========================================

CATEGORY_MAP = {
    'Physical': 0,
    'Special': 1,
    'Status': 2,
}

TARGET_MAP = {
    'normal': 0,
    'self': 1,
    'allAdjacentFoes': 2,
    'adjacentFoe': 3,
    'any': 4,
    'all': 5,
    'allAdjacent': 6,
    'allySide': 7,
    'randomNormal': 8,
    'adjacentAlly': 9,
    'scripted': 10,
    'allies': 11,
    'foeSide': 12,
    'allyTeam': 13,
    'adjacentAllyOrSelf': 14,
}

CONTEST_TYPE_MAP = {
    'Cool': 0,
    'Beautiful': 1,
    'Cute': 2,
    'Smart': 3,
    'Tough': 4,
}

NONSTANDARD_MAP = {
    'Past': 1,
    'LGPE': 2,
    'Unobtainable': 3,
    'Future': 4,
    'CAP': 5,
}

# Type 映射从 CSV 提取的 ID
TYPE_MAP = {
    'Normal': 0,
    'Fighting': 1,
    'Flying': 2,
    'Poison': 3,
    'Ground': 4,
    'Rock': 5,
    'Bug': 6,
    'Ghost': 7,
    'Steel': 8,
    'Fire': 10,
    'Water': 11,
    'Grass': 12,
    'Electric': 13,
    'Psychic': 14,
    'Ice': 15,
    'Dragon': 16,
    'Dark': 17,
    'Fairy': 18,
    'Stellar': 20,
}

# ========================================
# 阶段 1：枚举化转换
# ========================================

def convert_moves_enums():
    """转换 moves.json 的所有字符串字段为枚举"""
    with open(JSON_DIR / 'moves.json') as f:
        moves = json.load(f)

    converted = 0
    for key, move in moves.items():
        # category
        if 'category' in move and move['category'] in CATEGORY_MAP:
            move['category'] = CATEGORY_MAP[move['category']]
            converted += 1

        # target
        if 'target' in move and move['target'] in TARGET_MAP:
            move['target'] = TARGET_MAP[move['target']]
            converted += 1

        # contestType
        if 'contestType' in move and move['contestType'] in CONTEST_TYPE_MAP:
            move['contestType'] = CONTEST_TYPE_MAP[move['contestType']]
            converted += 1

        # isNonstandard
        if 'isNonstandard' in move:
            ns = move['isNonstandard']
            move['isNonstandard'] = NONSTANDARD_MAP.get(ns, 0)  # 0 = None
            converted += 1

        # type
        if 'type' in move and move['type'] in TYPE_MAP:
            move['type'] = TYPE_MAP[move['type']]
            converted += 1

        # zMoveType (in zMove dict)
        if 'zMove' in move and isinstance(move['zMove'], dict):
            if 'type' in move['zMove'] and move['zMove']['type'] in TYPE_MAP:
                move['zMove']['type'] = TYPE_MAP[move['zMove']['type']]
                converted += 1

    with open(JSON_DIR / 'moves.json', 'w') as f:
        json.dump(moves, f, indent=2, ensure_ascii=False)

    print(f"✅ moves.json 枚举化完成，转换 {converted} 个字段")
    return moves


def convert_items_enums():
    """转换 items.json 的字符串字段为枚举"""
    with open(JSON_DIR / 'items.json') as f:
        items = json.load(f)

    converted = 0
    for key, item in items.items():
        # onDrive/onMemory/onPlate (type)
        for field in ['onDrive', 'onMemory', 'onPlate', 'zMoveType']:
            if field in item and item[field] in TYPE_MAP:
                item[field] = TYPE_MAP[item[field]]
                converted += 1

        # isNonstandard
        if 'isNonstandard' in item:
            ns = item['isNonstandard']
            item['isNonstandard'] = NONSTANDARD_MAP.get(ns, 0)
            converted += 1

    with open(JSON_DIR / 'items.json', 'w') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)

    print(f"✅ items.json 枚举化完成，转换 {converted} 个字段")
    return items


def convert_abilities_enums():
    """转换 abilities.json 的 isNonstandard"""
    with open(JSON_DIR / 'abilities.json') as f:
        abilities = json.load(f)

    converted = 0
    for key, ability in abilities.items():
        if 'isNonstandard' in ability:
            ns = ability['isNonstandard']
            ability['isNonstandard'] = NONSTANDARD_MAP.get(ns, 0)
            converted += 1

    with open(JSON_DIR / 'abilities.json', 'w') as f:
        json.dump(abilities, f, indent=2, ensure_ascii=False)

    print(f"✅ abilities.json 枚举化完成，转换 {converted} 个字段")
    return abilities


def convert_typechart_enums():
    """转换 typechart.json 的 key 为整数 ID"""
    with open(JSON_DIR / 'typechart.json') as f:
        typechart = json.load(f)

    new_typechart = {}
    converted = 0

    for type_name, data in typechart.items():
        type_id = TYPE_MAP.get(type_name.capitalize())
        if type_id is not None:
            # 转换 damageTaken 的 key
            if 'damageTaken' in data:
                new_damage = {}
                for key, value in data['damageTaken'].items():
                    key_id = TYPE_MAP.get(key.capitalize())
                    if key_id is not None:
                        new_damage[key_id] = value
                        converted += 1
                    else:
                        new_damage[key] = value
                data['damageTaken'] = new_damage
            new_typechart[type_id] = data
            converted += 1
        else:
            new_typechart[type_name] = data

    with open(JSON_DIR / 'typechart.json', 'w') as f:
        json.dump(new_typechart, f, indent=2, ensure_ascii=False)

    print(f"✅ typechart.json 枚举化完成，转换 {converted} 个字段")
    return new_typechart


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 阶段 1：字符串枚举化转换")
    print("=" * 60)

    convert_moves_enums()
    convert_items_enums()
    convert_abilities_enums()
    convert_typechart_enums()

    print("\n✅ 阶段 1 完成！")
