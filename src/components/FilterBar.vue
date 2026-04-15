<template>
  <view class="fixed z-[999] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] border-b border-black/5 animate-slideDown" :style="{ top: 'calc(var(--status-bar-height) + 60px)' }">
    <view class="px-5 py-4 flex flex-col gap-4">
      <!-- 类型筛选 -->
      <view class="flex flex-col gap-3">
        <text class="text-sm font-semibold text-[#666] tracking-wide">类型筛选</text>
        <view class="flex flex-wrap gap-2 items-center">
          <button
            v-for="type in types"
            :key="type"
            :class="['px-3.5 py-1.5 rounded-[20px] text-[13px] font-semibold text-white cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] border-2 border-transparent shadow-[0_2px_6px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:translate-y-0', getTypeClass(type), { 'border-white shadow-[0_0_0_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.2)] scale-105': selectedTypes.includes(type) }]"
            @click="toggleTypeFilter(type)"
          >
            {{ typeNames[type] || type }}
          </button>
          <view class="relative">
            <button class="px-3.5 py-1.5 rounded-[20px] text-[13px] font-semibold text-white cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] border-2 border-transparent shadow-[0_2px_6px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:translate-y-0 bg-gradient-to-br from-[#667eea] to-[#764ba2]" @click="showMore = !showMore">
              {{ showMore ? '收起' : '更多' }}
            </button>
            <view v-if="showMore" class="absolute top-full mt-2 left-0 bg-white rounded-xl p-3 shadow-[0_8px_24px_rgba(0,0,0,0.15)] flex flex-wrap gap-2 min-w-[280px] z-[1000] animate-fadeIn">
              <button
                v-for="type in moreTypes"
                :key="type"
                :class="['px-3.5 py-1.5 rounded-[20px] text-[13px] font-semibold text-white cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] border-2 border-transparent shadow-[0_2px_6px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:translate-y-0', getTypeClass(type), { 'border-white shadow-[0_0_0_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.2)] scale-105': selectedTypes.includes(type) }]"
                @click="toggleTypeFilter(type)"
              >
                {{ typeNames[type] || type }}
              </button>
            </view>
          </view>
        </view>
      </view>

      <!-- 排序选项 -->
      <view class="flex-row items-center justify-between">
        <text class="text-sm font-semibold text-[#666] tracking-wide">排序方式</text>
        <picker :range="sortOptions" :range-key="'label'" @change="onSortChange">
          <view class="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-[#f5f7fa] to-[#c3cfe2] rounded-[20px] text-sm font-semibold text-[#333] cursor-pointer transition-all duration-300 shadow-[0_2px_6px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 active:translate-y-0">
            <text>{{ currentSort.label }}</text>
            <!-- 下拉箭头图标 -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-[#666]">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </view>
        </picker>
      </view>
    </view>
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

// 定义基础类型和扩展类型
const types = ref(['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison'])
const moreTypes = ref(['ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'])

// 控制更多类型显示
const showMore = ref(false)

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

// 处理排序变化
const onSortChange = (e) => {
  currentSort.value = sortOptions.value[e.detail.value]
  emit('filterChange', {
    types: selectedTypes.value,
    sort: currentSort.value.value
  })
}

// 定义事件发射器
const emit = defineEmits(['filterChange'])
</script>

<style lang="scss" scoped>
/* 所有样式已迁移至 Tailwind CSS */

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