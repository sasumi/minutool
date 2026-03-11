import { blobToBase64 } from "./base64";
import { urlB64DataCache } from "./file";

/**
 * 通过 Image 元素获取 Base64 数据
 * @param {HTMLImageElement} img - 图片元素
 * @returns {string|null} 返回 Base64 Data URL，失败返回 null
 * @example
 * imgToBase64(imageElement) // 'data:image/png;base64,...'
 */
export const imgToBase64 = (img: HTMLImageElement): string | null => {
    if (!img.src) {
        return null;
    }
    if (img.src.indexOf("data:") === 0) {
        return img.src;
    }
    let canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    let ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, img.width, img.height);
    return canvas.toDataURL("image/png");
};

/**
 * 通过图片 URL 获取 Base64（网络请求模式）
 * @param {string} src - 图片 URL
 * @param {boolean} [cache=false] - 是否缓存结果
 * @returns {Promise<unknown>} 返回 Base64 Data URL 的 Promise
 * @example
 * srcToBase64('https://example.com/image.png').then(base64 => console.log(base64))
 */
export const srcToBase64 = (src: string, cache: boolean = false): Promise<unknown> => {
    return new Promise((resolve, reject) => {
        if (cache) {
            const cached = urlB64DataCache(src);
            if (cached) {
                return resolve(cached);
            }
        }
        let xhr = new XMLHttpRequest();
        xhr.open("GET", src, true);
        xhr.responseType = "blob";
        xhr.onload = function () {
            if (this.status === 200) {
                let blob = this.response;
                blobToBase64(blob)
                    .then((base64) => {
                        if (cache) {
                            urlB64DataCache(src, base64 as string);
                        }
                        resolve(base64);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            }
        };
        xhr.onerror = function () {
            reject("Error:" + this.statusText);
        };
        xhr.onabort = function () {
            reject("Request abort");
        };
        xhr.send();
    });
};
