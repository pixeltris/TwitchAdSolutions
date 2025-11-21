// ==UserScript==
// @name         TwitchAdSolutions (video-swap-new)
// @namespace    https://github.com/pixeltris/TwitchAdSolutions
// @version      1.50
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
    const ourTwitchAdSolutionsVersion = 18;// Used to prevent conflicts with outdated versions of the scripts
    if (typeof window.twitchAdSolutionsVersion !== 'undefined' && window.twitchAdSolutionsVersion >= ourTwitchAdSolutionsVersion) {
        console.log("skipping video-swap-new as there's another script active. ourVersion:" + ourTwitchAdSolutionsVersion + " activeVersion:" + window.twitchAdSolutionsVersion);
        window.twitchAdSolutionsVersion = ourTwitchAdSolutionsVersion;
        return;
    }
    window.twitchAdSolutionsVersion = ourTwitchAdSolutionsVersion;
    function declareOptions(scope) {
        // Options / globals
        scope.OPT_BACKUP_PLAYER_TYPES = [ 'autoplay', 'picture-by-picture', 'autoplay-ALT', 'embed' ];
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
        scope.IsAdStrippingEnabled = true;
        scope.AdSegmentCache = new Map();
        scope.AllSegmentsAreAdSegments = false;
    }
    let twitchPlayerAndState = null;
    let localStorageHookFailed = false;
    const twitchWorkers = [];
    const workerStringConflicts = [
        'twitch',
        'isVariantA'// TwitchNoSub
    ];
    const workerStringAllow = [];
    const workerStringReinsert = [
        'isVariantA',// TwitchNoSub (prior to (0.9))
        'besuper/',// TwitchNoSub (0.9)
        '${patch_url}'// TwitchNoSub (0.9.1)
    ];
    function getCleanWorker(worker) {
        let root = null;
        let parent = null;
        let proto = worker;
        while (proto) {
            const workerString = proto.toString();
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
        const result = [];
        let proto = worker;
        while (proto) {
            const workerString = proto.toString();
            if (workerStringReinsert.some((x) => workerString.includes(x))) {
                result.push(proto);
            } else {
            }
            proto = Object.getPrototypeOf(proto);
        }
        return result;
    }
    function reinsertWorkers(worker, reinsert) {
        let parent = worker;
        for (let i = 0; i < reinsert.length; i++) {
            Object.setPrototypeOf(reinsert[i], parent);
            parent = reinsert[i];
        }
        return parent;
    }
    function isValidWorker(worker) {
        const workerString = worker.toString();
        return !workerStringConflicts.some((x) => workerString.includes(x))
            || workerStringAllow.some((x) => workerString.includes(x))
            || workerStringReinsert.some((x) => workerString.includes(x));
    }
    function hookWindowWorker() {
        const reinsert = getWorkersForReinsert(window.Worker);
        const newWorker = class Worker extends getCleanWorker(window.Worker) {
            constructor(twitchBlobUrl, options) {
                let isTwitchWorker = false;
                try {
                    isTwitchWorker = new URL(twitchBlobUrl).origin.endsWith('.twitch.tv');
                } catch {}
                if (!isTwitchWorker) {
                    super(twitchBlobUrl, options);
                    return;
                }
                const newBlobStr = `
                    const pendingFetchRequests = new Map();
                    ${stripAdSegments.toString()}
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
                    ${updateAdblockBannerForStream.toString()}
                    const workerString = getWasmWorkerJs('${twitchBlobUrl.replaceAll("'", "%27")}');
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
                            console.log('SimulatedAdsDepth: ' + SimulatedAdsDepth);
                        } else if (e.data.key == 'AllSegmentsAreAdSegments') {
                            AllSegmentsAreAdSegments = !AllSegmentsAreAdSegments;
                            console.log('AllSegmentsAreAdSegments: ' + AllSegmentsAreAdSegments);
                        }
                    });
                    hookWorkerFetch();
                    eval(workerString);
                `
                super(URL.createObjectURL(new Blob([newBlobStr])), options);
                twitchWorkers.push(this);
                this.addEventListener('message', (e) => {
                    if (e.data.key == 'UboUpdateAdBanner') {
                        updateAdblockBanner(e.data);
                    } else if (e.data.key == 'UboReloadPlayer') {
                        reloadTwitchPlayer(false);
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
            }
        }
        let workerInstance = reinsertWorkers(newWorker, reinsert);
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
        const req = new XMLHttpRequest();
        req.open('GET', twitchBlobUrl, false);
        req.overrideMimeType("text/javascript");
        req.send();
        return req.responseText;
    }
    function setStreamInfoUrls(streamInfo, encodingsM3u8) {
        const lines = encodingsM3u8.replaceAll('\r', '').split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].startsWith('#') && lines[i].includes('.m3u8')) {
                StreamInfosByUrl[lines[i].trimEnd()] = streamInfo;
            }
            if (lines[i].startsWith('#EXT-X-STREAM-INF') && lines[i + 1].includes('.m3u8')) {
                const attributes = parseAttributes(lines[i]);
                const resolution = attributes['RESOLUTION'];
                if (resolution) {
                    const resolutionInfo = {
                        Resolution: resolution,
                        FrameRate: attributes['FRAME-RATE'],
                        Url: lines[i + 1]
                    };
                    streamInfo.Urls.set(lines[i + 1].trimEnd(), resolutionInfo);
                }
            }
        }
    }
    function updateAdblockBannerForStream(streamInfo) {
        const isShowingAd = !!streamInfo.BackupEncodings;
        if (!isShowingAd && (streamInfo.IsStrippingAdSegments || streamInfo.NumStrippedAdSegments > 0)) {
            streamInfo.IsStrippingAdSegments = false;
            streamInfo.NumStrippedAdSegments = 0;
        }
        postMessage({
            key: 'UboUpdateAdBanner',
            isMidroll: streamInfo.IsMidroll,
            hasAds: isShowingAd,
            isStrippingAdSegments: streamInfo.IsStrippingAdSegments,
            numStrippedAdSegments: streamInfo.NumStrippedAdSegments
        });
    }
    async function onFoundAd(streamInfo, textStr, reloadPlayer, realFetch, url, resolutionInfo) {
        let result = textStr;
        streamInfo.IsMidroll = textStr.includes('"MIDROLL"') || textStr.includes('"midroll"');
        const playerTypes = OPT_BACKUP_PLAYER_TYPES;
        if (streamInfo.BackupEncodingsStatus.size >= playerTypes.length) {
            return textStr;
        }
        if (streamInfo.BackupEncodings && !streamInfo.BackupEncodings.includes(url)) {
            const streamM3u8Url = getStreamUrlForResolution(streamInfo.BackupEncodings, resolutionInfo);
            const streamM3u8Response = await realFetch(streamM3u8Url);
            if (streamM3u8Response.status === 200) {
                return await streamM3u8Response.text();
            }
        }
        let backupPlayerTypeInfo = '';
        for (let i = 0; i < playerTypes.length; i++) {
            const playerType = playerTypes[i];
            if (!streamInfo.BackupEncodingsStatus.has(playerType)) {
                try {
                    const accessTokenResponse = await getAccessToken(streamInfo.ChannelName, playerType);
                    if (accessTokenResponse != null && accessTokenResponse.status === 200) {
                        const accessToken = await accessTokenResponse.json();
                        const urlInfo = new URL('https://usher.ttvnw.net/api/' + (V2API ? 'v2/' : '') + 'channel/hls/' + streamInfo.ChannelName + '.m3u8' + streamInfo.UsherParams);
                        urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                        urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
                        const encodingsM3u8Response = await realFetch(urlInfo.href);
                        if (encodingsM3u8Response != null && encodingsM3u8Response.status === 200) {
                            let encodingsM3u8 = await encodingsM3u8Response.text();
                            const streamM3u8Url = getStreamUrlForResolution(encodingsM3u8, resolutionInfo);
                            const streamM3u8Response = await realFetch(streamM3u8Url);
                            if (streamM3u8Response.status === 200) {
                                const backTextStr = await streamM3u8Response.text();
                                if ((!backTextStr.includes(AD_SIGNIFIER) && (SimulatedAdsDepth == 0 || i >= SimulatedAdsDepth - 1)) || i >= playerTypes.length - 1) {
                                    result = backTextStr;
                                    backupPlayerTypeInfo = ' (' + playerType + ')';
                                    streamInfo.BackupEncodingsStatus.set(playerType, 1);
                                    streamInfo.BackupEncodingsPlayerTypeIndex = i;
                                    if (streamInfo.Encodings != null) {
                                        // Low resolution streams will reduce the number of resolutions in the UI. To fix this we merge the low res URLs into the main m3u8
                                        const normalEncodingsM3u8 = streamInfo.Encodings;
                                        const normalLines = normalEncodingsM3u8.replaceAll('\r', '').split('\n');
                                        for (let j = 0; j < normalLines.length - 1; j++) {
                                            if (normalLines[j].startsWith('#EXT-X-STREAM-INF')) {
                                                const resSettings = parseAttributes(normalLines[j].substring(normalLines[j].indexOf(':') + 1));
                                                const lowResUrl = getStreamUrlForResolution(encodingsM3u8, streamInfo.Urls.get(normalLines[j + 1].trimEnd()));
                                                const lowResInf = encodingsM3u8.match(new RegExp(`^.*(?=\n.*${lowResUrl})`, 'm'))[0];
                                                const lowResSettings = parseAttributes(lowResInf.substring(lowResInf.indexOf(':') + 1));
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
        updateAdblockBannerForStream(streamInfo);
        return result;
    }
    function stripAdSegments(textStr, stripAllSegments, streamInfo) {
        let hasStrippedAdSegments = false;
        const lines = textStr.replaceAll('\r', '').split('\n');
        const newAdUrl = 'https://twitch.tv';
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            // Remove tracking urls which appear in the overlay UI
            line = line
                .replaceAll(/(X-TV-TWITCH-AD-URL=")(?:[^"]*)(")/g, `$1${newAdUrl}$2`)
                .replaceAll(/(X-TV-TWITCH-AD-CLICK-TRACKING-URL=")(?:[^"]*)(")/g, `$1${newAdUrl}$2`);
            if (i < lines.length - 1 && line.startsWith('#EXTINF') && (!line.includes(',live') || stripAllSegments || AllSegmentsAreAdSegments)) {
                const segmentUrl = lines[i + 1];
                if (!AdSegmentCache.has(segmentUrl)) {
                    streamInfo.NumStrippedAdSegments++;
                }
                AdSegmentCache.set(segmentUrl, Date.now());
                hasStrippedAdSegments = true;
            }
            if (line.includes(AD_SIGNIFIER)) {
                hasStrippedAdSegments = true;
            }
        }
        if (hasStrippedAdSegments) {
            for (let i = 0; i < lines.length; i++) {
                // No low latency during ads (otherwise it's possible for the player to prefetch and display ad segments)
                if (lines[i].startsWith('#EXT-X-TWITCH-PREFETCH:')) {
                    lines[i] = '';
                }
            }
        } else {
            streamInfo.NumStrippedAdSegments = 0;
        }
        streamInfo.IsStrippingAdSegments = hasStrippedAdSegments;
        AdSegmentCache.forEach((key, value, map) => {
            if (value < Date.now() - 120000) {
                map.delete(key);
            }
        });
        return lines.join('\n');
    }
    async function processM3U8(url, textStr, realFetch) {
        const streamInfo = StreamInfosByUrl[url];
        if (!streamInfo) {
            return textStr;
        }
        const currentResolution = streamInfo.Urls.get(url);
        if (!currentResolution) {
            return textStr;
        }
        const haveAdTags = textStr.includes(AD_SIGNIFIER) || (SimulatedAdsDepth > 0 && (!streamInfo.BackupEncodings || !streamInfo.BackupEncodings.includes(url) || SimulatedAdsDepth - 1 > streamInfo.BackupEncodingsPlayerTypeIndex));
        if (streamInfo.BackupEncodings) {
            const streamM3u8Url = streamInfo.Encodings.match(/^https:.*\.m3u8$/m)[0];
            const streamM3u8Response = await realFetch(streamM3u8Url);
            if (streamM3u8Response.status == 200) {
                const streamM3u8 = await streamM3u8Response.text();
                if (streamM3u8 != null) {
                    if (!streamM3u8.includes(AD_SIGNIFIER) && SimulatedAdsDepth == 0) {
                        console.log('No more ads on main stream. Triggering player reload to go back to main stream...');
                        streamInfo.IsMovingOffBackupEncodings = true;
                        streamInfo.BackupEncodings = null;
                        streamInfo.BackupEncodingsStatus.clear();
                        streamInfo.BackupEncodingsPlayerTypeIndex = -1;
                        postMessage({key:'UboReloadPlayer'});
                    } else if (!streamM3u8.includes('"MIDROLL"') && !streamM3u8.includes('"midroll"')) {
                        const lines = streamM3u8.replaceAll('\r', '').split('\n');
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i];
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
        }
        if (IsAdStrippingEnabled) {
            textStr = stripAdSegments(textStr, false, streamInfo);
        }
        updateAdblockBannerForStream(streamInfo);
        return textStr;
    }
    function hookWorkerFetch() {
        console.log('hookWorkerFetch (video-swap-new)');
        const realFetch = fetch;
        fetch = async function(url, options) {
            if (typeof url === 'string') {
                if (AdSegmentCache.has(url)) {
                    return new Promise(function(resolve, reject) {
                        const send = function() {
                            return realFetch('data:video/mp4;base64,AAAAKGZ0eXBtcDQyAAAAAWlzb21tcDQyZGFzaGF2YzFpc282aGxzZgAABEltb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAYagAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAABqHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAURtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAALuAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAADvbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAACzc3RibAAAAGdzdHNkAAAAAAAAAAEAAABXbXA0YQAAAAAAAAABAAAAAAAAAAAAAgAQAAAAALuAAAAAAAAzZXNkcwAAAAADgICAIgABAASAgIAUQBUAAAAAAAAAAAAAAAWAgIACEZAGgICAAQIAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAeV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAoAAAAFoAAAAAAGBbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAA9CQAAAAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABLG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAOxzdGJsAAAAoHN0c2QAAAAAAAAAAQAAAJBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAoABaABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAOmF2Y0MBTUAe/+EAI2dNQB6WUoFAX/LgLUBAQFAAAD6AAA6mDgAAHoQAA9CW7y4KAQAEaOuPIAAAABBzdHRzAAAAAAAAAAAAAAAQc3RzYwAAAAAAAAAAAAAAFHN0c3oAAAAAAAAAAAAAAAAAAAAQc3RjbwAAAAAAAAAAAAAASG12ZXgAAAAgdHJleAAAAAAAAAABAAAAAQAAAC4AAAAAAoAAAAAAACB0cmV4AAAAAAAAAAIAAAABAACCNQAAAAACQAAA', options).then(function(response) {
                                resolve(response);
                            })['catch'](function(err) {
                                reject(err);
                            });
                        };
                        send();
                    });
                }
                url = url.trimEnd();
                if (url.endsWith('m3u8')) {
                    return new Promise(function(resolve, reject) {
                        const processAfter = async function(response) {
                            if (response.status === 200) {
                                const str = await processM3U8(url, await response.text(), realFetch);
                                resolve(new Response(str, {
                                    status: response.status,
                                    statusText: response.statusText,
                                    headers: response.headers
                                }));
                            } else {
                                resolve(response);
                            }
                        };
                        const send = function() {
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
                    const channelName = (new URL(url)).pathname.match(/([^\/]+)(?=\.\w+$)/)[0];
                    if (OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE) {
                        // parent_domains is used to determine if the player is embeded and stripping it gets rid of fake ads
                        const tempUrl = new URL(url);
                        tempUrl.searchParams.delete('parent_domains');
                        url = tempUrl.toString();
                    }
                    return new Promise(async function(resolve, reject) {
                        // - First m3u8 request is the m3u8 with the video encodings (360p,480p,720p,etc).
                        // - Second m3u8 request is the m3u8 for the given encoding obtained in the first request. At this point we will know if there's ads.
                        let streamInfo = StreamInfos[channelName];
                        if (streamInfo != null && streamInfo.Encodings != null && (await realFetch(streamInfo.Encodings.match(/^https:.*\.m3u8$/m)[0])).status !== 200) {
                            // The cached encodings are dead (the stream probably restarted)
                            streamInfo = null;
                        }
                        let serverTime = null;
                        if (streamInfo == null || streamInfo.Encodings == null) {
                            StreamInfos[channelName] = streamInfo = {
                                RequestedAds: new Set(),
                                Encodings: null,
                                BackupEncodings: null,
                                BackupEncodingsStatus: new Map(),
                                BackupEncodingsPlayerTypeIndex: -1,
                                IsMovingOffBackupEncodings: false,
                                IsMidroll: false,
                                IsStrippingAdSegments: false,
                                NumStrippedAdSegments: 0,
                                UseFallbackStream: false,
                                ChannelName: channelName,
                                UsherParams: (new URL(url)).search,
                                Urls: new Map(),
                            };
                            const encodingsM3u8Response = await realFetch(url, options);
                            if (encodingsM3u8Response != null && encodingsM3u8Response.status === 200) {
                                const encodingsM3u8 = await encodingsM3u8Response.text();
                                streamInfo.Encodings = encodingsM3u8;
                                setStreamInfoUrls(streamInfo, encodingsM3u8);
                                serverTime = getServerTimeFromM3u8(encodingsM3u8);
                                const resolutionInfo = streamInfo.Urls.values().next().value;
                                const streamM3u8Response = await realFetch(resolutionInfo.Url);
                                if (streamM3u8Response.status == 200) {
                                    const streamM3u8 = await streamM3u8Response.text();
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
                            const encodingsM3u8Response = await realFetch(url, options);
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
            const matches = encodingsM3u8.match(/#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE="([^"]+)"/);
            return matches.length > 1 ? matches[1] : null;
        }
        const matches = encodingsM3u8.match('SERVER-TIME="([0-9.]+)"');
        return matches.length > 1 ? matches[1] : null;
    }
    function replaceServerTimeInM3u8(encodingsM3u8, newServerTime) {
        if (V2API) {
            return newServerTime ? encodingsM3u8.replace(/(#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE=")[^"]+(")/, `$1${newServerTime}$2`) : encodingsM3u8;
        }
        return newServerTime ? encodingsM3u8.replace(new RegExp('(SERVER-TIME=")[0-9.]+"'), `SERVER-TIME="${newServerTime}"`) : encodingsM3u8;
    }
    function getStreamUrlForResolution(encodingsM3u8, resolutionInfo) {
        const encodingsLines = encodingsM3u8.replaceAll('\r', '').split('\n');
        const [targetWidth, targetHeight] = resolutionInfo.Resolution.split('x').map(Number);
        let matchedResolutionUrl = null;
        let matchedFrameRate = false;
        let closestResolutionUrl = null;
        let closestResolutionDifference = Infinity;
        for (let i = 0; i < encodingsLines.length - 1; i++) {
            if (encodingsLines[i].startsWith('#EXT-X-STREAM-INF') && encodingsLines[i + 1].includes('.m3u8')) {
                const attributes = parseAttributes(encodingsLines[i]);
                const resolution = attributes['RESOLUTION'];
                const frameRate = attributes['FRAME-RATE'];
                if (resolution) {
                    if (resolution == resolutionInfo.Resolution && (!matchedResolutionUrl || (!matchedFrameRate && frameRate == resolutionInfo.FrameRate))) {
                        matchedResolutionUrl = encodingsLines[i + 1];
                        matchedFrameRate = frameRate == resolutionInfo.FrameRate;
                        if (matchedFrameRate) {
                            return matchedResolutionUrl.trimEnd();
                        }
                    }
                    const [width, height] = resolution.split('x').map(Number);
                    const difference = Math.abs((width * height) - (targetWidth * targetHeight));
                    if (difference < closestResolutionDifference) {
                        closestResolutionUrl = encodingsLines[i + 1];
                        closestResolutionDifference = difference;
                    }
                }
            }
        }
        return closestResolutionUrl.trimEnd();
    }
    function getAccessToken(channelName, playerType) {
        const realPlayerType = playerType.replace('-ALT', '');
        const body = {
            operationName: 'PlaybackAccessToken',
            variables: {
                isLive: true,
                login: channelName,
                isVod: false,
                vodID: "",
                playerType: realPlayerType,
                platform: realPlayerType == 'autoplay' ? 'android' : 'web'
            },
            extensions: {
                persistedQuery: {
                    version:1,
                    sha256Hash:"ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9"
                }
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
        let headers = {
            'Client-Id': CLIENT_ID,
            'X-Device-Id': gql_device_id,
            'Authorization': AuthorizationHeader,
            ...(ClientIntegrityHeader && {'Client-Integrity': ClientIntegrityHeader})
        };
        if (playerType.includes('-ALT')) {
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
        const realFetch = window.fetch;
        window.realFetch = realFetch;
        window.fetch = function(url, init, ...args) {
            if (typeof url === 'string') {
                if (url.includes('gql')) {
                    let deviceId = init.headers['X-Device-Id'];
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
                    if (OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                        const targetPlayerType = 'embed';
                        let replacedPlayerType = '';
                        const newBody = JSON.parse(init.body);
                        if (Array.isArray(newBody)) {
                            for (let i = 0; i < newBody.length; i++) {
                                if (newBody[i]?.variables?.playerType && newBody[i]?.variables?.playerType === targetPlayerType) {
                                    replacedPlayerType = newBody[i].variables.playerType;
                                    newBody[i].variables.playerType = OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE;
                                }
                            }
                        } else {
                            if (newBody?.variables?.playerType && newBody?.variables?.playerType === targetPlayerType) {
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
                            let hasRemovedClassification = false;
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
    function updateAdblockBanner(data) {
        const playerRootDiv = document.querySelector('.video-player');
        if (playerRootDiv != null) {
            let adBlockDiv = null;
            adBlockDiv = playerRootDiv.querySelector('.adblock-overlay');
            if (adBlockDiv == null) {
                adBlockDiv = document.createElement('div');
                adBlockDiv.className = 'adblock-overlay';
                adBlockDiv.innerHTML = '<div class="player-adblock-notice" style="color: white; background-color: rgba(0, 0, 0, 0.8); position: absolute; top: 0px; left: 0px; padding: 5px;"><p></p></div>';
                adBlockDiv.style.display = 'none';
                adBlockDiv.P = adBlockDiv.querySelector('p');
                playerRootDiv.appendChild(adBlockDiv);
            }
            if (adBlockDiv != null) {
                if (!twitchPlayerAndState?.player?.core || !twitchPlayerAndState?.state) {
                    twitchPlayerAndState = getPlayerAndState();
                }
                const isLive = twitchPlayerAndState?.state?.props?.content?.type === 'live';
                adBlockDiv.P.textContent = 'Blocking' + (data.isMidroll ? ' midroll' : '') + ' ads' + (data.isStrippingAdSegments ? ' (stripping)' : '');// + (data.numStrippedAdSegments > 0 ? ` (${data.numStrippedAdSegments})` : '');
                adBlockDiv.style.display = data.hasAds && isLive ? 'block' : 'none';
            }
        }
    }
    function monitorLiveStatus() {
        if (!twitchPlayerAndState?.player?.core || !twitchPlayerAndState?.state) {
            twitchPlayerAndState = getPlayerAndState();
        }
        const isLive = twitchPlayerAndState?.state?.props?.content?.type === 'live';
        if (!isLive) {
            updateAdblockBanner({
                hasAds: false
            });
        }
        setTimeout(monitorLiveStatus, 1000);
    }
    function getPlayerAndState() {
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
            let reactRootNode = null;
            const rootNode = document.querySelector('#root');
            if (rootNode && rootNode._reactRootContainer && rootNode._reactRootContainer._internalRoot && rootNode._reactRootContainer._internalRoot.current) {
                reactRootNode = rootNode._reactRootContainer._internalRoot.current;
            }
            if (reactRootNode == null && rootNode != null) {
                const containerName = Object.keys(rootNode).find(x => x.startsWith('__reactContainer'));
                if (containerName != null) {
                    reactRootNode = rootNode[containerName];
                }
            }
            return reactRootNode;
        }
        const reactRootNode = findReactRootNode();
        if (!reactRootNode) {
            return null;
        }
        let player = findReactNode(reactRootNode, node => node.setPlayerActive && node.props && node.props.mediaPlayerInstance);
        player = player && player.props && player.props.mediaPlayerInstance ? player.props.mediaPlayerInstance : null;
        const playerState = findReactNode(reactRootNode, node => node.setSrc && node.setInitialPlaybackSettings);
        return  {
            player: player,
            state: playerState
        };
    }
    function reloadTwitchPlayer(isPausePlay) {
        const playerAndState = getPlayerAndState();
        if (!playerAndState) {
            console.log('Could not find react root');
            return;
        }
        const player = playerAndState.player;
        const playerState = playerAndState.state;
        if (!player) {
            console.log('Could not find player');
            return;
        }
        if (!playerState) {
            console.log('Could not find player state');
            return;
        }
        if (player.isPaused() || player.core?.paused) {
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
        let currentQualityLS = null;
        let currentMutedLS = null;
        let currentVolumeLS = null;
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
        const block = e => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };
        let wasVideoPlaying = true;
        const visibilityChange = e => {
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
            const keysToCache = [
                'video-quality',
                'video-muted',
                'volume',
                'lowLatencyModeEnabled',// Low Latency
                'persistenceEnabled',// Mini Player
            ];
            const cachedValues = new Map();
            for (let i = 0; i < keysToCache.length; i++) {
                cachedValues.set(keysToCache[i], localStorage.getItem(keysToCache[i]));
            }
            const realSetItem = localStorage.setItem;
            localStorage.setItem = function(key, value) {
                if (cachedValues.has(key)) {
                    cachedValues.set(key, value);
                }
                realSetItem.apply(this, arguments);
            };
            const realGetItem = localStorage.getItem;
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
    monitorLiveStatus();
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
    window.allSegmentsAreAdSegments = () => {
        postTwitchWorkerMessage('AllSegmentsAreAdSegments');
    };
})();