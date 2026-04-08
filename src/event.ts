const _EventBus = new EventTarget();

/**
 * 订阅事件
 * @param {string} event 事件名称
 * @param {Function} handler 事件处理函数
 */
export const onEvent = (event: string, handler: EventListenerOrEventListenerObject) => {
	_EventBus.addEventListener(event, handler);
};

/**
 * 取消订阅事件
 * @param {string} event 事件名称
 * @param {Function} handler 事件处理函数
 */
export const offEvent = (event: string, handler: EventListenerOrEventListenerObject) => {
	_EventBus.removeEventListener(event, handler);
};

/**
 * 发布事件
 * @param {string} event 事件名称
 * @param {any} detail 事件详情
 */
export const dispatchEvent = (event: string, detail: any = null) => {
	_EventBus.dispatchEvent(new CustomEvent(event, { detail }));
};
