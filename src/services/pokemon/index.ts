/**
 * 宝可梦领域数据：从 resourceManager 拿到的 bundle 转成 UI 消费的模型
 */
export { fetchPokemonList, genForPokemonId } from './pokemon';
export { loadMovesForPokemon } from './moves';
export { loadEvolutionChain, buildEvolutionChain, type EvolutionResolvers } from './evolution';
