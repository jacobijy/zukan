/* tslint:disable */
/* eslint-disable */
/**
 * 一条\"效果说明\"：简述 + 详述。文本已从池中解析。
 */
export interface ProseEffect {
    id: number;
    shortEffect: string;
    effect: string;
}

/**
 * 一条\"某实体在某游戏版本下的描述\"。文本已从池中解析为内联字符串。
 */
export interface FlavorText {
    id: number;
    text: string;
    /**
     * species 中为 version_id；moves/abilities/items 中为 version_group_id
     */
    version: number;
}

/**
 * 仅一列长文本。
 */
export interface SoloTextEntry {
    id: number;
    text: string;
}

/**
 * 名称 + 描述。
 */
export interface ProseTextEntry {
    id: number;
    name: string;
    description: string;
}

/**
 * 地点：名称 + 副标题。
 */
export interface LocationName {
    id: number;
    name: string;
    subtitle: string;
}

/**
 * 宝可梦体型：名称、趣味名与描述。
 */
export interface ShapeEntry {
    id: number;
    name: string;
    awesomeName: string;
    description: string;
}

/**
 * 宝可梦形态。
 */
export interface FormName {
    id: number;
    formName: string;
    pokemonName: string;
}

/**
 * 宝可梦物种：名称 + 分类（genus）。
 */
export interface SpeciesName {
    id: number;
    name: string;
    genus: string;
}

/**
 * 最常见形状：单一 id + 单一名称。
 *
 * `id` 为 `i32`：上游 move_meta_ailment_names 存在 id=-1 哨兵，
 * 与服务端 schema 保持一致。
 */
export interface NamedTextEntry {
    id: number;
    name: string;
}

export interface EvolutionBundle {
    species: EvolutionSpecies[];
    edges: EvolutionEdge[];
    details: EvolutionDetail[];
}

export interface EvolutionDetail {
    triggerItem: number;
    heldItem: number;
    knownMove: number;
    partySpecies: number;
    tradeSpecies: number;
    location: number;
    minimumSteps: number;
    minimumDamageTaken: number;
    /**
     * 进化后的形态 id；`0` = 不限
     */
    evolvedForm: number;
    /**
     * 进化起点形态限制；`0` = 不限
     */
    baseForm: number;
    /**
     * 该条件适用的版本组
     */
    versionGroupId: number;
    /**
     * evolution_trigger_id：1=升级 2=交换 3=使用道具 4=蜕皮…（名字查 PKNM evolution_triggers）
     */
    triggerId: number;
    knownMoveType: number;
    partyType: number;
    /**
     * `0`=不限 `1`=雌性 `2`=雄性
     */
    gender: number;
    /**
     * `0`=不限 `1`=day `2`=night `3`=dusk `4`=full-moon
     */
    timeOfDay: number;
    /**
     * `0` = 无等级要求
     */
    minimumLevel: number;
    minimumHappiness: number;
    minimumBeauty: number;
    minimumAffection: number;
    /**
     * `0`=不限 `1`=攻击<防御 `2`=相等 `3`=攻击>防御
     */
    relativePhysicalStats: number;
    minimumMoveCount: number;
    /**
     * `0`=不限 `7`=阿罗拉 `8`=伽勒尔 `9`=洗翠
     */
    region: number;
    /**
     * 位域：bit0=rain bit1=turn_upside_down bit2=multiplayer
     * bit3=near_special_rock bit4=该版本组默认路径
     */
    flags: number;
}

export interface EvolutionEdge {
    /**
     * 进化目标物种 id
     */
    targetSpecies: number;
    /**
     * 在 `details` 中的起始下标
     */
    detailStart: number;
    /**
     * 该分支的触发条件条数（多为 1；跨版本组不同时 >1）
     */
    detailCount: number;
}

export interface EvolutionSpecies {
    /**
     * 由何物种进化而来（evolves_from_species_id）；`0` = 链根 / 无前置
     */
    parentSpecies: number;
    /**
     * 所属进化链 id（仅用于同链分组，寻址用下标即可）
     */
    chainId: number;
    /**
     * 在 `edges` 中的起始下标（无进化目标时 edge_count = 0）
     */
    edgeStart: number;
    /**
     * 该物种可进化出的分支数
     */
    edgeCount: number;
}

