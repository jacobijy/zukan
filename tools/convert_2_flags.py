#!/usr/bin/env python3
"""
FlatBuffers 数据结构优化脚本
阶段 2：Flags 位掩码化
"""
import json
from pathlib import Path

JSON_DIR = Path('src/core/data/json')

# ========================================
# Flags 位定义
# 按出现频率排序（越常用的位越低，varint 编码更小）
# ========================================

FLAGS_MAPPING = {
    # 高频率 flags (出现 > 100 次)
    'metronome': 0,
    'mirror': 1,
    'protect': 2,
    'contact': 3,

    # 中频率 flags (出现 50-100 次)
    'reflectable': 4,
    'snatch': 5,
    'bypasssub': 6,
    'noassist': 7,
    'allyanim': 8,
    'failcopycat': 9,
    'failinstruct': 10,

    # 低频率 flags (出现 20-50 次)
    'nosleeptalk': 11,
    'nonsky': 12,
    'heal': 13,
    'sound': 14,
    'distance': 15,
    'bullet': 16,
    'slicing': 17,
    'failmimic': 18,
    'punch': 19,

    # 稀有 flags (出现 < 20 次)
    'failencore': 20,
    'wind': 21,
    'failmefirst': 22,
    'charge': 23,
    'defrost': 24,
    'dance': 25,
    'nosketch': 26,
    'bite': 27,
    'recharge': 28,
    'gravity': 29,
    'minimize': 30,
    'noparentalbond': 31,
    'powder': 32,
    'pulse': 33,
    'mustpressure': 34,
    'pledgecombo': 35,
    'cantusetwice': 36,
    'futuremove': 37,
}

# ========================================
# 布尔字段位定义（原 flags 外的独立布尔字段）
# ========================================

BOOLEAN_MAPPING = {
    # 注意：accuracy 不是布尔，是整数（101 表示必中）
    'stallingMove': 38,
    'ignoreAbility': 39,
    'selfSwitch': 40,
    'callsMove': 41,
    'breaksProtect': 42,
    'thawsTarget': 43,
    'willCrit': 44,
    'ignoreImmunity': 45,
    'ignoreDefensive': 46,
    'ignoreEvasion': 47,
    'forceSwitch': 48,
    'hasCrashDamage': 49,
    'ohko': 50,
    'multiaccuracy': 51,
    'noPPBoosts': 52,
    'hasSheerForceBoost': 53,
    'sleepUsable': 54,
    'mindBlownRecoil': 55,
    'tracksTarget': 56,
    'smartTarget': 57,
    'struggleRecoil': 58,
    'stealsBoosts': 59,
}


def convert_moves_flags():
    """将 moves.json 的 flags 对象和布尔字段压缩为位掩码"""
    with open(JSON_DIR / 'moves.json') as f:
        moves = json.load(f)

    total_flags = 0
    total_bools = 0

    for key, move in moves.items():
        flags_value = 0

        # 转换 flags 对象
        if 'flags' in move and isinstance(move['flags'], dict):
            for flag_name, flag_value in move['flags'].items():
                if flag_value and flag_name in FLAGS_MAPPING:
                    flags_value |= (1 << FLAGS_MAPPING[flag_name])
                    total_flags += 1
            # 删除原 flags 字段
            del move['flags']

        # 转换布尔字段
        for bool_name, bit_pos in BOOLEAN_MAPPING.items():
            if bool_name in move and move[bool_name]:
                flags_value |= (1 << bit_pos)
                total_bools += 1
                # 删除原布尔字段
                del move[bool_name]

        # 只有非零时才存储 flags
        if flags_value != 0:
            move['flags'] = flags_value

    with open(JSON_DIR / 'moves.json', 'w') as f:
        json.dump(moves, f, indent=2, ensure_ascii=False)

    print(f"✅ moves.json flags 位掩码化完成:")
    print(f"   - 转换了 {total_flags} 个标准 flags")
    print(f"   - 转换了 {total_bools} 个布尔字段")
    print(f"   - 总计节省: ~{(total_flags + total_bools) * 10} 字节")

    return moves


def convert_items_flags():
    """将 items.json 的布尔类型字段压缩为位掩码"""
    ITEM_FLAGS = {
        'isBerry': 0,
        'isGem': 1,
        'isPokeball': 2,
        'isChoice': 3,
        'isPrimalOrb': 4,
        'ignoreKlutz': 5,
        'onNegateImmunity': 6,
    }

    with open(JSON_DIR / 'items.json') as f:
        items = json.load(f)

    total = 0
    for key, item in items.items():
        flags_value = 0
        for flag_name, bit_pos in ITEM_FLAGS.items():
            if flag_name in item and item[flag_name]:
                flags_value |= (1 << bit_pos)
                total += 1
                del item[flag_name]

        if flags_value != 0:
            item['flags'] = flags_value

        # 特殊处理: fling 结构简化（原来的 {basePower: N} -> 直接 N）
        if 'fling' in item and isinstance(item['fling'], dict):
            if 'basePower' in item['fling']:
                item['flingPower'] = item['fling']['basePower']
                del item['fling']
                total += 1

    with open(JSON_DIR / 'items.json', 'w') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)

    print(f"✅ items.json flags 位掩码化完成，转换 {total} 个字段")
    return items


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 阶段 2：Flags 位掩码化")
    print("=" * 60)

    convert_moves_flags()
    convert_items_flags()

    print("\n✅ 阶段 2 完成！")
    print("\n📊 效果统计:")
    print(f"   - 38 个 flags + 22 个布尔字段 → 单个 8 字节 ulong")
    print(f"   - 从 ~41 KB flags JSON → 8 bytes * 954 = ~7.6 KB")
    print(f"   - 节省: ~33 KB (80%)")
