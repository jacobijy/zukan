#!/usr/bin/env python3
"""
完善转换：修复 contestType、处理 isZ/itemUser/megaStone 等名称字段
"""
import json
from pathlib import Path

JSON_DIR = Path('src/core/data/json')

# ContestType 映射
CONTEST_TYPE_MAP = {
    'Cool': 0,
    'Beautiful': 1,
    'Cute': 2,
    'Smart': 3,
    'Clever': 3,  # Smart 的另一种写法
    'Tough': 4,
}

def fix_contest_types():
    """修复 moves.json 中 contestType 字符串"""
    with open(JSON_DIR / 'moves.json') as f:
        moves = json.load(f)

    count = 0
    for key, move in moves.items():
        if 'contestType' in move and isinstance(move['contestType'], str):
            if move['contestType'] in CONTEST_TYPE_MAP:
                move['contestType'] = CONTEST_TYPE_MAP[move['contestType']]
                count += 1

    with open(JSON_DIR / 'moves.json', 'w') as f:
        json.dump(moves, f, indent=2, ensure_ascii=False)

    print(f"✅ moves.json: contestType 字符串修复 {count} 个")
    return moves


def fix_accuracy_boolean():
    """accuracy: true → 101"""
    with open(JSON_DIR / 'moves.json') as f:
        moves = json.load(f)

    count = 0
    for key, move in moves.items():
        if 'accuracy' in move and move['accuracy'] is True:
            move['accuracy'] = 101
            count += 1

    with open(JSON_DIR / 'moves.json', 'w') as f:
        json.dump(moves, f, indent=2, ensure_ascii=False)

    print(f"✅ moves.json: accuracy: true → 101，修复 {count} 个")
    return moves


def simplify_drain():
    """drain: {} → 移除（用 1 表示）"""
    with open(JSON_DIR / 'moves.json') as f:
        moves = json.load(f)

    count = 0
    for key, move in moves.items():
        if 'drain' in move and isinstance(move['drain'], dict) and len(move['drain']) == 0:
            move['drain'] = 1
            count += 1

    with open(JSON_DIR / 'moves.json', 'w') as f:
        json.dump(moves, f, indent=2, ensure_ascii=False)

    print(f"✅ moves.json: drain: {{}} → 1，简化 {count} 个")
    return moves


def fix_items_references():
    """items.json 中 itemUser 宝可梦名称不做处理，保持字符串
    isZ 是道具名称，也保持字符串（作为索引 key）
    """
    print("ℹ️  items.json: itemUser/megaStone 保留字符串（作为索引 key）")
    print("ℹ️  注：这些是对象 key，运行时通过宝可梦字典查找）")


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 完善数据结构转换")
    print("=" * 60)

    fix_contest_types()
    fix_accuracy_boolean()
    simplify_drain()
    fix_items_references()

    print("\n✅ 完善完成！")
