<template>
  <view class="archive-section mb-3 p-4">
    <view class="mb-3 flex items-center justify-between gap-3">
      <text class="text-lg font-black tracking-[-0.03em] text-[#24262b]">招式列表</text>
      <picker mode="selector" :range="['全部', '升级', '技能机器', '遗传', '教授招式']" @change="onMoveTypeChange">
        <view class="move-picker">
          <text>{{ moveTypeFilterText }}</text>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </view>
      </picker>
    </view>

    <view class="flex flex-col gap-2">
      <view v-for="(move, index) in filteredMoves" :key="index" class="move-card">
        <view class="min-w-0 flex-1">
          <text class="block truncate text-sm font-black text-[#24262b]">{{ getMoveName(move) }}</text>
          <text class="mt-0.5 block text-[10px] font-black tracking-[0.12em] text-[#8d929c]">{{ getMoveCategory(move) }}</text>
        </view>
        <text :class="getTypeBadgeClass(getMoveType(move))">{{ getTypeName(getMoveType(move)) }}</text>
        <view class="move-card__stats">
          <text>{{ getMovePower(move) }}</text>
          <text>{{ getMoveAccuracy(move) }}</text>
        </view>
      </view>
    </view>

    <view v-if="totalPages > 1" class="mt-4 flex justify-center gap-2">
      <button class="page-button" @click="prevPage" :disabled="currentPage <= 1">上一页</button>
      <button
        v-for="page in totalPages"
        :key="page"
        class="page-button"
        :class="page === currentPage ? 'page-button--active' : ''"
        @click="goToPage(page)"
      >
        {{ page }}
      </button>
      <button class="page-button" @click="nextPage" :disabled="currentPage >= totalPages">下一页</button>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    moves: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      moveTypeFilter: -1,
      movesPerPage: 10,
      currentPage: 1
    }
  },
  computed: {
    normalizedMoves() {
      if (!this.moves.length) {
        return [];
      }
      return this.moves.map(move => typeof move === 'string' ? { name: move } : move);
    },
    filteredMoves() {
      let filtered = this.normalizedMoves;

      if (this.moveTypeFilter >= 0) {
        const moveTypes = ['level-up', 'machine', 'egg', 'tutor'];
        filtered = this.normalizedMoves.filter(move => move.learnMethod === moveTypes[this.moveTypeFilter]);
      }

      const start = (this.currentPage - 1) * this.movesPerPage;
      const end = start + this.movesPerPage;
      return filtered.slice(start, end);
    },
    totalPages() {
      let filteredCount = this.normalizedMoves.length;

      if (this.moveTypeFilter >= 0) {
        const moveTypes = ['level-up', 'machine', 'egg', 'tutor'];
        filteredCount = this.normalizedMoves.filter(move => move.learnMethod === moveTypes[this.moveTypeFilter]).length;
      }

      return Math.max(1, Math.ceil(filteredCount / this.movesPerPage));
    },
    moveTypeFilterText() {
      const filterTexts = ['全部', '升级', '技能机器', '遗传', '教授招式'];
      return filterTexts[this.moveTypeFilter + 1];
    },
    typeNames() {
      return {
        normal: '一般',
        fire: '火',
        water: '水',
        electric: '电',
        grass: '草',
        ice: '冰',
        fighting: '格斗',
        poison: '毒',
        ground: '地面',
        flying: '飞行',
        psychic: '超能力',
        bug: '虫',
        rock: '岩石',
        ghost: '幽灵',
        dragon: '龙',
        dark: '恶',
        steel: '钢',
        fairy: '妖精'
      }
    }
  },
  methods: {
    getMoveName(move) {
      return move.name || '未知招式';
    },
    getMoveType(move) {
      return move.type || 'normal';
    },
    getMoveCategory(move) {
      return move.category || '—';
    },
    getMovePower(move) {
      return move.power || '—';
    },
    getMoveAccuracy(move) {
      return move.accuracy || '—';
    },
    getTypeName(type) {
      return this.typeNames[type] || type;
    },
    getTypeBadgeClass(type) {
      const typeColors = {
        normal: 'bg-gradient-to-br from-[#A8A77A] to-[#72714d]',
        fire: 'bg-gradient-to-br from-[#f58b38] to-[#c84b22]',
        water: 'bg-gradient-to-br from-[#5b95f0] to-[#2763c8]',
        electric: 'bg-gradient-to-br from-[#ffd84a] to-[#d99b00] text-[#2f2a12]',
        grass: 'bg-gradient-to-br from-[#83c85a] to-[#3f8f3d]',
        poison: 'bg-gradient-to-br from-[#a44ab0] to-[#682672]'
      };
      return `type-badge ${typeColors[type] || 'bg-gradient-to-br from-[#78906a] to-[#43543a]'}`;
    },
    onMoveTypeChange(e) {
      this.moveTypeFilter = e.detail.value - 1;
      this.currentPage = 1;
    },
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
      }
    },
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
      }
    },
    goToPage(page) {
      this.currentPage = page;
    }
  }
}
</script>

<style scoped>
.archive-section {
  border: 1px solid #e5e7ee;
  border-radius: 28px;
  background: #ffffff;
  box-shadow: 0 14px 34px rgba(48, 55, 72, 0.08);
}

.move-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 11px;
  border: 1px solid #e1e4eb;
  border-radius: 999px;
  color: #6f7682;
  font-size: 12px;
  font-weight: 900;
  background: #f5f6fa;
}

.move-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px;
  border: 1px solid #e5e7ee;
  border-radius: 18px;
  background: #f5f6fa;
}

.type-badge {
  display: inline-block;
  flex-shrink: 0;
  min-width: 44px;
  padding: 4px 8px;
  border-radius: 999px;
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.12);
}

.move-card__stats {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 2px;
  min-width: 28px;
  color: #6f7682;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 900;
  text-align: right;
}

.page-button {
  padding: 6px 10px;
  border: 1px solid #e1e4eb;
  border-radius: 999px;
  color: #6f7682;
  font-size: 12px;
  font-weight: 900;
  background: #f5f6fa;
}

.page-button--active {
  color: #ffffff;
  background: linear-gradient(135deg, #73b7ff, #357df4);
}

.page-button::after {
  border: none !important;
}
</style>
