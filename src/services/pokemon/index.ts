/**
 * 宝可梦领域数据：从 resourceManager 拿到的 bundle 转成 UI 消费的模型
 */
export { fetchPokemonList, genForPokemonId, type NameResolvers } from './pokemon';
export { loadMovesForPokemon } from './moves';
export {
    loadEvolutionChain,
    buildEvolutionChain,
    makeEvolutionResolvers,
    type EvolutionResolvers,
} from './evolution';
