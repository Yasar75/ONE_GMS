const target = new EventTarget()

function emit(type, detail = {}) {
  target.dispatchEvent(new CustomEvent(type, { detail }))
}

export const uiBus = {
  on(type, handler) {
    target.addEventListener(type, handler)
    return () => target.removeEventListener(type, handler)
  },
  startRequest(detail) {
    emit('ui:request:start', detail)
  },
  finishRequest(detail) {
    emit('ui:request:finish', detail)
  }
}
