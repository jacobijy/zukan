<template>
  <view class="bg-white rounded-xl shadow-md p-6 mb-6">
    <view class="flex justify-between items-center mb-4">
      <text class="text-xl font-bold text-gray-800">招式列表</text>
      <picker mode="selector" :range="['全部', '升级', '技能机器', '遗传', '教授招式']" @change="onMoveTypeChange">
        <view class="px-3 py-1 border border-gray-300 rounded-lg text-sm flex items-center gap-1">
          <text>{{ moveTypeFilterText }}</text>
          <!-- 下拉箭头图标 -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 text-[#666]">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </view>
      </picker>
    </view>

    <view class="overflow-x-auto">
      <view class="moves-table min-w-full divide-y divide-gray-200">
        <view
          class="moves-header grid grid-cols-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          <view class="px-3">招式名称</view>
          <view class="px-3">类型</view>
          <view class="px-3">分类</view>
          <view class="px-3">威力</view>
          <view class="px-3">命中率</view>
        </view>

        <view v-for="(move, index) in filteredMoves" :key="index"
          class="moves-row grid grid-cols-5 py-3 text-sm hover:bg-gray-50">
          <view class="px-3 font-medium text-gray-900">{{ move.name }}</view>
          <view class="px-3"><text :class="getTypeBadgeClass(move.type)">{{ getTypeName(move.type) }}</text></view>
          <view class="px-3">{{ move.category || '-' }}</view>
          <view class="px-3">{{ move.power || '-' }}</view>
          <view class="px-3">{{ move.accuracy || '-' }}</view>
        </view>
      </view>
    </view>

    <!-- 分页控件 -->
    <view class="mt-4 flex justify-center">
      <nav class="flex items-center space-x-1">
        <button
          class="px-2 py-1 rounded border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50"
          @click="prevPage" :disabled="currentPage <= 1">
          上一页
        </button>
        <button v-for="page in totalPages" :key="page"
          :class="{ 'px-2 py-1 rounded border border-gray-300 bg-red-500 text-xs font-medium text-white': page === currentPage, 'px-2 py-1 rounded border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50': page !== currentPage }"
          @click="goToPage(page)">
          {{ page }}
        </button>
        <button
          class="px-2 py-1 rounded border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50"
          @click="nextPage" :disabled="currentPage >= totalPages">
          下一页
        </button>
      </nav>
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
      moveTypeFilter: -1, // -1表示全部，0-4对应不同获取方式
      movesPerPage: 10,
      currentPage: 1
    }
  },
  computed: {
    filteredMoves() {
      // 根据筛选条件过滤招式
      let filtered = this.moves;

      if (this.moveTypeFilter >= 0) {
        const moveTypes = ['level-up', 'machine', 'egg', 'tutor'];
        filtered = this.moves.filter(move => move.learnMethod === moveTypes[this.moveTypeFilter]);
      }

      // 分页
      const start = (this.currentPage - 1) * this.movesPerPage;
      const end = start + this.movesPerPage;
      return filtered.slice(start, end);
    },
    totalPages() {
      let filteredCount = this.moves.length;

      if (this.moveTypeFilter >= 0) {
        const moveTypes = ['level-up', 'machine', 'egg', 'tutor'];
        filteredCount = this.moves.filter(move => move.learnMethod === moveTypes[this.moveTypeFilter]).length;
      }

      return Math.ceil(filteredCount / this.movesPerPage);
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
    getTypeName(type) {
      return this.typeNames[type] || type;
    },
    getTypeBadgeClass(type) {
      const typeColors = {
        normal: 'bg-normal',
        fire: 'bg-fire',
        water: 'bg-water',
        electric: 'bg-electric',
        grass: 'bg-grass',
        ice: 'bg-ice',
        fighting: 'bg-fighting',
        poison: 'bg-poison',
        ground: 'bg-ground',
        flying: 'bg-flying',
        psychic: 'bg-psychic',
        bug: 'bg-bug',
        rock: 'bg-rock',
        ghost: 'bg-ghost',
        dragon: 'bg-dragon',
        dark: 'bg-dark',
        steel: 'bg-steel',
        fairy: 'bg-fairy'
      };
      return `type-badge ${typeColors[type] || 'bg-gray-500'}`;
    },
    onMoveTypeChange(e) {
      this.moveTypeFilter = e.detail.value - 1;
      this.currentPage = 1; // 重置页码
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
.type-badge {
  @apply px-2 py-0.5 rounded-full text-xs font-bold text-white inline-block;
}

.moves-header,
.moves-row {
  @apply grid grid-cols-5 py-2 text-left text-sm;
}

.moves-header {
  @apply font-medium text-gray-500 border-b;
}

.moves-row {
  @apply border-b border-gray-100 hover:bg-gray-50 transition-colors;
}
</style>