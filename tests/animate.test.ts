import { describe, it, expect } from "vitest";
import {
    clamp01,
    easeValue,
    easeInBack,
    easeInBounce,
    easeInCirc,
    easeInCubic,
    easeInElastic,
    easeInExpo,
    easeInOutBack,
    easeInOutBounce,
    easeInOutCirc,
    easeInOutCubic,
    easeInOutElastic,
    easeInOutExpo,
    easeInOutQuad,
    easeInOutQuart,
    easeInOutQuint,
    easeInOutSine,
    easeInQuad,
    easeInQuart,
    easeInQuint,
    easeInSine,
    easeOutBack,
    easeOutBounce,
    easeOutCirc,
    easeOutCubic,
    easeOutElastic,
    easeOutExpo,
    easeOutQuad,
    easeOutQuart,
    easeOutQuint,
    easeOutSine,
    lerp,
    linear,
} from "../src/animate";

// 所有“标准”（非过冲/振荡）缓动函数，要求在 [0,1] 区间单调不减且不越界
const standardEasings = [
    easeInQuad, easeOutQuad, easeInOutQuad,
    easeInCubic, easeOutCubic, easeInOutCubic,
    easeInQuart, easeOutQuart, easeInOutQuart,
    easeInQuint, easeOutQuint, easeInOutQuint,
    easeInSine, easeOutSine, easeInOutSine,
    easeInExpo, easeOutExpo, easeInOutExpo,
    easeInCirc, easeOutCirc, easeInOutCirc,
];

// 所有缓动函数在端点处都应满足 ease(0)=0 且 ease(1)=1
const allEasings = [
    linear,
    easeInQuad, easeOutQuad, easeInOutQuad,
    easeInCubic, easeOutCubic, easeInOutCubic,
    easeInQuart, easeOutQuart, easeInOutQuart,
    easeInQuint, easeOutQuint, easeInOutQuint,
    easeInSine, easeOutSine, easeInOutSine,
    easeInExpo, easeOutExpo, easeInOutExpo,
    easeInCirc, easeOutCirc, easeInOutCirc,
    easeInBack, easeOutBack, easeInOutBack,
    easeInElastic, easeOutElastic, easeInOutElastic,
    easeInBounce, easeOutBounce, easeInOutBounce,
];

describe("clamp01", () => {
    it("should clamp values into [0, 1]", () => {
        expect(clamp01(-0.5)).toBe(0);
        expect(clamp01(1.5)).toBe(1);
        expect(clamp01(0.5)).toBe(0.5);
    });
});

describe("lerp", () => {
    it("should linearly interpolate between two values", () => {
        expect(lerp(0, 100, 0)).toBe(0);
        expect(lerp(0, 100, 0.5)).toBe(50);
        expect(lerp(0, 100, 1)).toBe(100);
        expect(lerp(10, 20, 0.25)).toBe(12.5);
    });
});

describe("easeValue", () => {
    it("should interpolate with easing applied", () => {
        expect(easeValue(0, 100, 0)).toBe(0);
        expect(easeValue(0, 100, 1)).toBe(100);
        expect(easeValue(0, 100, 0.5, linear)).toBe(50);
        expect(easeValue(0, 100, 0.5, easeOutCubic)).toBeCloseTo(87.5, 10);
        // 默认缓动为 linear
        expect(easeValue(0, 100, 0.3)).toBe(30);
    });
});

describe("easing endpoints", () => {
    it("all easings start at 0 and end at 1", () => {
        allEasings.forEach((easing) => {
            expect(easing(0)).toBeCloseTo(0, 10);
            expect(easing(1)).toBeCloseTo(1, 10);
        });
    });
});

describe("standard easings", () => {
    it("should stay within [0, 1] and be monotonic", () => {
        const samples = Array.from({ length: 101 }, (_, i) => i / 100);
        standardEasings.forEach((easing) => {
            let prev = 0;
            samples.forEach((t) => {
                const v = easing(t);
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(1);
                expect(v + 1e-9).toBeGreaterThanOrEqual(prev);
                prev = v;
            });
        });
    });

    it("should match known expected values", () => {
        expect(easeInCubic(0.5)).toBeCloseTo(0.125, 10);
        expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 10);
        expect(easeInOutCubic(0.25)).toBeCloseTo(0.0625, 10);
        expect(easeInOutCubic(0.75)).toBeCloseTo(0.9375, 10);
        expect(easeInOutQuad(0.25)).toBeCloseTo(0.125, 10);
        expect(easeInOutQuart(0.5)).toBeCloseTo(0.5, 10);
        expect(easeInOutQuint(0.5)).toBeCloseTo(0.5, 10);
        expect(easeInSine(0.5)).toBeCloseTo(1 - Math.cos(Math.PI / 4), 10);
        expect(easeOutSine(0.5)).toBeCloseTo(Math.sin(Math.PI / 4), 10);
    });
});

describe("special easings", () => {
    it("back easing overshoots but still returns to endpoints", () => {
        // easeOutBack 中间值会越过 1，但起点/终点正确（浮点误差范围内）
        expect(easeOutBack(0)).toBeCloseTo(0, 10);
        expect(easeOutBack(1)).toBeCloseTo(1, 10);
        expect(easeOutBack(0.5)).toBeGreaterThan(1);
        expect(easeInOutBack(0.5)).toBeCloseTo(0.5, 10);
    });

    it("elastic easing oscillates but returns to endpoints", () => {
        expect(easeOutElastic(0)).toBe(0);
        expect(easeOutElastic(1)).toBe(1);
        expect(easeInElastic(0.5)).toBeGreaterThanOrEqual(-1);
        expect(easeInElastic(0.5)).toBeLessThanOrEqual(1);
    });

    it("bounce easing returns to endpoints", () => {
        expect(easeOutBounce(0)).toBe(0);
        expect(easeOutBounce(1)).toBe(1);
        expect(easeInBounce(1)).toBe(1);
        expect(easeInOutBounce(0.5)).toBeCloseTo(0.5, 10);
    });
});
