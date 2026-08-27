/* @ts-self-types="./zukan_wasm.d.ts" */

/**
 * 批量伤害计算结果
 */
export class BatchDamageResult {
    static __wrap(ptr) {
        const obj = Object.create(BatchDamageResult.prototype);
        obj.__wbg_ptr = ptr;
        BatchDamageResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BatchDamageResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_batchdamageresult_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get average() {
        const ret = wasm.batchdamageresult_average(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Uint16Array}
     */
    getRolls() {
        const ret = wasm.batchdamageresult_getRolls(this.__wbg_ptr);
        var v1 = getArrayU16FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 2, 2);
        return v1;
    }
    /**
     * @returns {number}
     */
    get max() {
        const ret = wasm.batchdamageresult_max(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get min() {
        const ret = wasm.batchdamageresult_min(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) BatchDamageResult.prototype[Symbol.dispose] = BatchDamageResult.prototype.free;

/**
 * 伤害计算输入
 */
export class DamageInput {
    static __wrap(ptr) {
        const obj = Object.create(DamageInput.prototype);
        obj.__wbg_ptr = ptr;
        DamageInputFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DamageInputFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_damageinput_free(ptr, 0);
    }
    /**
     * @param {number} level
     * @param {number} attack
     * @param {number} defense
     * @param {number} base_power
     * @param {number} move_type
     * @param {number} move_category
     * @param {number} attacker_type1
     * @param {number} attacker_type2
     * @param {number} defender_type1
     * @param {number} defender_type2
     * @param {number} weather
     * @param {number} terrain
     * @param {number} attacker_ability
     * @param {number} defender_ability
     * @param {number} is_critical
     * @param {number} is_burned
     * @param {number} move_flags
     */
    constructor(level, attack, defense, base_power, move_type, move_category, attacker_type1, attacker_type2, defender_type1, defender_type2, weather, terrain, attacker_ability, defender_ability, is_critical, is_burned, move_flags) {
        const ret = wasm.damageinput_new(level, attack, defense, base_power, move_type, move_category, attacker_type1, attacker_type2, defender_type1, defender_type2, weather, terrain, attacker_ability, defender_ability, is_critical, is_burned, move_flags);
        this.__wbg_ptr = ret;
        DamageInputFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 设置攻击方物攻等级
     * @param {number} stage
     */
    withAttackerAtkStage(stage) {
        wasm.damageinput_withAttackerAtkStage(this.__wbg_ptr, stage);
    }
    /**
     * 设置攻击方特攻等级
     * @param {number} stage
     */
    withAttackerSpaStage(stage) {
        wasm.damageinput_withAttackerSpaStage(this.__wbg_ptr, stage);
    }
    /**
     * 设置防御方物防等级
     * @param {number} stage
     */
    withDefenderDefStage(stage) {
        wasm.damageinput_withDefenderDefStage(this.__wbg_ptr, stage);
    }
    /**
     * 设置防御方道具 id（DEF_ITEM_*）
     * @param {number} defender_item
     */
    withDefenderItem(defender_item) {
        wasm.damageinput_withDefenderItem(this.__wbg_ptr, defender_item);
    }
    /**
     * 设置防御方特防等级
     * @param {number} stage
     */
    withDefenderSpdStage(stage) {
        wasm.damageinput_withDefenderSpdStage(this.__wbg_ptr, stage);
    }
    /**
     * @param {number} item_mod
     */
    withItemMod(item_mod) {
        wasm.damageinput_withItemMod(this.__wbg_ptr, item_mod);
    }
    /**
     * @param {number} seed
     */
    withSeed(seed) {
        wasm.damageinput_withSeed(this.__wbg_ptr, seed);
    }
}
if (Symbol.dispose) DamageInput.prototype[Symbol.dispose] = DamageInput.prototype.free;

/**
 * 单次伤害计算
 * @param {DamageInput} input
 * @returns {number}
 */
export function calculateDamage(input) {
    _assertClass(input, DamageInput);
    const ret = wasm.calculateDamage(input.__wbg_ptr);
    return ret;
}

/**
 * 批量计算所有随机值的伤害范围
 * @param {DamageInput} input
 * @returns {BatchDamageResult}
 */
export function calculateDamageBatch(input) {
    _assertClass(input, DamageInput);
    const ret = wasm.calculateDamageBatch(input.__wbg_ptr);
    return BatchDamageResult.__wrap(ret);
}

/**
 * 计算 HP 能力值
 * @param {number} level
 * @param {number} base
 * @param {number} iv
 * @param {number} ev
 * @returns {number}
 */
export function calculateHp(level, base, iv, ev) {
    const ret = wasm.calculateHp(level, base, iv, ev);
    return ret;
}

/**
 * 获取性格修正
 * 返回 [atk, def, spa, spd, spe] 修正值 (90/100/110)
 * @param {number} nature_id
 * @returns {Uint8Array}
 */
export function calculateNatureMod(nature_id) {
    const ret = wasm.calculateNatureMod(nature_id);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * 计算能力值
 * @param {number} level
 * @param {number} base
 * @param {number} iv
 * @param {number} ev
 * @param {number} nature_mod
 * @returns {number}
 */
export function calculateStat(level, base, iv, ev, nature_mod) {
    const ret = wasm.calculateStat(level, base, iv, ev, nature_mod);
    return ret;
}

/**
 * 创建新版 DamageInput 的便捷函数
 * @param {number} level
 * @param {number} attack
 * @param {number} defense
 * @param {number} base_power
 * @param {number} move_type
 * @param {number} move_category
 * @param {number} attacker_type1
 * @param {number} attacker_type2
 * @param {number} defender_type1
 * @param {number} defender_type2
 * @param {number} weather
 * @param {number} terrain
 * @param {number} attacker_ability
 * @param {number} defender_ability
 * @param {number} is_critical
 * @param {number} is_burned
 * @param {number} move_flags
 * @returns {DamageInput}
 */
export function createDamageInput(level, attack, defense, base_power, move_type, move_category, attacker_type1, attacker_type2, defender_type1, defender_type2, weather, terrain, attacker_ability, defender_ability, is_critical, is_burned, move_flags) {
    const ret = wasm.createDamageInput(level, attack, defense, base_power, move_type, move_category, attacker_type1, attacker_type2, defender_type1, defender_type2, weather, terrain, attacker_ability, defender_ability, is_critical, is_burned, move_flags);
    return DamageInput.__wrap(ret);
}

/**
 * 解码 `evolution.bin` (fid = `EVO1`) —— 全代进化树（species/edges/details）
 * @param {Uint8Array} data
 * @returns {EvolutionBundle}
 */
export function decodeEvolutionBundle(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decodeEvolutionBundle(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * 解码 `I18nFlavorBundle` (fid = `PKFL`) —— 单语言描述组
 * （图鉴/技能/特性/道具描述）。传输层的字符串池在解码时解析为内联字符串。
 * @param {Uint8Array} data
 * @returns {I18nFlavorBundle}
 */
export function decodeI18nFlavorBundle(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decodeI18nFlavorBundle(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * 解码 `I18nNamesBundle` (fid = `PKNM`) —— 单语言名称组
 * （物种名、技能名、属性名、形态名等 33 张短文本表）
 * @param {Uint8Array} data
 * @returns {I18nNamesBundle}
 */
export function decodeI18nNamesBundle(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decodeI18nNamesBundle(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * 解码 `MovesDataBundle` (fid = `MDAT`) —— 招式定义
 * @param {Uint8Array} data
 * @returns {MovesDataBundle}
 */
export function decodeMovesDataBundle(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decodeMovesDataBundle(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * 解码 `PokemonGenBundle` (fid = `PKMB`) —— 宝可梦基础参数（按世代打包）
 * @param {Uint8Array} data
 * @returns {PokemonGenBundle}
 */
export function decodePokemonGenBundle(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decodePokemonGenBundle(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * 解码 `PokemonMovesBundle` (fid = `PMSB`) —— 招式学习记录（按宝可梦聚合）
 * @param {Uint8Array} data
 * @returns {PokemonMovesBundle}
 */
export function decodePokemonMovesBundle(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decodePokemonMovesBundle(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * 解码 `PokemonVgMovesBundle` (fid = `PMOV`) —— 招式学习记录（原始行式）
 * @param {Uint8Array} data
 * @returns {PokemonVgMovesBundle}
 */
export function decodePokemonVgMovesBundle(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decodePokemonVgMovesBundle(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * 解密图鉴加密二进制数据
 * @param {Uint8Array} encrypted_data
 * @param {string} dek_hex
 * @returns {Uint8Array}
 */
export function decryptZukan(encrypted_data, dek_hex) {
    const ptr0 = passArray8ToWasm0(encrypted_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(dek_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.decryptZukan(ptr0, len0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * 加密图鉴数据
 * @param {Uint8Array} plaintext
 * @param {string} dek_hex
 * @param {number} version
 * @returns {Uint8Array}
 */
export function encryptZukan(plaintext, dek_hex, version) {
    const ptr0 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(dek_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.encryptZukan(ptr0, len0, ptr1, len1, version);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * 生成 256 位随机密钥（Hex 编码）
 * @returns {string}
 */
export function generateKey() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.generateKey();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * 获取文件的密钥版本号
 * @param {Uint8Array} data
 * @returns {number}
 */
export function getZukanVersion(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.getZukanVersion(ptr0, len0);
    return ret;
}

/**
 * HMAC-SHA256 签名
 * @param {string} key
 * @param {string} data
 * @returns {string}
 */
export function hmacSign(key, data) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(data, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.hmacSign(ptr0, len0, ptr1, len1);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * HMAC-SHA256 验证
 * @param {string} key
 * @param {string} data
 * @param {string} signature
 * @returns {boolean}
 */
export function hmacVerify(key, data, signature) {
    const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(data, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(signature, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.hmacVerify(ptr0, len0, ptr1, len1, ptr2, len2);
    return ret !== 0;
}

export function init() {
    wasm.init();
}

/**
 * 校验文件是否为合法的图鉴加密文件格式
 * @param {Uint8Array} data
 * @returns {boolean}
 */
export function isValidZukanFile(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.isValidZukanFile(ptr0, len0);
    return ret !== 0;
}

/**
 * SHA-256 哈希
 * @param {string} data
 * @returns {string}
 */
export function sha256(data) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(data, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.sha256(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_function_1ff95bcc5517c252: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_object_a27215656b807791: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_ea5e6cc2e4141dfe: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_c05833b95a3cf397: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_a6e5c5dce5018821: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_crypto_38df2bab126b63dc: function(arg0) {
            const ret = arg0.crypto;
            return ret;
        },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_getRandomValues_c44a50d8cfdaebeb: function() { return handleError(function (arg0, arg1) {
            arg0.getRandomValues(arg1);
        }, arguments); },
        __wbg_length_1f0964f4a5e2c6d8: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_msCrypto_bd5a034af96bcba6: function(arg0) {
            const ret = arg0.msCrypto;
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_32b398fb48b6d94a: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_da52cf8fe3429cb2: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_with_length_e6785c33c8e4cce8: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_node_84ea875411254db1: function(arg0) {
            const ret = arg0.node;
            return ret;
        },
        __wbg_process_44c7a14e11e9f69e: function(arg0) {
            const ret = arg0.process;
            return ret;
        },
        __wbg_prototypesetcall_4770620bbe4688a0: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_randomFillSync_6c25eac9869eb53c: function() { return handleError(function (arg0, arg1) {
            arg0.randomFillSync(arg1);
        }, arguments); },
        __wbg_require_b4edbdcf3e2a1ef0: function() { return handleError(function () {
            const ret = module.require;
            return ret;
        }, arguments); },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_8a16b38e4805b298: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_static_accessor_GLOBAL_4ef717fb391d88b7: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_8d1badc68b5a74f4: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_146583524fe1469b: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_f2829a2234d7819e: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_subarray_3ed232c8a6baee09: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_versions_276b2795b1c6a219: function(arg0) {
            const ret = arg0.versions;
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./zukan_wasm_bg.js": import0,
    };
}

const BatchDamageResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_batchdamageresult_free(ptr, 1));
const DamageInputFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_damageinput_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function getArrayU16FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint16ArrayMemory0().subarray(ptr / 2, ptr / 2 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
    if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
        cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
    }
    return cachedUint16ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint16ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('zukan_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
