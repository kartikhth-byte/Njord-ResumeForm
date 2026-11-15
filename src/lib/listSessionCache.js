const caches = new Set()

export function registerListSessionCache(cache) {
  caches.add(cache)
  return cache
}

export function clearListSessionCaches() {
  for (const cache of caches) cache.clear()
}
