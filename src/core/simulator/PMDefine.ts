export enum PokemonType {
    Normal = 1,
    Fighting = 2,
    Flying = 3,
    Poison = 4,
    Ground = 5,
    Rock = 6,
    Bug = 7,
    Ghost = 8,
    Steel = 9,
    Fire = 10,
    Water = 11,
    Grass = 12,
    Electric = 13,
    Psychic = 14,
    Ice = 15,
    Dragon = 16,
    Dark = 17,
    Fairy = 18,
    Stellar = 19
}

export enum PokemonStat {
    HP = 1,
    Attack = 2,
    Defense = 3,
    SpecialAttack = 4,
    SpecialDefense = 5,
    Speed = 6
}

export enum PokemonNature {
    Hardy = 1,
    Lonely = 2,
    Brave = 3,
    Adamant = 4,
    Naughty = 5,
    Bold = 6,
    Docile = 7,
    Relaxed = 8,
    Impish = 9,
    Lax = 10,
    Timid = 11,
    Hasty = 12,
    Serious = 13,
    Jolly = 14,
    Naive = 15,
    Modest = 16,
    Mild = 17,
    Quiet = 18,
    Bashful = 19,
    Rash = 20,
    Calm = 21,
    Gentle = 22,
    Sassy = 23,
    Careful = 24,
    Quirky = 25
}

export enum PokemonStatus {
    None = 0,
    Burn = 1,
    Freeze = 2,
    Paralyze = 3,
    Poison = 4,
    BadlyPoison = 5,
    Sleep = 6
}

export enum Weather {
    None = 0,
    RainDance = 1,
    SunnyDay = 2,
    Sandstorm = 3,
    Hail = 4,
    Snowscape = 5,
    DeltaStream = 6,
    DesolateLand = 7,
    PrimordialSea = 8
}

export enum Terrain {
    None = 0,
    Electric = 1,
    Grassy = 2,
    Misty = 3,
    Psychic = 4
}

export enum Condition {
    Burn = 1,
    Paralyze = 2,
    Sleep = 3,
    Freeze = 4,
    Poison = 5,
    Toxic = 6,
    Confusion = 7,
    Flinch = 8,
    Trapped = 9,
    Trapper = 10,
    PartiallyTrapped = 11,
    LockedMove = 12,
    TwoTurnMove = 13,
    ChoiceLock = 14,
    MustRecharge = 15,
    FutureMove = 16,
    HealReplacement = 17,
    Stall = 18,
    Gem = 19,
    RainDance = 20,
    PrimordialSea = 21,
    SunnyDay = 22,
    DesolateLand = 23,
    Sandstorm = 24,
    Hail = 25,
    Snowscape = 26,
    DeltaStream = 27,
    Dynamax = 28,
    Commanded = 29,
    Commanding = 30,
    Arceus = 31,
    Silvally = 32,
    RolloutStorage = 33
}

export enum EffectType {
    Status = 1,
    Weather = 2,
    Volatile = 3
}

export enum ResidualType {
    Damage = 1,
    Heal = 2,
    StatBoost = 3,
    StatDrop = 4,
    ToxicDamage = 5
}

export enum BeforeMoveType {
    Paralyze = 1,
    Sleep = 2,
    Freeze = 3,
    Flinch = 4,
    Confusion = 5,
    Disable = 6,
    Taunt = 7,
    Imprison = 8,
    Stall = 9
}

// === 从数据文件提取的扩展枚举定义 ===

/** 招式目标类型 */
export enum MoveTarget {
    NORMAL = 'normal',
    ALL_ADJACENT_FOES = 'allAdjacentFoes',
    SELF = 'self',
    ANY = 'any',
    ADJACENT_ALLY_OR_SELF = 'adjacentAllyOrSelf',
    ALLY_TEAM = 'allyTeam',
    ADJACENT_ALLY = 'adjacentAlly',
    ALLY_SIDE = 'allySide',
    ALL_ADJACENT = 'allAdjacent',
    ALL = 'all',
    SCRIPTED = 'scripted',
    ADJACENT_FOE = 'adjacentFoe',
    ALLIES = 'allies',
    RANDOM_NORMAL = 'randomNormal',
    FOE_SIDE = 'foeSide',
}

/** 招式分类 */
export enum MoveCategory {
    SPECIAL = 'Special',
    PHYSICAL = 'Physical',
    STATUS = 'Status',
}

