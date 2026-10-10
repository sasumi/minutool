import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildCacheKey, cacheClear, cacheDelete, cacheGet, cacheSet, cacheSweep } from "../src/cache";
import type { CACHE_TYPE } from "../src/cache";

describe("buildCacheKey", () => {
    it("should prefix string and number keys", () => {
        expect(buildCacheKey("token")).toBe("cache_token");
        expect(buildCacheKey(12)).toBe("cache_12");
    });

    it("should stringify object keys", () => {
        expect(buildCacheKey({ id: 1 })).toBe('cache_{"id":1}');
    });
});

describe.each(["memory", "session", "localStorage", "cookie"] as CACHE_TYPE[])("cache (%s)", (type) => {
    beforeEach(async () => {
        await cacheClear(type);
    });

    it("should return null when key is missing", async () => {
        expect(await cacheGet(type, "missing")).toBeNull();
    });

    it("should return default value when key is missing", async () => {
        expect(await cacheGet(type, "missing", { fallback: true })).toEqual({ fallback: true });
    });

    it("should store and restore object values", async () => {
        await cacheSet(type, "user", { name: "tom", age: 18, tags: ["a", "b"] });
        expect(await cacheGet(type, "user")).toEqual({ name: "tom", age: 18, tags: ["a", "b"] });
    });

    it("should keep falsy primitive values", async () => {
        await cacheSet(type, "zero", 0);
        await cacheSet(type, "empty", "");
        await cacheSet(type, "flag", false);

        expect(await cacheGet(type, "zero", 999)).toBe(0);
        expect(await cacheGet(type, "empty", "fallback")).toBe("");
        expect(await cacheGet(type, "flag", true)).toBe(false);
    });

    it("should delete a cached value", async () => {
        await cacheSet(type, "temp", "value");
        await cacheDelete(type, "temp");
        expect(await cacheGet(type, "temp")).toBeNull();
    });

    it("should clear only prefixed keys", async () => {
        await cacheSet(type, "one", 1);
        await cacheSet(type, "two", 2);

        if (type === "session" || type === "localStorage") {
            window[type === "session" ? "sessionStorage" : "localStorage"].setItem("other_key", "keep");
        }

        await cacheClear(type);

        expect(await cacheGet(type, "one")).toBeNull();
        expect(await cacheGet(type, "two")).toBeNull();

        if (type === "session" || type === "localStorage") {
            const storage = window[type === "session" ? "sessionStorage" : "localStorage"];
            expect(storage.getItem("other_key")).toBe("keep");
            storage.removeItem("other_key");
        }
    });

    describe("expireSeconds", () => {
        // 基于真实时间往后偏移，避免 Cookie 依据真实时间被判定为已过期
        const start = Date.now() + 60 * 60 * 1000;

        beforeEach(() => {
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(start);
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should keep the value before it expires", async () => {
            await cacheSet(type, "ttl", { v: 1 }, 10);
            vi.setSystemTime(start + 9_000);
            expect(await cacheGet(type, "ttl")).toEqual({ v: 1 });
        });

        it("should treat an expired value as missing", async () => {
            await cacheSet(type, "ttl", { v: 1 }, 10);
            vi.setSystemTime(start + 10_001);
            expect(await cacheGet(type, "ttl")).toBeNull();
            expect(await cacheGet(type, "ttl", { fallback: true })).toEqual({ fallback: true });
        });

        it("should remove the expired entry from the store", async () => {
            await cacheSet(type, "ttl", { v: 1 }, 10);
            vi.setSystemTime(start + 10_001);
            await cacheGet(type, "ttl");

            if (type === "session" || type === "localStorage") {
                const storage = window[type === "session" ? "sessionStorage" : "localStorage"];
                expect(storage.getItem("cache_ttl")).toBeNull();
            } else if (type === "cookie") {
                expect(document.cookie).not.toContain("cache_ttl");
            }
        });

        it("should ignore expireSeconds of zero or less", async () => {
            await cacheSet(type, "zero", "value", 0);
            await cacheSet(type, "negative", "value", -5);
            vi.setSystemTime(start + 365 * 24 * 60 * 60 * 1000);

            expect(await cacheGet(type, "zero")).toBe("value");
            expect(await cacheGet(type, "negative")).toBe("value");
        });
    });
});

describe.each(["memory", "session", "localStorage", "cookie"] as CACHE_TYPE[])("cacheSweep (%s)", (type) => {
    const start = Date.now() + 60 * 60 * 1000;

    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(start);
        await cacheClear(type);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should remove only expired entries", async () => {
        await cacheSet(type, "expired", "a", 10);
        await cacheSet(type, "valid", "b", 100);
        await cacheSet(type, "forever", "c");
        vi.setSystemTime(start + 20_000);

        const removed = await cacheSweep(type);

        expect(await cacheGet(type, "expired")).toBeNull();
        expect(await cacheGet(type, "valid")).toBe("b");
        expect(await cacheGet(type, "forever")).toBe("c");

        if (type === "cookie") {
            // Cookie 的过期由浏览器按自身有效期清理，扫描时该条目可能已被移除
            expect(removed).toBeLessThanOrEqual(1);
        } else {
            expect(removed).toBe(1);
        }
    });

    it("should remove nothing when no entry has expired", async () => {
        await cacheSet(type, "valid", "b", 100);

        expect(await cacheSweep(type)).toBe(0);
        expect(await cacheGet(type, "valid")).toBe("b");
    });
});

describe("cacheSweep without type", () => {
    const start = Date.now() + 60 * 60 * 1000;
    // Cookie 已由浏览器依据自身有效期清理，这里只针对其余类型校验数量
    const types: CACHE_TYPE[] = ["memory", "session", "localStorage"];

    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(start);
        for (const type of [...types, "cookie"] as CACHE_TYPE[]) {
            await cacheClear(type);
        }
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should sweep every cache type", async () => {
        for (const type of [...types, "cookie"] as CACHE_TYPE[]) {
            await cacheSet(type, "expired", type, 10);
        }
        vi.setSystemTime(start + 20_000);

        expect(await cacheSweep()).toBe(types.length);
        for (const type of [...types, "cookie"] as CACHE_TYPE[]) {
            expect(await cacheGet(type, "expired")).toBeNull();
        }
    });
});

describe("cache without indexedDB support", () => {
    it("should reject when indexedDB is unavailable", async () => {
        expect(typeof indexedDB).toBe("undefined");

        await expect(cacheGet("indexedDB", "key")).rejects.toThrow("indexedDB is not available");
        await expect(cacheSet("indexedDB", "key", 1)).rejects.toThrow("indexedDB is not available");
        await expect(cacheDelete("indexedDB", "key")).rejects.toThrow("indexedDB is not available");
        await expect(cacheClear("indexedDB")).rejects.toThrow("indexedDB is not available");
        await expect(cacheSweep("indexedDB")).rejects.toThrow("indexedDB is not available");
    });

    it("should skip unsupported cache types when sweeping without type", async () => {
        for (const type of ["memory", "session", "localStorage", "cookie"] as CACHE_TYPE[]) {
            await cacheClear(type);
        }

        await expect(cacheSweep()).resolves.toBe(0);
    });
});
