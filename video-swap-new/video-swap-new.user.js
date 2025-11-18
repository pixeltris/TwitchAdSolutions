// ==UserScript==
// @name         TwitchAdSolutions (video-swap-new)
// @namespace    https://github.com/pixeltris/TwitchAdSolutions
// @version      1.48
// @updateURL    https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap-new/video-swap-new.user.js
// @downloadURL  https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap-new/video-swap-new.user.js
// @description  Multiple solutions for blocking Twitch ads (video-swap-new)
// @author       pixeltris
// @match        *://*.twitch.tv/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==
(function() {
    'use strict';
    var ourTwitchAdSolutionsVersion = 16;// Used to prevent conflicts with outdated versions of the scripts
    if (typeof window.twitchAdSolutionsVersion !== 'undefined' && window.twitchAdSolutionsVersion >= ourTwitchAdSolutionsVersion) {
        console.log("skipping video-swap-new as there's another script active. ourVersion:" + ourTwitchAdSolutionsVersion + " activeVersion:" + window.twitchAdSolutionsVersion);
        window.twitchAdSolutionsVersion = ourTwitchAdSolutionsVersion;
        return;
    }
    window.twitchAdSolutionsVersion = ourTwitchAdSolutionsVersion;
    function declareOptions(scope) {
        // Options / globals
        scope.OPT_BACKUP_PLAYER_TYPES = [ 'autoplay', 'picture-by-picture', 'embed' ];
        scope.OPT_BACKUP_PLATFORM = 'android';
        scope.OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE = 'site';
        scope.OPT_DISABLE_MATURE_CONTENT_POPUP = false;// If true this avoids having to log in to watch age gated content
        scope.AD_SIGNIFIER = 'stitched-ad';
        scope.LIVE_SIGNIFIER = ',live';
        scope.CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
        // These are only really for Worker scope...
        scope.StreamInfos = [];
        scope.StreamInfosByUrl = [];
        // Need this in both scopes. Window scope needs to update this to worker scope.
        scope.gql_device_id = null;
        scope.ClientIntegrityHeader = null;
        scope.AuthorizationHeader = undefined;
        scope.SimulatedAdsDepth = 0;
        scope.V2API = false;
    }
    var localStorageHookFailed = false;
    var adBlockDiv = null;
    var twitchWorkers = [];
    var workerStringConflicts = [
        'twitch',
        'isVariantA'// TwitchNoSub
    ];
    var workerStringAllow = [];
    var workerStringReinsert = [
        'isVariantA',// TwitchNoSub (prior to (0.9))
        'besuper/',// TwitchNoSub (0.9)
        '${patch_url}'// TwitchNoSub (0.9.1)
    ];
    function getCleanWorker(worker) {
        var root = null;
        var parent = null;
        var proto = worker;
        while (proto) {
            var workerString = proto.toString();
            if (workerStringConflicts.some((x) => workerString.includes(x)) && !workerStringAllow.some((x) => workerString.includes(x))) {
                if (parent !== null) {
                    Object.setPrototypeOf(parent, Object.getPrototypeOf(proto));
                }
            } else {
                if (root === null) {
                    root = proto;
                }
                parent = proto;
            }
            proto = Object.getPrototypeOf(proto);
        }
        return root;
    }
    function getWorkersForReinsert(worker) {
        var result = [];
        var proto = worker;
        while (proto) {
            var workerString = proto.toString();
            if (workerStringReinsert.some((x) => workerString.includes(x))) {
                result.push(proto);
            } else {
            }
            proto = Object.getPrototypeOf(proto);
        }
        return result;
    }
    function reinsertWorkers(worker, reinsert) {
        var parent = worker;
        for (var i = 0; i < reinsert.length; i++) {
            Object.setPrototypeOf(reinsert[i], parent);
            parent = reinsert[i];
        }
        return parent;
    }
    function isValidWorker(worker) {
        var workerString = worker.toString();
        return !workerStringConflicts.some((x) => workerString.includes(x))
            || workerStringAllow.some((x) => workerString.includes(x))
            || workerStringReinsert.some((x) => workerString.includes(x));
    }
    function hookWindowWorker() {
        var reinsert = getWorkersForReinsert(window.Worker);
        var newWorker = class Worker extends getCleanWorker(window.Worker) {
            constructor(twitchBlobUrl, options) {
                var isTwitchWorker = false;
                try {
                    isTwitchWorker = new URL(twitchBlobUrl).origin.endsWith('.twitch.tv');
                } catch {}
                if (!isTwitchWorker) {
                    super(twitchBlobUrl, options);
                    return;
                }
                var newBlobStr = `
                    const pendingFetchRequests = new Map();
                    ${processM3U8.toString()}
                    ${hookWorkerFetch.toString()}
                    ${declareOptions.toString()}
                    ${getAccessToken.toString()}
                    ${gqlRequest.toString()}
                    ${parseAttributes.toString()}
                    ${setStreamInfoUrls.toString()}
                    ${onFoundAd.toString()}
                    ${getWasmWorkerJs.toString()}
                    ${getServerTimeFromM3u8.toString()}
                    ${replaceServerTimeInM3u8.toString()}
                    ${getStreamUrlForResolution.toString()}
                    var workerString = getWasmWorkerJs('${twitchBlobUrl.replaceAll("'", "%27")}');
                    declareOptions(self);
                    gql_device_id = ${gql_device_id ? "'" + gql_device_id + "'" : null};
                    AuthorizationHeader = ${AuthorizationHeader ? "'" + AuthorizationHeader + "'" : undefined};
                    ClientIntegrityHeader = ${ClientIntegrityHeader ? "'" + ClientIntegrityHeader + "'" : null};
                    self.addEventListener('message', function(e) {
                        if (e.data.key == 'UboUpdateDeviceId') {
                            gql_device_id = e.data.value;
                        } else if (e.data.key == 'UpdateClientIntegrityHeader') {
                            ClientIntegrityHeader = e.data.value;
                        } else if (e.data.key == 'UpdateAuthorizationHeader') {
                            AuthorizationHeader = e.data.value;
                        } else if (e.data.key == 'FetchResponse') {
                            const responseData = e.data.value;
                            if (pendingFetchRequests.has(responseData.id)) {
                                const { resolve, reject } = pendingFetchRequests.get(responseData.id);
                                pendingFetchRequests.delete(responseData.id);
                                if (responseData.error) {
                                    reject(new Error(responseData.error));
                                } else {
                                    // Create a Response object from the response data
                                    const response = new Response(responseData.body, {
                                        status: responseData.status,
                                        statusText: responseData.statusText,
                                        headers: responseData.headers
                                    });
                                    resolve(response);
                                }
                            }
                        } else if (e.data.key == 'SimulateAds') {
                            SimulatedAdsDepth = e.data.value;
                            console.log('SimulatedAdsDepth:' + SimulatedAdsDepth);
                        }
                    });
                    hookWorkerFetch();
                    eval(workerString);
                `
                super(URL.createObjectURL(new Blob([newBlobStr])), options);
                twitchWorkers.push(this);
                this.addEventListener('message', (e) => {
                    // NOTE: Removed adDiv caching as '.video-player' can change between streams?
                    if (e.data.key == 'UboShowAdBanner') {
                        if (adBlockDiv == null) {
                            adBlockDiv = getAdDiv();
                        }
                        if (adBlockDiv != null) {
                            adBlockDiv.P.textContent = 'Blocking' + (e.data.isMidroll ? ' midroll' : '') + ' ads';
                            adBlockDiv.style.display = 'block';
                        }
                    } else if (e.data.key == 'UboHideAdBanner') {
                        if (adBlockDiv == null) {
                            adBlockDiv = getAdDiv();
                        }
                        if (adBlockDiv != null) {
                            adBlockDiv.style.display = 'none';
                        }
                    } else if (e.data.key == 'UboReloadPlayer') {
                        reloadTwitchPlayer();
                    } else if (e.data.key == 'UboPauseResumePlayer') {
                        reloadTwitchPlayer(true);
                    }
                });
                this.addEventListener('message', async event => {
                    if (event.data.key == 'FetchRequest') {
                        const fetchRequest = event.data.value;
                        const responseData = await handleWorkerFetchRequest(fetchRequest);
                        this.postMessage({
                            key: 'FetchResponse',
                            value: responseData
                        });
                    }
                });
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
        var workerInstance = reinsertWorkers(newWorker, reinsert);
        Object.defineProperty(window, 'Worker', {
            get: function() {
                return workerInstance;
            },
            set: function(value) {
                if (isValidWorker(value)) {
                    workerInstance = value;
                } else {
                    console.log('Attempt to set twitch worker denied');
                }
            }
        });
    }
    function getWasmWorkerJs(twitchBlobUrl) {
        var req = new XMLHttpRequest();
        req.open('GET', twitchBlobUrl, false);
        req.overrideMimeType("text/javascript");
        req.send();
        return req.responseText;
    }
    function setStreamInfoUrls(streamInfo, encodingsM3u8) {
        var lines = encodingsM3u8.replace('\r', '').split('\n');
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i].startsWith('#') && lines[i].includes('.m3u8')) {
                StreamInfosByUrl[lines[i].trimEnd()] = streamInfo;
            }
            if (lines[i].startsWith('#EXT-X-STREAM-INF') && lines[i + 1].includes('.m3u8')) {
                var attributes = parseAttributes(lines[i]);
                var resolution = attributes['RESOLUTION'];
                if (resolution) {
                    var resolutionInfo = {
                        Resolution: resolution,
                        FrameRate: attributes['FRAME-RATE'],
                        Url: lines[i + 1]
                    };
                    streamInfo.Urls.set(lines[i + 1].trimEnd(), resolutionInfo);
                }
            }
        }
    }
    async function onFoundAd(streamInfo, textStr, reloadPlayer, realFetch, url, resolutionInfo) {
        var result = textStr;
        streamInfo.IsMidroll = textStr.includes('"MIDROLL"') || textStr.includes('"midroll"');
        var playerTypes = OPT_BACKUP_PLAYER_TYPES;
        if (streamInfo.BackupEncodingsStatus.size >= playerTypes.length) {
            return textStr;
        }
        if (streamInfo.BackupEncodings && !streamInfo.BackupEncodings.includes(url)) {
            var streamM3u8Url = getStreamUrlForResolution(streamInfo.BackupEncodings, resolutionInfo);
            var streamM3u8Response = await realFetch(streamM3u8Url);
            if (streamM3u8Response.status === 200) {
                return await streamM3u8Response.text();
            }
        }
        var backupPlayerTypeInfo = '';
        for (var i = 0; i < playerTypes.length; i++) {
            var playerType = playerTypes[i];
            if (!streamInfo.BackupEncodingsStatus.has(playerType)) {
                try {
                    var accessTokenResponse = await getAccessToken(streamInfo.ChannelName, playerType, OPT_BACKUP_PLATFORM);
                    if (accessTokenResponse != null && accessTokenResponse.status === 200) {
                        var accessToken = await accessTokenResponse.json();
                        var urlInfo = new URL('https://usher.ttvnw.net/api/' + (V2API ? 'v2/' : '') + 'channel/hls/' + streamInfo.ChannelName + '.m3u8' + streamInfo.UsherParams);
                        urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                        urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
                        var encodingsM3u8Response = await realFetch(urlInfo.href);
                        if (encodingsM3u8Response != null && encodingsM3u8Response.status === 200) {
                            var encodingsM3u8 = await encodingsM3u8Response.text();
                            var streamM3u8Url = getStreamUrlForResolution(encodingsM3u8, resolutionInfo);
                            var streamM3u8Response = await realFetch(streamM3u8Url);
                            if (streamM3u8Response.status === 200) {
                                var backTextStr = await streamM3u8Response.text();
                                if ((!backTextStr.includes(AD_SIGNIFIER) && (SimulatedAdsDepth == 0 || i >= SimulatedAdsDepth - 1)) || i >= playerTypes.length - 1) {
                                    result = backTextStr;
                                    backupPlayerTypeInfo = ' (' + playerType + ')';
                                    streamInfo.BackupEncodingsStatus.set(playerType, 1);
                                    streamInfo.BackupEncodingsPlayerTypeIndex = i;
                                    if (streamInfo.Encodings != null) {
                                        // Low resolution streams will reduce the number of resolutions in the UI. To fix this we merge the low res URLs into the main m3u8
                                        var normalEncodingsM3u8 = streamInfo.Encodings;
                                        var normalLines = normalEncodingsM3u8.replace('\r', '').split('\n');
                                        for (var j = 0; j < normalLines.length - 1; j++) {
                                            if (normalLines[j].startsWith('#EXT-X-STREAM-INF')) {
                                                var resSettings = parseAttributes(normalLines[j].substring(normalLines[j].indexOf(':') + 1));
                                                var lowResUrl = getStreamUrlForResolution(encodingsM3u8, streamInfo.Urls.get(normalLines[j + 1].trimEnd()));
                                                var lowResInf = encodingsM3u8.match(new RegExp(`^.*(?=\n.*${lowResUrl})`, 'm'))[0];
                                                var lowResSettings = parseAttributes(lowResInf.substring(lowResInf.indexOf(':') + 1));
                                                //console.log('map ' + resSettings['RESOLUTION'] + ' to ' + lowResSettings['RESOLUTION']);
                                                const codecsKey = 'CODECS';
                                                if (typeof resSettings[codecsKey] === 'string' && typeof lowResSettings[codecsKey] === 'string' &&
                                                    resSettings[codecsKey].length >= 3 && lowResSettings[codecsKey].length >= 3 &&
                                                    (resSettings[codecsKey].startsWith('hev') || resSettings[codecsKey].startsWith('hvc')) &&
                                                    resSettings[codecsKey].substring(0, 3) !== lowResSettings[codecsKey].substring(0, 3)
                                                ) {
                                                    console.log('swap ' + resSettings[codecsKey] + ' to ' + lowResSettings[codecsKey]);
                                                    normalLines[j] = normalLines[j].replace(/CODECS="[^"]+"/, `CODECS="${lowResSettings[codecsKey]}"`);
                                                    console.log(normalLines[j]);
                                                }
                                                normalLines[j + 1] = lowResUrl + ' '.repeat(j + 1);// The stream doesn't load unless each url line is unique
                                            }
                                        }
                                        encodingsM3u8 = normalLines.join('\n');
                                    }
                                    streamInfo.BackupEncodings = encodingsM3u8;
                                    setStreamInfoUrls(streamInfo, encodingsM3u8);
                                }
                            }
                        }
                    }
                } catch (err) { console.error(err); }
                if (streamInfo.BackupEncodingsStatus.get(playerType) === 1) {
                    break;
                } else {
                    streamInfo.BackupEncodingsStatus.set(playerType, 0);
                }
            }
        }
        console.log('Found ads, switch to backup' + backupPlayerTypeInfo);
        if (reloadPlayer) {
            postMessage({key:'UboReloadPlayer'});
        }
        postMessage({key:'UboShowAdBanner',isMidroll:streamInfo.IsMidroll});
        return result;
    }
    async function processM3U8(url, textStr, realFetch) {
        var streamInfo = StreamInfosByUrl[url];
        if (streamInfo == null) {
            //console.log('Unknown stream url ' + url);
            //postMessage({key:'UboHideAdBanner'});
            return textStr;
        }
        var currentResolution = streamInfo.Urls.get(url);
        if (!currentResolution) {
            return textStr;
        }
        var haveAdTags = textStr.includes(AD_SIGNIFIER);
        if (SimulatedAdsDepth > 0 && (!streamInfo.BackupEncodings || !streamInfo.BackupEncodings.includes(url) || SimulatedAdsDepth - 1 > streamInfo.BackupEncodingsPlayerTypeIndex)) {
            haveAdTags = true;
        }
        if (streamInfo.BackupEncodings) {
            var streamM3u8Url = streamInfo.Encodings.match(/^https:.*\.m3u8$/m)[0];
            var streamM3u8Response = await realFetch(streamM3u8Url);
            if (streamM3u8Response.status == 200) {
                var streamM3u8 = await streamM3u8Response.text();
                if (streamM3u8 != null) {
                    if (!streamM3u8.includes(AD_SIGNIFIER) && SimulatedAdsDepth == 0) {
                        console.log('No more ads on main stream. Triggering player reload to go back to main stream...');
                        streamInfo.IsMovingOffBackupEncodings = true;
                        streamInfo.BackupEncodings = null;
                        streamInfo.BackupEncodingsStatus.clear();
                        streamInfo.BackupEncodingsPlayerTypeIndex = -1;
                        postMessage({key:'UboHideAdBanner'});
                        postMessage({key:'UboReloadPlayer'});
                    } else if (!streamM3u8.includes('"MIDROLL"') && !streamM3u8.includes('"midroll"')) {
                        var lines = streamM3u8.replace('\r', '').split('\n');
                        for (var i = 0; i < lines.length; i++) {
                            var line = lines[i];
                            if (line.startsWith('#EXTINF') && lines.length > i + 1) {
                                if (!line.includes(LIVE_SIGNIFIER) && !streamInfo.RequestedAds.has(lines[i + 1])) {
                                    // Only request one .ts file per .m3u8 request to avoid making too many requests
                                    //console.log('Fetch ad .ts file');
                                    streamInfo.RequestedAds.add(lines[i + 1]);
                                    fetch(lines[i + 1]).then((response)=>{response.blob()});
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            if (streamInfo.BackupEncodings && haveAdTags) {
                textStr = await onFoundAd(streamInfo, textStr, true, realFetch, url, currentResolution);
            }
        } else if (haveAdTags && !streamInfo.IsMovingOffBackupEncodings) {
            textStr = await onFoundAd(streamInfo, textStr, true, realFetch, url, currentResolution);
        } else {
            postMessage({key:'UboHideAdBanner'});
        }
        return textStr;
    }
    function hookWorkerFetch() {
        console.log('hookWorkerFetch (video-swap-new)');
        var realFetch = fetch;
        fetch = async function(url, options) {
            if (typeof url === 'string') {
                url = url.trimEnd();
                if (url.endsWith('m3u8')) {
                    return new Promise(function(resolve, reject) {
                        var processAfter = async function(response) {
                            if (response.status === 200) {
                                var str = await processM3U8(url, await response.text(), realFetch);
                                resolve(new Response(str, {
                                    status: response.status,
                                    statusText: response.statusText,
                                    headers: response.headers
                                }));
                            } else {
                                resolve(response);
                            }
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
                else if (url.includes('/channel/hls/') && !url.includes('picture-by-picture')) {
                    V2API = url.includes('/api/v2/');
                    var channelName = (new URL(url)).pathname.match(/([^\/]+)(?=\.\w+$)/)[0];
                    if (OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE) {
                        // parent_domains is used to determine if the player is embeded and stripping it gets rid of fake ads
                        var tempUrl = new URL(url);
                        tempUrl.searchParams.delete('parent_domains');
                        url = tempUrl.toString();
                    }
                    return new Promise(async function(resolve, reject) {
                        // - First m3u8 request is the m3u8 with the video encodings (360p,480p,720p,etc).
                        // - Second m3u8 request is the m3u8 for the given encoding obtained in the first request. At this point we will know if there's ads.
                        var streamInfo = StreamInfos[channelName];
                        if (streamInfo != null && streamInfo.Encodings != null && (await realFetch(streamInfo.Encodings.match(/^https:.*\.m3u8$/m)[0])).status !== 200) {
                            // The cached encodings are dead (the stream probably restarted)
                            streamInfo = null;
                        }
                        var serverTime = null;
                        if (streamInfo == null || streamInfo.Encodings == null) {
                            StreamInfos[channelName] = streamInfo = {
                                RequestedAds: new Set(),
                                Encodings: null,
                                BackupEncodings: null,
                                BackupEncodingsStatus: new Map(),
                                BackupEncodingsPlayerTypeIndex: -1,
                                IsMovingOffBackupEncodings: false,
                                IsMidroll: false,
                                UseFallbackStream: false,
                                ChannelName: channelName,
                                UsherParams: (new URL(url)).search,
                                Urls: new Map(),
                            };
                            var encodingsM3u8Response = await realFetch(url, options);
                            if (encodingsM3u8Response != null && encodingsM3u8Response.status === 200) {
                                var encodingsM3u8 = await encodingsM3u8Response.text();
                                streamInfo.Encodings = encodingsM3u8;
                                setStreamInfoUrls(streamInfo, encodingsM3u8);
                                serverTime = getServerTimeFromM3u8(encodingsM3u8);
                                var resolutionInfo = streamInfo.Urls.values().next().value;
                                var streamM3u8Response = await realFetch(resolutionInfo.Url);
                                if (streamM3u8Response.status == 200) {
                                    var streamM3u8 = await streamM3u8Response.text();
                                    if (streamM3u8.includes(AD_SIGNIFIER) || SimulatedAdsDepth > 0) {
                                        await onFoundAd(streamInfo, streamM3u8, false, realFetch, resolutionInfo.Url, resolutionInfo);
                                    }
                                } else {
                                    resolve(streamM3u8Response);
                                    return;
                                }
                            } else {
                                resolve(encodingsM3u8Response);
                                return;
                            }
                        }
                        if (!serverTime) {
                            var encodingsM3u8Response = await realFetch(url, options);
                            if (encodingsM3u8Response != null && encodingsM3u8Response.status === 200) {
                                serverTime = getServerTimeFromM3u8(await encodingsM3u8Response.text());
                            }
                        }
                        streamInfo.IsMovingOffBackupEncodings = false;
                        resolve(new Response(replaceServerTimeInM3u8(streamInfo.BackupEncodings ? streamInfo.BackupEncodings : streamInfo.Encodings, serverTime)));
                    });
                }
            }
            return realFetch.apply(this, arguments);
        }
    }
    function getServerTimeFromM3u8(encodingsM3u8) {
        if (V2API) {
            var matches = encodingsM3u8.match(/#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE="([^"]+)"/);
            return matches.length > 1 ? matches[1] : null;
        }
        var matches = encodingsM3u8.match('SERVER-TIME="([0-9.]+)"');
        return matches.length > 1 ? matches[1] : null;
    }
    function replaceServerTimeInM3u8(encodingsM3u8, newServerTime) {
        if (V2API) {
            return newServerTime ? encodingsM3u8.replace(/(#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE=")[^"]+(")/, `$1${newServerTime}$2`) : encodingsM3u8;
        }
        return newServerTime ? encodingsM3u8.replace(new RegExp('(SERVER-TIME=")[0-9.]+"'), `SERVER-TIME="${newServerTime}"`) : encodingsM3u8;
    }
    function getStreamUrlForResolution(encodingsM3u8, resolutionInfo) {
        var encodingsLines = encodingsM3u8.replace('\r', '').split('\n');
        const [targetWidth, targetHeight] = resolutionInfo.Resolution.split('x').map(Number);
        var matchedResolutionUrl = null;
        var matchedFrameRate = false;
        var closestResolutionUrl = null;
        var closestResolutionDifference = Infinity;
        for (var i = 0; i < encodingsLines.length - 1; i++) {
            if (encodingsLines[i].startsWith('#EXT-X-STREAM-INF') && encodingsLines[i + 1].includes('.m3u8')) {
                var attributes = parseAttributes(encodingsLines[i]);
                var resolution = attributes['RESOLUTION'];
                var frameRate = attributes['FRAME-RATE'];
                if (resolution) {
                    if (resolution == resolutionInfo.Resolution && (!matchedResolutionUrl || (!matchedFrameRate && frameRate == resolutionInfo.FrameRate))) {
                        matchedResolutionUrl = encodingsLines[i + 1];
                        matchedFrameRate = frameRate == resolutionInfo.FrameRate;
                        if (matchedFrameRate) {
                            return matchedResolutionUrl.trimEnd();
                        }
                    }
                    const [width, height] = resolution.split('x').map(Number);
                    var difference = Math.abs((width * height) - (targetWidth * targetHeight));
                    if (difference < closestResolutionDifference) {
                        closestResolutionUrl = encodingsLines[i + 1];
                        closestResolutionDifference = difference;
                    }
                }
            }
        }
        return closestResolutionUrl.trimEnd();
    }
    function getAccessToken(channelName, playerType, platform) {
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
        return gqlRequest(body, playerType);
    }
    function gqlRequest(body, playerType) {
        if (!gql_device_id) {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            for (let i = 0; i < 32; i += 1) {
                gql_device_id += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }
        var headers = {
            'Client-Id': CLIENT_ID,
            'Device-ID': gql_device_id,
            'X-Device-Id': gql_device_id,
            'Authorization': AuthorizationHeader,
            ...(ClientIntegrityHeader && {'Client-Integrity': ClientIntegrityHeader})
        };
        if (playerType != 'site') {
            headers = {
                'Client-Id': CLIENT_ID,
                'X-Device-Id': gql_device_id
            };
        }
        return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).substring(2, 15);
            const fetchRequest = {
                id: requestId,
                url: 'https://gql.twitch.tv/gql',
                options: {
                    method: 'POST',
                    body: JSON.stringify(body),
                    headers
                }
            };
            pendingFetchRequests.set(requestId, {
                resolve,
                reject
            });
            postMessage({
                key: 'FetchRequest',
                value: fetchRequest
            });
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
    function postTwitchWorkerMessage(key, value) {
        twitchWorkers.forEach((worker) => {
            worker.postMessage({key: key, value: value});
        });
    }
    async function handleWorkerFetchRequest(fetchRequest) {
        try {
            const response = await window.realFetch(fetchRequest.url, fetchRequest.options);
            const responseBody = await response.text();
            const responseObject = {
                id: fetchRequest.id,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseBody
            };
            return responseObject;
        } catch (error) {
            return {
                id: fetchRequest.id,
                error: error.message
            };
        }
    }
    function hookFetch() {
        var realFetch = window.fetch;
        window.realFetch = realFetch;
        window.fetch = function(url, init, ...args) {
            if (typeof url === 'string') {
                if (url.includes('gql')) {
                    var deviceId = init.headers['X-Device-Id'];
                    if (typeof deviceId !== 'string') {
                        deviceId = init.headers['Device-ID'];
                    }
                    if (typeof deviceId === 'string' && gql_device_id != deviceId) {
                        gql_device_id = deviceId;
                        postTwitchWorkerMessage('UboUpdateDeviceId', gql_device_id);
                    }
                    if (typeof init.headers['Client-Integrity'] === 'string' && init.headers['Client-Integrity'] !== ClientIntegrityHeader) {
                        postTwitchWorkerMessage('UpdateClientIntegrityHeader', ClientIntegrityHeader = init.headers['Client-Integrity']);
                    }
                    if (typeof init.headers['Authorization'] === 'string' && init.headers['Authorization'] !== AuthorizationHeader) {
                        postTwitchWorkerMessage('UpdateAuthorizationHeader', AuthorizationHeader = init.headers['Authorization']);
                    }
                    if (OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken') && !init.body.includes('picture-by-picture') && !init.body.includes('frontpage')) {
                        let replacedPlayerType = '';
                        const newBody = JSON.parse(init.body);
                        if (Array.isArray(newBody)) {
                            for (let i = 0; i < newBody.length; i++) {
                                if (newBody[i]?.variables?.playerType && newBody[i]?.variables?.playerType !== OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE) {
                                    replacedPlayerType = newBody[i].variables.playerType;
                                    newBody[i].variables.playerType = OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE;
                                }
                            }
                        } else {
                            if (newBody?.variables?.playerType && newBody?.variables?.playerType !== OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE) {
                                replacedPlayerType = newBody.variables.playerType;
                                newBody.variables.playerType = OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE;
                            }
                        }
                        if (replacedPlayerType) {
                            console.log(`Replaced '${replacedPlayerType}' player type with '${OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE}' player type`);
                            init.body = JSON.stringify(newBody);
                        }
                    }
                    if (OPT_DISABLE_MATURE_CONTENT_POPUP) {
                        const newBody2 = JSON.parse(init.body);
                        if (Array.isArray(newBody2)) {
                            var hasRemovedClassification = false;
                            for (let i = 0; i < newBody2.length; i++) {
                                if (newBody2[i]?.operationName == 'ContentClassificationContext') {
                                    hasRemovedClassification = true;
                                    // Doesn't seem like it if we remove this element from the array so instead we duplicate another entry into this index. TODO: Find out why
                                    newBody2[i] = newBody2[i == 0 && newBody2.length > 1 ? 1 : 0];
                                }
                            }
                            if (hasRemovedClassification) {
                                init.body = JSON.stringify(newBody2);
                            }
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
        function findReactRootNode() {
            var reactRootNode = null;
            var rootNode = document.querySelector('#root');
            if (rootNode && rootNode._reactRootContainer && rootNode._reactRootContainer._internalRoot && rootNode._reactRootContainer._internalRoot.current) {
                reactRootNode = rootNode._reactRootContainer._internalRoot.current;
            }
            if (reactRootNode == null) {
                var containerName = Object.keys(rootNode).find(x => x.startsWith('__reactContainer'));
                if (containerName != null) {
                    reactRootNode = rootNode[containerName];
                }
            }
            return reactRootNode;
        }
        var reactRootNode = findReactRootNode();
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
        if (player.paused || player.core?.paused) {
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
        var currentQualityLS = null;
        var currentMutedLS = null;
        var currentVolumeLS = null;
        try {
            currentQualityLS = localStorage.getItem(lsKeyQuality);
            currentMutedLS = localStorage.getItem(lsKeyMuted);
            currentVolumeLS = localStorage.getItem(lsKeyVolume);
            if (localStorageHookFailed && player?.core?.state) {
                localStorage.setItem(lsKeyMuted, JSON.stringify({default:player.core.state.muted}));
                localStorage.setItem(lsKeyVolume, player.core.state.volume);
            }
            if (localStorageHookFailed && player?.core?.state?.quality?.group) {
                localStorage.setItem(lsKeyQuality, JSON.stringify({default:player.core.state.quality.group}));
            }
        } catch {}
        playerState.setSrc({ isNewMediaPlayerInstance: true, refreshAccessToken: true });
        player.play();
        if (localStorageHookFailed && (currentQualityLS || currentMutedLS || currentVolumeLS)) {
            setTimeout(() => {
                try {
                    if (currentQualityLS) {
                        localStorage.setItem(lsKeyQuality, currentQualityLS);
                    }
                    if (currentMutedLS) {
                        localStorage.setItem(lsKeyMuted, currentMutedLS);
                    }
                    if (currentVolumeLS) {
                        localStorage.setItem(lsKeyVolume, currentVolumeLS);
                    }
                } catch {}
            }, 3000);
        }
    }
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
        let hidden = document.__lookupGetter__('hidden');
        let webkitHidden = document.__lookupGetter__('webkitHidden');
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
        let wasVideoPlaying = true;
        var visibilityChange = e => {
            if (typeof chrome !== 'undefined') {
                const videos = document.getElementsByTagName('video');
                if (videos.length > 0) {
                    if (hidden.apply(document) === true || (webkitHidden && webkitHidden.apply(document) === true)) {
                        wasVideoPlaying = !videos[0].paused && !videos[0].ended;
                    } else if (wasVideoPlaying && !videos[0].ended && videos[0].paused && videos[0].muted) {
                        videos[0].play();
                    }
                }
            }
            block(e);
        };
        document.addEventListener('visibilitychange', visibilityChange, true);
        document.addEventListener('webkitvisibilitychange', visibilityChange, true);
        document.addEventListener('mozvisibilitychange', visibilityChange, true);
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
        try {
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
            if (!localStorage.getItem.toString().includes(Object.keys({cachedValues})[0])) {
                // These hooks are useful to preserve player state on player reload
                // Firefox doesn't allow hooking of localStorage functions but chrome does
                localStorageHookFailed = true;
            }
        } catch (err) {
            console.log('localStorageHooks failed ' + err)
            localStorageHookFailed = true;
        }
    }
    window.reloadTwitchPlayer = reloadTwitchPlayer;
    declareOptions(window);
    hookWindowWorker();
    hookFetch();
    if (document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive") {
        onContentLoaded();
    } else {
        window.addEventListener("DOMContentLoaded", function() {
            onContentLoaded();
        });
    }
    window.simulateAds = (depth) => {
        if (depth === undefined || depth < 0) {
            console.log('Ad depth paramter required (0 = no simulated ad, 1+ = use backup player for given depth)');
            return;
        }
        postTwitchWorkerMessage('SimulateAds', depth);
    };
})();