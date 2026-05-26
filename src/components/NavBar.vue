<template>
  <view
    class="navbar-root fixed top-0 left-0 right-0 z-[1000] bg-gradient-to-br from-[#FF6B6B] to-[#EE5A6F] shadow-[0_4px_20px_rgba(238,90,111,0.3)] backdrop-blur-lg"
    :style="{ paddingTop: 'var(--status-bar-height)' }"
  >
    <view class="navbar-inner flex items-center justify-between px-4 gap-3">
      <!-- Logo和标题 (左侧) -->
      <view class="flex items-center gap-2 flex-shrink-0 cursor-pointer" @click="goHome">
        <view class="navbar-logo rounded-full bg-white flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] relative overflow-hidden transition-transform duration-300 hover:scale-110 active:scale-95">
          <view class="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[#FF6B6B] to-[#FF8787]"></view>
          <view class="absolute bottom-0 left-0 right-0 h-1/2 bg-white"></view>
          <view class="absolute top-1/2 left-0 right-0 h-[2px] bg-[#333] -translate-y-1/2"></view>
          <view class="navbar-logo-dot absolute top-1/2 left-1/2 bg-white border-[2px] border-[#333] rounded-full -translate-x-1/2 -translate-y-1/2 z-10"></view>
        </view>
        <text class="text-lg font-bold text-white whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] hidden sm:block">宝可梦图鉴</text>
      </view>

      <!-- 搜索框 (中间 - 扩展) -->
      <view class="flex-1 max-w-2xl relative h-full flex items-center">
        <input
          type="text"
          placeholder="搜索宝可梦名称、编号或属性..."
          class="navbar-input w-full rounded-full border-none bg-white/95 text-[#333] transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus:bg-white focus:shadow-[0_4px_16px_rgba(0,0,0,0.15)] placeholder:text-[#999]"
          v-model="searchText"
          @input="onSearch"
          @focus="onSearchFocus"
          @blur="onSearchBlur"
        />
        <view
          class="navbar-search-icon absolute top-1/2 -translate-y-1/2 transition-all duration-300"
          :class="isSearchFocused ? 'opacity-100 scale-110' : 'opacity-60'"
          :style="{ left: 'calc(var(--navbar-control-height) * 0.28)' }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full" :class="isSearchFocused ? 'text-[#EE5A6F]' : 'text-[#666]'">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </view>
        <view
          v-if="searchText"
          class="navbar-search-icon absolute top-1/2 -translate-y-1/2 cursor-pointer"
          :style="{ right: 'calc(var(--navbar-control-height) * 0.28)' }"
          @click="clearSearch"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full text-[#999] hover:text-[#EE5A6F] transition-colors">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </view>
      </view>

      <!-- 右侧按钮组 -->
      <view class="flex items-center gap-2 flex-shrink-0 h-full">
        <button
          class="navbar-icon-btn rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur hover:bg-white/30 hover:scale-105 active:scale-95 relative"
          :class="{ '!bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.15)]': generationVisible }"
          @click="toggleGeneration"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="navbar-btn-icon transition-all duration-300" :class="generationVisible ? 'text-[#EE5A6F]' : 'text-white'">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <view v-if="hasActiveGeneration" class="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full border-2 border-white animate-pulse"></view>
        </button>

        <button
          class="navbar-icon-btn rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur hover:bg-white/30 hover:scale-105 active:scale-95 relative"
          :class="{ '!bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.15)]': filterVisible }"
          @click="toggleFilter"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="navbar-btn-icon transition-all duration-300" :class="filterVisible ? 'text-[#EE5A6F]' : 'text-white'">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <view v-if="hasActiveFilters" class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></view>
        </button>

        <button
          class="navbar-icon-btn rounded-full bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur hover:bg-white/30 hover:scale-105 active:scale-95 relative"
          @click="handleFavoritesClick"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="navbar-btn-icon text-white">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <view v-if="favoritesCount > 0" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
            <text class="text-[10px] font-bold text-white">{{ favoritesCount > 99 ? '99+' : favoritesCount }}</text>
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

const searchText = ref('')
const filterVisible = ref(false)
const generationVisible = ref(false)
const isSearchFocused = ref(false)

const favoritesCount = computed(() => favorites.value.length)
const hasActiveFilters = computed(() => false)
const hasActiveGeneration = computed(() => false)

const onSearch = () => {
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
  emit('filterToggle', filterVisible.value)
}

const toggleGeneration = () => {
  generationVisible.value = !generationVisible.value
  emit('generationToggle', generationVisible.value)
}

const goHome = () => {
  uni.switchTab({
    url: '/pages/index/index'
  })
}

const handleFavoritesClick = () => {
  emit('showFavorites')
}

const emit = defineEmits(['search', 'filterToggle', 'showFavorites', 'generationToggle'])
</script>

<style lang="scss" scoped>
.navbar-inner {
  height: var(--navbar-content-height);
}

.navbar-input {
  height: var(--navbar-control-height);
  min-height: var(--navbar-control-height);
  max-height: var(--navbar-control-height);
  line-height: var(--navbar-control-height);
  font-size: max(12px, calc(var(--navbar-control-height) * 0.36));
  padding-top: 0;
  padding-bottom: 0;
  padding-left: calc(var(--navbar-control-height) * 0.95);
  padding-right: calc(var(--navbar-control-height) * 0.55);
  box-sizing: border-box;
}

.navbar-icon-btn {
  width: var(--navbar-control-height);
  height: var(--navbar-control-height);
  min-width: var(--navbar-control-height);
  min-height: var(--navbar-control-height);
  padding: 0;
  box-sizing: border-box;
}

.navbar-btn-icon {
  width: calc(var(--navbar-control-height) * 0.5);
  height: calc(var(--navbar-control-height) * 0.5);
}

.navbar-logo {
  width: calc(var(--navbar-content-height) * 0.55);
  height: calc(var(--navbar-content-height) * 0.55);
}

.navbar-logo-dot {
  width: calc(var(--navbar-content-height) * 0.18);
  height: calc(var(--navbar-content-height) * 0.18);
}

.navbar-search-icon {
  width: calc(var(--navbar-control-height) * 0.42);
  height: calc(var(--navbar-control-height) * 0.42);
}
</style>
