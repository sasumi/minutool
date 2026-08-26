import { MIME_FORM, MIME_JSON, MIME_MULTIPART } from "./mime";

/**
 * 将 URL 查询字符串转换为对象
 * @param {string} query - 查询字符串
 * @returns {Record<string, string>} 返回键值对对象
 * @example
 * queryToObj('name=John&age=30') // {name: 'John', age: '30'}
 */
export const queryToObj = (query: string): Record<string, string> => {
    const obj: Record<string, string> = {};
    query
        .replace(/^\?/, "")
        .split("&")
        .forEach((pair) => {
            const [key, value] = pair.split("=");
            if (key) {
                obj[decodeURIComponent(key)] = decodeURIComponent(value || "");
            }
        });
    return obj;
};

/**
 * 替换 URL 中的查询参数
 * @param {string} url - 原始 URL
 * @param {Record<string, any>} newQuery - 新的查询参数对象
 * @returns {string} 返回更新后的 URL
 * @example
 * queryReplace('http://example.com?a=1', {b: 2}) // 'http://example.com?a=1&b=2'
 */
export const queryReplace = (url: string, newQuery: Record<string, any>): string => {
    const [baseUrl, queryString] = url.split("?");
    const currentQuery = queryString ? queryToObj(queryString) : {};
    const mergedQuery = { ...currentQuery, ...newQuery };
    const newQueryString = objToQuery(mergedQuery);
    return `${baseUrl}?${newQueryString}`;
};

/**
 * 将对象转换为 URL 查询字符串
 * @param {Record<string, any>} data - 数据对象
 * @returns {string} 返回查询字符串
 * @example
 * objToQuery({name: 'John', age: 30}) // 'name=John&age=30'
 */
export const objToQuery = (data: Record<string, any>): string => {
    if (typeof data === "undefined" || typeof data !== "object") {
        return data;
    }
    let query = [];
    for (let param in data) {
        if (data.hasOwnProperty(param)) {
            if (data[param] === null) {
                continue; //null数据不提交
            }
            if (typeof data[param] === "object" && data[param].length) {
                data[param].forEach((item: any) => {
                    query.push(encodeURI(param + "=" + item));
                });
            } else if (typeof data[param] === "object") {
                //todo 不处理子级object、空数组情况
            } else {
                query.push(encodeURI(param + "=" + data[param]));
            }
        }
    }
    return query.join("&");
};

/**
 * 扩展 RequestInit，添加 timeout 和其他自定义属性，timeout 用于设置请求超时时间，其他自定义属性可以直接添加到 headers 中
 */
interface RequestOption extends RequestInit {
    timeout?: number;
    [key: string]: any;
}

export class AbortError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * 可中止的 Fetch 请求
 * 完全独立定义，避免与 Promise 类型混淆
 */
export interface AbortablePromise<T> extends PromiseLike<T> {
    // 添加 abort 方法
    abort: () => void;

    // 添加 abortSilently 方法，用于中止请求但不抛出异常
    abortSilently: () => void;

    // 添加 aborted 属性，表示请求是否已被中止
    aborted: boolean;

    // 完全重新定义 then 方法，返回 AbortablePromise
    then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): AbortablePromise<TResult1 | TResult2>;

    // 定义 catch 方法
    catch<TResult = never>(
        onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
    ): AbortablePromise<T | TResult>;

    // 定义 finally 方法
    finally(onfinally?: (() => void) | undefined | null): AbortablePromise<T>;

    // 添加 Symbol.toStringTag，使其在运行时表现像 Promise
    readonly [Symbol.toStringTag]: "Promise";
}

/**
 * 拓展原生 Fetch API 实现可中止的请求，支持超时设置
 * @param url - 请求 URL
 * @param fetchOption - fetch请求选项，包括 method、headers、body 等
 * @param timeout - 超时时间，单位毫秒，0 表示不设置超时
 * @returns AbortablePromise<any> 返回可中止的 Promise 对象
 * @example
 * const req = abortableFetch('/api/data');
 * req.abort('canceled'); // 中止请求
 */
export const abortableFetch = (url: string, fetchOption: RequestOption = {}): AbortablePromise<any> => {
    const controller = new AbortController();

    let timeoutId: number | null = null;
    if (fetchOption.timeout) {
        timeoutId = setTimeout(() => controller.abort(), fetchOption.timeout);
    }

    const clearTimer = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    const addAbortMethod = (promise: Promise<any>): AbortablePromise<any> => {
        const abortablePromise = promise as AbortablePromise<any>;

        // 保存原始方法
        const originalThen = abortablePromise.then.bind(abortablePromise);
        const originalCatch = abortablePromise.catch.bind(abortablePromise);
        const originalFinally = abortablePromise.finally.bind(abortablePromise);

        // 重写方法，确保返回的 Promise 也具有 abort 方法
        abortablePromise.then = function (onfulfilled, onrejected) {
            return addAbortMethod(originalThen(onfulfilled, onrejected));
        };

        abortablePromise.catch = function (onrejected) {
            return addAbortMethod(originalCatch(onrejected));
        };

        abortablePromise.finally = function (onfinally) {
            return addAbortMethod(originalFinally(onfinally));
        };

        // 添加 abort 方法
        abortablePromise.abort = (reason?: string) => {
            clearTimer();
            abortablePromise.aborted = true;
            controller.abort(new AbortError(reason || "request aborted."));
        };

        // 添加 abortSilently 方法
        abortablePromise.abortSilently = () => {
            clearTimer();
            abortablePromise.aborted = true;
            try {
                controller.abort();
            } catch (e) {
                // 忽略异常
            }
        };

        return abortablePromise;
    };

    const fetchPromise = fetch(url, {
        ...fetchOption,
        signal: controller.signal,
    })
        .then((res) => {
            clearTimer();
            return res;
        })
        .catch((err) => {
            clearTimer();
            throw err;
        });

    return addAbortMethod(fetchPromise);
};

