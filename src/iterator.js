
// 可以迭代对象 
/* 一个对象是否可迭代，取决于这个对象或对象的原型上是否实现了[symbol.iterator] 方法  */
const obj = {
    val:0,
    [Symbol.iterator](){
        return {
            next(){
                return {
                    value: obj.val++,
                    done: obj.val>10?true:false
                }
            }
        }
    }
}

for (const val of obj) {
    console.log('val: ', val);
}

/*
    ❯ node iterator.js
    val:  0
    val:  1
    val:  2
    val:  3
    val:  4
    val:  5
    val:  6
    val:  7
    val:  8
    val:  9
*/