export interface I18nFlavorBundle {
    languageId: number;
    language: string;
    /**
     * 宝可梦图鉴描述（version 语义 = version_id）
     */
    species: FlavorText[];
    /**
     * 技能说明（version 语义 = version_group_id）
     */
    moves: FlavorText[];
    /**
     * 特性说明（version 语义 = version_group_id）
     */
    abilities: FlavorText[];
    /**
     * 道具说明（version 语义 = version_group_id）
     */
    items: FlavorText[];
    /**
     * 特性效果（简述 + 详述）。上游仅英文有数据。
     */
    abilityEffects: ProseEffect[];
    /**
     * 技能效果（简述 + 详述）。上游仅英文有数据。
     */
    moveEffects: ProseEffect[];
}

export interface I18nNamesBundle {
    /**
     * 上游 languages.csv 的 id（1..14）
     */
    languageId: number;
    /**
     * 上游 languages.csv 的 identifier，如 \"zh-hans\
     */
    language: string;
    species: SpeciesName[];
    forms: FormName[];
    locations: LocationName[];
    shapes: ShapeEntry[];
    moves: NamedTextEntry[];
    abilities: NamedTextEntry[];
    items: NamedTextEntry[];
    types: NamedTextEntry[];
    natures: NamedTextEntry[];
    stats: NamedTextEntry[];
    eggGroups: NamedTextEntry[];
    regions: NamedTextEntry[];
    versions: NamedTextEntry[];
    generations: NamedTextEntry[];
    growthRates: NamedTextEntry[];
    itemCategories: NamedTextEntry[];
    itemPockets: NamedTextEntry[];
    colors: NamedTextEntry[];
    habitats: NamedTextEntry[];
    moveAilments: NamedTextEntry[];
    moveBattleStyles: NamedTextEntry[];
    encounterMethods: NamedTextEntry[];
    evolutionTriggers: NamedTextEntry[];
    berryFirmnesses: NamedTextEntry[];
    languages: NamedTextEntry[];
    pokedexes: ProseTextEntry[];
    moveDamageClasses: ProseTextEntry[];
    moveTargets: ProseTextEntry[];
    itemFlags: ProseTextEntry[];
    moveFlags: ProseTextEntry[];
    moveCategories: SoloTextEntry[];
    itemFlingEffects: SoloTextEntry[];
    characteristics: SoloTextEntry[];
}

export interface LevelMove {
    level: number;
    moveId: number;
}

export interface Move {
    id: number;
    generationId: number;
    typeId: number;
    /**
     * `0` = 无固定伤害
     */
    power: number;
    pp: number;
    /**
     * `0` = 必中
     */
    accuracy: number;
    /**
     * `-7..=+5`
     */
    priority: number;
    targetId: number;
    /**
     * `1=status, 2=physical, 3=special`
     */
    damageClassId: number;
    /**
     * `0` = 无 effect 数据
     */
    effectId: number;
    effectChance: number;
    contestTypeId: number;
    contestEffectId: number;
    superContestEffectId: number;
}

export interface MoveFlagPair {
    moveId: number;
    moveFlagId: number;
}

export interface MoveMeta {
    moveId: number;
    metaCategoryId: number;
    /**
     * `-1` = 随机异常
     */
    metaAilmentId: number;
    minHits: number;
    maxHits: number;
    minTurns: number;
    maxTurns: number;
    /**
     * 负数 = 反噬
     */
    drain: number;
    /**
     * 负数 = 血量代价
     */
    healing: number;
    critRate: number;
    ailmentChance: number;
    flinchChance: number;
    statChance: number;
}

export interface MoveMetaStatChange {
    moveId: number;
    statId: number;
    /**
     * `-2..=+3`
     */
    change: number;
}

export interface MovesDataBundle {
    /**
     * `0` = common baseline，`1..=32` = 各版本组
     */
    versionGroupId: number;
    moves: Move[];
    moveMeta: MoveMeta[];
    moveMetaStatChanges: MoveMetaStatChange[];
    moveFlagMap: MoveFlagPair[];
    moveEffects: number[];
}

export interface PokemonAbility {
    id: number;
    ability1Id: number;
    /**
     * `0` = 无
     */
    ability2Id: number;
    /**
     * `0` = 无（第 5 代前恒为 0）
     */
    abilityHiddenId: number;
}

export interface PokemonBase {
    id: number;
    speciesId: number;
    isDefault: boolean;
    height: number;
    weight: number;
    baseExperience: number;
    generationId: number;
    growthRateId: number;
    /**
     * `-1` = genderless；`0..=8` = 母率 8ths
     */
    genderRate: number;
    captureRate: number;
    baseHappiness: number;
    hatchCounter: number;
    isLegendary: boolean;
    isMythical: boolean;
    colorId: number;
    shapeId: number;
    habitatId: number;
    /**
     * 该 pokemon id 下是否有任一正面立绘（artwork/home/shiny）；
     * `false` 表示官方暂无可展示正面图，前端可屏蔽该形态而非等 404 回退。
     */
    hasSprite: boolean;
}

