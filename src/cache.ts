import { deleteCookie, getCookie, setCookie } from "./cookie";

export type CACHE_TYPE_MEM = "memory";
export type CACHE_TYPE_SESSION = "session";
export type CACHE_TYPE_LOCALSTORAGE = "localStorage";
export type CACHE_TYPE_COOKIE = "cookie";
export type CACHE_TYPE_INDEXEDDB = "indexedDB";
export type CACHE_TYPE = CACHE_TYPE_MEM | CACHE_TYPE_SESSION | CACHE_TYPE_LOCALSTORAGE | CACHE_TYPE_COOKIE | CACHE_TYPE_INDEXEDDB;

const CACHE_KEY_PREFIX = "cache_";

/** 全部缓存类型，用于不指定类型时批量清理 */
const CACHE_TYPES: CACHE_TYPE[] = ["memory", "session", "localStorage", "cookie", "indexedDB"];

/** 内存缓存容器，随页面生命周期存在 */
const MEMORY_CACHE = new Map<string, any>();

/** 缓存条目标记字段，用于区分缓存内容与直接写入存储的原始数据 */
const CACHE_ENTRY_FLAG = "__minutool_cache__";

/** IndexedDB 缓存库配置 */
const IDB_NAME = "minutool_cache";
const IDB_VERSION = 1;
const IDB_STORE = "cache";

/** 缓存条目结构，expireAt 为过期时间戳（毫秒），null 表示永不过期 */
interface CacheEntry {
    [CACHE_ENTRY_FLAG]: true;
    expireAt: number | null;
    value: any;
}

/** Web Storage 的窗口属性名映射 */
const STORAGE_NAMES: Record<CACHE_TYPE_SESSION | CACHE_TYPE_LOCALSTORAGE, "sessionStorage" | "localStorage"> = {
    session: "sessionStorage",
    localStorage: "localStorage",
};

/**
 * 生成带统一前缀的缓存键，保证缓存数据与其他业务数据互不干扰
 * @param {string|number|object} param - 原始键
 * @returns {string} 带前缀的缓存键
 * @example
 * buildCacheKey('token') // 'cache_token'
 * buildCacheKey({id: 1}) // 'cache_{"id":1}'
 */
export const buildCacheKey = (param: string | number | object): string => {
    if (typeof param === "object") {
        return `${CACHE_KEY_PREFIX}${JSON.stringify(param)}`;
    }
    return `${CACHE_KEY_PREFIX}${param}`;
};

/** 序列化缓存值，除字符串外的类型统一按 JSON 存储 */
const serialize = (value: any): string => JSON.stringify(value) ?? "null";

/** 反序列化缓存值，非 JSON 内容按原始字符串返回 */
const deserialize = (raw: string | null): any => {
    if (raw === null || raw === "") {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
};

/** 解码 Cookie 值，非法编码时返回原值 */
const safeDecode = (raw: string): string => {
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
};

/** 构造缓存条目，ttlSeconds 小于等于 0 表示永不过期 */
const createEntry = (value: any, ttlSeconds: number): CacheEntry => ({
    [CACHE_ENTRY_FLAG]: true,
    expireAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    value,
});

/** 判断是否为缓存条目 */
const isCacheEntry = (value: any): value is CacheEntry =>
    typeof value === "object" && value !== null && value[CACHE_ENTRY_FLAG] === true;

/** 判断缓存条目是否已过期 */
const isExpired = (entry: CacheEntry): boolean => entry.expireAt !== null && Date.now() > entry.expireAt;

/** 获取 Web Storage 实例，环境不支持时抛出异常 */
const getStorage = (type: CACHE_TYPE_SESSION | CACHE_TYPE_LOCALSTORAGE): Storage => {
    const name = STORAGE_NAMES[type];
    if (typeof window === "undefined" || !window[name]) {
        throw new Error(`${name} is not available in the current environment`);
    }
    return window[name];
};

/** Cookie 名称不允许包含 = ; 空格 等字符，因此对键名进行编码 */
const toCookieName = (cacheKey: string): string => encodeURIComponent(cacheKey);

/** 校验 IndexedDB 可用性 */
const assertIndexedDB = (): void => {
    if (typeof indexedDB === "undefined") {
        throw new Error("indexedDB is not available in the current environment");
    }
};

/** 打开（必要时创建）缓存数据库 */
const openCacheDB = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

/** 在事务中执行一次 IndexedDB 操作 */
const runIdbRequest = <T>(mode: IDBTransactionMode, createRequest: (store: IDBObjectStore) => IDBRequest): Promise<T> =>
    openCacheDB().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const transaction = db.transaction(IDB_STORE, mode);
                const request = createRequest(transaction.objectStore(IDB_STORE));
                transaction.oncomplete = () => {
                    db.close();
                    resolve(request.result as T);
                };
                transaction.onerror = () => {
                    db.close();
                    reject(transaction.error);
                };
                transaction.onabort = () => {
                    db.close();
                    reject(transaction.error);
                };
            })
    );

