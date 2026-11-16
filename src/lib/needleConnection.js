// Serialize cookie-changing requests and coalesce only an in-flight sign-in
// for the SAME Holmes identity. This is not a cached authorization decision.
export function createNeedleConnection({ exchange, logout }) {
  let queue = Promise.resolve()
  const pending = new Map()
  const enqueue = action => {
    const result = queue.then(action)
    queue = result.catch(() => {})
    return result
  }
  return {
    start(identity) {
      if (!identity) return Promise.resolve({ ok: false, reason: 'identity' })
      if (pending.has(identity)) return pending.get(identity)
      const result = enqueue(exchange)
      pending.set(identity, result)
      const clear = () => { if (pending.get(identity) === result) pending.delete(identity) }
      result.then(clear, clear)
      return result
    },
    end() {
      pending.clear()
      return enqueue(logout)
    },
  }
}
