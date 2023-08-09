// ==UserScript==
// @name         TwitchAdSolutions (video-swap-new)
// @namespace    https://github.com/pixeltris/TwitchAdSolutions
// @version      1.21
// @updateURL    https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap-new/video-swap-new.user.js
// @downloadURL  https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap-new/video-swap-new.user.js
// @description  Multiple solutions for blocking Twitch ads (video-swap-new)
// @author       pixeltris
// @match        *://*.twitch.tv/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function() {
    'use strict';
    function declareOptions(scope) {
        // Options / globals
        scope.OPT_ROLLING_DEVICE_ID = false;
        scope.OPT_MODE_STRIP_AD_SEGMENTS = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_MIN_REQUESTS = false;
        scope.OPT_BACKUP_PLAYER_TYPE = 'autoplay';
        scope.OPT_BACKUP_PLATFORM = 'ios';
        scope.OPT_REGULAR_PLAYER_TYPE = 'site';
        scope.OPT_ACCESS_TOKEN_PLAYER_TYPE = null;
        scope.OPT_SHOW_AD_BANNER = true;
        scope.AD_SIGNIFIER = 'stitched-ad';
        scope.LIVE_SIGNIFIER = ',live';
        scope.CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
        // These are only really for Worker scope...
        scope.StreamInfos = [];
        scope.StreamInfosByUrl = [];
        scope.CurrentChannelNameFromM3U8 = null;
        // Need this in both scopes. Window scope needs to update this to worker scope.
        scope.gql_device_id = null;
        scope.gql_device_id_rolling = '';
        // Rolling device id crap... TODO: improve this
        var charTable = []; for (var i = 97; i <= 122; i++) { charTable.push(String.fromCharCode(i)); } for (var i = 65; i <= 90; i++) { charTable.push(String.fromCharCode(i)); } for (var i = 48; i <= 57; i++) { charTable.push(String.fromCharCode(i)); }
        var bs = 'eVI6jx47kJvCFfFowK86eVI6jx47kJvC';
        var di = (new Date()).getUTCFullYear() + (new Date()).getUTCMonth() + ((new Date()).getUTCDate() / 7) | 0;
        for (var i = 0; i < bs.length; i++) {
            scope.gql_device_id_rolling += charTable[(bs.charCodeAt(i) ^ di) % charTable.length];
        }
        scope.gql_device_id_rolling = '1';//temporary
        scope.ClientIntegrityHeader = null;
        scope.AuthorizationHeader = null;
    }
    declareOptions(window);
    var twitchMainWorker = null;
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
                ${processM3U8.toString()}
                ${hookWorkerFetch.toString()}
                ${declareOptions.toString()}
                ${getAccessToken.toString()}
                ${gqlRequest.toString()}
                ${makeGraphQlPacket.toString()}
                ${tryNotifyAdsWatchedM3U8.toString()}
                ${parseAttributes.toString()}
                ${onFoundAd.toString()}
                declareOptions(self);
                self.addEventListener('message', function(e) {
                    if (e.data.key == 'UboUpdateDeviceId') {
                        gql_device_id = e.data.value;
                    } else if (e.data.key == 'UpdateClientIntegrityHeader') {
                        ClientIntegrityHeader = e.data.value;
                    } else if (e.data.key == 'UpdateAuthorizationHeader') {
                        AuthorizationHeader = e.data.value;
                    }
                });
                hookWorkerFetch();
                importScripts('${jsURL}');
            `
            super(URL.createObjectURL(new Blob([newBlobStr])));
            twitchMainWorker = this;
            this.onmessage = function(e) {
                // NOTE: Removed adDiv caching as '.video-player' can change between streams?
                if (e.data.key == 'UboShowAdBanner') {
                    var adDiv = getAdDiv();
                    if (adDiv != null) {
                        adDiv.P.textContent = 'Blocking' + (e.data.isMidroll ? ' midroll' : '') + ' ads';
                        if (OPT_SHOW_AD_BANNER) {
                            adDiv.style.display = 'block';
                        }
                    }
                } else if (e.data.key == 'UboHideAdBanner') {
                    var adDiv = getAdDiv();
                    if (adDiv != null) {
                        adDiv.style.display = 'none';
                    }
                } else if (e.data.key == 'UboChannelNameM3U8Changed') {
                    //console.log('M3U8 channel name changed to ' + e.data.value);
                } else if (e.data.key == 'UboReloadPlayer') {
                    reloadTwitchPlayer();
                } else if (e.data.key == 'UboPauseResumePlayer') {
                    reloadTwitchPlayer(false, true);
                } else if (e.data.key == 'UboSeekPlayer') {
                    reloadTwitchPlayer(true);
                }
            }
            function getAdDiv() {
                var playerRootDiv = document.querySelector('.video-player');
                var adDiv = null;
                if (playerRootDiv != null) {
                    adDiv = playerRootDiv.querySelector('.ubo-overlay');
                    if (adDiv == null) {
                        adDiv = document.createElement('div');
                        adDiv.className = 'ubo-overlay';
                        adDiv.innerHTML = '<div class="player-ad-notice" style="color: white; background-color: rgba(0, 0, 0, 0.8); position: absolute; top: 0px; left: 0px; padding: 5px;"><p></p></div>';
                        adDiv.style.display = 'none';
                        adDiv.P = adDiv.querySelector('p');
                        playerRootDiv.appendChild(adDiv);
                    }
                }
                return adDiv;
            }
        }
    }
    function getWasmWorkerUrl(twitchBlobUrl) {
        var req = new XMLHttpRequest();
        req.open('GET', twitchBlobUrl, false);
        req.send();
        return req.responseText.split("'")[1];
    }
    function onFoundAd(streamInfo, textStr, reloadPlayer) {
        console.log('Found ads, switch to backup');
        streamInfo.UseBackupStream = true;
        streamInfo.IsMidroll = textStr.includes('"MIDROLL"') || textStr.includes('"midroll"');
        if (reloadPlayer) {
            postMessage({key:'UboReloadPlayer'});
        }
        postMessage({key:'UboShowAdBanner',isMidroll:streamInfo.IsMidroll});
    }
    async function processM3U8(url, textStr, realFetch) {
        var streamInfo = StreamInfosByUrl[url];
        if (streamInfo == null) {
            console.log('Unknown stream url ' + url);
            //postMessage({key:'UboHideAdBanner'});
            return textStr;
        }
        if (!OPT_MODE_STRIP_AD_SEGMENTS) {
            return textStr;
        }
        var haveAdTags = textStr.includes(AD_SIGNIFIER);
        if (streamInfo.UseBackupStream) {
            if (streamInfo.Encodings == null) {
                console.log('Found backup stream but not main stream?');
                streamInfo.UseBackupStream = false;
                postMessage({key:'UboReloadPlayer'});
                return '';
            } else {
                var streamM3u8Url = streamInfo.Encodings.match(/^https:.*\.m3u8$/m)[0];
                var streamM3u8Response = await realFetch(streamM3u8Url);
                if (streamM3u8Response.status == 200) {
                    var streamM3u8 = await streamM3u8Response.text();
                    if (streamM3u8 != null && !streamM3u8.includes(AD_SIGNIFIER)) {
                        console.log('No more ads on main stream. Triggering player reload to go back to main stream...');
                        streamInfo.UseBackupStream = false;
                        postMessage({key:'UboHideAdBanner'});
                        postMessage({key:'UboReloadPlayer'});
                    }
                }
            }
            if (streamInfo.BackupEncodings == null) {
                return '';
            }
        } else if (haveAdTags) {
            onFoundAd(streamInfo, textStr, true);
            return '';
        } else {
            postMessage({key:'UboHideAdBanner'});
        }
        return textStr;
    }
    function hookWorkerFetch() {
        console.log('hookWorkerFetch');
        var realFetch = fetch;
        fetch = async function(url, options) {
            if (typeof url === 'string') {
                url = url.trimEnd();
                if (url.endsWith('m3u8')) {
                    return new Promise(function(resolve, reject) {
                        var processAfter = async function(response) {
                            var str = await processM3U8(url, await response.text(), realFetch);
                            resolve(new Response(str));
                        };
                        var send = function() {
                            return realFetch(url, options).then(function(response) {
                                processAfter(response);
                            })['catch'](function(err) {
                                console.log('fetch hook err ' + err);
                                reject(err);
                            });
                        };
                        send();
                    });
                }
                else if (url.includes('/api/channel/hls/') && !url.includes('picture-by-picture')) {
                    var channelName = (new URL(url)).pathname.match(/([^\/]+)(?=\.\w+$)/)[0];
                    if (CurrentChannelNameFromM3U8 != channelName) {
                        postMessage({
                            key: 'UboChannelNameM3U8Changed',
                            value: channelName
                        });
                    }
                    CurrentChannelNameFromM3U8 = channelName;
                    if (OPT_MODE_STRIP_AD_SEGMENTS) {
                        return new Promise(async function(resolve, reject) {
                            // - First m3u8 request is the m3u8 with the video encodings (360p,480p,720p,etc).
                            // - Second m3u8 request is the m3u8 for the given encoding obtained in the first request. At this point we will know if there's ads.
                            var streamInfo = StreamInfos[channelName];
                            var useBackupStream = false;
                            if (streamInfo == null || streamInfo.Encodings == null || streamInfo.BackupEncodings == null) {
                                StreamInfos[channelName] = streamInfo = {
                                    Encodings: null,
                                    BackupEncodings: null,
                                    IsMidroll: false,
                                    UseBackupStream: false,
                                    ChannelName: channelName
                                };
                                for (var i = 0; i < 2; i++) {
                                    var encodingsUrl = url;
                                    if (i == 1) {
                                        var accessTokenResponse = await getAccessToken(channelName, OPT_BACKUP_PLAYER_TYPE, OPT_BACKUP_PLATFORM, realFetch);
                                        if (accessTokenResponse != null && accessTokenResponse.status === 200) {
                                            var accessToken = await accessTokenResponse.json();
                                            var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + channelName + '.m3u8' + (new URL(url)).search);
                                            urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                                            urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
                                            encodingsUrl = urlInfo.href;
                                        } else {
                                            resolve(accessTokenResponse);
                                            return;
                                        }
                                    }
                                    var encodingsM3u8Response = await realFetch(encodingsUrl, options);
                                    if (encodingsM3u8Response != null && encodingsM3u8Response.status === 200) {
                                        var encodingsM3u8 = await encodingsM3u8Response.text();
                                        if (i == 0) {
                                            streamInfo.Encodings = encodingsM3u8;
                                            var streamM3u8Url = encodingsM3u8.match(/^https:.*\.m3u8$/m)[0];
                                            var streamM3u8Response = await realFetch(streamM3u8Url);
                                            if (streamM3u8Response.status == 200) {
                                                var streamM3u8 = await streamM3u8Response.text();
                                                if (streamM3u8.includes(AD_SIGNIFIER)) {
                                                    onFoundAd(streamInfo, streamM3u8, false);
                                                }
                                            } else {
                                                resolve(streamM3u8Response);
                                                return;
                                            }
                                        } else {
                                            var lowResLines = encodingsM3u8.replace('\r', '').split('\n');
                                            var lowResBestUrl = null;
                                            for (var j = 0; j < lowResLines.length; j++) {
                                                if (lowResLines[j].startsWith('#EXT-X-STREAM-INF')) {
                                                    var res = parseAttributes(lowResLines[j])['RESOLUTION'];
                                                    if (res && lowResLines[j + 1].endsWith('.m3u8')) {
                                                        // Assumes resolutions are correctly ordered
                                                        lowResBestUrl = lowResLines[j + 1];
                                                        break;
                                                    }
                                                }
                                            }
                                            if (lowResBestUrl != null && streamInfo.Encodings != null) {
                                                var normalEncodingsM3u8 = streamInfo.Encodings;
                                                var normalLines = normalEncodingsM3u8.replace('\r', '').split('\n');
                                                for (var j = 0; j < normalLines.length - 1; j++) {
                                                    if (normalLines[j].startsWith('#EXT-X-STREAM-INF')) {
                                                        var res = parseAttributes(normalLines[j])['RESOLUTION'];
                                                        if (res) {
                                                            lowResBestUrl += ' ';// The stream doesn't load unless each url line is unique
                                                            normalLines[j + 1] = lowResBestUrl;
                                                        }
                                                    }
                                                }
                                                encodingsM3u8 = normalLines.join('\r\n');
                                            }
                                            streamInfo.BackupEncodings = encodingsM3u8;
                                        }
                                        var lines = encodingsM3u8.replace('\r', '').split('\n');
                                        for (var j = 0; j < lines.length; j++) {
                                            if (!lines[j].startsWith('#') && lines[j].includes('.m3u8')) {
                                                StreamInfosByUrl[lines[j].trimEnd()] = streamInfo;
                                            }
                                        }
                                    } else {
                                        resolve(encodingsM3u8Response);
                                        return;
                                    }
                                }
                            }
                            if (streamInfo.UseBackupStream) {
                                resolve(new Response(streamInfo.BackupEncodings));
                            } else {
                                resolve(new Response(streamInfo.Encodings));
                            }
                        });
                    }
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
    function getAccessToken(channelName, playerType, platform, realFetch) {
        if (!platform) {
            platform = 'web';
        }
        var body = null;
        var templateQuery = 'query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) {  streamPlaybackAccessToken(channelName: $login, params: {platform: "' + platform + '", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {    value    signature    __typename  }  videoPlaybackAccessToken(id: $vodID, params: {platform: "' + platform + '", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {    value    signature    __typename  }}';
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
        if (ClientIntegrityHeader == null) {
            console.warn('ClientIntegrityHeader is null');
            //throw 'ClientIntegrityHeader is null';
        }
        var fetchFunc = realFetch ? realFetch : fetch;
        return fetchFunc('https://gql.twitch.tv/gql', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Client-Id': CLIENT_ID,
                'Client-Integrity': ClientIntegrityHeader,
                'X-Device-Id': OPT_ROLLING_DEVICE_ID ? gql_device_id_rolling : gql_device_id,
                'Authorization': AuthorizationHeader
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
    async function tryNotifyAdsWatchedM3U8(streamM3u8) {
        try {
            //console.log(streamM3u8);
            if (!streamM3u8 || !streamM3u8.includes(AD_SIGNIFIER)) {
                return 1;
            }
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
                    if (OPT_MODE_NOTIFY_ADS_WATCHED_MIN_REQUESTS) {
                        // This is all that's actually required at the moment
                        await gqlRequest(makeGraphQlPacket('video_ad_pod_complete', radToken, baseData));
                    } else {
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
            }
            return 0;
        } catch (err) {
            console.log(err);
            return 0;
        }
    }
    function hookFetch() {
        var realFetch = window.fetch;
        window.fetch = function(url, init, ...args) {
            if (typeof url === 'string') {
                if (url.includes('gql')) {
                    var deviceId = init.headers['X-Device-Id'];
                    if (typeof deviceId !== 'string') {
                        deviceId = init.headers['Device-ID'];
                    }
                    if (typeof deviceId === 'string') {
                        gql_device_id = deviceId;
                    }
                    if (gql_device_id && twitchMainWorker) {
                        twitchMainWorker.postMessage({
                            key: 'UboUpdateDeviceId',
                            value: gql_device_id
                        });
                    }
                    if (typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                        if (OPT_ACCESS_TOKEN_PLAYER_TYPE) {
                            const newBody = JSON.parse(init.body);
                            if (Array.isArray(newBody)) {
                                for (let i = 0; i < newBody.length; i++) {
                                    newBody[i].variables.playerType = OPT_ACCESS_TOKEN_PLAYER_TYPE;
                                }
                            } else {
                                newBody.variables.playerType = OPT_ACCESS_TOKEN_PLAYER_TYPE;
                            }
                            init.body = JSON.stringify(newBody);
                        }
                        if (OPT_ROLLING_DEVICE_ID) {
                            if (typeof init.headers['X-Device-Id'] === 'string') {
                                init.headers['X-Device-Id'] = gql_device_id_rolling;
                            }
                            if (typeof init.headers['Device-ID'] === 'string') {
                                init.headers['Device-ID'] = gql_device_id_rolling;
                            }
                        }
                        if (typeof init.headers['Client-Integrity'] === 'string') {
                            ClientIntegrityHeader = init.headers['Client-Integrity'];
                            twitchMainWorker.postMessage({
                                key: 'UpdateClientIntegrityHeader',
                                value: init.headers['Client-Integrity']
                            });
                        }
                        if (typeof init.headers['Authorization'] === 'string') {
                            AuthorizationHeader = init.headers['Authorization'];
                            twitchMainWorker.postMessage({
                                key: 'UpdateAuthorizationHeader',
                                value: init.headers['Authorization']
                            });
                        }
                    }
                }
            }
            return realFetch.apply(this, arguments);
        };
    }
    function reloadTwitchPlayer(isSeek, isPausePlay) {
        // Taken from ttv-tools / ffz
        // https://github.com/Nerixyz/ttv-tools/blob/master/src/context/twitch-player.ts
        // https://github.com/FrankerFaceZ/FrankerFaceZ/blob/master/src/sites/twitch-twilight/modules/player.jsx
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
        if (!reactRootNode) {
            console.log('Could not find react root');
            return;
        }
        var player = findReactNode(reactRootNode, node => node.setPlayerActive && node.props && node.props.mediaPlayerInstance);
        player = player && player.props && player.props.mediaPlayerInstance ? player.props.mediaPlayerInstance : null;
        var playerState = findReactNode(reactRootNode, node => node.setSrc && node.setInitialPlaybackSettings);
        if (!player) {
            console.log('Could not find player');
            return;
        }
        if (!playerState) {
            console.log('Could not find player state');
            return;
        }
        if (player.paused) {
            return;
        }
        if (isSeek) {
            console.log('Force seek to reset player (hopefully fixing any audio desync) pos:' + player.getPosition() + ' range:' + JSON.stringify(player.getBuffered()));
            var pos = player.getPosition();
            player.seekTo(0);
            player.seekTo(pos);
            return;
        }
        if (isPausePlay) {
            player.pause();
            player.play();
            return;
        }
        const lsKeyQuality = 'video-quality';
        const lsKeyMuted = 'video-muted';
        const lsKeyVolume = 'volume';
        var currentQualityLS = localStorage.getItem(lsKeyQuality);
        var currentMutedLS = localStorage.getItem(lsKeyMuted);
        var currentVolumeLS = localStorage.getItem(lsKeyVolume);
        if (player?.core?.state) {
            localStorage.setItem(lsKeyMuted, JSON.stringify({default:player.core.state.muted}));
            localStorage.setItem(lsKeyVolume, player.core.state.volume);
        }
        if (player?.core?.state?.quality?.group) {
            localStorage.setItem(lsKeyQuality, JSON.stringify({default:player.core.state.quality.group}));
        }
        playerState.setSrc({ isNewMediaPlayerInstance: true, refreshAccessToken: true });
        setTimeout(() => {
            localStorage.setItem(lsKeyQuality, currentQualityLS);
            localStorage.setItem(lsKeyMuted, currentMutedLS);
            localStorage.setItem(lsKeyVolume, currentVolumeLS);
        }, 3000);
    }
    window.reloadTwitchPlayer = reloadTwitchPlayer;
    hookFetch();
    function onContentLoaded() {
        // This stops Twitch from pausing the player when in another tab and an ad shows.
        // Taken from https://github.com/saucettv/VideoAdBlockForTwitch/blob/cefce9d2b565769c77e3666ac8234c3acfe20d83/chrome/content.js#L30
        try {
            Object.defineProperty(document, 'visibilityState', {
                get() {
                    return 'visible';
                }
            });
        }catch{}
        try {
            Object.defineProperty(document, 'hidden', {
                get() {
                    return false;
                }
            });
        }catch{}
        var block = e => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };
        document.addEventListener('visibilitychange', block, true);
        document.addEventListener('webkitvisibilitychange', block, true);
        document.addEventListener('mozvisibilitychange', block, true);
        document.addEventListener('hasFocus', block, true);
        try {
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
        }catch{}
        // Hooks for preserving volume / resolution
        var keysToCache = [
            'video-quality',
            'video-muted',
            'volume',
            'lowLatencyModeEnabled',// Low Latency
            'persistenceEnabled',// Mini Player
        ];
        var cachedValues = new Map();
        for (var i = 0; i < keysToCache.length; i++) {
            cachedValues.set(keysToCache[i], localStorage.getItem(keysToCache[i]));
        }
        var realSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
            if (cachedValues.has(key)) {
                cachedValues.set(key, value);
            }
            realSetItem.apply(this, arguments);
        };
        var realGetItem = localStorage.getItem;
        localStorage.getItem = function(key) {
            if (cachedValues.has(key)) {
                return cachedValues.get(key);
            }
            return realGetItem.apply(this, arguments);
        };
    }
    if (document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive") {
        onContentLoaded();
    } else {
        window.addEventListener("DOMContentLoaded", function() {
            onContentLoaded();
        });
    }
})();