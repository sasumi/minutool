export const MIME_JSON = "application/json";

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
 * 可中止的 Fetch 请求
 */
export interface AbortablePromise<T> extends Promise<T> {
    abort: () => void;
}

/**
 * 使用 Fetch API 实现可中止的请求，支持超时设置
 * @param {string} url - 请求 URL
 * @param {any} [options={}] - 请求选项，包括 method、headers、body、timeout 等
 * @returns {AbortablePromise<any>} 返回可中止的 Promise 对象
 * @example
 * const req = abortableFetch('/api/data');
 * req.abort(); // 中止请求
 */
const abortableFetch = (url: string, options: any = {}): AbortablePromise<any> => {
    const controller = new AbortController();
    const { timeout, ...fetchOptions } = options;

    let timeoutId: number | null = null;
    if (timeout) {
        timeoutId = setTimeout(() => controller.abort(), timeout);
    }
    const wrap = (promise: Promise<any>) => {
        const p = promise
            .then((res) => {
                if (timeoutId !== null) clearTimeout(timeoutId);
                return res;
            })
            .catch((err) => {
                if (timeoutId !== null) clearTimeout(timeoutId);
                throw err;
            }) as AbortablePromise<any>;

        const oldThen = p.then.bind(p);
        p.then = (...args) => wrap(oldThen(...args));
        p.abort = () => controller.abort();
        return p;
    };

    return wrap(
        fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        }),
    );
};

interface RequestOption {
    method?: string;
    headers?: Record<string, string>;
    ContentType?: string;
    Accept?: string;
    timeout?: number;
}

/**
 * 发送 HTTP 请求
 * @param {string} url - 请求 URL
 * @param {BodyInit|null} [data=null] - 请求数据
 * @param {RequestOption} option - 请求选项
 * @returns {AbortablePromise<Response>} 返回可中止的 Promise
 * @example
 * request('/api/data', null, {method: 'GET'})
 */
export const request = (url: string, data: BodyInit | null = null, option: RequestOption): AbortablePromise<Response> => {
    const { method = "GET", headers = {}, ContentType, Accept, timeout } = option;
    if (ContentType) {
        headers["Content-Type"] = ContentType;
    }
    if (Accept) {
        headers["Accept"] = Accept;
    }
    return abortableFetch(url, {
        method,
        headers,
        body: data,
        timeout,
    }).then((response) => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    }) as AbortablePromise<Response>;
};

/**
 * 发送 GET 请求并获取 JSON 响应
 * @param {string} url - 请求 URL
 * @param {any} [data=null] - 请求数据
 * @param {RequestOption} [option={}] - 请求选项
 * @returns {Promise<any>} 返回解析后的 JSON 数据
 * @example
 * getJson('/api/users').then(data => console.log(data))
 */
export const getJson = (url: string, data: any = null, option: RequestOption = {}) => {
    return request(url, data, { ...option, ContentType: MIME_JSON, Accept: MIME_JSON }).then((response) => response.json());
};

/**
 * 发送 POST 请求并获取 JSON 响应
 * @param {string} url - 请求 URL
 * @param {any} [data=null] - 请求数据
 * @param {RequestOption} [option={}] - 请求选项
 * @returns {Promise<any>} 返回解析后的 JSON 数据
 * @example
 * postJson('/api/users', {name: 'John'}).then(data => console.log(data))
 */
export const postJson = (url: string, data: any = null, option: RequestOption = {}) => {
    return request(url, data, { ...option, method: "POST", ContentType: MIME_JSON, Accept: MIME_JSON }).then((response) => response.json());
};

/**
 * 上传文件
 * @param {string} url - 请求 URL
 * @param {Record<string, File>} fileMap - 文件对象映射
 * @param {any} [data=null] - 额外的表单数据
 * @param {RequestOption} [option={}] - 请求选项
 * @returns {Promise<any>} 返回解析后的 JSON 数据
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