const appendHeader = (key: string, value: any, headers: Headers): void => {
    if (value == null) return;
    // 将驼峰命名转换为 HTTP 头格式 (例如: ContentType -> content-type)
    const headerName = key
        .replace(/([A-Z])/g, "-$1")
        .replace(/^-/, "")
        .toLowerCase();
    headers.set(headerName, String(value));
};

// 判断属性是否为 RequestInit 的标准属性
const isRequestInitProp = (key: string): boolean => {
    return [
        "method",
        "headers",
        "body",
        "mode",
        "credentials",
        "cache",
        "redirect",
        "referrer",
        "referrerPolicy",
        "integrity",
        "keepalive",
        "signal",
        "window",
    ].includes(key);
};

/**
 * 发送 HTTP 请求
 * @param {string} url - 请求 URL
 * @param {BodyInit|null} [data=null] - 请求数据,可以是字符串、FormData、URLSearchParams、Blob、ArrayBuffer 等，如果是对象会根据 ContentType 自动转换（例如 application/json 会自动 JSON.stringify）
 * @param {RequestOption} option - 请求选项
 * @returns {AbortablePromise<Response>} 返回可中止的 Promise
 * @example
 * request('/api/data', null, {method: 'GET'})
 */
export const request = (url: string, data: BodyInit | null = null, requestOption: RequestOption): AbortablePromise<Response> => {
    requestOption = requestOption || {};
    requestOption.method = requestOption.method || "GET";

    const IS_GET = requestOption.method.toUpperCase() === "GET";

    const headers = new Headers(requestOption.headers || {});

    //如果 key 不是RequestInit的属性，则添加到 headers 中
    for (let key in requestOption) {
        if (!isRequestInitProp(key)) {
            appendHeader(key, requestOption[key], headers);
        }
    }

    if (IS_GET && data) {
        url = queryReplace(url, typeof data === "string" ? queryToObj(data) : data);
        data = null;
    }

    return abortableFetch(
        url,
        {
            headers,
            ...{
                body: !IS_GET ? fixData(data, headers.get("content-type") || undefined) : undefined,
            },
            ...requestOption,
        },
    ).then((response) => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    }) as AbortablePromise<Response>;
};

/**
 * 检测值是否为 BodyInit 可接受的类型
 * @param {any} value - 要检测的值
 * @returns {boolean} 如果是 BodyInit 可接受的类型返回 true，否则返回 false
 */
export const isBodyInit = (value: any): value is BodyInit => {
    return (
        typeof value === "string" ||
        value instanceof FormData ||
        value instanceof URLSearchParams ||
        value instanceof Blob ||
        value instanceof ArrayBuffer ||
        ArrayBuffer.isView(value)
    );
};

const fixData = (data: any, contentType?: string) => {
    if (isBodyInit(data)) {
        return data;
    }
    if (typeof data !== "object") {
        return data;
    }
    switch (contentType?.toLowerCase()) {
        case MIME_JSON:
            return JSON.stringify(data);
        case MIME_FORM:
        case MIME_MULTIPART:
        default:
            return objToQuery(data);
    }
};

/**
 * 发送 GET 请求并获取 JSON 响应
 * @param url - 请求 URL
 * @param data - 请求数据
 * @param option - 请求选项
 * @returns Promise<any> 返回解析后的 JSON 数据
 * @example
 * getJson('/api/users').then(data => console.log(data))
 */
export const getJson = (url: string, data: any = null, option: RequestOption = {}) => {
    return request(url, data, { ...option, ContentType: MIME_JSON, Accept: MIME_JSON }).then((response) => response.json());
};

/**
 * 发送 POST 请求并获取 JSON 响应
 * @param url - 请求 URL
 * @param data - 请求数据
 * @param option - 请求选项
 * @returns Promise<any> 返回解析后的 JSON 数据
 * @example
 * postJson('/api/users', {name: 'John'}).then(data => console.log(data))
 */
export const postJson = (url: string, data: any = null, option: RequestOption = {}) => {
    return request(url, data, { ...option, method: "POST", ContentType: MIME_JSON, Accept: MIME_JSON }).then((response) => response.json());
};

/**
 * 上传文件
 * @param url - 请求 URL
 * @param fileMap - 文件对象映射
 * @param data - 额外的表单数据
 * @param option - 请求选项
 * @returns Promise<any> 返回解析后的 JSON 数据
 * @example
 * postFiles('/api/upload', {avatar: fileObject})
 */
export const postFiles = (url: string, fileMap: Record<string, File>, data: any = null, option: RequestOption = {}) => {
    const formData = new FormData();
    Object.keys(fileMap).forEach((key) => {
        formData.append(key, fileMap[key], fileMap[key].name);
    });
    if (data) {
        for (let key in data) {
            if (data.hasOwnProperty(key)) {
                formData.append(key, data[key]);
            }
        }
    }
    return request(url, formData, { ...option, method: "POST" }).then((response) => response.json());
};
