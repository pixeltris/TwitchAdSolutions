twitch-videoad.js application/javascript
(function() {
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    function declareOptions(scope) {
        // Options / globals
        scope.OPT_MODE_MUTE_BLACK = false;
        scope.OPT_MODE_VIDEO_SWAP = false;
        scope.OPT_MODE_LOW_RES = false;
        scope.OPT_MODE_EMBED = false;
        scope.OPT_MODE_STRIP_AD_SEGMENTS = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED = false;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_ATTEMPTS = 2;// Larger values might increase load time. Lower values may increase ad chance.
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_MIN_REQUESTS = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT = false;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT_DELAY = 0;
        scope.OPT_MODE_PROXY_M3U8 = '';
        scope.OPT_MODE_PROXY_M3U8_FULL_URL = false;
        scope.OPT_VIDEO_SWAP_PLAYER_TYPE = 'thunderdome';
        scope.OPT_INITIAL_M3U8_ATTEMPTS = 1;
        scope.OPT_ACCESS_TOKEN_PLAYER_TYPE = '';
        scope.AD_SIGNIFIER = 'stitched-ad';
        scope.LIVE_SIGNIFIER = ',live';
        scope.CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
        // Modify options based on mode
        if (!scope.OPT_ACCESS_TOKEN_PLAYER_TYPE && scope.OPT_MODE_LOW_RES) {
            scope.OPT_ACCESS_TOKEN_PLAYER_TYPE = 'thunderdome';//480p
            //scope.OPT_ACCESS_TOKEN_PLAYER_TYPE = 'picture-by-picture';//360p
        }
        if (!scope.OPT_ACCESS_TOKEN_PLAYER_TYPE && scope.OPT_MODE_EMBED) {
            scope.OPT_ACCESS_TOKEN_PLAYER_TYPE = 'embed';
        }
        // These are only really for Worker scope...
        scope.StreamInfos = [];
        scope.StreamInfosByUrl = [];
        scope.CurrentChannelNameFromM3U8 = null;
        scope.LastAdUrl = null;
        scope.LastAdTime = 0;
    }
    declareOptions(window);
    ////////////////////////////////////
    // stream swap / stream mute
    ////////////////////////////////////
    var tempVideo = null;// A temporary video container to hold a lower resolution stream without ads
    var disabledVideo = null;// The original video element (disabled for the duration of the ad)
    var originalVolume = 0;// The volume of the original video element
    var foundAdContainer = false;// Have ad containers been found (the clickable ad)
    var foundAdBanner = false;// Is the ad banner visible (top left of screen)
    ////////////////////////////////////
    var notifyAdsWatchedReloadNextTime = 0;
    var gql_device_id = null;
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
                ${getSegmentTimes.toString()}
                ${hookWorkerFetch.toString()}
                ${declareOptions.toString()}
                declareOptions(self);
                hookWorkerFetch();
                importScripts('${jsURL}');
            `
            super(URL.createObjectURL(new Blob([newBlobStr])));
            twitchMainWorker = this;
            var adDiv = null;
            this.onmessage = function(e) {
                if (e.data.key == 'UboShowAdBanner') {
                    if (adDiv == null) { adDiv = getAdDiv(); }
                    adDiv.P.textContent = 'Waiting for' + (e.data.isMidroll ? ' midroll' : '') + ' ads to finish...';
                    adDiv.style.display = 'block';
                }
                else if (e.data.key == 'UboHideAdBanner') {
                    if (adDiv == null) { adDiv = getAdDiv(); }
                    adDiv.style.display = 'none';
                }
                else if (e.data.key == 'UboFoundAdSegment') {
                    onFoundAd(e.data.hasLiveSeg, e.data.streamM3u8);
                } else if (e.data.key == 'UboChannelNameM3U8Changed') {
                    //console.log('M3U8 channel name changed to ' + e.data.value);
                    notifyAdsWatchedReloadNextTime = 0;
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
                        adDiv.innerHTML = '<div class="player-ad-notice" style="color: white; background-color: rgba(0, 0, 0, 0.8); position: absolute; top: 0px; left: 0px; padding: 10px;"><p></p></div>';
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
    function getSegmentTimes(lines) {
        var result = [];
        var lastDate = 0;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
                lastDate = Date.parse(line.substring(line.indexOf(':') + 1));
            } else if (line.startsWith('http')) {
                result[lastDate] = line;
            }
        }
        return result;
    }
    async function processM3U8(url, textStr, realFetch) {
        var haveAdTags = textStr.includes(AD_SIGNIFIER);
        if (haveAdTags) {
            postMessage({
                key: 'UboFoundAdSegment',
                hasLiveSeg: textStr.includes(LIVE_SIGNIFIER),
                streamM3u8: textStr
            });
        }
        if (!OPT_MODE_STRIP_AD_SEGMENTS) {
            return textStr;
        }
        // NOTE: midroll ads are intertwined with live segments, always display the banner on midroll ads
        if (haveAdTags && (!textStr.includes(LIVE_SIGNIFIER) || textStr.includes('MIDROLL'))) {
            postMessage({key:'UboShowAdBanner',isMidroll:textStr.includes('MIDROLL')});
        } else if ((LastAdUrl && LastAdUrl == url) || LastAdTime < Date.now() - 10000) {
            postMessage({key:'UboHideAdBanner'});
            LastAdTime = 0;
        }
        if (haveAdTags) {
            LastAdUrl = url;
            LastAdTime = Date.now();
            if (OPT_MODE_NOTIFY_ADS_WATCHED) {
                console.log('Stripping ads (instead of skipping ads)');
            }
            var streamInfo = StreamInfosByUrl[url];
            if (streamInfo == null) {
                console.log('Unknown stream url! ' + url);
                return textStr;
            }
            if (!streamInfo.BackupFailed && streamInfo.BackupUrl == null) {
                // NOTE: We currently don't fetch the oauth_token. You wont be able to access private streams like this.
                streamInfo.BackupFailed = true;
                var accessTokenResponse = await realFetch('https://api.twitch.tv/api/channels/' + streamInfo.ChannelName + '/access_token?oauth_token=undefined&need_https=true&platform=web&player_type=picture-by-picture&player_backend=mediaplayer', {headers:{'client-id':CLIENT_ID}});
                if (accessTokenResponse.status === 200) {
                    var accessToken = JSON.parse(await accessTokenResponse.text());
                    var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + streamInfo.ChannelName + '.m3u8' + streamInfo.RootM3U8Params);
                    urlInfo.searchParams.set('sig', accessToken.sig);
                    urlInfo.searchParams.set('token', accessToken.token);
                    var encodingsM3u8Response = await realFetch(urlInfo.href);
                    if (encodingsM3u8Response.status === 200) {
                        // TODO: Maybe look for the most optimal m3u8
                        var encodingsM3u8 = await encodingsM3u8Response.text();
                        var streamM3u8Url = encodingsM3u8.match(/^https:.*\.m3u8$/m)[0];
                        // Maybe this request is a bit unnecessary
                        var streamM3u8Response = await realFetch(streamM3u8Url);
                        if (streamM3u8Response.status == 200) {
                            streamInfo.BackupFailed = false;
                            streamInfo.BackupUrl = streamM3u8Url;
                            console.log('Fetched backup url: ' + streamInfo.BackupUrl);
                        } else {
                            console.log('Backup url request (streamM3u8) failed with ' + streamM3u8Response.status);
                        }
                    } else {
                        console.log('Backup url request (encodingsM3u8) failed with ' + encodingsM3u8Response.status);
                    }
                } else {
                    console.log('Backup url request (accessToken) failed with ' + accessTokenResponse.status);
                }
            }
            var backupM3u8 = null;
            if (streamInfo.BackupUrl != null) {
                var backupM3u8Response = await realFetch(streamInfo.BackupUrl);
                if (backupM3u8Response.status == 200) {
                    backupM3u8 = await backupM3u8Response.text();
                } else {
                    console.log('Backup m3u8 failed with ' + backupM3u8Response.status);
                }
            }
            var lines = textStr.replace('\r', '').split('\n');
            var segmentMap = [];
            if (backupM3u8 != null) {
                var backupLines = backupM3u8.replace('\r', '').split('\n');
                var segTimes = getSegmentTimes(lines);
                var backupSegTimes = getSegmentTimes(backupLines);
                for (const [segTime, segUrl] of Object.entries(segTimes)) {
                    //segmentMap[segUrl] = Object.values(backupSegTimes)[Object.keys(backupSegTimes).length-1];
                    var closestTime = Number.MAX_VALUE;
                    var matchingBackupTime = Number.MAX_VALUE;
                    for (const [backupSegTime, backupSegUrl] of Object.entries(backupSegTimes)) {
                        var timeDiff = Math.abs(segTime - backupSegTime);
                        if (timeDiff < closestTime) {
                            closestTime = timeDiff;
                            matchingBackupTime = backupSegTime;
                            segmentMap[segUrl] = backupSegUrl;
                        }
                    }
                    if (closestTime != Number.MAX_VALUE) {
                        backupSegTimes.splice(backupSegTimes.indexOf(matchingBackupTime), 1);
                    }
                }
            }
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line.includes('stitched-ad')) {
                    lines[i] = '';
                }
                if (line.startsWith('#EXTINF:') && !line.includes(',live')) {
                    lines[i] = line.substring(0, line.indexOf(',')) + ',live';
                    var backupSegment = segmentMap[lines[i + 1]];
                    lines[i + 1] = backupSegment != null ? backupSegment : ''
                }
            }
            textStr = lines.join('\n');
            //console.log(textStr);
        }
        return textStr;
    }
    function hookWorkerFetch() {
        var realFetch = fetch;
        fetch = async function(url, options) {
            if (typeof url === 'string') {
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
                    if (OPT_MODE_PROXY_M3U8) {
                        if (OPT_MODE_PROXY_M3U8_FULL_URL) {
                            url = OPT_MODE_PROXY_M3U8 + url;
                            console.log('proxy-m3u8: ' + url);
                            var opt2 = {};
                            opt2.headers = [];
                            opt2.headers['Access-Control-Allow-Origin'] = '*';// This is to appease the currently set proxy
                            return realFetch(url, opt2);
                        } else {
                            url = OPT_MODE_PROXY_M3U8 + channelName;
                            console.log('proxy-m3u8: ' + url);
                        }
                    }
                    else if (OPT_MODE_STRIP_AD_SEGMENTS) {
                        return new Promise(async function(resolve, reject) {
                            // - First m3u8 request is the m3u8 with the video encodings (360p,480p,720p,etc).
                            // - Second m3u8 request is the m3u8 for the given encoding obtained in the first request. At this point we will know if there's ads.
                            var maxAttempts = OPT_INITIAL_M3U8_ATTEMPTS <= 0 ? 1 : OPT_INITIAL_M3U8_ATTEMPTS;
                            var attempts = 0;
                            while(true) {
                                var encodingsM3u8Response = await realFetch(url, options);
                                if (encodingsM3u8Response.status === 200) {
                                    var encodingsM3u8 = await encodingsM3u8Response.text();
                                    var streamM3u8Url = encodingsM3u8.match(/^https:.*\.m3u8$/m)[0];
                                    var streamM3u8Response = await realFetch(streamM3u8Url);
                                    var streamM3u8 = await streamM3u8Response.text();
                                    if (!streamM3u8.includes(AD_SIGNIFIER) || ++attempts >= maxAttempts) {
                                        if (maxAttempts > 1 && attempts >= maxAttempts) {
                                            console.log('max skip ad attempts reached (attempt #' + attempts + ')');
                                        }
                                        var streamInfo = StreamInfos[channelName];
                                        if (streamInfo == null) {
                                            StreamInfos[channelName] = streamInfo = {};
                                        }
                                        // This might potentially backfire... maybe just add the new urls
                                        streamInfo.ChannelName = channelName;
                                        streamInfo.Urls = [];
                                        streamInfo.RootM3U8Params = (new URL(url)).search;
                                        streamInfo.BackupUrl = null;
                                        streamInfo.BackupFailed = false;
                                        var lines = encodingsM3u8.replace('\r', '').split('\n');
                                        for (var i = 0; i < lines.length; i++) {
                                            if (!lines[i].startsWith('#') && lines[i].includes('.m3u8')) {
                                                streamInfo.Urls.push(lines[i]);
                                                StreamInfosByUrl[lines[i]] = streamInfo;
                                            }
                                        }
                                        resolve(new Response(encodingsM3u8));
                                        break;
                                    }
                                    console.log('attempt to skip ad (attempt #' + attempts + ')');
                                } else {
                                    // Stream is offline?
                                    resolve(encodingsM3u8Response);
                                    break;
                                }
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
    async function tryNotifyAdsWatchedM3U8(streamM3u8) {
        //console.log(streamM3u8);
        if (!streamM3u8.includes(AD_SIGNIFIER)) {
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
    }
    async function tryNotifyAdsWatchedSigTok(realFetch, i, sig, token) {
        var tokInfo = JSON.parse(token);
        var channelName = tokInfo.channel;
        var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + channelName + '.m3u8');
        urlInfo.searchParams.set('sig', sig);
        urlInfo.searchParams.set('token', token);
        var encodingsM3u8Response = await realFetch(urlInfo.href);
        if (encodingsM3u8Response.status === 200) {
            var encodingsM3u8 = await encodingsM3u8Response.text();
            var streamM3u8Url = encodingsM3u8.match(/^https:.*\.m3u8$/m)[0];
            var streamM3u8Response = await realFetch(streamM3u8Url);
            var streamM3u8 = await streamM3u8Response.text();
            var res = await tryNotifyAdsWatchedM3U8(streamM3u8);
            if (res == 1) {
                console.log("no ad at req " + i);
            } else {
                console.log('ad at req ' + i);
            }
            return res;
        } else {
            // http error 
            return 2;
        }
        return 0;
    }
    function hookFetch() {
        var realFetch = window.fetch;
        window.fetch = function(url, init, ...args) {
            if (typeof url === 'string') {
                if (url.includes('/access_token') || url.includes('gql')) {
                    if (OPT_ACCESS_TOKEN_PLAYER_TYPE) {
                        if (url.includes('/access_token')) {
                            var modifiedUrl = new URL(url);
                            modifiedUrl.searchParams.set('player_type', OPT_ACCESS_TOKEN_PLAYER_TYPE);
                            arguments[0] = modifiedUrl.href;
                        }
                        else if (url.includes('gql') && init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                            const newBody = JSON.parse(init.body);
                            newBody.variables.playerType = OPT_ACCESS_TOKEN_PLAYER_TYPE;
                            init.body = JSON.stringify(newBody);
                        }
                    }
                    var deviceId = init.headers['X-Device-Id'];
                    if (typeof deviceId !== 'string') {
                        deviceId = init.headers['Device-ID'];
                    }
                    if (typeof deviceId === 'string') {
                        gql_device_id = deviceId;
                    }
                    if (OPT_MODE_NOTIFY_ADS_WATCHED) {
                        var tok = null, sig = null;
                        if (url.includes('/access_token')) {
                            return new Promise(async function(resolve, reject) {
                                var response = await realFetch(url, init);
                                if (response.status === 200) {
                                    // NOTE: This code path is untested
                                    for (var i = 0; i < OPT_MODE_NOTIFY_ADS_WATCHED_ATTEMPTS; i++) {
                                        var cloned = response.clone();
                                        var responseStr = await cloned.text();
                                        var responseData = JSON.parse(responseStr);
                                        if (responseData && responseData.sig && responseData.token) {
                                            if (await tryNotifyAdsWatchedSigTok(realFetch, i, responseData.sig, responseData.token) == 1) {
                                                resolve(new Response(responseStr));
                                                return;
                                            }
                                        } else {
                                            console.log('malformed');
                                            console.log(responseData);
                                            break;
                                        }
                                    }
                                    resolve(response);
                                } else {
                                    resolve(response);
                                }
                            });
                        }
                        else if (url.includes('gql') && init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                            return new Promise(async function(resolve, reject) {
                                var response = await realFetch(url, init);
                                if (response.status === 200) {
                                    for (var i = 0; i < OPT_MODE_NOTIFY_ADS_WATCHED_ATTEMPTS; i++) {
                                        var cloned = response.clone();
                                        var responseStr = await cloned.text();
                                        var responseData = JSON.parse(responseStr);
                                        if (responseData && responseData.data && responseData.data.streamPlaybackAccessToken && responseData.data.streamPlaybackAccessToken.value && responseData.data.streamPlaybackAccessToken.signature) {
                                            if (await tryNotifyAdsWatchedSigTok(realFetch, i, responseData.data.streamPlaybackAccessToken.signature, responseData.data.streamPlaybackAccessToken.value) == 1) {
                                                resolve(new Response(responseStr));
                                                return;
                                            }
                                        } else {
                                            console.log('malformed');
                                            console.log(responseData);
                                            break;
                                        }
                                    }
                                    resolve(response);
                                } else {
                                    resolve(response);
                                }
                            });
                        }
                    }
                }
            }
            return realFetch.apply(this, arguments);
        }
    }
    function onFoundAd(hasLiveSeg, streamM3u8) {
        if (OPT_MODE_NOTIFY_ADS_WATCHED && OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT && Date.now() >= notifyAdsWatchedReloadNextTime) {
            console.log('OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT');
            notifyAdsWatchedReloadNextTime = Date.now() + OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT_DELAY;
            if (streamM3u8) {
                tryNotifyAdsWatchedM3U8(streamM3u8);
            }
            reloadTwitchPlayer();
            return;
        }
        if (hasLiveSeg) {
            return;
        }
        if (!OPT_MODE_MUTE_BLACK && !OPT_MODE_VIDEO_SWAP) {
            return;
        }
        if (OPT_MODE_VIDEO_SWAP && typeof Hls === 'undefined') {
            return;
        }
        if (!foundAdContainer) {
            // hide ad contianers
            var adContainers = document.querySelectorAll('[data-test-selector="sad-overlay"]');
            for (var i = 0; i < adContainers.length; i++) {
                adContainers[i].style.display = "none";
            }
            foundAdContainer = adContainers.length > 0;
        }
        if (disabledVideo) {
            disabledVideo.volume = 0;
        } else {
            //get livestream video element
            var liveVid = document.getElementsByTagName("video");
            if (liveVid.length) {
                disabledVideo = liveVid = liveVid[0];
                if (!disabledVideo) {
                    return;
                }
                //mute
                originalVolume = liveVid.volume;
                liveVid.volume = 0;
                //black out
                liveVid.style.filter = "brightness(0%)";
                if (OPT_MODE_VIDEO_SWAP) {
                    var createTempStream = async function() {
                        // Create new video stream TODO: Do this with callbacks
                        var channelName = window.location.pathname.substr(1);// TODO: Better way of determining the channel name
                        var tempM3u8Url = null;
                        var accessTokenResponse = await fetch('https://api.twitch.tv/api/channels/' + channelName + '/access_token?oauth_token=undefined&need_https=true&platform=web&player_type=' + OPT_VIDEO_SWAP_PLAYER_TYPE + '&player_backend=mediaplayer', {headers:{'client-id':CLIENT_ID}});
                        if (accessTokenResponse.status === 200) {
                            var accessToken = JSON.parse(await accessTokenResponse.text());
                            var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + channelName + '.m3u8?allow_source=true');
                            urlInfo.searchParams.set('sig', accessToken.sig);
                            urlInfo.searchParams.set('token', accessToken.token);
                            var encodingsM3u8Response = await fetch(urlInfo.href);
                            if (encodingsM3u8Response.status === 200) {
                                // TODO: Maybe look for the most optimal m3u8
                                var encodingsM3u8 = await encodingsM3u8Response.text();
                                var streamM3u8Url = encodingsM3u8.match(/^https:.*\.m3u8$/m)[0];
                                // Maybe this request is a bit unnecessary
                                var streamM3u8Response = await fetch(streamM3u8Url);
                                if (streamM3u8Response.status == 200) {
                                    tempM3u8Url = streamM3u8Url;
                                } else {
                                    console.log('Backup url request (streamM3u8) failed with ' + streamM3u8Response.status);
                                }
                            } else {
                                console.log('Backup url request (encodingsM3u8) failed with ' + encodingsM3u8Response.status);
                            }
                        } else {
                            console.log('Backup url request (accessToken) failed with ' + accessTokenResponse.status);
                        }
                        if (tempM3u8Url != null) {
                            tempVideo = document.createElement('video');
                            tempVideo.autoplay = true;
                            tempVideo.volume = originalVolume;
                            console.log(disabledVideo);
                            disabledVideo.parentElement.insertBefore(tempVideo, disabledVideo.nextSibling);
                            if (Hls.isSupported()) {
                                tempVideo.hls = new Hls();
                                tempVideo.hls.loadSource(tempM3u8Url);
                                tempVideo.hls.attachMedia(tempVideo);
                            }
                            console.log(tempVideo);
                            console.log(tempM3u8Url);
                        }
                    };
                    createTempStream();
                }
            }
        }
    }
    function pollForAds() {
        //check ad by looking for text banner
        var adBanner = document.querySelectorAll("span.tw-c-text-overlay");
        var foundAd = false;
        for (var i = 0; i < adBanner.length; i++) {
            if (adBanner[i].attributes["data-test-selector"]) {
                foundAd = true;
                foundAdBanner = true;
                break;
            }
        }
        if (tempVideo && disabledVideo && tempVideo.paused != disabledVideo.paused) {
            if (disabledVideo.paused) {
                tempVideo.pause();
            } else {
                tempVideo.play();//TODO: Fix issue with Firefox
            }
        }
        if (foundAd) {
            onFoundAd(false);
        } else if (!foundAd && foundAdBanner) {
            if (disabledVideo) {
                disabledVideo.volume = originalVolume;
                disabledVideo.style.filter = "";
                disabledVideo = null;
                foundAdContainer = false;
                foundAdBanner = false;
                if (tempVideo) {
                    tempVideo.hls.stopLoad();
                    tempVideo.remove();
                    tempVideo = null;
                }
            }
        }
        setTimeout(pollForAds,100);
    }
    function reloadTwitchPlayer() {
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
        const sink = player.mediaSinkManager || (player.core ? player.core.mediaSinkManager : null);
        if (sink && sink.video && sink.video._ffz_compressor) {
            const video = sink.video;
            const volume = video.volume ? video.volume : player.getVolume();
            const muted = player.isMuted();
            const newVideo = document.createElement('video');
            newVideo.volume = muted ? 0 : volume;
            newVideo.playsInline = true;
            video.replaceWith(newVideo);
            player.attachHTMLVideoElement(newVideo);
            setImmediate(() => {
                player.setVolume(volume);
                player.setMuted(muted);
            });
        }
        playerState.setSrc({ isNewMediaPlayerInstance: true, refreshAccessToken: true });// ffz sets this false
    }
    window.reloadTwitchPlayer = reloadTwitchPlayer;
    function onContentLoaded() {
        // These modes use polling of the ad elements (e.g. ad banner text) to show/hide content
        if (!OPT_MODE_VIDEO_SWAP && !OPT_MODE_MUTE_BLACK) {
            return;
        }
        if (OPT_MODE_VIDEO_SWAP && typeof Hls === 'undefined') {
            var script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
            script.onload = function() {
                pollForAds();
            }
            document.head.appendChild(script);
        } else {
            pollForAds();
        }
    }
    hookFetch();
    if (document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive") {
        onContentLoaded();
    } else {
        window.addEventListener("DOMContentLoaded", function() {
            onContentLoaded();
        });
    }
})();
