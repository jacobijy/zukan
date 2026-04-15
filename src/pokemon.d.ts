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

interface IPokemonBaseModel {
    id: number;
    name: string;
    types: string[];
    abilities: string[];
    hiddenAbility: string;
    image: string;
    stats: { name: string; value: number }[];
    description: string;
    moves: string[];
    evolutionChain: number[];
    height?: number;
    weight?: number;
    category?: string;
}

interface IPokemonCardModel extends IPokemonBaseModel {
}
