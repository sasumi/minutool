import { findOne } from "./dom";

const _EventBus = new EventTarget();
const STR_SYM_MAP = new Map<string, symbol>();
const SYM_STR_MAP = new Map<symbol, string>();

let id = 0;
const PREFIX = `__MINUTOOL_SYM_EVENT__`;
function symbolToString(sym: symbol): string {
    if (!SYM_STR_MAP.has(sym)) {
        const key = `${PREFIX}${++id}`;
        SYM_STR_MAP.set(sym, key);
        STR_SYM_MAP.set(key, sym);
    }
    return SYM_STR_MAP.get(sym)!;
}

export const onEvents = (events: (string | symbol)[], handler: EventListenerOrEventListenerObject) => {
    const offFunctions = events.map((event) => onEvent(event, handler));
    return () => offFunctions.forEach((off) => off());
};

/**
 * 订阅事件，event 可以是字符串或 Symbol，handler 是事件处理函数
 * @param event 事件名称
 * @param handler 事件处理函数
 * @return 返回一个取消订阅的函数
 */
export const onEvent = (event: string | symbol, handler: EventListenerOrEventListenerObject) => {
    _EventBus.addEventListener(typeof event === "symbol" ? symbolToString(event) : event, handler);
    return () => offEvent(event, handler);
};

/**
 * 取消订阅事件，event 可以是字符串或 Symbol，handler 是事件处理函数
 * @param event 事件名称
 * @param handler 事件处理函数
 */
export const offEvent = (event: string | symbol, handler: EventListenerOrEventListenerObject) => {
    _EventBus.removeEventListener(typeof event === "symbol" ? symbolToString(event) : event, handler);
};

/**
 * 发布事件，event 可以是字符串或 Symbol，detail 是事件详情
 * @param event 事件名称
 * @param detail 事件详情
 */
export const dispatchEvent = <T = any>(event: string | symbol, detail?: T) => {
    _EventBus.dispatchEvent(new CustomEvent(typeof event === "symbol" ? symbolToString(event) : event, { detail }));
};

/**
 * 文档就绪事件，handler 是文档就绪时的回调函数
 * @param handler 文档就绪时的回调函数
 */
export const onDocReady = (handler: () => void) => {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        handler();
    } else {
        const onReady = () => {
            handler();
            document.removeEventListener("DOMContentLoaded", onReady);
        };
        document.addEventListener("DOMContentLoaded", onReady);
    }
};

/**
 * 事件委托，parent 是父元素，selector 是子元素选择器，event 是事件名称，handler 是事件处理函数
 * @param parent 父元素
 * @param selector 子元素选择器
 * @param event 事件名称
 * @param handler 事件处理函数, 参数为事件对象和匹配的子元素 (event, target)
 * @return 返回一个取消事件委托的函数
 */
export const eventDelegate = (parent: EventTarget | string, selector: string, event: string, handler: (event: Event, target: Element) => void) => {
    const listener = (e: Event) => {
        const target = e.target as Element | null;
        const matchedTarget = target?.closest?.(selector);
        if (matchedTarget) {
            handler(e, matchedTarget);
        }
    };
    return bindDomEvent(parent, event, listener);
};

/**
 * 绑定点击事件，并返回一个解绑函数
 * @param element - 要绑定事件的元素
 * @param payload - 事件回调函数
 * @returns 解绑函数
 */
export const bindClick = (element: EventTarget | string, payload: (event: MouseEvent) => void) => {
    return bindDomEvent(element, "click", payload);
};

/**
 * 绑定键盘按键抬起事件，并返回一个解绑函数
 * @param element - 要绑定事件的元素
 * @param payload - 事件回调函数
 * @returns 解绑函数
 */
export const bindKeyUp = (element: EventTarget | string, payload: (event: KeyboardEvent) => void) => {
    return bindDomEvent(element, "keyup", payload);
};

/**
 * 绑定键盘按键按下事件，并返回一个解绑函数
 * @param element - 要绑定事件的元素
 * @param payload - 事件回调函数
 * @returns 解绑函数
 */