export interface PokemonEggGroup {
    id: number;
    speciesId: number;
    eggGroup1Id: number;
    /**
     * `0` = 无
     */
    eggGroup2Id: number;
}

export interface PokemonGenBundle {
    generationId: number;
    baseEntries: PokemonBase[];
    statEntries: PokemonStat[];
    typeEntries: PokemonType[];
    abilityEntries: PokemonAbility[];
    eggGroupEntries: PokemonEggGroup[];
}

export interface PokemonMove {
    pokemonId: number;
    moveId: number;
    methodId: number;
    level: number;
    order: number;
    mastery: number;
}

export interface PokemonMoveSet {
    pokemonId: number;
    levelUp: LevelMove[];
    egg: number[];
    tutor: number[];
    machine: number[];
    stadiumSurfingPikachu: number[];
    lightBallEgg: number[];
    colosseumPurification: number[];
    xdShadow: number[];
    xdPurification: number[];
    formChange: number[];
    zygardeCube: number[];
    train: number[];
}

export interface PokemonMovesBundle {
    /**
     * `0 = COMMON`，`1 = MAINLINE_DIFF`，`2 = SPECIAL_FULL`
     */
    kind: number;
    versionGroupId: number;
    entries: PokemonMoveSet[];
}

export interface PokemonStat {
    id: number;
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
}

export interface PokemonType {
    id: number;
    type1Id: number;
    /**
     * `0` = 无副属性
     */
    type2Id: number;
}

export interface PokemonVgMovesBundle {
    versionGroupId: number;
    entries: PokemonMove[];
}


/**
 * 批量伤害计算结果
 */
export class BatchDamageResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    getRolls(): Uint16Array;
    readonly average: number;
    readonly max: number;
    readonly min: number;
}

/**
 * 伤害计算输入
 */
export class DamageInput {
    free(): void;
    [Symbol.dispose](): void;
    constructor(level: number, attack: number, defense: number, base_power: number, move_type: number, move_category: number, attacker_type1: number, attacker_type2: number, defender_type1: number, defender_type2: number, weather: number, terrain: number, attacker_ability: number, defender_ability: number, is_critical: number, is_burned: number, move_flags: number);
    /**
     * 设置攻击方物攻等级
     */
    withAttackerAtkStage(stage: number): void;
    /**
     * 设置攻击方特攻等级
     */
    withAttackerSpaStage(stage: number): void;
    /**
     * 设置防御方物防等级
     */
    withDefenderDefStage(stage: number): void;
    /**
     * 设置防御方道具 id（DEF_ITEM_*）
     */
    withDefenderItem(defender_item: number): void;
    /**
     * 设置防御方特防等级
     */
    withDefenderSpdStage(stage: number): void;
    withItemMod(item_mod: number): void;
    withSeed(seed: number): void;
}

/**
 * 单次伤害计算
 */
export function calculateDamage(input: DamageInput): number;

/**
 * 批量计算所有随机值的伤害范围
 */
export function calculateDamageBatch(input: DamageInput): BatchDamageResult;

/**
 * 计算 HP 能力值
 */
export function calculateHp(level: number, base: number, iv: number, ev: number): number;

/**
 * 获取性格修正
 * 返回 [atk, def, spa, spd, spe] 修正值 (90/100/110)
 */
export function calculateNatureMod(nature_id: number): Uint8Array;

/**
 * 计算能力值
 */
export function calculateStat(level: number, base: number, iv: number, ev: number, nature_mod: number): number;

/**
 * 创建新版 DamageInput 的便捷函数
 */
export function createDamageInput(level: number, attack: number, defense: number, base_power: number, move_type: number, move_category: number, attacker_type1: number, attacker_type2: number, defender_type1: number, defender_type2: number, weather: number, terrain: number, attacker_ability: number, defender_ability: number, is_critical: number, is_burned: number, move_flags: number): DamageInput;

/**
 * 解码 `evolution.bin` (fid = `EVO1`) —— 全代进化树（species/edges/details）
 */
export function decodeEvolutionBundle(data: Uint8Array): EvolutionBundle;

/**
 * 解码 `I18nFlavorBundle` (fid = `PKFL`) —— 单语言描述组
 * （图鉴/技能/特性/道具描述）。传输层的字符串池在解码时解析为内联字符串。
 */
