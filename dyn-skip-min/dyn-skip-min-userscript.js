// ==UserScript==
// @name         TwitchAdSolutions (dyn-skip)
// @namespace    https://github.com/pixeltris/TwitchAdSolutions
// @version      1.0
// @description  Skips twitch ads, and reloads the stream
// @author       pixeltris
// @match        *://*.twitch.tv/*
// @downloadURL  https://github.com/pixeltris/TwitchAdSolutions/raw/master/dyn-skip/dyn-skip-userscript.js
// @run-at       document-start
// @grant        none
// ==/UserScript==
// ad-skip from https://github.com/Nerixyz/ttv-tools/blob/master/src/context/context-script.ts
(function() {
    'use strict';
    function declareOptions(scope) {
        // Options / globals
        scope.OPT_INITIAL_M3U8_ATTEMPTS = 10;
        scope.AD_SIGNIFIER = 'stitched-ad';
        scope.CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
    }
    var gql_device_id = null;
    const oldWorker = window.Worker;
    window.Worker = class Worker extends oldWorker {
        constructor(twitchBlobUrl) {
            var jsURL = getWasmWorkerUrl(twitchBlobUrl);
            var newBlobStr = `
                ${hookWorkerFetch.toString()}
                hookWorkerFetch();
                importScripts('${jsURL}');
            `
            super(URL.createObjectURL(new Blob([newBlobStr])));
        }
    }
    function getWasmWorkerUrl(twitchBlobUrl) {
        var req = new XMLHttpRequest();
        req.open('GET', twitchBlobUrl, false);
        req.send();
        return req.responseText.split("'")[1];
    }
    function hookWorkerFetch() {
        var realFetch = fetch;
        fetch = async function(url, options) {
            if (typeof url === 'string') {
                if (url.includes('/api/channel/hls/')) {
                    var rawUrl = url.split(/[?#]/)[0];
                    var urlInfo = new URL(rawUrl);
                    urlInfo.searchParams.set('sig', (new URL(url)).searchParams.get('sig'));
                    urlInfo.searchParams.set('token', (new URL(url)).searchParams.get('token'));
                    //console.log('modify url ' + url + ' ------------------ ' + urlInfo.href);
                    url = urlInfo.href;
                }
            }
            return realFetch.apply(this, arguments);
        }
    }
    function makeGraphQlPacket(event, radToken, payload) {
        return [{
            operationName: 'ClientSideAdEventHandling_RecordAdEvent',
            variables: {
                input: {
                    eventName: event,
                    eventPayload: JSON.stringify(payload),
                    radToken,
                },
            },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: '7e6c69e6eb59f8ccb97ab73686f3d8b7d85a72a0298745ccd8bfc68e4054ca5b',
                },
            },
        }];
    }
    function gqlRequest(body) {
        return fetch('https://gql.twitch.tv/gql', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'client-id': CLIENT_ID,
                'X-Device-Id': gql_device_id
            }
        });
    }
    function parseAttributes(str) {
        return Object.fromEntries(
            str.split(/(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))/)
                .filter(Boolean)
                .map(x => {
                    const idx = x.indexOf('=');
                    const key = x.substring(0, idx);
                    const value = x.substring(idx +1);
                    const num = Number(value);
                    return [key, Number.isNaN(num) ? value.startsWith('"') ? JSON.parse(value) : value : num]
                }));
    }
    declareOptions(window);
    function hookFetch() {
        var realFetch = window.fetch;
        window.fetch = function(url, init, ...args) {
            if (typeof url === 'string') {
                var deviceId = init.headers['X-Device-Id'];
                if (typeof deviceId !== 'string') {
                    deviceId = init.headers['Device-ID'];
                }
                if (typeof deviceId === 'string') {
                    gql_device_id = deviceId;
                }
                var tok = null, sig = null;
                if (url.includes('/access_token')) {
                    return new Promise(async function(resolve, reject) {
                        var response = await realFetch(url, init);
                        if (response.status === 200) {
                            // TODO
                        } else {
                            resolve(response);
                        }
                    });
                }
                else if (url.includes('gql') && init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                    return new Promise(async function(resolve, reject) {
                        var response = await realFetch(url, init);
                        if (response.status === 200) {
                            for (var i = 0; i < OPT_INITIAL_M3U8_ATTEMPTS; i++) {
                                var cloned = response.clone();
                                var responseData = await cloned.json();
                                if (responseData && responseData.data && responseData.data.streamPlaybackAccessToken && responseData.data.streamPlaybackAccessToken.value && responseData.data.streamPlaybackAccessToken.signature) {
                                    var tokInfo = JSON.parse(responseData.data.streamPlaybackAccessToken.value);
                                    var channelName = tokInfo.channel;
                                    var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + channelName + '.m3u8');
                                    urlInfo.searchParams.set('sig', responseData.data.streamPlaybackAccessToken.signature);
                                    urlInfo.searchParams.set('token', responseData.data.streamPlaybackAccessToken.value);
                                    var encodingsM3u8Response = await realFetch(urlInfo.href);
                                    if (encodingsM3u8Response.status === 200) {
                                        var encodingsM3u8 = await encodingsM3u8Response.text();
                                        var streamM3u8Url = encodingsM3u8.match(/^https:.*\.m3u8$/m)[0];
                                        var streamM3u8Response = await realFetch(streamM3u8Url);
                                        var streamM3u8 = await streamM3u8Response.text();
                                        //console.log(streamM3u8);
                                        if (streamM3u8.includes(AD_SIGNIFIER)) {
                                            console.log('ad at req ' + i);
                                            var matches = streamM3u8.match(/#EXT-X-DATERANGE:(ID="stitched-ad-[^\n]+)\n/);
                                            if (matches.length > 1) {
                                                const attrString = matches[1];
                                                const attr = parseAttributes(attrString);
                                                var podLength = parseInt(attr['X-TV-TWITCH-AD-POD-LENGTH'] ? attr['X-TV-TWITCH-AD-POD-LENGTH'] : '1');
                                                var podPosition = parseInt(attr['X-TV-TWITCH-AD-POD-POSITION'] ? attr['X-TV-TWITCH-AD-POD-POSITION'] : '0');
                                                var radToken = attr['X-TV-TWITCH-AD-RADS-TOKEN'];
                                                var lineItemId = attr['X-TV-TWITCH-AD-LINE-ITEM-ID'];
                                                var orderId = attr['X-TV-TWITCH-AD-ORDER-ID'];
                                                var creativeId = attr['X-TV-TWITCH-AD-CREATIVE-ID'];
                                                var adId = attr['X-TV-TWITCH-AD-ADVERTISER-ID'];
                                                var rollType = attr['X-TV-TWITCH-AD-ROLL-TYPE'].toLowerCase();
                                                const baseData = {
                                                    stitched: true,
                                                    roll_type: rollType,
                                                    player_mute: false,
                                                    player_volume: 0.5,
                                                    visible: true,
                                                };
                                                for (let podPosition = 0; podPosition < podLength; podPosition++) {
                                                    const extendedData = {
                                                        ...baseData,
                                                        ad_id: adId,
                                                        ad_position: podPosition,
                                                        duration: 30,
                                                        creative_id: creativeId,
                                                        total_ads: podLength,
                                                        order_id: orderId,
                                                        line_item_id: lineItemId,
                                                    };
                                                    await gqlRequest(makeGraphQlPacket('video_ad_impression', radToken, extendedData));
                                                    for (let quartile = 0; quartile < 4; quartile++) {
                                                        await gqlRequest(
                                                            makeGraphQlPacket('video_ad_quartile_complete', radToken, {
                                                                ...extendedData,
                                                                quartile: quartile + 1,
                                                            })
                                                        );
                                                    }
                                                    await gqlRequest(makeGraphQlPacket('video_ad_pod_complete', radToken, baseData));
                                                }
                                            }
                                        } else {
                                            console.log("no ad at req " + i);
                                            break;
                                        }
                                    } else {
                                        break;
                                    }
                                } else {
                                    console.log('malformed');
                                    console.log(responseData);
                                    break;
                                }
                            }
                            console.log(responseData);
                            resolve(response);
                        } else {
                            resolve(response);
                        }
                    });
                }
            }
            return realFetch.apply(this, arguments);
        }
    }
    hookFetch();
})();