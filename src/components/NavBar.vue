<template>
  <view class="fixed top-0 left-0 right-0 z-[1000] bg-gradient-to-br from-[#FF6B6B] to-[#EE5A6F] shadow-[0_4px_20px_rgba(238,90,111,0.3)] backdrop-blur-lg" :style="{ paddingTop: 'var(--status-bar-height)' }">
    <view class="h-[60px] flex items-center justify-between px-4 gap-3">
      <!-- Logo和标题 (左侧) -->
      <view class="flex items-center gap-2 flex-shrink-0 cursor-pointer" @click="goHome">
        <!-- 宝可梦球图标 -->
        <view class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] relative overflow-hidden transition-transform duration-300 hover:scale-110 active:scale-95">
          <view class="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[#FF6B6B] to-[#FF8787]"></view>
          <view class="absolute bottom-0 left-0 right-0 h-1/2 bg-white"></view>
          <view class="absolute top-1/2 left-0 right-0 h-[2px] bg-[#333] -translate-y-1/2"></view>
          <view class="absolute top-1/2 left-1/2 w-2.5 h-2.5 bg-white border-[2px] border-[#333] rounded-full -translate-x-1/2 -translate-y-1/2 z-10"></view>
        </view>
        <text class="text-lg font-bold text-white whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] hidden sm:block">宝可梦图鉴</text>
      </view>

      <!-- 搜索框 (中间 - 扩展) -->
      <view class="flex-1 max-w-2xl relative">
        <input 
          type="text" 
          placeholder="搜索宝可梦名称、编号或属性..." 
          class="w-full h-10 pl-10 pr-4 rounded-full border-none bg-white/95 text-sm text-[#333] transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus:bg-white focus:shadow-[0_4px_16px_rgba(0,0,0,0.15)] focus:scale-[1.02] placeholder:text-[#999]"
          v-model="searchText"
          @input="onSearch"
          @focus="onSearchFocus"
          @blur="onSearchBlur"
        />
        <!-- 搜索图标 -->
        <view class="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] transition-all duration-300" :class="isSearchFocused ? 'opacity-100 scale-110' : 'opacity-60'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full" :class="isSearchFocused ? 'text-[#EE5A6F]' : 'text-[#666]'">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </view>
        <!-- 清除按钮 -->
        <view v-if="searchText" class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" @click="clearSearch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-[#999] hover:text-[#EE5A6F] transition-colors">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </view>
      </view>

      <!-- 右侧按钮组 -->
      <view class="flex items-center gap-2 flex-shrink-0">
        <!-- 筛选按钮 -->
        <button 
          class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur hover:bg-white/30 hover:scale-105 active:scale-95 relative"
          :class="{ '!bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.15)]': filterVisible }"
          @click="toggleFilter"
        >
          <!-- 筛选图标 -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 transition-all duration-300" :class="filterVisible ? 'text-[#EE5A6F]' : 'text-white'">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <!-- 筛选激活指示器 -->
          <view v-if="hasActiveFilters" class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></view>
        </button>

        <!-- 收藏按钮 -->
        <button 
          class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur hover:bg-white/30 hover:scale-105 active:scale-95 relative"
          @click="goToFavorites"
        >
          <!-- 心形图标 -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-white">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <!-- 收藏数量徽章 -->
          <view v-if="favoritesCount > 0" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-white rounded-full flex items-center justify-center border-2 border-[#EE5A6F]">
            <text class="text-[10px] font-bold text-[#EE5A6F]">{{ favoritesCount > 99 ? '99+' : favoritesCount }}</text>
          </view>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { usePokemonStore } from '@/store/pokemon'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const pokemonStore = usePokemonStore()
const { favorites } = storeToRefs(pokemonStore)

// 定义响应式数据
const searchText = ref('')
const filterVisible = ref(false)
const isSearchFocused = ref(false)

// 计算收藏数量
const favoritesCount = computed(() => {
  return favorites.value.length
})

// 计算是否有激活的筛选条件（可以根据实际情况调整）
const hasActiveFilters = computed(() => {
  // TODO: 根据实际筛选状态返回
  return false
})

// 定义方法
const onSearch = () => {
  // 向父组件发送搜索事件
  emit('search', searchText.value)
}

const onSearchFocus = () => {
  isSearchFocused.value = true
}

const onSearchBlur = () => {
  isSearchFocused.value = false
}

const clearSearch = () => {
  searchText.value = ''
  emit('search', '')
}

const toggleFilter = () => {
  filterVisible.value = !filterVisible.value
  // 向父组件发送筛选切换事件
  emit('filterToggle', filterVisible.value)
}

const goHome = () => {
  // 返回首页
  uni.switchTab({
    url: '/pages/index/index'
  })
}

const goToFavorites = () => {
  // 跳转到收藏页面或显示收藏列表
  uni.showToast({
    title: `已收藏 ${favoritesCount.value} 只宝可梦`,
    icon: 'none'
  })
}

// 定义 emit 用于向父组件传递事件
const emit = defineEmits(['search', 'filterToggle'])
</script>

<style lang="scss" scoped>
/* 所有样式已迁移至 Tailwind CSS */
</style>