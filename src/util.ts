import { randomString } from "./string";

let _guid = 0;
/**
 * 生成全局唯一 ID
 * @param {string} [prefix=''] - ID 前缀
 * @returns {string} 返回唯一 ID
 * @example
 * guid('user') // 'guid_user123_1'
 */
export const guid = (prefix = "") => {
    return "guid_" + (prefix || randomString(6)) + ++_guid;
};

/**
 * 节流函数
 * 规定在一个单位时间内，只能触发一次函数。如果这个函数单位时间内触发多次函数，只有一次生效。
 * @param {Function} fn - 要节流的函数
 * @param {number} intervalMiSec - 间隔时间（毫秒）
 * @returns {Function} 返回节流后的函数
 * @example
 * const throttled = throttle(() => console.log('called'), 1000)
 */
export const throttle = (fn: Function, intervalMiSec: number): Function => {
    let context: any, args: any;
    let previous = 0;
    return function (this: any) {
        let now = +new Date();
        context = this;
        args = arguments;
        if (now - previous > intervalMiSec) {
            fn.apply(context, args as any);
            previous = now;
        }
    };
};

/**
 * 更有效果的节流函数
 * 区别：如果函数执行间隔还没到期，放入下一个时间周期执行，如果已经有下一周期未执行，当前触发作废。
 * 这种效果在 Change 类型函数场景中更有效果，可以确保最后一次变更能够有效执行
 * @param {Function} fn - 要节流的函数
 * @param {number} intervalMiSec - 间隔时间（毫秒）
 * @returns {Function} 返回节流后的函数
 * @example
 * const throttled = throttleEffect(() => console.log('called'), 1000)
 */
export const throttleEffect = (fn: Function, intervalMiSec: number): Function => {
    let context: any, args: any;
    let lastExecuteTime = 0;
    let queuing = false;
    return function (this: any) {
        if (queuing) {
            return;
        }
        let now = +new Date();
        context = this;
        args = arguments;
        let remaining = intervalMiSec - (now - lastExecuteTime);
        if (remaining <= 0) {
            fn.apply(context, args as any);
            lastExecuteTime = now;
        } else {
            queuing = true;
            setTimeout(() => {
                fn.apply(context, args as any);
                queuing = false;
                lastExecuteTime = now;
            }, remaining);
        }
    };
};

/**
 * 防抖函数
 * 在事件被触发 n 秒后再执行回调，如果在这 n 秒内又被触发，则重新计时。
 * @param {Function} fn - 要防抖的函数
 * @param {number} intervalMiSec - 间隔时间（毫秒）
 * @returns {Function} 返回防抖后的函数
 * @example
 * const debounced = debounce(() => console.log('called'), 1000)
 */
export const debounce = (fn: Function, intervalMiSec: number): Function => {
    let timeout: any;
    return function (this: any) {
        let context = this;
        let args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function () {
            fn.apply(context, args);
        }, intervalMiSec);
    };
};
/**
 * 检测对象是否为 Promise 对象
 * @param {any} obj - 要检测的对象
 * @returns {boolean} 如果是 Promise 返回 true，否则返回 false
 * @example
 * isPromise(Promise.resolve()) // true
 */
export const isPromise = (obj: any): boolean => {
    return obj && typeof obj === "object" && obj.then && typeof obj.then === "function";
};

/**
 * 检测字符串是否为有效的 JSON
 * @param {string} json - 要检测的字符串
 * @returns {boolean} 如果是有效 JSON 返回 true，否则返回 false
 * @example
 * isJson('{"name":"John"}') // true
 */
export const isJson = (json: string): boolean => {
    let is_json = false;
    try {
        JSON.parse(json);
        is_json = true;
    } catch (error) {}
    return is_json;
};

/**
 * 检测目标是否为 Object（非数组的对象）
 * @param {any} item - 要检测的对象
 * @returns {boolean} 如果是对象返回 true，否则返回 false
 * @example
 * isObject({}) // true
 * isObject([]) // false
 */
export const isObject = (item: any): boolean => {
    return item && typeof item === "object" && !Array.isArray(item);
};

/**
 * 检测是否为函数
 * @param {any} value - 要检测的值
 * @returns {boolean} 如果是函数返回 true，否则返回 false
 * @example
 * isFunction(() => {}) // true
 */
export const isFunction = (value: any): boolean => {
    return value ? Object.prototype.toString.call(value) === "[object Function]" || "function" === typeof value || value instanceof Function : false;
};

/**
 * 检测是否为 URL（不包含 blob: data: file: 等协议）
 * @param {string} str - 要检测的字符串
 * @returns {boolean} 如果是 URL 返回 true，否则返回 false
 * @example
 * isUrl('https://example.com') // true
 */
export const isUrl = (str: string) => {
    if (typeof str !== "string" || str.trim() === "") return false;
    // 常见的可作为资源的 URL/路径：http(s)://, //, blob:, data:, file:, 以及以 / 或 ./ ../ 开头的相对路径
    return /^(https?:\/\/|\/\/|\/|\.\.?\/*)/i.test(str);
};

/**
 * 判断字符串是否符合 JSON 标准
 * @param {string} json - 要检测的字符串
 * @returns {boolean} 如果是有效 JSON 返回 true，否则返回 false
 * @example
 * isJSON('{"name":"John"}') // true
 */
export const isJSON = (json: string): boolean => {
	let is_json = false;
	try{
		JSON.parse(json);
		is_json = true;
	}catch(error){
	}
	return is_json;
}

/**
 * 打印调用堆栈
 * @returns {void}
 * @example
 * printStack() // 在控制台输出堆栈信息
 */
export const printStack = () => {
    let stack = new Error().stack;
    console.log(stack);
};