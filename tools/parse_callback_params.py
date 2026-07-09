#!/usr/bin/env python3
"""
解析回调函数参数，添加标准化的参数关键字到 JSON
"""
import json
import re
from pathlib import Path

JSON_DIR = Path('src/core/data/json')
MOVES_TS = Path('src/core/data/moves.ts')

# 参数标准化映射
PARAM_NORMALIZE = {
    # 目标宝可梦
    'target': 'hasTarget',
    'target: Pokemon': 'hasTarget',
    'defender': 'hasTarget',
    't': 'hasTarget',
    # 使用者宝可梦
    'source': 'hasSource',
    'pokemon': 'hasSource',
    'attacker': 'hasSource',
    # 技能对象
    'move': 'hasMove',
    # 效果对象
    'effect': 'hasEffect',
    'sourceEffect': 'hasEffect',
    # 数值参数
    'basePower': 'hasBasePower',
    'damage': 'hasDamage',
    'accuracy': 'hasAccuracy',
    'critRatio': 'hasCritRatio',
    'boost': 'hasBoost',
    'boosts': 'hasBoost',
    'type': 'hasType',
    'types': 'hasType',
    'typeMod': 'hasTypeMod',
    'status': 'hasStatus',
    'spe': 'hasSpeed',
    'priority': 'hasPriority',
    # 场地/队伍
    'side': 'hasSide',
    'targetSide': 'hasTargetSide',
    'field': 'hasField',
    # 特殊
    'targetRelayVar': 'hasRelay',
}


def extract_callback_params(moves_content):
    """从 moves.ts 提取每个技能的回调参数信息"""
    move_callback_params = {}

    # 按技能分割，简化处理
    lines = moves_content.split('\n')

    current_move = None
    for i, line in enumerate(lines):
        # 检测技能 key 开始
        key_match = re.match(r'^\s*(\w+):\s*\{$', line)
        if key_match:
            current_move = key_match.group(1)
            move_callback_params[current_move] = set()
            continue

        # 检测回调函数
        if current_move:
            callback_match = re.match(r'^\s*(on\w+)\s*\(([^)]*)\)\s*\{', line)
            if callback_match:
                callback_name = callback_match.group(1)
                params_str = callback_match.group(2).strip()

                # 记录存在的回调类型（标准化）
                handler_type = callback_name
                if handler_type.startswith('on'):
                    handler_type = handler_type[2:]  # 移除 'on' 前缀
                move_callback_params[current_move].add(f'handler_{handler_type}')

                # 解析参数
                if params_str:
                    params = [p.strip() for p in params_str.split(',')]
                    for param in params:
                        if param in PARAM_NORMALIZE:
                            move_callback_params[current_move].add(PARAM_NORMALIZE[param])

    return move_callback_params


def add_callback_params_to_json(callback_params):
    """将回调参数信息添加到 moves.json"""
    with open(JSON_DIR / 'moves.json') as f:
        moves = json.load(f)

    count = 0
    for move_key, move_data in moves.items():
        if move_key in callback_params and callback_params[move_key]:
            # 添加到 JSON
            for flag in callback_params[move_key]:
                # handler_xxx 保持原样，其他用布尔值
                if flag.startswith('handler_'):
                    # 已在 _handlers 中，不需要重复
                    pass
                else:
                    move_data[flag] = True
            count += 1

    with open(JSON_DIR / 'moves.json', 'w') as f:
        json.dump(moves, f, indent=2, ensure_ascii=False)

    print(f"✅ 已为 {count} 个技能添加回调参数标志")
    return moves


