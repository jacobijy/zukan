//! FB view → owned struct 的实际拷贝逻辑。
//!
//! flatc 把每个 `.fbs` 定义的类型放在其对应 `*_generated.rs` 的 `pokeapi::fb::`
//! 命名空间下。这里为每个类型的原始模块起 `gen_*` 别名。

use super::convert as owned;
use super::FbDecodeError;

// —— 类型来源模块（每个 .fbs 一个）——
use super::generated::move_flag_pair_generated::pokeapi::fb as gen_move_flag_pair;
use super::generated::move_generated::pokeapi::fb as gen_move;
use super::generated::move_meta_generated::pokeapi::fb as gen_move_meta;
use super::generated::move_meta_stat_change_generated::pokeapi::fb as gen_move_meta_stat_change;
use super::generated::pokemon_abilities_generated::pokeapi::fb as gen_ability;
use super::generated::pokemon_base_generated::pokeapi::fb as gen_base;
use super::generated::pokemon_egg_groups_generated::pokeapi::fb as gen_egg;
use super::generated::pokemon_move_generated::pokeapi::fb as gen_pkmv;
use super::generated::pokemon_move_set_generated::pokeapi::fb as gen_move_set;
use super::generated::pokemon_stats_generated::pokeapi::fb as gen_stat;
use super::generated::pokemon_types_generated::pokeapi::fb as gen_type;

// —— 四个 root：identifier 常量 + root_as_* 函数 ——
use super::generated::moves_data_bundle_generated::pokeapi::fb::{
    MOVES_DATA_BUNDLE_IDENTIFIER, root_as_moves_data_bundle,
};
use super::generated::pokemon_gen_bundle_generated::pokeapi::fb::{
    POKEMON_GEN_BUNDLE_IDENTIFIER, root_as_pokemon_gen_bundle,
};
use super::generated::pokemon_moves_bundle_generated::pokeapi::fb::{
    POKEMON_MOVES_BUNDLE_IDENTIFIER, root_as_pokemon_moves_bundle,
};
use super::generated::pokemon_vg_moves_bundle_generated::pokeapi::fb::{
    POKEMON_VG_MOVES_BUNDLE_IDENTIFIER, root_as_pokemon_vg_moves_bundle,
};

// ────────── 通用工具 ──────────

/// 校验 buffer 头部的 file_identifier；不吞掉任何字节，只是比对。
///
/// FlatBuffers 头 = `[root_offset:u32][identifier:4]`。低于 8 字节直接判失败。
fn check_identifier(buf: &[u8], expected: &'static str) -> Result<(), FbDecodeError> {
    if buf.len() < 8 {
        return Err(FbDecodeError::TruncatedBuffer(buf.len()));
    }
    let found = &buf[4..8];
    if found != expected.as_bytes() {
        return Err(FbDecodeError::InvalidIdentifier {
            expected,
            found: std::str::from_utf8(found).ok().map(|s| s.to_string()),
        });
    }
    Ok(())
}

// ────────── PokemonGenBundle → owned ──────────

pub fn decode_pokemon_gen_bundle(buf: &[u8]) -> Result<owned::PokemonGenBundle, FbDecodeError> {
    check_identifier(buf, POKEMON_GEN_BUNDLE_IDENTIFIER)?;
    let root = root_as_pokemon_gen_bundle(buf).map_err(|e| FbDecodeError::ParseFailed(e.to_string()))?;

    let base_entries = root
        .base_entries()
        .map(|v| v.iter().map(base_to_owned).collect())
        .unwrap_or_default();
    let stat_entries = root
        .stat_entries()
        .map(|v| v.iter().map(stat_to_owned).collect())
        .unwrap_or_default();
    let type_entries = root
        .type_entries()
        .map(|v| v.iter().map(type_to_owned).collect())
        .unwrap_or_default();
    let ability_entries = root
        .ability_entries()
        .map(|v| v.iter().map(ability_to_owned).collect())
        .unwrap_or_default();
    let egg_group_entries = root
        .egg_group_entries()
        .map(|v| v.iter().map(egg_group_to_owned).collect())
        .unwrap_or_default();

    Ok(owned::PokemonGenBundle {
        generation_id: root.generation_id(),
        base_entries,
        stat_entries,
        type_entries,
        ability_entries,
        egg_group_entries,
    })
}

