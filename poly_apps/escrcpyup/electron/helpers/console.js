import log from '$electron/helpers/log.js'
import { createProxy } from './index.js'
import appStore from './store.js'

let debug = false

try {
  debug = appStore.get('common.debug') || false
}
catch (error) {
  // appStore may not be ready yet during initialization
  debug = false
}

if (debug) {
  Object.assign(console, {
    ...createProxy(log.functions, log.levels),
    raw: console.log,
  })
}