/** 招式标志 */
export enum MoveFlag {
    PROTECT = 'protect',
    MIRROR = 'mirror',
    HEAL = 'heal',
    METRONOME = 'metronome',
    CONTACT = 'contact',
    SNATCH = 'snatch',
    BULLET = 'bullet',
    DISTANCE = 'distance',
    SLICING = 'slicing',
    WIND = 'wind',
    BYPASSSUB = 'bypasssub',
    ALLYANIM = 'allyanim',
    SOUND = 'sound',
    DANCE = 'dance',
    FAILENCORE = 'failencore',
    NOSLEEPTALK = 'nosleeptalk',
    NOASSIST = 'noassist',
    FAILCOPYCAT = 'failcopycat',
    FAILMIMIC = 'failmimic',
    FAILINSTRUCT = 'failinstruct',
    REFLECTABLE = 'reflectable',
    PULSE = 'pulse',
    FAILMEFIRST = 'failmefirst',
    BITE = 'bite',
    RECHARGE = 'recharge',
    NOSKETCH = 'nosketch',
    CANTUSETWICE = 'cantusetwice',
    NONSKY = 'nonsky',
    CHARGE = 'charge',
    GRAVITY = 'gravity',
    PUNCH = 'punch',
    DEFROST = 'defrost',
    POWDER = 'powder',
    FUTUREMOVE = 'futuremove',
    NOPARENTALBOND = 'noparentalbond',
    PLEDGECOMBO = 'pledgecombo',
    MUSTPRESSURE = 'mustpressure',
}

/** 状态条件类型 */
export enum ConditionType {
    STATUS = 'Status',
    MOVE = 'Move',
    WEATHER = 'Weather',
    TERRAIN = 'Terrain',
}

/** 状态名称 */
export enum StatusName {
    BRN = 'brn',
    PAR = 'par',
    SLP = 'slp',
    FRZ = 'frz',
    PSN = 'psn',
    TOX = 'tox',
    CONFUSION = 'confusion',
    FLINCH = 'flinch',
    TRAPPED = 'trapped',
    TRAPPER = 'trapper',
    PARTIALLY_TRAPPED = 'partiallytrapped',
    LOCKED_MOVE = 'lockedmove',
    TWO_TURN_MOVE = 'twoturnmove',
    CHOICE_LOCK = 'choicelock',
    MUST_RECHARGE = 'mustrecharge',
    FUTURE_MOVE = 'futuremove',
    HEAL_REPLACEMENT = 'healreplacement',
    STALL = 'stall',
    GEM = 'gem',
    RAIN_DANCE = 'raindance',
    PRIMORDIAL_SEA = 'primordialsea',
    SUNNY_DAY = 'sunnyday',
    DESOLATE_LAND = 'desolateland',
    SANDSTORM = 'sandstorm',
    HAIL = 'hail',
    SNOWSCAPE = 'snowscape',
    DELTA_STREAM = 'deltastream',
    DYNAMAX = 'dynamax',
    COMMANDED = 'commanded',
    COMMANDING = 'commanding',
    ARCEUS = 'arceus',
    SILVALLY = 'silvally',
    ROLLOUT_STORAGE = 'rolloutstorage',
}

/** 天气名称 */
export enum WeatherName {
    RAIN_DANCE = 'raindance',
    PRIMORDIAL_SEA = 'primordialsea',
    SUNNY_DAY = 'sunnyday',
    DESOLATE_LAND = 'desolateland',
    SANDSTORM = 'sandstorm',
    HAIL = 'hail',
    SNOWSCAPE = 'snowscape',
    DELTA_STREAM = 'deltastream',
}

/** 特性标志 */
export enum AbilityFlag {
    BREAKABLE = 'breakable',
    FAIL_ROLEPLAY = 'failroleplay',
    NO_RECEIVER = 'noreceiver',
    NO_ENTRAIN = 'noentrain',
    NO_TRACE = 'notrace',
    FAIL_SKILL_SWAP = 'failskillswap',
    CANT_SUPPRESS = 'cantsuppress',
    NO_TRANSFORM = 'notransform',
}

/** 能力统计项 */
export enum BoostStat {
    ATK = 'atk',
    DEF = 'def',
    SPA = 'spa',
    SPD = 'spd',
    SPE = 'spe',
    ACCURACY = 'accuracy',
    EVASION = 'evasion',
}

/** 性格名称 */
export enum NatureName {
    ADAMANT = 'adamant',
    BASHFUL = 'bashful',
    BOLD = 'bold',
    BRAVE = 'brave',
    CALM = 'calm',
    CAREFUL = 'careful',
    DOCILE = 'docile',
    GENTLE = 'gentle',
    HARDY = 'hardy',
    HASTY = 'hasty',
    IMPISH = 'impish',
    JOLLY = 'jolly',
    LAX = 'lax',
    LONELY = 'lonely',
    MILD = 'mild',
    MODEST = 'modest',
    NAIVE = 'naive',
    NAUGHTY = 'naughty',
    QUIET = 'quiet',
    QUIRKY = 'quirky',
    RASH = 'rash',
    RELAXED = 'relaxed',
    SASSY = 'sassy',
    SERIOUS = 'serious',
    TIMID = 'timid',
}