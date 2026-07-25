<template>
  <view class="sprite-wrapper">
    <image
      v-if="blobUrl"
      :src="blobUrl"
      mode="aspectFit"
      :class="imgClass"
    />
    <view v-else-if="loading" :class="['skeleton', skeletonClass]"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { initWasm, decryptZukan } from '@/infra/wasm'

interface Props {
  pokemonId: number
  variant?: string   // default / shiny / home / artwork 等
  imgClass?: string
  skeletonClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  imgClass: '',
  skeletonClass: '',
})

const blobUrl = ref<string | null>(null)
const loading = ref(true)

// ── 全局密钥缓存 ──
let keyCache: { dek: string } | null = null
let keyPromise: Promise<{ dek: string }> | null = null

async function getKey(): Promise<{ dek: string }> {
  if (keyCache) return keyCache
  if (!keyPromise) {
    keyPromise = new Promise((resolve, reject) => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
      uni.request({
        url: `${baseUrl}/zukan/key`,
        method: 'GET',
        header: {
          Authorization: `Bearer ${getToken()}`,
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            keyCache = res.data as { dek: string }
            resolve(keyCache)
          } else {
            reject(new Error(`获取密钥失败: ${res.statusCode}`))
          }
        },
        fail: (err) => reject(new Error(err.errMsg)),
      })
    })
  }
  return keyPromise
}

// ── 解密结果 LRU 缓存（全局共享） ──
const decryptedCache = new Map<string, string>()
const MAX_CACHE = 200

// ── 已创建的 Blob URL 追踪（用于组件卸载时清理） ──
const createdUrls = new Set<string>()

onMounted(async () => {
  const cacheKey = `${props.pokemonId}/${props.variant}`

  // 1. 命中缓存的 Blob URL
  const cached = decryptedCache.get(cacheKey)
  if (cached) {
    blobUrl.value = cached
    loading.value = false
    return
  }

  try {
    // 2. 初始化 WASM（幂等）
    await initWasm()

    // 3. 获取密钥
    const { dek } = await getKey()

    // 4. 请求加密图片
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    const encrypted = await new Promise<Uint8Array>((resolve, reject) => {
      uni.request({
        url: `${baseUrl}/assets/encrypted/pokemon/${props.pokemonId}/${props.variant}.bin`,
        method: 'GET',
        responseType: 'arraybuffer',
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(new Uint8Array(res.data as ArrayBuffer))
          } else {
            reject(new Error(`加载图片失败: ${res.statusCode}`))
          }
        },
        fail: (err) => reject(new Error(err.errMsg)),
      })
    })

    // 5. WASM 解密（复用已有 decryptZukan）
    const decrypted = decryptZukan(encrypted, dek)

    // 6. Blob URL
    const blob = new Blob([decrypted], { type: 'image/png' })
    // uni-app 的 H5 环境支持 URL.createObjectURL
    const url = URL.createObjectURL(blob)
    createdUrls.add(url)

    // 7. 写入 LRU 缓存
    if (decryptedCache.size >= MAX_CACHE) {
      const oldest = decryptedCache.keys().next().value
      if (oldest) decryptedCache.delete(oldest)
    }
    decryptedCache.set(cacheKey, url)

    blobUrl.value = url
  } catch (err) {
    console.error('[EncryptedSprite] 解密失败:', props.pokemonId, props.variant, err)
    // 加载失败时显示占位图
    blobUrl.value = '/static/default.png'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  // 组件卸载时清除 Blob URL（仅清理本组件创建的）
  // 共享缓存中的 URL 由其他组件持有，不清除
  // 此处仅清理未被缓存引用的 URL
  const cacheKey = `${props.pokemonId}/${props.variant}`
  if (!decryptedCache.has(cacheKey)) {
    createdUrls.forEach((url) => URL.revokeObjectURL(url))
    createdUrls.clear()
  }
})

/**
 * 获取认证 token。
 * 目前使用 localStorage 中的 token，后续可接入统一 auth 管理。
 */
function getToken(): string {
  return localStorage.getItem('zukan_token') ?? ''
}
</script>

<style scoped>
.sprite-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>