/** 用游标扫描 IndexedDB，删除其中已过期的缓存条目 */
const sweepIndexedDB = (): Promise<number> =>
    openCacheDB().then(
        (db) =>
            new Promise<number>((resolve, reject) => {
                const transaction = db.transaction(IDB_STORE, "readwrite");
                const request = transaction.objectStore(IDB_STORE).openCursor();
                let count = 0;
                request.onsuccess = () => {
                    const cursor = request.result;
                    if (!cursor) {
                        return;
                    }
                    if (isCacheEntry(cursor.value) && isExpired(cursor.value)) {
                        cursor.delete();
                        count++;
                    }
                    cursor.continue();
                };
                transaction.oncomplete = () => {
                    db.close();
                    resolve(count);
                };
                transaction.onerror = () => {
                    db.close();
                    reject(transaction.error);
                };
                transaction.onabort = () => {
                    db.close();
                    reject(transaction.error);
                };
            })
    );

/** 清理 Web Storage 中已过期的缓存条目 */
const sweepStorage = (type: CACHE_TYPE_SESSION | CACHE_TYPE_LOCALSTORAGE): number => {
    const storage = getStorage(type);
    let count = 0;
    // 先取出键名快照，避免遍历过程中删除数据导致下标错位
    for (const name of Object.keys(storage)) {
        if (!name.startsWith(CACHE_KEY_PREFIX)) {
            continue;
        }
        const entry = deserialize(storage.getItem(name));
        if (isCacheEntry(entry) && isExpired(entry)) {
            storage.removeItem(name);
            count++;
        }
    }
    return count;
};

/** 清理 Cookie 中已过期的缓存条目 */
const sweepCookie = (): number => {
    let count = 0;
    document.cookie.split(";").forEach((item) => {
        const name = item.split("=")[0].trim();
        if (!name.startsWith(CACHE_KEY_PREFIX)) {
            return;
        }
        const raw = getCookie(name);
        const entry = deserialize(raw === null ? null : safeDecode(raw));
        if (isCacheEntry(entry) && isExpired(entry)) {
            deleteCookie(name);
            count++;
        }
    });
    return count;
};

/** 清理指定类型中已过期的缓存条目 */
const sweepType = async (type: CACHE_TYPE): Promise<number> => {
    switch (type) {
        case "memory": {
            let count = 0;
            for (const [key, entry] of MEMORY_CACHE) {
                if (isCacheEntry(entry) && isExpired(entry)) {
                    MEMORY_CACHE.delete(key);
                    count++;
                }
            }
            return count;
        }
        case "session":
        case "localStorage":
            return sweepStorage(type);
        case "cookie":
            return sweepCookie();
        case "indexedDB":
            assertIndexedDB();
            return sweepIndexedDB();
    }
};

/**
 * 读取缓存，已过期的数据会被清除并按不存在处理
 * @param {CACHE_TYPE} type - 缓存类型
 * @param {string} key - 缓存键
 * @param {any} [defaultValue] - 缓存不存在或已过期时返回的默认值
 * @returns {Promise<any>} 缓存值，不存在时返回 defaultValue，未传默认值时返回 null
 * @example
 * await cacheGet('localStorage', 'token') // 'abc'
 * await cacheGet('memory', 'config', {}) // {} 缓存不存在或已过期时
 */
export const cacheGet = async (type: CACHE_TYPE, key: string, defaultValue?: any): Promise<any> => {
    const cacheKey = buildCacheKey(key);
    let entry: any = null;

    switch (type) {
        case "memory":
            entry = MEMORY_CACHE.get(cacheKey) ?? null;
            break;
        case "session":
        case "localStorage":
            entry = deserialize(getStorage(type).getItem(cacheKey));
            break;
        case "cookie": {
            const raw = getCookie(toCookieName(cacheKey));
            entry = deserialize(raw === null ? null : safeDecode(raw));
            break;
        }
        case "indexedDB":
            assertIndexedDB();
            entry = (await runIdbRequest<any>("readonly", (store) => store.get(cacheKey))) ?? null;
            break;
    }

    if (entry === null || entry === undefined) {
        return defaultValue ?? null;
    }

    // 兼容未使用缓存封装、直接写入存储的原始数据
    if (!isCacheEntry(entry)) {
        return entry ?? defaultValue ?? null;
    }

    if (isExpired(entry)) {
        await cacheDelete(type, key);
        return defaultValue ?? null;
    }

    return entry.value ?? defaultValue ?? null;
};