export function decodeI18nFlavorBundle(data: Uint8Array): I18nFlavorBundle;

/**
 * 解码 `I18nNamesBundle` (fid = `PKNM`) —— 单语言名称组
 * （物种名、技能名、属性名、形态名等 33 张短文本表）
 */
export function decodeI18nNamesBundle(data: Uint8Array): I18nNamesBundle;

/**
 * 解码 `MovesDataBundle` (fid = `MDAT`) —— 招式定义
 */
export function decodeMovesDataBundle(data: Uint8Array): MovesDataBundle;

/**
 * 解码 `PokemonGenBundle` (fid = `PKMB`) —— 宝可梦基础参数（按世代打包）
 */
export function decodePokemonGenBundle(data: Uint8Array): PokemonGenBundle;

/**
 * 解码 `PokemonMovesBundle` (fid = `PMSB`) —— 招式学习记录（按宝可梦聚合）
 */
export function decodePokemonMovesBundle(data: Uint8Array): PokemonMovesBundle;

/**
 * 解码 `PokemonVgMovesBundle` (fid = `PMOV`) —— 招式学习记录（原始行式）
 */
export function decodePokemonVgMovesBundle(data: Uint8Array): PokemonVgMovesBundle;

/**
 * 解密图鉴加密二进制数据
 */
export function decryptZukan(encrypted_data: Uint8Array, dek_hex: string): Uint8Array;

/**
 * 加密图鉴数据
 */
export function encryptZukan(plaintext: Uint8Array, dek_hex: string, version: number): Uint8Array;

/**
 * 生成 256 位随机密钥（Hex 编码）
 */
export function generateKey(): string;

/**
 * 获取文件的密钥版本号
 */
export function getZukanVersion(data: Uint8Array): number;

/**
 * HMAC-SHA256 签名
 */
export function hmacSign(key: string, data: string): string;

/**
 * HMAC-SHA256 验证
 */
export function hmacVerify(key: string, data: string, signature: string): boolean;

export function init(): void;

/**
 * 校验文件是否为合法的图鉴加密文件格式
 */
export function isValidZukanFile(data: Uint8Array): boolean;

/**
 * SHA-256 哈希
 */
export function sha256(data: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_batchdamageresult_free: (a: number, b: number) => void;
    readonly __wbg_damageinput_free: (a: number, b: number) => void;
    readonly batchdamageresult_getRolls: (a: number) => [number, number];
    readonly batchdamageresult_max: (a: number) => number;
    readonly batchdamageresult_min: (a: number) => number;
    readonly calculateDamage: (a: number) => number;
    readonly calculateDamageBatch: (a: number) => number;
    readonly calculateHp: (a: number, b: number, c: number, d: number) => number;
    readonly calculateNatureMod: (a: number) => [number, number];
    readonly calculateStat: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly createDamageInput: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number) => number;
    readonly damageinput_withAttackerAtkStage: (a: number, b: number) => void;
    readonly damageinput_withAttackerSpaStage: (a: number, b: number) => void;
    readonly damageinput_withDefenderDefStage: (a: number, b: number) => void;
    readonly damageinput_withDefenderItem: (a: number, b: number) => void;
    readonly damageinput_withDefenderSpdStage: (a: number, b: number) => void;
    readonly damageinput_withItemMod: (a: number, b: number) => void;
    readonly damageinput_withSeed: (a: number, b: number) => void;
    readonly decodeEvolutionBundle: (a: number, b: number) => [number, number, number];
    readonly decodeI18nFlavorBundle: (a: number, b: number) => [number, number, number];
    readonly decodeI18nNamesBundle: (a: number, b: number) => [number, number, number];
    readonly decodeMovesDataBundle: (a: number, b: number) => [number, number, number];
    readonly decodePokemonGenBundle: (a: number, b: number) => [number, number, number];
    readonly decodePokemonMovesBundle: (a: number, b: number) => [number, number, number];
    readonly decodePokemonVgMovesBundle: (a: number, b: number) => [number, number, number];
    readonly decryptZukan: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly encryptZukan: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly generateKey: () => [number, number];
    readonly getZukanVersion: (a: number, b: number) => number;
    readonly hmacSign: (a: number, b: number, c: number, d: number) => [number, number];
    readonly hmacVerify: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly init: () => void;
    readonly isValidZukanFile: (a: number, b: number) => number;
    readonly sha256: (a: number, b: number) => [number, number];
    readonly batchdamageresult_average: (a: number) => number;
    readonly damageinput_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