fn base_to_owned(b: &gen_base::PokemonBase) -> owned::PokemonBase {
    owned::PokemonBase {
        id: b.id(),
        species_id: b.species_id(),
        is_default: b.is_default(),
        height: b.height(),
        weight: b.weight(),
        base_experience: b.base_experience(),
        generation_id: b.generation_id(),
        growth_rate_id: b.growth_rate_id(),
        gender_rate: b.gender_rate(),
        capture_rate: b.capture_rate(),
        base_happiness: b.base_happiness(),
        hatch_counter: b.hatch_counter(),
        is_legendary: b.is_legendary(),
        is_mythical: b.is_mythical(),
        color_id: b.color_id(),
        shape_id: b.shape_id(),
        habitat_id: b.habitat_id(),
    }
}

fn stat_to_owned(s: &gen_stat::PokemonStat) -> owned::PokemonStat {
    owned::PokemonStat {
        id: s.id(),
        hp: s.hp(),
        attack: s.attack(),
        defense: s.defense(),
        special_attack: s.special_attack(),
        special_defense: s.special_defense(),
        speed: s.speed(),
    }
}

fn type_to_owned(t: &gen_type::PokemonType) -> owned::PokemonType {
    owned::PokemonType {
        id: t.id(),
        type_1_id: t.type_1_id(),
        type_2_id: t.type_2_id(),
    }
}

fn ability_to_owned(a: &gen_ability::PokemonAbility) -> owned::PokemonAbility {
    owned::PokemonAbility {
        id: a.id(),
        ability_1_id: a.ability_1_id(),
        ability_2_id: a.ability_2_id(),
        ability_hidden_id: a.ability_hidden_id(),
    }
}

fn egg_group_to_owned(g: &gen_egg::PokemonEggGroup) -> owned::PokemonEggGroup {
    owned::PokemonEggGroup {
        id: g.id(),
        species_id: g.species_id(),
        egg_group_1_id: g.egg_group_1_id(),
        egg_group_2_id: g.egg_group_2_id(),
    }
}

// ────────── PokemonVgMovesBundle → owned ──────────

pub fn decode_pokemon_vg_moves_bundle(
    buf: &[u8],
) -> Result<owned::PokemonVgMovesBundle, FbDecodeError> {
    check_identifier(buf, POKEMON_VG_MOVES_BUNDLE_IDENTIFIER)?;
    let root = root_as_pokemon_vg_moves_bundle(buf)
        .map_err(|e| FbDecodeError::ParseFailed(e.to_string()))?;

    let entries = root
        .entries()
        .map(|v| v.iter().map(pokemon_move_to_owned).collect())
        .unwrap_or_default();

    Ok(owned::PokemonVgMovesBundle {
        version_group_id: root.version_group_id(),
        entries,
    })
}

fn pokemon_move_to_owned(m: &gen_pkmv::PokemonMove) -> owned::PokemonMove {
    owned::PokemonMove {
        pokemon_id: m.pokemon_id(),
        move_id: m.move_id(),
        method_id: m.method_id(),
        level: m.level(),
        order: m.order(),
        mastery: m.mastery(),
    }
}

// ────────── PokemonMovesBundle → owned ──────────

pub fn decode_pokemon_moves_bundle(buf: &[u8]) -> Result<owned::PokemonMovesBundle, FbDecodeError> {
    check_identifier(buf, POKEMON_MOVES_BUNDLE_IDENTIFIER)?;
    let root = root_as_pokemon_moves_bundle(buf)
        .map_err(|e| FbDecodeError::ParseFailed(e.to_string()))?;

    let entries = root
        .entries()
        .map(|v| v.iter().map(move_set_to_owned).collect())
        .unwrap_or_default();

    Ok(owned::PokemonMovesBundle {
        kind: root.kind().0,
        version_group_id: root.version_group_id(),
        entries,
    })
}