def update_handlers_to_enum_names():
    """将 _handlers 中的名称改为不带 'on' 的标准名称（与 FlatBuffers schema 一致）"""
    with open(JSON_DIR / 'moves.json') as f:
        moves = json.load(f)

    count = 0
    for move_key, move_data in moves.items():
        if '_handlers' in move_data:
            new_handlers = []
            for handler in move_data['_handlers']:
                if handler.startswith('on'):
                    # 首字母小写：onHit → hit
                    new_handler = handler[2].lower() + handler[3:]
                    new_handlers.append(new_handler)
                else:
                    new_handlers.append(handler)
            move_data['_handlers'] = new_handlers
            count += 1

    with open(JSON_DIR / 'moves.json', 'w') as f:
        json.dump(moves, f, indent=2, ensure_ascii=False)

    print(f"✅ 已更新 {count} 个技能的 _handlers 名称（移除 'on' 前缀）")


def process_items_abilities():
    """处理道具和特性的回调参数"""
    for data_type, ts_file in [('items', 'items.ts'), ('abilities', 'abilities.ts')]:
        json_file = JSON_DIR / f'{data_type}.json'
        ts_path = Path('src/core/data') / ts_file

        if not ts_path.exists():
            continue

        with open(ts_path) as f:
            content = f.read()

        callback_params = {}

        lines = content.split('\n')
        current_key = None
        for i, line in enumerate(lines):
            key_match = re.match(r'^\s*(\w+):\s*\{$', line)
            if key_match:
                current_key = key_match.group(1)
                callback_params[current_key] = set()
                continue

            if current_key:
                callback_match = re.match(r'^\s*(on\w+)\s*\(([^)]*)\)\s*\{', line)
                if callback_match:
                    callback_name = callback_match.group(1)
                    params_str = callback_match.group(2).strip()

                    handler_type = callback_name
                    if handler_type.startswith('on'):
                        handler_type = handler_type[2:]
                    callback_params[current_key].add(f'handler_{handler_type}')

                    if params_str:
                        params = [p.strip() for p in params_str.split(',')]
                        for param in params:
                            if param in PARAM_NORMALIZE:
                                callback_params[current_key].add(PARAM_NORMALIZE[param])

        # 更新 JSON
        with open(json_file) as f:
            data = json.load(f)

        count = 0
        for key, item_data in data.items():
            if key in callback_params and callback_params[key]:
                for flag in callback_params[key]:
                    if not flag.startswith('handler_'):
                        item_data[flag] = True
                count += 1

            # 更新 _handlers 名称（移除 'on' 前缀）
            if '_handlers' in item_data:
                new_handlers = []
                for handler in item_data['_handlers']:
                    if handler.startswith('on'):
                        new_handler = handler[2].lower() + handler[3:]
                        new_handlers.append(new_handler)
                    else:
                        new_handlers.append(handler)
                item_data['_handlers'] = new_handlers

        with open(json_file, 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"✅ 已处理 {data_type}.json: {count} 个条目")


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 解析回调参数并添加到 JSON")
    print("=" * 60)

    print("\n📋 处理 moves.json")
    with open(MOVES_TS) as f:
        moves_content = f.read()

    callback_params = extract_callback_params(moves_content)
    print(f"   提取到 {len(callback_params)} 个技能的回调信息")

    add_callback_params_to_json(callback_params)
    update_handlers_to_enum_names()

    print("\n📋 处理 items.json 和 abilities.json")
    process_items_abilities()

    print("\n✅ 回调参数解析完成！")
    print("\n📖 新增字段说明:")
    print("   - hasTarget: 回调接收目标宝可梦参数")
    print("   - hasSource: 回调接收使用者宝可梦参数")
    print("   - hasMove: 回调接收技能对象参数")
    print("   - hasEffect: 回调接收效果对象参数")
    print("   - hasBasePower: 回调接收威力参数")
    print("   - hasDamage: 回调接收伤害参数")
    print("   - hasAccuracy: 回调接收命中参数")
    print("   - hasCritRatio: 回调接收会心参数")
    print("   - hasBoost: 回调接收能力变化参数")
    print("   - hasType: 回调接收属性参数")
    print("   - hasStatus: 回调接收状态参数")
    print("   - hasSide: 回调接收场地/队伍参数")
    print("   - hasField: 回调接收场地参数")
    print("   - _handlers: 已移除 'on' 前缀（onHit → hit）")
