#!/usr/bin/env python3
"""
最终调整：
1. num → id
2. 移除 name 字段
3. CSV 转换为名称 JSON 映射文件
4. 通过 id + 名称文件查找显示名称
"""
import json
from pathlib import Path
import csv

JSON_DIR = Path('src/core/data/json')
CSV_DIR = Path('src/core/data/csv')


def csv_to_name_json(csv_filename: str, output_filename: str, prefix: str):
    """将 CSV 转换为 {id: name} 的 JSON 映射文件"""
    mapping = {}
    with open(CSV_DIR / csv_filename, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            label = row['label']
            name = row['flavor_text']
            id_num = int(label.split('_')[-1])
            mapping[str(id_num)] = name

    with open(JSON_DIR / output_filename, 'w') as f:
        json.dump(mapping, f, indent=2, ensure_ascii=False)

    print(f"✅ 生成 {output_filename}: {len(mapping)} 个名称映射")
    return mapping


def convert_moves():
    """技能：num → id，移除 name"""
    with open(JSON_DIR / 'moves.json') as f:
        moves = json.load(f)

    for key, move in moves.items():
        if 'num' in move:
            move['id'] = move.pop('num')
        if 'name' in move:
            del move['name']

    with open(JSON_DIR / 'moves.json', 'w') as f:
        json.dump(moves, f, indent=2, ensure_ascii=False)

    print(f"✅ moves.json: num→id，移除 name，{len(moves)} 个技能")
    return moves


def convert_items():
    """道具：num → id，移除 name，spritenum 保留"""
    with open(JSON_DIR / 'items.json') as f:
        items = json.load(f)

    for key, item in items.items():
        if 'num' in item:
            item['id'] = item.pop('num')
        if 'name' in item:
            del item['name']

    with open(JSON_DIR / 'items.json', 'w') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)

    print(f"✅ items.json: num→id，移除 name，{len(items)} 个道具")
    return items


def convert_abilities():
    """特性：num → id，移除 name"""
    with open(JSON_DIR / 'abilities.json') as f:
        abilities = json.load(f)

    for key, ability in abilities.items():
        if 'num' in ability:
            ability['id'] = ability.pop('num')
        if 'name' in ability:
            del ability['name']

    with open(JSON_DIR / 'abilities.json', 'w') as f:
        json.dump(abilities, f, indent=2, ensure_ascii=False)

    print(f"✅ abilities.json: num→id，移除 name，{len(abilities)} 个特性")
    return abilities


def convert_natures():
    """性格：添加 id，移除 name"""
    with open(JSON_DIR / 'natures.json') as f:
        natures = json.load(f)

    # 按 key 排序分配 id
    for idx, (key, nature) in enumerate(sorted(natures.items()), 0):
        nature['id'] = idx
        if 'name' in nature:
            del nature['name']

    with open(JSON_DIR / 'natures.json', 'w') as f:
        json.dump(natures, f, indent=2, ensure_ascii=False)

    print(f"✅ natures.json: 添加 id，移除 name，{len(natures)} 个性格")
    return natures


def convert_conditions():
    """状态：num → id，移除 name"""
    with open(JSON_DIR / 'conditions.json') as f:
        conditions = json.load(f)

    for key, cond in conditions.items():
        if 'num' in cond:
            cond['id'] = cond.pop('num')
        if 'name' in cond:
            del cond['name']

    with open(JSON_DIR / 'conditions.json', 'w') as f:
        json.dump(conditions, f, indent=2, ensure_ascii=False)

    print(f"✅ conditions.json: num→id，移除 name，{len(conditions)} 个状态")
    return conditions


def convert_typechart():
    """属性克制表：key 就是 id (0-20)，保留"""
    print("ℹ️  typechart.json: 无需转换，key 即为属性 id")


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 最终调整：num→id，移除 name，名称独立 JSON")
    print("=" * 60)

    print("\n📁 生成名称映射 JSON 文件")
    csv_to_name_json('wazaname.csv', 'move_names.json', 'WAZANAME')
    csv_to_name_json('itemname.csv', 'item_names.json', 'ITEMNAME')
    csv_to_name_json('tokusei.csv', 'ability_names.json', 'TOKUSEI')
    csv_to_name_json('seikaku.csv', 'nature_names.json', 'SEIKAKU')
    csv_to_name_json('typename.csv', 'type_names.json', 'TYPENAME')

    print("\n📝 转换数据文件结构")
    convert_moves()
    convert_items()
    convert_abilities()
    convert_natures()
    convert_conditions()
    convert_typechart()

    print("\n✅ 最终调整完成！")
    print("\n📖 名称查找方式:")
    print("   - 技能名称: move_names.json[str(move.id)]")
    print("   - 道具名称: item_names.json[str(item.id)]")
    print("   - 特性名称: ability_names.json[str(ability.id)]")
    print("   - 性格名称: nature_names.json[str(nature.id)]")
    print("   - 属性名称: type_names.json[str(type_id)]")
    print("\n💡 多语言扩展:")
    print("   - 可生成 move_names_zh.json, move_names_ja.json 等")
    print("   - 运行时根据语言设置加载对应名称文件")