fn move_set_to_owned(s: gen_move_set::PokemonMoveSet) -> owned::PokemonMoveSet {
    let level_up = s
        .level_up()
        .map(|v| {
            v.iter()
                .map(|lm| owned::LevelMove { level: lm.level(), move_id: lm.move_id() })
                .collect()
        })
        .unwrap_or_default();
    let collect_u16 = |vec: Option<flatbuffers::Vector<'_, u16>>| -> Vec<u16> {
        vec.map(|v| v.iter().collect()).unwrap_or_default()
    };

    owned::PokemonMoveSet {
        pokemon_id: s.pokemon_id(),
        level_up,
        egg: collect_u16(s.egg()),
        tutor: collect_u16(s.tutor()),
        machine: collect_u16(s.machine()),
        stadium_surfing_pikachu: collect_u16(s.stadium_surfing_pikachu()),
        light_ball_egg: collect_u16(s.light_ball_egg()),
        colosseum_purification: collect_u16(s.colosseum_purification()),
        xd_shadow: collect_u16(s.xd_shadow()),
        xd_purification: collect_u16(s.xd_purification()),
        form_change: collect_u16(s.form_change()),
        zygarde_cube: collect_u16(s.zygarde_cube()),
        train: collect_u16(s.train()),
    }
}

// ────────── MovesDataBundle → owned ──────────

pub fn decode_moves_data_bundle(buf: &[u8]) -> Result<owned::MovesDataBundle, FbDecodeError> {
    check_identifier(buf, MOVES_DATA_BUNDLE_IDENTIFIER)?;
    let root = root_as_moves_data_bundle(buf)
        .map_err(|e| FbDecodeError::ParseFailed(e.to_string()))?;

    let moves = root
        .moves()
        .map(|v| v.iter().map(move_to_owned).collect())
        .unwrap_or_default();
    let move_meta = root
        .move_meta()
        .map(|v| v.iter().map(move_meta_to_owned).collect())
        .unwrap_or_default();
    let move_meta_stat_changes = root
        .move_meta_stat_changes()
        .map(|v| v.iter().map(move_meta_stat_change_to_owned).collect())
        .unwrap_or_default();
    let move_flag_map = root
        .move_flag_map()
        .map(|v| v.iter().map(move_flag_pair_to_owned).collect())
        .unwrap_or_default();
    let move_effects = root
        .move_effects()
        .map(|v| v.iter().collect())
        .unwrap_or_default();

    Ok(owned::MovesDataBundle {
        version_group_id: root.version_group_id(),
        moves,
        move_meta,
        move_meta_stat_changes,
        move_flag_map,
        move_effects,
    })
}

fn move_to_owned(m: &gen_move::Move) -> owned::Move {
    owned::Move {
        id: m.id(),
        generation_id: m.generation_id(),
        type_id: m.type_id(),
        power: m.power(),
        pp: m.pp(),
        accuracy: m.accuracy(),
        priority: m.priority(),
        target_id: m.target_id(),
        damage_class_id: m.damage_class_id(),
        effect_id: m.effect_id(),
        effect_chance: m.effect_chance(),
        contest_type_id: m.contest_type_id(),
        contest_effect_id: m.contest_effect_id(),
        super_contest_effect_id: m.super_contest_effect_id(),
    }
}

fn move_meta_to_owned(m: &gen_move_meta::MoveMeta) -> owned::MoveMeta {
    owned::MoveMeta {
        move_id: m.move_id(),
        meta_category_id: m.meta_category_id(),
        meta_ailment_id: m.meta_ailment_id(),
        min_hits: m.min_hits(),
        max_hits: m.max_hits(),
        min_turns: m.min_turns(),
        max_turns: m.max_turns(),
        drain: m.drain(),
        healing: m.healing(),
        crit_rate: m.crit_rate(),
        ailment_chance: m.ailment_chance(),
        flinch_chance: m.flinch_chance(),
        stat_chance: m.stat_chance(),
    }
}

fn move_meta_stat_change_to_owned(m: &gen_move_meta_stat_change::MoveMetaStatChange) -> owned::MoveMetaStatChange {
    owned::MoveMetaStatChange {
        move_id: m.move_id(),
        stat_id: m.stat_id(),
        change: m.change(),
    }
}

fn move_flag_pair_to_owned(m: &gen_move_flag_pair::MoveFlagPair) -> owned::MoveFlagPair {
    owned::MoveFlagPair {
        move_id: m.move_id(),
        move_flag_id: m.move_flag_id(),
    }
}
