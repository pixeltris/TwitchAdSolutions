// ==UserScript==
// @name         TwitchAdSolutions (vaft)
// @namespace    https://github.com/pixeltris/TwitchAdSolutions
// @version      5.4.0
// @description  Multiple solutions for blocking Twitch ads (vaft)
// @updateURL    https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft.user.js
// @downloadURL  https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft.user.js
// @author       https://github.com/cleanlock/VideoAdBlockForTwitch#credits
// @match        *://*.twitch.tv/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
// This code is directly copied from https://github.com/cleanlock/VideoAdBlockForTwitch (only change is whitespace is removed for the ublock origin script - also indented)
(function() {
    'use strict';
    //This stops Twitch from pausing the player when in another tab and an ad shows.
    try {
        Object.defineProperty(document, 'visibilityState', {
            get() {
                return 'visible';
            }
        });
        Object.defineProperty(document, 'hidden', {
            get() {
                return false;
            }
        });
        const block = e => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };
        const process = e => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            //This corrects the background tab buffer bug when switching to the background tab for the first time after an extended period.
            doTwitchPlayerTask(false, false, true, false, false);
        };
        document.addEventListener('visibilitychange', process, true);
        document.addEventListener('webkitvisibilitychange', block, true);
        document.addEventListener('mozvisibilitychange', block, true);
        document.addEventListener('hasFocus', block, true);
        if (/Firefox/.test(navigator.userAgent)) {
            Object.defineProperty(document, 'mozHidden', {
                get() {
                    return false;
                }
            });
        } else {
            Object.defineProperty(document, 'webkitHidden', {
                get() {
                    return false;
                }
            });
        }
    } catch (err) {}
    //Send settings updates to worker.
    window.addEventListener("message", (event) => {
        if (event.source != window)
            return;
        if (event.data.type && (event.data.type == "SetHideBlockingMessage")) {
            if (twitchMainWorker) {
                twitchMainWorker.postMessage({
                    key: 'SetHideBlockingMessage',
                    value: event.data.value
                });
            }
        }
    }, false);
    function declareOptions(scope) {
        scope.AdSignifier = 'stitched';
        scope.ClientID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
        scope.ClientVersion = 'null';
        scope.ClientSession = 'null';
        scope.PlayerType1 = 'site'; //Source
        scope.PlayerType2 = 'thunderdome'; //480p
        scope.PlayerType3 = 'pop_tart'; //480p
        scope.PlayerType4 = 'picture-by-picture'; //360p
        scope.CurrentChannelName = null;
        scope.UsherParams = null;
        scope.WasShowingAd = false;
        scope.GQLDeviceID = null;
        scope.HideBlockingMessage = false;
        scope.IsSquadStream = false;
    }
    declareOptions(window);
    var twitchMainWorker = null;
    var adBlockDiv = null;
    var OriginalVideoPlayerQuality = null;
    var IsPlayerAutoQuality = null;
    const oldWorker = window.Worker;
    window.Worker = class Worker extends oldWorker {
        constructor(twitchBlobUrl) {
            if (twitchMainWorker) {
                super(twitchBlobUrl);
                return;
            }
            var jsURL = getWasmWorkerUrl(twitchBlobUrl);
            if (typeof jsURL !== 'string') {
                super(twitchBlobUrl);
                return;
            }
            var newBlobStr = `
                ${getNewUsher.toString()}
                ${processM3U8.toString()}
                ${hookWorkerFetch.toString()}
                ${declareOptions.toString()}
                ${getAccessToken.toString()}
                ${gqlRequest.toString()}
                ${adRecordgqlPacket.toString()}
                ${tryNotifyTwitch.toString()}
                ${parseAttributes.toString()}
                declareOptions(self);
                self.addEventListener('message', function(e) {
                    if (e.data.key == 'UpdateIsSquadStream') {
                        IsSquadStream = e.data.value;
                    } else if (e.data.key == 'UpdateClientVersion') {
                        ClientVersion = e.data.value;
                    } else if (e.data.key == 'UpdateClientSession') {
                        ClientSession = e.data.value;
                    } else if (e.data.key == 'UpdateClientId') {
                        ClientID = e.data.value;
                    } else if (e.data.key == 'UpdateDeviceId') {
                        GQLDeviceID = e.data.value;
                    } else if (e.data.key == 'SetHideBlockingMessage') {
                        if (e.data.value == "true") {
                        HideBlockingMessage = false;
                        } else if (e.data.value == "false") {
                        HideBlockingMessage = true;
                        }
                    }
                });
                hookWorkerFetch();
                importScripts('${jsURL}');
            `;
            super(URL.createObjectURL(new Blob([newBlobStr])));
            twitchMainWorker = this;
            this.onmessage = function(e) {
                if (e.data.key == 'ShowAdBlockBanner') {
                    if (adBlockDiv == null) {
                        adBlockDiv = getAdBlockDiv();
                    }
                    adBlockDiv.P.textContent = 'Blocking ads...';
                    adBlockDiv.style.display = 'block';
                } else if (e.data.key == 'HideAdBlockBanner') {
                    if (adBlockDiv == null) {
                        adBlockDiv = getAdBlockDiv();
                    }
                    adBlockDiv.style.display = 'none';
                } else if (e.data.key == 'PauseResumePlayer') {
                    doTwitchPlayerTask(true, false, false, false, false);
                } else if (e.data.key == 'ForceChangeQuality') {
                    //This is used to fix the bug where the video would freeze.
                    try {
                        var autoQuality = doTwitchPlayerTask(false, false, false, true, false);
                        var currentQuality = doTwitchPlayerTask(false, true, false, false, false);
                        if (IsPlayerAutoQuality == null) {
                            IsPlayerAutoQuality = autoQuality;
                        }
                        if (OriginalVideoPlayerQuality == null) {
                            OriginalVideoPlayerQuality = currentQuality;
                        }
                        if (!currentQuality.includes('480') || e.data.value != null) {
                            if (!OriginalVideoPlayerQuality.includes('480')) {
                                var settingsMenu = document.querySelector('div[data-a-target="player-settings-menu"]');
                                if (settingsMenu == null) {
                                    var settingsCog = document.querySelector('button[data-a-target="player-settings-button"]');
                                    if (settingsCog) {
                                        settingsCog.click();
                                        var qualityMenu = document.querySelector('button[data-a-target="player-settings-menu-item-quality"]');
                                        if (qualityMenu) {
                                            qualityMenu.click();
                                        }
                                        var lowQuality = document.querySelectorAll('input[data-a-target="tw-radio"');
                                        if (lowQuality) {
                                            var qualityToSelect = lowQuality.length - 3;
                                            if (e.data.value != null) {
                                                if (e.data.value.includes('original')) {
                                                    e.data.value = OriginalVideoPlayerQuality;
                                                    if (IsPlayerAutoQuality) {
                                                        e.data.value = 'auto';
                                                    }
                                                }
                                                if (e.data.value.includes('160p')) {
                                                    qualityToSelect = 5;
                                                }
                                                if (e.data.value.includes('360p')) {
                                                    qualityToSelect = 4;
                                                }
                                                if (e.data.value.includes('480p')) {
                                                    qualityToSelect = 3;
                                                }
                                                if (e.data.value.includes('720p')) {
                                                    qualityToSelect = 2;
                                                }
                                                if (e.data.value.includes('822p')) {
                                                    qualityToSelect = 2;
                                                }
                                                if (e.data.value.includes('864p')) {
                                                    qualityToSelect = 2;
                                                }
                                                if (e.data.value.includes('900p')) {
                                                    qualityToSelect = 2;
                                                }
                                                if (e.data.value.includes('936p')) {
                                                    qualityToSelect = 2;
                                                }
                                                if (e.data.value.includes('960p')) {
                                                    qualityToSelect = 2;
                                                }
                                                if (e.data.value.includes('1080p')) {
                                                    qualityToSelect = 2;
                                                }
                                                if (e.data.value.includes('source')) {
                                                    qualityToSelect = 1;
                                                }
                                                if (e.data.value.includes('auto')) {
                                                    qualityToSelect = 0;
                                                }
                                            }
                                            var currentQualityLS = window.localStorage.getItem('video-quality');
                                            lowQuality[qualityToSelect].click();
                                            window.localStorage.setItem('video-quality', currentQualityLS);
                                            if (e.data.value != null) {
                                                OriginalVideoPlayerQuality = null;
                                                IsPlayerAutoQuality = null;
                                                doTwitchPlayerTask(false, false, false, true, true);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        OriginalVideoPlayerQuality = null;
                        IsPlayerAutoQuality = null;
                    }
                }
            };
            function getAdBlockDiv() {
                //To display a notification to the user, that an ad is being blocked.
                var playerRootDiv = document.querySelector('.video-player');
                var adBlockDiv = null;
                if (playerRootDiv != null) {
                    adBlockDiv = playerRootDiv.querySelector('.adblock-overlay');
                    if (adBlockDiv == null) {
                        adBlockDiv = document.createElement('div');
                        adBlockDiv.className = 'adblock-overlay';
                        adBlockDiv.innerHTML = '<div class="player-adblock-notice" style="color: white; background-color: rgba(0, 0, 0, 0.8); position: absolute; top: 0px; left: 0px; padding: 5px;"><p></p></div>';
                        adBlockDiv.style.display = 'none';
                        adBlockDiv.P = adBlockDiv.querySelector('p');
                        playerRootDiv.appendChild(adBlockDiv);
                    }
                }
                return adBlockDiv;
            }
        }
    };
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
                if (url.includes('video-weaver')) {
                    return new Promise(function(resolve, reject) {
                        var processAfter = async function(response) {
                            //Here we check the m3u8 for any ads and also try fallback player types if needed.
                            var responseText = await response.text();
                            var weaverText = null;
                            weaverText = await processM3U8(url, responseText, realFetch, PlayerType2);
                            if (weaverText.includes(AdSignifier)) {
                                weaverText = await processM3U8(url, responseText, realFetch, PlayerType3);
                            }
                            if (weaverText.includes(AdSignifier)) {
                                weaverText = await processM3U8(url, responseText, realFetch, PlayerType4);
                            }
                            resolve(new Response(weaverText));
                        };
                        var send = function() {
                            return realFetch(url, options).then(function(response) {
                                processAfter(response);
                            })['catch'](function(err) {
                                reject(err);
                            });
                        };
                        send();
                    });
                } else if (url.includes('/api/channel/hls/')) {
                    var channelName = (new URL(url)).pathname.match(/([^\/]+)(?=\.\w+$)/)[0];
                    UsherParams = (new URL(url)).search;
                    CurrentChannelName = channelName;
                    //To prevent pause/resume loop for mid-rolls.
                    var isPBYPRequest = url.includes('picture-by-picture');
                    if (isPBYPRequest) {
                        url = '';
                    }
                    //Make new Usher request if needed to create fallback if UBlock bypass method fails.
                    var useNewUsher = false;
                    if (url.includes('subscriber%22%3Afalse') && url.includes('hide_ads%22%3Afalse') && url.includes('show_ads%22%3Atrue')) {
                        useNewUsher = true;
                    }
                    if (url.includes('subscriber%22%3Atrue') && url.includes('hide_ads%22%3Afalse') && url.includes('show_ads%22%3Atrue')) {
                        useNewUsher = true;
                    }
                    if (useNewUsher == true) {
                        return new Promise(function(resolve, reject) {
                            var processAfter = async function(response) {
                                encodingsM3u8 = await getNewUsher(realFetch, response, channelName);
                                if (encodingsM3u8.length > 1) {
                                    resolve(new Response(encodingsM3u8));
                                } else {
                                    postMessage({
                                        key: 'HideAdBlockBanner'
                                    });
                                    resolve(encodingsM3u8);
                                }
                            };
                            var send = function() {
                                return realFetch(url, options).then(function(response) {
                                    processAfter(response);
                                })['catch'](function(err) {
                                    reject(err);
                                });
                            };
                            send();
                        });
                    }
                }
            }
            return realFetch.apply(this, arguments);
        };
    }
    //Added as fallback for when UBlock method fails.
    async function getNewUsher(realFetch, originalResponse, channelName) {
        var accessTokenResponse = await getAccessToken(channelName, PlayerType1);
        var encodingsM3u8 = '';
        if (accessTokenResponse.status === 200) {
            var accessToken = await accessTokenResponse.json();
            try {
                var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + channelName + '.m3u8' + UsherParams);
                urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
                var encodingsM3u8Response = await realFetch(urlInfo.href);
                if (encodingsM3u8Response.status === 200) {
                    encodingsM3u8 = await encodingsM3u8Response.text();
                    return encodingsM3u8;
                } else {
                    return originalResponse;
                }
            } catch (err) {}
            return originalResponse;
        } else {
            return originalResponse;
        }
    }
    async function processM3U8(url, textStr, realFetch, playerType) {
        //Checks the m3u8 for ads and if it finds one, instead returns an ad-free stream.
        //Ad blocking for squad streams is disabled due to the way multiple weaver urls are used. No workaround so far.
        if (IsSquadStream == true) {
            return textStr;
        }
        if (!textStr) {
            return textStr;
        }
        //Some live streams use mp4.
        if (!textStr.includes(".ts") && !textStr.includes(".mp4")) {
            return textStr;
        }
        var haveAdTags = textStr.includes(AdSignifier);
        if (haveAdTags) {
            //Reduces ad frequency.
            try {
                tryNotifyTwitch(textStr);
            } catch (err) {}
            var accessTokenResponse = await getAccessToken(CurrentChannelName, playerType);
            if (accessTokenResponse.status === 200) {
                var accessToken = await accessTokenResponse.json();
                try {
                    var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + CurrentChannelName + '.m3u8' + UsherParams);
                    urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                    urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
                    var encodingsM3u8Response = await realFetch(urlInfo.href);
                    if (encodingsM3u8Response.status === 200) {
                        var encodingsM3u8 = await encodingsM3u8Response.text();
                        streamM3u8Url = encodingsM3u8.match(/^https:.*\.m3u8$/mg)[0];
                        var streamM3u8Response = await realFetch(streamM3u8Url);
                        if (streamM3u8Response.status == 200) {
                            var m3u8Text = await streamM3u8Response.text();
                            console.log("Blocking ads...");
                            WasShowingAd = true;
                            if (HideBlockingMessage == false) {
                                postMessage({
                                    key: 'ShowAdBlockBanner'
                                });
                            } else if (HideBlockingMessage == true) {
                                postMessage({
                                    key: 'HideAdBlockBanner'
                                });
                            }
                            postMessage({
                                key: 'ForceChangeQuality'
                            });
                            return m3u8Text;
                        } else {
                            return textStr;
                        }
                    } else {
                        return textStr;
                    }
                } catch (err) {}
                return textStr;
            } else {
                return textStr;
            }
        } else {
            if (WasShowingAd) {
                console.log("Done blocking ads, changing back to original quality");
                WasShowingAd = false;
                //Here we put player back to original quality and remove the blocking message.
                postMessage({
                    key: 'ForceChangeQuality',
                    value: 'original'
                });
                postMessage({
                    key: 'PauseResumePlayer'
                });
                postMessage({
                    key: 'HideAdBlockBanner'
                });
            }
            return textStr;
        }
        return textStr;
    }
    function parseAttributes(str) {
        return Object.fromEntries(
            str.split(/(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))/)
            .filter(Boolean)
            .map(x => {
                const idx = x.indexOf('=');
                const key = x.substring(0, idx);
                const value = x.substring(idx + 1);
                const num = Number(value);
                return [key, Number.isNaN(num) ? value.startsWith('"') ? JSON.parse(value) : value : num];
            }));
    }
    async function tryNotifyTwitch(streamM3u8) {
        //We notify that an ad was requested but was not visible and was also muted.
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
                player_mute: true,
                player_volume: 0.0,
                visible: false,
            };
            for (let podPosition = 0; podPosition < podLength; podPosition++) {
                const extendedData = {
                    ...baseData,
                    ad_id: adId,
                    ad_position: podPosition,
                    duration: 0,
                    creative_id: creativeId,
                    total_ads: podLength,
                    order_id: orderId,
                    line_item_id: lineItemId,
                };
                await gqlRequest(adRecordgqlPacket('video_ad_impression', radToken, extendedData));
                for (let quartile = 0; quartile < 4; quartile++) {
                    await gqlRequest(
                        adRecordgqlPacket('video_ad_quartile_complete', radToken, {
                            ...extendedData,
                            quartile: quartile + 1,
                        })
                    );
                }
                await gqlRequest(adRecordgqlPacket('video_ad_pod_complete', radToken, baseData));
            }
        }
    }
    function adRecordgqlPacket(event, radToken, payload) {
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
    function getAccessToken(channelName, playerType, realFetch) {
        var body = null;
        var templateQuery = 'query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) {  streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {    value    signature    __typename  }  videoPlaybackAccessToken(id: $vodID, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {    value    signature    __typename  }}';
        body = {
            operationName: 'PlaybackAccessToken_Template',
            query: templateQuery,
            variables: {
                'isLive': true,
                'login': channelName,
                'isVod': false,
                'vodID': '',
                'playerType': playerType
            }
        };
        return gqlRequest(body, realFetch);
    }
    function gqlRequest(body, realFetch) {
        var fetchFunc = realFetch ? realFetch : fetch;
        if (!GQLDeviceID) {
            var dcharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
            var dcharactersLength = dcharacters.length;
            for (var i = 0; i < 32; i++) {
                GQLDeviceID += dcharacters.charAt(Math.floor(Math.random() * dcharactersLength));
            }
        }
        return fetchFunc('https://gql.twitch.tv/gql', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Client-ID': ClientID,
                'Device-ID': GQLDeviceID,
                'X-Device-Id': GQLDeviceID,
                'Client-Version': ClientVersion,
                'Client-Session-Id': ClientSession
            }
        });
    }
    function doTwitchPlayerTask(isPausePlay, isCheckQuality, isCorrectBuffer, isAutoQuality, setAutoQuality) {
        //This will do an instant pause/play to return to original quality once the ad is finished.
        //We also use this function to get the current video player quality set by the user.
        //We also use this function to quickly pause/play the player when switching tabs to stop delays.
        try {
            var videoController = null;
            var videoPlayer = null;
            function findReactNode(root, constraint) {
                if (root.stateNode && constraint(root.stateNode)) {
                    return root.stateNode;
                }
                let node = root.child;
                while (node) {
                    const result = findReactNode(node, constraint);
                    if (result) {
                        return result;
                    }
                    node = node.sibling;
                }
                return null;
            }
            var reactRootNode = null;
            var rootNode = document.querySelector('#root');
            if (rootNode && rootNode._reactRootContainer && rootNode._reactRootContainer._internalRoot && rootNode._reactRootContainer._internalRoot.current) {
                reactRootNode = rootNode._reactRootContainer._internalRoot.current;
            }
            videoPlayer = findReactNode(reactRootNode, node => node.setPlayerActive && node.props && node.props.mediaPlayerInstance);
            videoPlayer = videoPlayer && videoPlayer.props && videoPlayer.props.mediaPlayerInstance ? videoPlayer.props.mediaPlayerInstance : null;
            if (isPausePlay) {
                videoPlayer.pause();
                videoPlayer.play();
                return;
            }
            if (isCheckQuality) {
                if (typeof videoPlayer.getQuality() == 'undefined') {
                    return;
                }
                var playerQuality = JSON.stringify(videoPlayer.getQuality());
                if (playerQuality) {
                    return playerQuality;
                } else {
                    return;
                }
            }
            if (isAutoQuality) {
                if (typeof videoPlayer.isAutoQualityMode() == 'undefined') {
                    return false;
                }
                var autoQuality = videoPlayer.isAutoQualityMode();
                if (autoQuality) {
                    videoPlayer.setAutoQualityMode(false);
                    return autoQuality;
                } else {
                    return false;
                }
            }
            if (setAutoQuality) {
                videoPlayer.setAutoQualityMode(true);
                return;
            }
            //This only happens when switching tabs and is to correct the high latency caused when opening background tabs and going to them at a later time.
            //We check that this is a live stream by the page URL, to prevent vod/clip pause/plays.
            try {
                var currentPageURL = document.URL;
                var isLive = true;
                if (currentPageURL.includes('videos/') || currentPageURL.includes('clip/')) {
                    isLive = false;
                }
                if (isCorrectBuffer && isLive) {
                    //A timer is needed due to the player not resuming without it.
                    setTimeout(function() {
                        //If latency to broadcaster is above 5 or 15 seconds upon switching tabs, we pause and play the player to reset the latency.
                        //If latency is between 0-6, user can manually pause and resume to reset latency further.
                        if (videoPlayer.isLiveLowLatency() && videoPlayer.getLiveLatency() > 5) {
                            videoPlayer.pause();
                            videoPlayer.play();
                        } else if (videoPlayer.getLiveLatency() > 15) {
                            videoPlayer.pause();
                            videoPlayer.play();
                        }
                    }, 3000);
                }
            } catch (err) {}
        } catch (err) {}
    }
    var localDeviceID = null;
    localDeviceID = window.localStorage.getItem('local_copy_unique_id');
    function hookFetch() {
        var realFetch = window.fetch;
        window.fetch = function(url, init, ...args) {
            if (typeof url === 'string') {
                //Check if squad stream.
                if (window.location.pathname.includes('/squad')) {
                    if (twitchMainWorker) {
                        twitchMainWorker.postMessage({
                            key: 'UpdateIsSquadStream',
                            value: true
                        });
                    }
                } else {
                    if (twitchMainWorker) {
                        twitchMainWorker.postMessage({
                            key: 'UpdateIsSquadStream',
                            value: false
                        });
                    }
                }
                if (url.includes('/access_token') || url.includes('gql')) {
                    //Device ID is used when notifying Twitch of ads.
                    var deviceId = init.headers['X-Device-Id'];
                    if (typeof deviceId !== 'string') {
                        deviceId = init.headers['Device-ID'];
                    }
                    //Added to prevent eventual UBlock conflicts.
                    if (typeof deviceId === 'string' && !deviceId.includes('twitch-web-wall-mason')) {
                        GQLDeviceID = deviceId;
                    } else if (localDeviceID) {
                        GQLDeviceID = localDeviceID.replace('"', '');
                        GQLDeviceID = GQLDeviceID.replace('"', '');
                    }
                    if (GQLDeviceID && twitchMainWorker) {
                        if (typeof init.headers['X-Device-Id'] === 'string') {
                            init.headers['X-Device-Id'] = GQLDeviceID;
                        }
                        if (typeof init.headers['Device-ID'] === 'string') {
                            init.headers['Device-ID'] = GQLDeviceID;
                        }
                        twitchMainWorker.postMessage({
                            key: 'UpdateDeviceId',
                            value: GQLDeviceID
                        });
                    }
                    //Client version is used in GQL requests.
                    var clientVersion = init.headers['Client-Version'];
                    if (clientVersion && typeof clientVersion == 'string') {
                        ClientVersion = clientVersion;
                    }
                    if (ClientVersion && twitchMainWorker) {
                        twitchMainWorker.postMessage({
                            key: 'UpdateClientVersion',
                            value: ClientVersion
                        });
                    }
                    //Client session is used in GQL requests.
                    var clientSession = init.headers['Client-Session-Id'];
                    if (clientSession && typeof clientSession == 'string') {
                        ClientSession = clientSession;
                    }
                    if (ClientSession && twitchMainWorker) {
                        twitchMainWorker.postMessage({
                            key: 'UpdateClientSession',
                            value: ClientSession
                        });
                    }
                    //Client ID is used in GQL requests.
                    if (url.includes('gql') && init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                        var clientId = init.headers['Client-ID'];
                        if (clientId && typeof clientId == 'string') {
                            ClientID = clientId;
                        } else {
                            clientId = init.headers['Client-Id'];
                            if (clientId && typeof clientId == 'string') {
                                ClientID = clientId;
                            }
                        }
                        if (ClientID && twitchMainWorker) {
                            twitchMainWorker.postMessage({
                                key: 'UpdateClientId',
                                value: ClientID
                            });
                        }
                    }
                    //To prevent pause/resume loop for mid-rolls.
                    if (url.includes('gql') && init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken') && init.body.includes('picture-by-picture')) {
                        init.body = '';
                    }
                    var isPBYPRequest = url.includes('picture-by-picture');
                    if (isPBYPRequest) {
                        url = '';
                    }
                }
            }
            return realFetch.apply(this, arguments);
        };
    }
    hookFetch();
})();
