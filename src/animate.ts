/**
 * 缓动函数类型：接收时间进度 t（范围 [0, 1]），返回缓动后的进度
 * 注意：部分缓动（如 back / elastic）中间过程可能超出 [0, 1]，但起点与终点仍是 0 和 1
 */
export type EasingFn = (t: number) => number;

/**
 * 线性缓动：匀速运动，无加减速
 * @param t - 时间进度，范围 [0, 1]
 * @returns 缓动后的值，恒等于 t
 * @example
 * linear(0.5) // 0.5
 */
export const linear = (t: number): number => t;

/**
 * 将任意数值限制到 [0, 1] 区间，常用于保证动画进度合法
 * @param t - 进度值
 * @returns 限制后的进度
 * @example
 * clamp01(-0.5) // 0
 * clamp01(1.5) // 1
 */
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * 线性插值：根据进度 t 在 from 与 to 之间取值
 * @param from - 起始值
 * @param to - 结束值
 * @param t - 进度，范围 [0, 1]
 * @returns 插值结果
 * @example
 * lerp(0, 100, 0.5) // 50
 */
export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/**
 * 按缓动函数计算 from 到 to 之间某一进度的插值
 * @param from - 起始值
 * @param to - 结束值
 * @param t - 原始时间进度，范围 [0, 1]
 * @param easing - 缓动函数，默认为 linear
 * @returns 缓动后的插值结果
 * @example
 * easeValue(0, 100, 0.5, easeOutCubic) // 87.5
 */
export const easeValue = (from: number, to: number, t: number, easing: EasingFn = linear): number => lerp(from, to, easing(t));

// ==================== Quad（二次方）缓动 ====================

/** 二次方缓入：由慢到快 */
export const easeInQuad = (t: number): number => t * t;

/** 二次方缓出：由快到慢 */
export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

/** 二次方缓入缓出 */
export const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ==================== Cubic（三次方）缓动 ====================

/** 三次方缓入：由慢到快 */
export const easeInCubic = (t: number): number => t * t * t;

/** 三次方缓出：由快到慢 */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * 三次方缓入缓出
 * @param t - 时间进度，范围 [0, 1]
 * @returns 缓动后的值，范围 [0, 1]
 * @example
 * easeInOutCubic(0.25) // 0.0625
 */
export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ==================== Quart（四次方）缓动 ====================

/** 四次方缓入 */
export const easeInQuart = (t: number): number => t * t * t * t;

/** 四次方缓出 */
export const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

/** 四次方缓入缓出 */
export const easeInOutQuart = (t: number): number => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

// ==================== Quint（五次方）缓动 ====================

/** 五次方缓入 */
export const easeInQuint = (t: number): number => t * t * t * t * t;

/** 五次方缓出 */
export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);

/** 五次方缓入缓出 */
export const easeInOutQuint = (t: number): number => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2);

// ==================== Sine（正弦）缓动 ====================

/** 正弦缓入 */
export const easeInSine = (t: number): number => 1 - Math.cos((t * Math.PI) / 2);

/** 正弦缓出 */
export const easeOutSine = (t: number): number => Math.sin((t * Math.PI) / 2);

/** 正弦缓入缓出 */
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

// ==================== Expo（指数）缓动 ====================

/** 指数缓入 */
export const easeInExpo = (t: number): number => (t === 0 ? 0 : Math.pow(2, 10 * t - 10));

/** 指数缓出 */
export const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** 指数缓入缓出 */
export const easeInOutExpo = (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
};

// ==================== Circ（圆形）缓动 ====================

/** 圆形缓入 */
export const easeInCirc = (t: number): number => 1 - Math.sqrt(1 - Math.pow(t, 2));

/** 圆形缓出 */
export const easeOutCirc = (t: number): number => Math.sqrt(1 - Math.pow(t - 1, 2));

/** 圆形缓入缓出 */
export const easeInOutCirc = (t: number): number => {
    return t < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
};

// ==================== Back（回退/过冲）缓动 ====================

/**
 * 回退缓入：先向后蓄力再前进
 * @param t - 时间进度，范围 [0, 1]
 * @param s - 过冲系数，默认为 1.70158
 * @returns 缓动后的值
 */
export const easeInBack = (t: number, s: number = 1.70158): number => (s + 1) * t * t * t - s * t * t;

/**
 * 回退缓出：超过终点再回弹到终点
 * @param t - 时间进度，范围 [0, 1]
 * @param s - 过冲系数，默认为 1.70158
 * @returns 缓动后的值
 */
export const easeOutBack = (t: number, s: number = 1.70158): number => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

/**
 * 回退缓入缓出
 * @param t - 时间进度，范围 [0, 1]
 * @param s - 过冲系数，默认为 1.70158
 * @returns 缓动后的值
 */
export const easeInOutBack = (t: number, s: number = 1.70158): number => {
    const c = s * 1.525;
    return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
};

// ==================== Elastic（弹性）缓动 ====================

/** 弹性缓入 */
export const easeInElastic = (t: number): number => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
};

/** 弹性缓出：终点前反复振荡 */
export const easeOutElastic = (t: number): number => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** 弹性缓入缓出 */
export const easeInOutElastic = (t: number): number => {
    if (t === 0 || t === 1) return t;
    const c5 = (2 * Math.PI) / 4.5;
    return t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
};

// ==================== Bounce（弹跳）缓动 ====================

/** 弹跳缓出：落地点弹跳衰减 */
export const easeOutBounce = (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

/** 弹跳缓入 */
export const easeInBounce = (t: number): number => 1 - easeOutBounce(1 - t);

/** 弹跳缓入缓出 */
export const easeInOutBounce = (t: number): number => {
    return t < 0.5 ? (1 - easeOutBounce(1 - 2 * t)) / 2 : (1 + easeOutBounce(2 * t - 1)) / 2;
};


