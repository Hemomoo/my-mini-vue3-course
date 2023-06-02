
const bucket = new WeakMap()

const data = { foo: 1 }
// 用一个全局变量存储当前激活的 effect 函数
let activeEffect
// effect 栈
const effectStack = []

function effect (fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    // 当调用副作用函数之前将当前副作用函数压入栈中
    activeEffect = effectFn
    effectStack.push(effectFn)
    fn()
    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
  }
  effectFn.options = options
  // activeEffect.deps 用来存储所有与该副作用函数相关的依赖集合
  effectFn.deps = []
  // 执行副作用函数
  effectFn()
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
    /*
      1. 新建Map 用来存储 key ---> effect 
      2. 整个bucket 得结构  
      bucket = {
          // desMap  是proxyData 对象 map 可以用对象做值
          desMap：{
            // deps 是proxy对象得key,data.foo 中得foo    用到了set得去重功能 
            deps:  { effectFn,effectFn,effectFn} // 包装过后得effect函数  deps中记录所有这个value得effect 
        }
      }
    */ 
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


// 触发
function trigger (target, key) {
  const desMap = bucket.get(target)
  if (!desMap) return
  const effects = desMap.get(key)
  console.log('effects: ', effects);
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
  // 将所有的effect 函数放入微任务中 同个值得修改所有effect 同步执行 从而优化渲染
  p.then(() => {
    jobQueue.forEach(job => job())
  }).finally(() => {
    isFlushing = false
  })
}

effect(() => {
  console.log(obj.foo)
}, {

  scheduler(fn) {
    jobQueue.add(fn)
    flushJog()
  }
})

obj.foo++
obj.foo++


effect(() => {
  console.log(obj.foo, '你好')
  console.log("effect trigger");
}, {
  scheduler(fn) {
    jobQueue.add(fn)
    flushJog()
  }
})