/**
 * 写入缓存，值统一序列化后存储，读取时可还原原始类型
 * @param {CACHE_TYPE} type - 缓存类型
 * @param {string} key - 缓存键
 * @param {any} value - 缓存值
 * @param {number} [expireSeconds] - 过期秒数，不传或小于等于 0 表示永不过期
 * @returns {Promise<void>}
 * @example
 * await cacheSet('session', 'user', {name: 'tom'})
 * await cacheSet('localStorage', 'token', 'abc', 3600) // 1 小时后过期
 */
export const cacheSet = async (type: CACHE_TYPE, key: string, value: any, expireSeconds?: number): Promise<void> => {
    const cacheKey = buildCacheKey(key);
    const ttl = expireSeconds && expireSeconds > 0 ? expireSeconds : 0;
    const entry = createEntry(value, ttl);

    switch (type) {
        case "memory":
            MEMORY_CACHE.set(cacheKey, entry);
            break;
        case "session":
        case "localStorage":
            getStorage(type).setItem(cacheKey, serialize(entry));
            break;
        case "cookie":
            // 同时设置 Cookie 自身的有效期，过期后由浏览器清理，未设置有效期则为会话 Cookie
            setCookie(toCookieName(cacheKey), encodeURIComponent(serialize(entry)), ttl / 86400);
            break;
        case "indexedDB":
            assertIndexedDB();
            await runIdbRequest("readwrite", (store) => store.put(entry, cacheKey));
            break;
    }
};

/**
 * 删除指定缓存
 * @param {CACHE_TYPE} type - 缓存类型
 * @param {string} key - 缓存键
 * @returns {Promise<void>}
 * @example
 * await cacheDelete('localStorage', 'token')
 */
export const cacheDelete = async (type: CACHE_TYPE, key: string): Promise<void> => {
    const cacheKey = buildCacheKey(key);

    switch (type) {
        case "memory":
            MEMORY_CACHE.delete(cacheKey);
            break;
        case "session":
        case "localStorage":
            getStorage(type).removeItem(cacheKey);
            break;
        case "cookie":
            deleteCookie(toCookieName(cacheKey));
            break;
        case "indexedDB":
            assertIndexedDB();
            await runIdbRequest("readwrite", (store) => store.delete(cacheKey));
            break;
    }
};

/**
 * 清空指定类型的缓存，仅清理带缓存前缀的数据，不影响其他业务数据
 * @param {CACHE_TYPE} type - 缓存类型
 * @returns {Promise<void>}
 * @example
 * await cacheClear('session')
 */
export const cacheClear = async (type: CACHE_TYPE): Promise<void> => {
    switch (type) {
        case "memory":
            MEMORY_CACHE.clear();
            break;
        case "session":
        case "localStorage": {
            const storage = getStorage(type);
            for (let i = storage.length - 1; i >= 0; i--) {
                const name = storage.key(i);
                if (name && name.startsWith(CACHE_KEY_PREFIX)) {
                    storage.removeItem(name);
                }
            }
            break;
        }
        case "cookie":
            document.cookie.split(";").forEach((item) => {
                const name = item.split("=")[0].trim();
                if (name.startsWith(CACHE_KEY_PREFIX)) {
                    deleteCookie(name);
                }
            });
            break;
        case "indexedDB":
            assertIndexedDB();
            await runIdbRequest("readwrite", (store) => store.clear());
            break;
    }
};

/**
 * 主动清理已过期的缓存条目，用于释放存储空间，未过期的数据不受影响
 * @param {CACHE_TYPE} [type] - 缓存类型，不传时依次清理所有缓存类型（当前环境不支持的类型会被跳过）
 * @returns {Promise<number>} 被清理的条目数量
 * @example
 * await cacheSweep('localStorage') // 2
 * await cacheSweep() // 清理全部缓存类型
 */
export const cacheSweep = async (type?: CACHE_TYPE): Promise<number> => {
    if (type) {
        return sweepType(type);
    }

    let count = 0;
    for (const item of CACHE_TYPES) {
        try {
            count += await sweepType(item);
        } catch {
            // 环境不支持该缓存类型时跳过，不影响其余类型
        }
    }
    return count;
};