interface IPokemonBase {
    /** HP */
    hp: number;
    /** 攻击 */
    atk: number;
    /** 防御 */
    def: number;
    /** 速度 */
    spe: number;
    /** 特攻 */
    spa: number;
    /** 特防 */
    spd: number;
    /** 属性1 */
    type1: number;
    /** 属性2 */
    type2: number;
    Species: number;
    CatchRate: number;
    gender: number;
    hatchCycles: number;
    /** 初始友好度 */
    baseFriendShip: number;
    /** 孵蛋组1 */
    eggGroup1: number;
    /** 孵蛋组2 */
    eggGroup2: number;
    /** 特性1 */
    ability1: number;
    /** 特性2 */
    ability2: number;
    /** 隐藏特性 */
    abilityH: number;
    /** 升级技能 */
    levelUpMoves: string;
    /** 回忆技能 */
    ReminderMoves: string;
}

interface MoveRecord {
    /** PokeAPI moveId；i18n bundle 上线后用它 join 中文名 */
    id: number;
    /** 显示名（未接 i18n bundle 前占位 `move-{id}`） */
    name: string;
    /** 属性 slug：'fire' / 'grass' / ... 与 typeStrs 一致 */
    type: string;
    /** 分类 id（move_damage_classes）：1=状态 2=物理 3=特殊；0=未知，显示 '—' */
    categoryId: number;
    /** 招式威力；0（如吼叫）显示 '—' */
    power: number | string;
    /** 命中率；0（如剑舞、Swift 必中）显示 '—' */
    accuracy: number | string;
    /** 学习方式；与 MovesList picker 一一对应 */
    learnMethod: 'level-up' | 'machine' | 'egg' | 'tutor';
    /** 仅 level-up 使用；0 表示进化学习 */
    level?: number;
}

/** 进化链展示节点：id 用于加载立绘与名称，level/triggerText 描述触发条件 */
interface EvolutionStage {
    /** 进化目标物种的默认形态 pokemon id（用于立绘与点击跳转） */
    id: number;
    /** 物种显示名；i18n 未就绪时由组件回落 NO.xxx */
    name?: string;
    /** 升级进化的最低等级；其他触发方式为 undefined */
    level?: number;
    /** 除等级外的触发条件文本（道具/亲密度/交换…），已本地化 */
    triggerText?: string;
    /** 该节点可进化出的分支；线性链每节点仅一个 child */
    children?: EvolutionStage[];
}

interface IPokemonBaseModel {
    id: number;
    /** 同 species 分组 key；缺席视为等于 id（单形态） */
    speciesId?: number;
    /** 是否 species 的默认形态；单形态默认为 true */
    isDefault?: boolean;
    /** 形态显示名（"攻击形态" / "阿罗拉形态"…），缺席 UI 用 `形态 #{id}` 占位 */
    formLabel?: string;
    /** 该形态是否有正面立绘；false 时 UI 应屏蔽该形态（不进卡片/详情左右切换） */
    hasSprite?: boolean;
    name: string;
    types: string[];
    abilities: string[];
    hiddenAbility: string;
    /** 蛋组本地化名称（1~2 个；未发现蛋组为单个「未发现」） */
    eggGroups: string[];
    image: string;
    stats: { name: string; value: number }[];
    description: string;
    moves: MoveRecord[];
    evolutionChain: EvolutionStage[];
    height?: number;
    weight?: number;
    category?: string;
}

interface IPokemonCardModel extends IPokemonBaseModel {}
