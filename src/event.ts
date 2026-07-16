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
}

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
export const dispatchEvent = (event: string | symbol, detail: any = null) => {
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
export const eventDelegate = (parent: HTMLElement, selector: string, event: string, handler: (event: Event, target: HTMLElement) => void) => {
    const listener = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.matches(selector)) {
            handler(e, target);
        }
    };
    parent.addEventListener(event, listener);
    return () => parent.removeEventListener(event, listener);
}

/**
 * 触发HTML节点事件
 * @param node HTML节点
 * @param event 事件名称
 */
export const triggerDomEvent = (node: HTMLElement, event: string) => {
    if ("createEvent" in document) {
        let evt = document.createEvent("HTMLEvents");
        evt.initEvent(event.toLowerCase(), false, true);
        node.dispatchEvent(evt);
    } else {
        (node as any).fireEvent("on" + event.toLowerCase());
    }
};