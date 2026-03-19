const subscribers = new Set()
let sequence = 0

function emit(payload) {
  subscribers.forEach((subscriber) => subscriber(payload))
}

export const loadingBus = {
  subscribe(subscriber) {
    subscribers.add(subscriber)
    return () => subscribers.delete(subscriber)
  },
  show(payload = {}) {
    const id = `loader-${Date.now()}-${sequence++}`
    emit({ type: 'show', id, payload })
    return id
  },
  hide(id) {
    emit({ type: 'hide', id })
  },
  clear() {
    emit({ type: 'clear' })
  }
}
