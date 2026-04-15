<template>
  <view class="relative bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg overflow-hidden mb-6">
    <!-- 背景装饰 - 宝可梦球图案 -->
    <view class="absolute -right-10 -top-10 w-64 h-64 opacity-10">
      <svg viewBox="0 0 100 100" class="w-full h-full text-white">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="3"></circle>
        <path d="M 5 50 L 95 50" stroke="currentColor" stroke-width="3"></path>
        <circle cx="50" cy="50" r="12" fill="none" stroke="currentColor" stroke-width="3"></circle>
        <circle cx="50" cy="50" r="6" fill="currentColor"></circle>
      </svg>
    </view>
    
    <!-- 宝可梦图片 -->
    <view class="relative z-10 flex justify-center pt-8 pb-4">
      <view class="w-48 h-48 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
        <image 
          :src="pokemon.image || '/static/images/placeholder.png'" 
          mode="aspectFit" 
          class="w-40 h-40 animate-bounce"
          @load="onImageLoad"
        ></image>
      </view>
    </view>
    
    <!-- 宝可梦名称和编号 -->
    <view class="px-6 pb-6 text-center text-white">
      <view class="flex justify-center items-center mb-2">
        <text class="text-3xl font-bold tracking-wider mr-2">{{ pokemon.name }}</text>
        <text class="text-xl bg-white/20 px-2 py-0.5 rounded-full">#{{ pokemon.id.toString().padStart(3, '0') }}</text>
      </view>
      
      <!-- 宝可梦类型 -->
      <view class="flex justify-center gap-2 mt-2">
        <text v-for="type in pokemon.types" :key="type" :class="getTypeBadgeClass(type)">{{ getTypeName(type) }}</text>
      </view>
      
      <!-- 宝可梦特性 -->
      <view class="mt-3 text-sm opacity-90">
        <text>特性: {{ pokemon.ability || '-' }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    pokemon: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      imageLoaded: false
    }
  },
  computed: {
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
      return this.typeNames[type] || type
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
      }
      return `px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm ${typeColors[type] || 'bg-gray-500'}`
    },
    onImageLoad() {
      this.imageLoaded = true
    }
  }
}
</script>

<style lang="scss" scoped>
.animate-bounce {
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
</style>