export const bindKeyDown = (element: EventTarget | string, payload: (event: KeyboardEvent) => void) => {
    return bindDomEvent(element, "keydown", payload);
};

/**
 * 绑定双击事件，并返回一个解绑函数
 * @param element - 要绑定事件的元素
 * @param payload - 事件回调函数
 * @returns 解绑函数
 */
export const bindDoubleClick = (element: EventTarget | string, payload: (event: MouseEvent) => void) => {
    return bindDomEvent(element, "dblclick", payload);
};

/**
 * 绑定DOM事件，并返回一个解绑函数
 * @param element - 要绑定事件的元素
 * @param eventName - 事件名称
 * @param payload - 事件回调函数
 * @returns 解绑函数
 */
export const bindDomEvent = <E extends Event = Event>(
    element: EventTarget | string,
    eventName: string,
    payload: (event: E) => void,
    options?: boolean | AddEventListenerOptions,
) => {
    const onEvent = (event: Event) => {
        payload(event as E);
    };
    const el = typeof element === "string" ? findOne(element) : element;
    if (!el) {
        throw new Error(`EventTarget not found for selector: ${element}`);
    }
    el.addEventListener(eventName, onEvent, options);
    return () => {
        el.removeEventListener(eventName, onEvent, options);
    };
};

/**
 * 为 input/textarea 绑定支持 IME 的防抖函数
 * @param element - DOM 元素
 * @param callback - 回调，参数为 { value, event }
 * @param delay - 防抖延迟（ms），默认 50
 * @returns { destroy, cancel, flush }
 */
export const bindInputDebounce = (
    element: HTMLInputElement | HTMLTextAreaElement,
    callback: (value: string, event: InputEvent) => void,
    delay: number = 50,
): (() => void) => {
    let isComposing = false;
    let timer: number | null = null;
    let lastExecutedValue: string | null = null;
    let pendingEvent: InputEvent | null = null;

    const exec = (event: InputEvent) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        let value = target.value;
        if (lastExecutedValue === value) {
            return;
        }

        lastExecutedValue = value;
        callback(value, event);
    };

    const handleInput = (e: Event) => {
        const inputEvent = e as InputEvent;
        if (inputEvent.isComposing || isComposing) {
            return;
        }

        pendingEvent = inputEvent;
        if (timer) {
            clearTimeout(timer);
        }

        timer = window.setTimeout(() => {
            timer = null;
            if (isComposing || !pendingEvent) {
                return;
            }
            exec(pendingEvent);
            pendingEvent = null;
        }, delay);
    };

    const onCompositionStart = () => {
        isComposing = true;
    };
    const onCompositionEnd = () => {
        isComposing = false;
    };

    element.addEventListener("input", handleInput);
    element.addEventListener("compositionstart", onCompositionStart);
    element.addEventListener("compositionend", onCompositionEnd);
    return () => {
        element.removeEventListener("input", handleInput);
        element.removeEventListener("compositionstart", onCompositionStart);
        element.removeEventListener("compositionend", onCompositionEnd);
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        pendingEvent = null;
    };
};

/**
 * 为指定的 localStorage key 绑定变化事件
 * @param key - localStorage 的 key
 * @param callback - 回调，参数为新的值
 * @returns { destroy } - 解绑函数
 */
export const bindStorageEvent = (key: string, callback: (value: string | null) => void): (() => void) => {
    const handleStorage = (e: StorageEvent) => {
        if (e.key === key) {
            callback(e.newValue);
        }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
        window.removeEventListener("storage", handleStorage);
    };
};

/**
 * 触发HTML节点事件
 * @param node HTML节点
 * @param event 事件名称
 */
export const triggerDomEvent = (node: EventTarget, event: string) => {
    if ("createEvent" in document) {
        let evt = document.createEvent("HTMLEvents");
        evt.initEvent(event.toLowerCase(), false, true);
        node.dispatchEvent(evt);
    } else {
        (node as any).fireEvent("on" + event.toLowerCase());
    }
};
