<template>
  <view class="filter-panel fixed z-[999] bg-white shadow-[0_12px_30px_rgba(48,55,72,0.12)] border-b border-[#e5e7ee] animate-slideDown overflow-visible" :style="{ top: 'calc(var(--status-bar-height) + var(--navbar-content-height))' }">
    <view class="px-5 py-4 flex flex-col gap-4">
      <view class="flex items-center justify-between pr-8">
        <text class="text-base font-bold text-[#24262b]">筛选和排序</text>
        <text class="text-xs font-medium text-[#9da2ad]">点击右侧收起</text>
      </view>

      <!-- 类型筛选 -->
      <view class="flex flex-col gap-3">
        <text class="text-sm font-semibold text-[#6f7480] tracking-wide">类型筛选</text>
        <view class="flex flex-wrap gap-2 items-center">
          <button
            v-for="type in allTypes"
            :key="type"
            :class="['px-3.5 py-1.5 rounded-[20px] text-[13px] font-semibold text-white cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] border-2 border-transparent shadow-[0_2px_6px_rgba(48,55,72,0.1)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(48,55,72,0.15)] active:translate-y-0', getTypeClass(type), { 'border-white shadow-[0_0_0_3px_rgba(53,125,244,0.14),0_4px_12px_rgba(48,55,72,0.18)] scale-105': selectedTypes.includes(type) }]"
            @click="toggleTypeFilter(type)"
          >
            {{ typeNames[type] || type }}
          </button>
        </view>
      </view>

      <!-- 排序选项 -->
      <view class="flex flex-col gap-2 relative w-[180px] max-w-full">
        <text class="text-sm font-semibold text-[#6f7480] tracking-wide">排序方式</text>
        <button class="filter-panel-btn w-full flex items-center justify-between gap-2 px-4 py-2 bg-[#f5f6fa] border border-[#e1e4eb] rounded-[20px] text-sm font-semibold text-[#24262b] cursor-pointer transition-all duration-300 shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(48,55,72,0.06)] active:scale-[0.98]" @click="toggleSortDropdown">
          <text>{{ currentSort.label }}</text>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-[#8d929c] transition-transform duration-200" :class="showSortDropdown ? 'rotate-180' : ''">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <view v-if="showSortDropdown" class="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-[0_12px_28px_rgba(48,55,72,0.12)] border border-[#e5e7ee] overflow-hidden z-[1000]">
          <view
            v-for="option in sortOptions"
            :key="option.value"
            class="px-4 py-3 flex items-center justify-between cursor-pointer transition-colors active:bg-[#f5f6fa]"
            :class="currentSort.value === option.value ? 'bg-[#eef4ff] text-[#357df4]' : 'text-[#24262b]'"
            @click="selectSort(option)"
          >
            <text class="text-sm font-semibold">{{ option.label }}</text>
            <svg v-if="currentSort.value === option.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-[#357df4]">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </view>
        </view>
      </view>
    </view>

    <button class="filter-panel-btn absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-9 h-16 rounded-l-full bg-[linear-gradient(135deg,#73b7ff,#357df4)] shadow-[-4px_0_16px_rgba(53,125,244,0.24)] flex items-center justify-start pl-2 active:scale-95 transition-all" @click="closeFilterPanel">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
  </view>
</template>

<script setup>
import { ref } from 'vue'

// 定义类型名称映射
const typeNames = {
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

// 定义所有类型（合并基础类型和扩展类型）
const allTypes = ref(['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'])

// 获取类型样式类名
const getTypeClass = (type) => {
  const typeColors = {
    normal: 'bg-gradient-to-br from-[#A8A77A] to-[#8B8A6A]',
    fire: 'bg-gradient-to-br from-[#EE8130] to-[#D96E28]',
    water: 'bg-gradient-to-br from-[#6390F0] to-[#4A7BD9]',
    electric: 'bg-gradient-to-br from-[#F7D02C] to-[#E5BE1A] text-[#333]',
    grass: 'bg-gradient-to-br from-[#7AC74C] to-[#6BB33D]',
    ice: 'bg-gradient-to-br from-[#96D9D6] to-[#7EC5C2] text-[#333]',
    fighting: 'bg-gradient-to-br from-[#C22E28] to-[#A82620]',
    poison: 'bg-gradient-to-br from-[#A33EA1] to-[#8E358C]',
    ground: 'bg-gradient-to-br from-[#E2BF65] to-[#CFAA52] text-[#333]',
    flying: 'bg-gradient-to-br from-[#A98FF3] to-[#9478E0]',
    psychic: 'bg-gradient-to-br from-[#F95587] to-[#E64073]',
    bug: 'bg-gradient-to-br from-[#A6B91A] to-[#92A316]',
    rock: 'bg-gradient-to-br from-[#B6A136] to-[#A18D2E]',
    ghost: 'bg-gradient-to-br from-[#735797] to-[#614880]',
    dragon: 'bg-gradient-to-br from-[#6F35FC] to-[#5C23E0]',
    dark: 'bg-gradient-to-br from-[#705746] to-[#5C4739]',
    steel: 'bg-gradient-to-br from-[#B7B7CE] to-[#A3A3BA] text-[#333]',
    fairy: 'bg-gradient-to-br from-[#D685AD] to-[#C27098]'
  }
  return typeColors[type] || ''
}

// 定义选中的类型
const selectedTypes = ref([])

// 定义排序选项
const sortOptions = ref([
  { value: 'id', label: '编号' },
  { value: 'name', label: '名称' },
  { value: 'hp', label: 'HP' },
  { value: 'attack', label: '攻击力' },
  { value: 'defense', label: '防御力' }
])

// 当前排序项
const currentSort = ref({ value: 'id', label: '编号' })
const showSortDropdown = ref(false)

// 切换类型筛选
const toggleTypeFilter = (type) => {
  if (selectedTypes.value.includes(type)) {
    selectedTypes.value = selectedTypes.value.filter(t => t !== type)
  } else {
    selectedTypes.value.push(type)
  }
  emit('filterChange', {
    types: selectedTypes.value,
    sort: currentSort.value.value
  })
}

const toggleSortDropdown = () => {
  showSortDropdown.value = !showSortDropdown.value
}

const selectSort = (option) => {
  currentSort.value = option
  showSortDropdown.value = false
  emit('filterChange', {
    types: selectedTypes.value,
    sort: currentSort.value.value
  })
}

const closeFilterPanel = () => {
  showSortDropdown.value = false
  emit('filterToggle', false)
}

// 定义事件发射器
const emit = defineEmits(['filterChange', 'filterToggle'])
</script>

<style lang="scss" scoped>
.filter-panel {
  width: 100%;
}

.filter-panel-btn::after {
  border: none !important;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideDown {
  animation: slideDown 0.3s ease;
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease;
}
</style>
