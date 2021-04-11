var isChrome = typeof chrome !== "undefined" && typeof browser === "undefined";
var extensionAPI = isChrome ? chrome : browser;
function onBeforeRequest(details) {
    const match = /hls\/(\w+)\.m3u8/gim.exec(details.url);
    if (match !== null && match.length > 1) {
        return {
            redirectUrl: `http://127.0.0.1/twitch-m3u8/${match[1]}`
        };
    } else {
        return {
            redirectUrl: details.url
        };
    }
}
extensionAPI.webRequest.onBeforeRequest.addListener(
    onBeforeRequest, {
        urls: ["https://usher.ttvnw.net/api/channel/hls/*"]
    },
    ["blocking"]
);