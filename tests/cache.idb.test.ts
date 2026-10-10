import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cacheClear, cacheDelete, cacheGet, cacheSet, cacheSweep } from "../src/cache";

describe("cache (indexedDB)", () => {
    beforeEach(async () => {
        await cacheClear("indexedDB");
    });

    it("should return null when key is missing", async () => {
        expect(await cacheGet("indexedDB", "missing")).toBeNull();
    });

    it("should return default value when key is missing", async () => {
        expect(await cacheGet("indexedDB", "missing", "fallback")).toBe("fallback");
    });

    it("should store and restore object values", async () => {
        await cacheSet("indexedDB", "user", { name: "tom", age: 18, tags: ["a", "b"] });
        expect(await cacheGet("indexedDB", "user")).toEqual({ name: "tom", age: 18, tags: ["a", "b"] });
    });

    it("should overwrite existing value", async () => {
        await cacheSet("indexedDB", "count", 1);
        await cacheSet("indexedDB", "count", 2);
        expect(await cacheGet("indexedDB", "count")).toBe(2);
    });

    it("should delete a cached value", async () => {
        await cacheSet("indexedDB", "temp", "value");
        await cacheDelete("indexedDB", "temp");
        expect(await cacheGet("indexedDB", "temp")).toBeNull();
    });

    it("should clear all cached values", async () => {
        await cacheSet("indexedDB", "one", 1);
        await cacheSet("indexedDB", "two", 2);
        await cacheClear("indexedDB");
        expect(await cacheGet("indexedDB", "one")).toBeNull();
        expect(await cacheGet("indexedDB", "two")).toBeNull();
    });

    describe("expireSeconds", () => {
        const start = Date.now() + 60 * 60 * 1000;

        beforeEach(() => {
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(start);
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should keep the value before it expires", async () => {
            await cacheSet("indexedDB", "ttl", { v: 1 }, 10);
            vi.setSystemTime(start + 9_000);
            expect(await cacheGet("indexedDB", "ttl")).toEqual({ v: 1 });
        });

        it("should treat an expired value as missing", async () => {
            await cacheSet("indexedDB", "ttl", { v: 1 }, 10);
            vi.setSystemTime(start + 10_001);
            expect(await cacheGet("indexedDB", "ttl")).toBeNull();
            expect(await cacheGet("indexedDB", "ttl", "fallback")).toBe("fallback");
        });

        it("should remove the expired entry from the store", async () => {
            await cacheSet("indexedDB", "ttl", { v: 1 }, 10);
            vi.setSystemTime(start + 10_001);
            await cacheGet("indexedDB", "ttl");

            await cacheSet("indexedDB", "probe", "value");
            const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
                const request = indexedDB.open("minutool_cache", 1);
                request.onsuccess = () => {
                    const db = request.result;
                    const getAllKeys = db.transaction("cache", "readonly").objectStore("cache").getAllKeys();
                    getAllKeys.onsuccess = () => {
                        db.close();
                        resolve(getAllKeys.result);
                    };
                    getAllKeys.onerror = () => reject(getAllKeys.error);
                };
                request.onerror = () => reject(request.error);
            });

            expect(keys).toContain("cache_probe");
            expect(keys).not.toContain("cache_ttl");
        });
    });

    describe("cacheSweep", () => {
        const start = Date.now() + 60 * 60 * 1000;

        beforeEach(() => {
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(start);
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should remove only expired entries", async () => {
            await cacheSet("indexedDB", "expired", "a", 10);
            await cacheSet("indexedDB", "valid", "b", 100);
            vi.setSystemTime(start + 20_000);

            expect(await cacheSweep("indexedDB")).toBe(1);
            expect(await cacheGet("indexedDB", "expired")).toBeNull();
            expect(await cacheGet("indexedDB", "valid")).toBe("b");
        });

        it("should remove nothing when no entry has expired", async () => {
            await cacheSet("indexedDB", "valid", "b", 100);

            expect(await cacheSweep("indexedDB")).toBe(0);
            expect(await cacheGet("indexedDB", "valid")).toBe("b");
        });
    });
});
