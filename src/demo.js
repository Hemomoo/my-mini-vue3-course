
const bucket = new WeakMap()

const data = { foo: 1, bar: 4}
// 用一个全局变量存储当前激活的 effect 函数
let activeEffect
// effect 栈
const effectStack = []

function effect (fn, options = {}) {
  const effectFn = () => {
    // console.log('effectFn执行了')
    cleanup(effectFn)
    // 当调用副作用函数之前将当前副作用函数压入栈中
    activeEffect = effectFn
    effectStack.push(effectFn)
    const res = fn()
    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
  effectFn.options = options
  // activeEffect.deps 用来存储所有与该副作用函数相关的依赖集合
  effectFn.deps = []
  if (!options.lazy) {
    // 执行副作用函数
    effectFn()
  }
  return effectFn
}

function cleanup (effectFn) {
  // 遍历 effectFn.deps 数组
  for (let i = 0; i < effectFn.deps.length; i++) {
    // deps 是依赖集合
    const deps = effectFn.deps[i]
    // 将 effectFn 从依赖依赖中移除
    deps.delete(effectFn)
  }
  // 最后需要重置 effectFn.deps 数组
  effectFn.deps.length = 0
}

function track (target, key) {
  // 没有 activeEffect 直接  return
  if (!activeEffect) return
  let desMap = bucket.get(target)
  if (!desMap) {
    desMap = new Map()
    bucket.set(target, desMap)
  }
  let deps = desMap.get(key)
  if (!deps) {
    deps = new Set()
    desMap.set(key, deps)
  }
  // 把当前激活的副作用函数添加到依赖集合 deps 中
  deps.add(activeEffect)
  // deps 就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps)
}

function trigger (target, key) {
  const desMap = bucket.get(target)
  if (!desMap) return
  const effects = desMap.get(key)
  const effectToRun = new Set(effects)
  effectToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      if (effectFn !== activeEffect) {
        effectFn()
      }
    }
  })
  // effects && effects.forEach(fn => fn())
}
const obj = new Proxy(data,  {
  // 拦截读取操作
  get (target, key) {
    // 收集依赖
    track(target, key)
    return target[key]
  },
  set (target, key, newVal) {
    target[key] = newVal
    // 触发依赖
    trigger(target, key)
    return true
  }
})

const jobQueue = new Set()
const p = Promise.resolve()
let isFlushing = false

function flushJog () {
  if (isFlushing) return
  isFlushing = true
  p.then(() => {
    jobQueue.forEach(job => job())
  }).finally(() => {
    isFlushing = false
  })
}


/*
  1. 
*/
function computed (getter) {
  let value
  let dirty = true
  // 把 getter 作为副作用函数，创建一个 lazy 的 effect
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      if (!dirty) {
        dirty = true
        // 
        trigger(obj, 'value')
      }
  
    }
  })
  // 获取value 值得时候回
  const obj = {
    // 当读取 value 时执行 effectFn
    get value() {
      if (dirty) {
        value = effectFn()
        dirty = false
      }
      track(obj, 'value')
      return value 
    }
  }
  return obj
}


// 如果是对象就get所有的key 触发响应式 
function traverse (value, seen = new Set()) {
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  seen.add(value)
  for (const k in value) {
    traverse(value[k], seen)
  }
  return value
}

// source 需要监听的值，需要是一个方法，或则对象。因为effect的第一次参数是函数，cb得回调函数
function watch(source, cb) {
  let getter
  let newValue
  let oldValue
  if (typeof source === 'function') {
    getter = source
  } else {
    // 如果是对象就需要便利所有的值存入
    getter = () => traverse(source)
  }
  //  get的数据的时候， 搜集effect函数
  const effectFn = effect(()=> getter(), {
    // 因为lazy 为 true 所以 effectFn 返回的是 effecth函数 而不是 计算的值
    lazy: true,
    scheduler() {
      newValue = effectFn()
      // 自己传入的回调函数。
      cb(oldValue, newValue) // 一个闭包
      oldValue = newValue
      console.log('oldValue1: ', oldValue);
    }
  })
  /*
    所以这个地方返回的是上个effect计算的值，
    watch 需要是一个函数的原因
    因为effect 是 get 函数所以这个返回的是oldValue
  */ 
  oldValue = effectFn()
  console.log('oldValue2: ', oldValue);
  /*
    oldValue2:  1
    oldValue1:  2
  */
}

watch(() => obj.foo, (newValue, oldValue) => {
  console.log(newValue, oldValue)
})

obj.foo++




