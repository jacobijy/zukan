/**
 * 登出清理：清会话 + 撤销解密图片 Blob URL + 清空当前账号的内存数据。
 *
 * 不能塞进 `clearSession()`：session 层 import resources 会形成
 * session ⇄ resources 环（既有约定见 AGENTS.md / docs/security/auth-session.md）。
 * 由页面在用户确认后调用本 composable。
 */
import { clearSession } from '@/services/session';
import { clearItemIconCache, clearSpriteCache } from '@/services/resources';
import { usePokemonStore } from '@/store/pokemon';
import { useTeamsStore } from '@/store/teams';
import { useTemplatesStore } from '@/store/templates';

export function useLogout() {
    const pokemonStore = usePokemonStore();
    const teamsStore = useTeamsStore();
    const templatesStore = useTemplatesStore();

    function logout(): void {
        clearSession();
        // sprite / 道具图是用旧 DEK 解出来的，登出后一并撤销所有 Blob URL。
        clearSpriteCache();
        clearItemIconCache();
        // 收藏 / 队伍 / 模板均为账号数据：清空内存，避免下一账号看到上一账号的内容。
        pokemonStore.resetFavorites();
        teamsStore.clearPreviews();
        templatesStore.clearPreviews();
    }

    return { logout };
}
