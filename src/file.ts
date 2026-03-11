import { isUrl } from "./util";

/**
 * 过滤字符串为合法文件名
 * 替换 Windows/Unix 不允许的字符为下划线
 * 包括：\ / : * ? " < > | 以及控制字符
 * @param {string} name
 * @returns {string}
 */
export const sanitizeFileName = (name: string): string => {
    return name
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/[\0-\x1F]/g, "_") // 单独替换控制字符
        .replace(/\s+/g, " ") // 替换多个空格为一个空格
        .replace(/^\.+/, "") // 去除开头的点
        .replace(/\.+$/, "") // 去除结尾的点
        .trim();
};

/**
 * 将 Blob 转换为 Data URI
 * @param {Blob} blob - Blob 对象
 * @returns {Promise<string>} 返回 Data URI 字符串
 * @example
 * blobToDataUri(blob).then(uri => console.log(uri))
 */
export const blobToDataUri = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
    });

// 缓存通过 URL 获取的文件数据
const FILE_B64_CACHE_DATA: Record<string, string> = {};

/**
 * URL 转 Base64 Data URL 数据缓存
 * @param {string} url - 文件 URL
 * @param {string|null} [b64Data=null] - Base64 Data URL 数据，传入 null 则为读取缓存
 * @returns {string|null} 读取缓存时返回 Base64 Data URL 字符串，未命中返回 null
 * @example
 * urlB64DataCache('http://example.com/img.png', dataUrl) // 设置缓存
 * urlB64DataCache('http://example.com/img.png') // 读取缓存
 */
export const urlB64DataCache = (url: string, b64Data: string | null = null): string | null => {
    if (b64Data !== null) {
        FILE_B64_CACHE_DATA[url] = b64Data;
        return null;
    } else {
        return FILE_B64_CACHE_DATA[url] || null;
    }
};

/**
 * 将文件转换为 Base64 Data URI
 * 支持 File/Blob 对象，或字符串 URL（http(s)/相对/blob:）
 * @param {File|Blob|string} file - 文件对象或 URL 字符串
 * @returns {Promise<string|null>} 返回 Data URL 字符串，失败返回 null
 * @example
 * fileToBase64DataUri(file).then(uri => console.log(uri))
 */
export const fileToBase64DataUri = async (file: File | Blob | string) => {
    if (!file) {
        return null;
    }

    // 已经是 data URL
    if (typeof file === "string" && file.startsWith("data:")) {
        return file;
    }

    try {
        // 字符串 URL（http(s)/相对/blob:）
        if (typeof file === "string" && isUrl(file)) {
            // fetch -> blob -> dataURL
            const resp = await fetch(file);
            if (!resp.ok) {
                throw new Error(`Fetch failed: ${resp.status}`);
            }
            const blob = await resp.blob();
            return await blobToDataUri(blob);
        }

        // File 或 Blob
        if (file instanceof Blob) {
            return await blobToDataUri(file);
        }

        // 不能处理的类型，返回 null
        return null;
    } catch (err) {
        console.warn("file2Base64DataURL failed:", err);
        return null;
    }
};

/**
 * 下载文件
 * @param {string} uri - 文件 URI（支持 Data URI 和普通 URL）
 * @param {string} fileName - 保存的文件名
 * @returns {void}
 * @example
 * downloadFile('data:text/plain;base64,SGVsbG8=', 'hello.txt')
 */
export const downloadFile = (uri: string, fileName: string) => {
    const link = document.createElement("a");
	link.rel = 'noopener noreferrer';
    link.href = uri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
