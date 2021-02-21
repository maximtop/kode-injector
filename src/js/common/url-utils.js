class UrlUtils {
    getHostname = (url) => {
        const urlObj = new URL(url);
        return urlObj.hostname;
    };

    getHostnameWithoutWww = (url) => {
        const hostname = this.getHostname(url);
        const wwwRegex = /^www./;
        return hostname.replace(wwwRegex, '');
    }
}

export const urlUtils = new UrlUtils();
