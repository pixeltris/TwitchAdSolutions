twitch-videoad.js application/javascript
(function() {
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    function declareOptions(scope) {
        // Options / globals
        scope.OPT_MODE_MUTE_BLACK = false;
        scope.OPT_MODE_VIDEO_SWAP = true;
        scope.OPT_MODE_LOW_RES = false;
        scope.OPT_MODE_EMBED = false;
        scope.OPT_MODE_STRIP_AD_SEGMENTS = false;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED = false;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_INITIAL_ATTEMPTS = 0;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_PERSIST = false;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_PERSIST_AND_RELOAD = false;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_PERSIST_EXPECTED_DURATION = 10000;// In milliseconds
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_MIN_REQUESTS = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT = false;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT_DELAY = 0;
        scope.OPT_MODE_PROXY_M3U8 = '';
        scope.OPT_MODE_PROXY_M3U8_OBFUSCATED = false;
        scope.OPT_MODE_PROXY_M3U8_FULL_URL = false;
        scope.OPT_MODE_PROXY_M3U8_PARTIAL_URL = false;
        scope.OPT_VIDEO_SWAP_PLAYER_TYPE = 'picture-by-picture';
        scope.OPT_BACKUP_PLAYER_TYPE = 'picture-by-picture';
        scope.OPT_REGULAR_PLAYER_TYPE = 'site';
        scope.OPT_INITIAL_M3U8_ATTEMPTS = 1;
        scope.OPT_ACCESS_TOKEN_PLAYER_TYPE = '';
        scope.OPT_ACCESS_TOKEN_TEMPLATE = true;
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
        if (scope.OPT_MODE_PROXY_M3U8 && scope.OPT_MODE_PROXY_M3U8_OBFUSCATED) {
            var newStr = '';
            scope.OPT_MODE_PROXY_M3U8 = atob(scope.OPT_MODE_PROXY_M3U8);
            for (var i = 0; i < scope.OPT_MODE_PROXY_M3U8.length; i++) {
                newStr += String.fromCharCode(scope.OPT_MODE_PROXY_M3U8.charCodeAt(i) ^ scope.CLIENT_ID.charCodeAt(i % scope.CLIENT_ID.length));
            }
            scope.OPT_MODE_PROXY_M3U8 = newStr;
        }
        // These are only really for Worker scope...
        scope.StreamInfos = [];
        scope.StreamInfosByUrl = [];
        scope.CurrentChannelNameFromM3U8 = null;
        scope.LastAdUrl = null;
        scope.LastAdTime = 0;
        // Need this in both scopes. Window scope needs to update this to worker scope.
        scope.gql_device_id = null;
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
                ${getSegmentInfos.toString()}
                ${getSegmentInfosLines.toString()}
                ${hookWorkerFetch.toString()}
                ${declareOptions.toString()}
                ${getAccessToken.toString()}
                ${gqlRequest.toString()}
                ${makeGraphQlPacket.toString()}
                ${tryNotifyAdsWatchedM3U8.toString()}
                ${parseAttributes.toString()}
                declareOptions(self);
                self.addEventListener('message', function(e) {
                    if (e.data.key == 'UboUpdateDeviceId') {
                        gql_device_id = e.data.value;
                    }
                });
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
                }
                else if (e.data.key == 'UboChannelNameM3U8Changed') {
                    //console.log('M3U8 channel name changed to ' + e.data.value);
                    notifyAdsWatchedReloadNextTime = 0;
                }
                else if (e.data.key == 'UboReloadPlayer') {
                    reloadTwitchPlayer();
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
    function getSegmentInfosLines(streamInfo, lines) {
        var result = {};
        result.segs = [];
        result.targetDuration = 0;
        result.elapsedSecs = 0;
        result.totalSecs = 0;
        result.hasPrefetch = false;
        result.hasLiveBeforeAd = true;// This most likely means a midroll (live segments before ad segments)
        var hasLive = false;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.startsWith('#EXT-X-TARGETDURATION')) {
                result.targetDuration = parseInt(line.split(':')[1]);
            }
            if (line.startsWith('#EXT-X-TWITCH-ELAPSED-SECS')) {
                result.elapsedSecs = line.split(':')[1];
            }
            if (line.startsWith('#EXT-X-TWITCH-TOTAL-SECS')) {
                result.totalSecs = line.split(':')[1];
            }
            if (line.startsWith('#EXT-X-DATERANGE')) {
                var attr = parseAttributes(line);
                if (attr['CLASS'] && attr['CLASS'].includes('stitched-ad')) {
                    streamInfo.IsMidroll = attr['X-TV-TWITCH-AD-ROLL-TYPE'] == 'MIDROLL';
                }
            }
            if (line.startsWith('http')) {
                var segInfo = {};
                segInfo.urlLineIndex = i;
                segInfo.urlLine = lines[i];
                segInfo.url = lines[i];
                segInfo.isPrefetch = false;
                if (i >= 1 && lines[i - 1].startsWith('#EXTINF')) {
                    //#EXTINF:2.002,DCM|2435256
                    //#EXTINF:2.002,Amazon|8493257483
                    //#EXTINF:2.000,live
                    var splitted = lines[i - 1].split(':')[1].split(',');
                    segInfo.extInfLineIndex = i - 1;
                    segInfo.extInfLine = lines[i - 1];
                    segInfo.extInfLen = splitted[0];//2.000 (can be between 2.000 -> 5.000?)
                    segInfo.extInfType = splitted[1].split('|')[0];//live / Amazon / DCM
                    segInfo.isAd = segInfo.extInfType != 'live';
                    if (segInfo.isAd && !hasLive && result.hasLiveBeforeAd) {
                        result.hasLiveBeforeAd = false;
                    }
                    hasLive = !segInfo.isAd;
                }
                if (i >= 2 && lines[i - 2].startsWith('#EXT-X-PROGRAM-DATE-TIME')) {
                    segInfo.dateTimeLineIndex = i - 2;
                    segInfo.dateTimeLine = lines[i - 2];
                    segInfo.dateTime = new Date(lines[i - 2].split(':')[1]);
                }
                result.segs.push(segInfo);
            }
            if (lines[i].startsWith('#EXT-X-TWITCH-PREFETCH:')) {
                var segInfo = {};
                segInfo.urlLineIndex = i;
                segInfo.urlLine = lines[i];
                segInfo.url = lines[i].substr(lines[i].indexOf(':') + 1);
                segInfo.isPrefetch = true;
                result.hasPrefetch = true;
                result.segs.push(segInfo);
            }
        }
        return result;
    }
    function getSegmentInfos(streamInfo, lines, backupLines) {
        var result = {};
        result.segs = [];
        result.main = getSegmentInfosLines(streamInfo, lines);
        result.backup = getSegmentInfosLines(streamInfo, backupLines);
        // Push all backup segments first
        for (var i = 0; i < result.backup.segs.length; i++) {
            var seg = {};
            seg.backup = result.backup.segs[i];
            result.segs.push(seg);
        }
        // Insert any live main segments
        // NOTE: We might want to make sure we aren't writing over previously established backup segments (make use of streamInfo.SegmentCache)
        // NOTE: Midroll ads will result in a very long backup stream. Better logic required for midrolls.
        for (var i = result.main.segs.length - 1, j = result.segs.length - 1; i >= 0 && j >= 0; i--, j--) {
            while (result.main.segs[i].isPrefetch) {
                if (result.segs[j].backup.isPrefetch) {
                    result.segs[j].main = result.main.segs[i];
                    j--;
                }
                i--;
            }
            if (!result.main.segs[i].isAd) {
                result.segs[j].main = result.main.segs[i];
            } else {
                break;
            }
        }
        // Set the segment cache (currently unused)
        streamInfo.SegmentCache.length = 0;
        for (var i = 0; i < result.segs.length; i++) {
            if (result.segs[i].main != null) {
                streamInfo.SegmentCache[result.segs[i].main.url] = result.segs[i];
            }
            if (result.segs[i].backup != null) {
                streamInfo.SegmentCache[result.segs[i].backup.url] = result.segs[i];
            }
        }
        return result;
    }
    async function processM3U8(url, textStr, realFetch) {
        var haveAdTags = textStr.includes(AD_SIGNIFIER);
        if (OPT_MODE_STRIP_AD_SEGMENTS) {
            var si = StreamInfosByUrl[url];
            if (si != null) {
                si.BackupSeqNumber = -1;
                var lines = textStr.replace('\r', '').split('\n');
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
                        var oldRealSeq = si.RealSeqNumber;
                        si.RealSeqNumber = parseInt(/#EXT-X-MEDIA-SEQUENCE:([0-9]*)/.exec(lines[i])[1]);
                        if (!haveAdTags && si.FakeSeqNumber > 0) {
                            // We previously modified the sequence number, we need to keep doing so (alternatively pause/playing might work better)
                            si.FakeSeqNumber += Math.max(0, si.RealSeqNumber - oldRealSeq);
                            lines[i] = '#EXT-X-MEDIA-SEQUENCE:' + si.FakeSeqNumber;
                            console.log('No ad, but modifying sequence realSeq:' + si.RealSeqNumber + ' fakeSeq:' + si.FakeSeqNumber);
                        }
                        break;
                    }
                }
                textStr = lines.join('\n');
            }
        }
        if (haveAdTags) {
            var si = StreamInfosByUrl[url];
            if (OPT_MODE_NOTIFY_ADS_WATCHED_PERSIST && si != null && !si.NotifyObservedNoAds) {
                // We only really know it's fully processed when we no loger see ads
                // NOTE: We probably shouldn't keep sending these requests. Possibly start sending them after expected ad duration?
                var noAds = false;
                var encodingsM3u8Response = await realFetch(si.RootM3U8Url);
                if (encodingsM3u8Response.status === 200) {
                    var encodingsM3u8 = await encodingsM3u8Response.text();
                    var streamM3u8Url = encodingsM3u8.match(/^https:.*\.m3u8$/m)[0];
                    var streamM3u8Response = await realFetch(streamM3u8Url);
                    if (streamM3u8Response.status == 200) {
                        noAds = (await tryNotifyAdsWatchedM3U8(await streamM3u8Response.text())) == 1;
                        console.log('Notify ad watched. Response has ads: ' + !noAds);
                    }
                }
                if (si.NotifyFirstTime == 0) {
                    si.NotifyFirstTime = Date.now();
                }
                if (noAds && !si.NotifyObservedNoAds && Date.now() >= si.NotifyFirstTime + OPT_MODE_NOTIFY_ADS_WATCHED_PERSIST_EXPECTED_DURATION) {
                    si.NotifyObservedNoAds = true;
                }
                if (noAds && OPT_MODE_NOTIFY_ADS_WATCHED_PERSIST_AND_RELOAD && Date.now() >= si.NotifyFirstTime + OPT_MODE_NOTIFY_ADS_WATCHED_PERSIST_EXPECTED_DURATION) {
                    console.log('Reload player');
                    postMessage({key:'UboHideAdBanner'});
                    postMessage({key:'UboReloadPlayer'});
                    return '';
                }
            }
            postMessage({
                key: 'UboFoundAdSegment',
                hasLiveSeg: textStr.includes(LIVE_SIGNIFIER),
                streamM3u8: textStr
            });
        }
        if (!OPT_MODE_STRIP_AD_SEGMENTS) {
            return textStr;
        }
        if (haveAdTags) {
            LastAdUrl = url;
            LastAdTime = Date.now();
            var streamInfo = StreamInfosByUrl[url];
            if (streamInfo == null) {
                console.log('Unknown stream url ' + url);
                postMessage({key:'UboHideAdBanner'});
                return textStr;
            }
            if (!streamInfo.BackupFailed && streamInfo.BackupUrl == null) {
                // NOTE: We currently don't fetch the oauth_token. You wont be able to access private streams like this.
                streamInfo.BackupFailed = true;
                var accessTokenResponse = await getAccessToken(streamInfo.ChannelName, OPT_BACKUP_PLAYER_TYPE);
                if (accessTokenResponse.status === 200) {
                    var accessToken = await accessTokenResponse.json();
                    var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + streamInfo.ChannelName + '.m3u8' + streamInfo.RootM3U8Params);
                    urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                    urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
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
            var newLines = [];
            if (backupM3u8 != null) {
                var seqMatch = /#EXT-X-MEDIA-SEQUENCE:([0-9]*)/.exec(backupM3u8);
                if (seqMatch != null) {
                    var oldBackupSeqNumber = streamInfo.BackupSeqNumber;
                    streamInfo.BackupSeqNumber = Math.max(0, parseInt(seqMatch[1]));
                    if (streamInfo.RealSeqNumber > 0) {
                        // We already have a real stream, this must be a midroll. We should therefore increment rather than just using backup directly.
                        // - If we don't do this then our sequence number will be broken and the stream will get stuck in a loading state.
                        if (streamInfo.FakeSeqNumber == 0) {
                            streamInfo.FakeSeqNumber = streamInfo.RealSeqNumber;
                        }
                        if (oldBackupSeqNumber == -1) {
                            // First backup sequence, assume +1
                            streamInfo.FakeSeqNumber++;
                        }
                        else {
                            streamInfo.FakeSeqNumber += Math.max(0, streamInfo.BackupSeqNumber - oldBackupSeqNumber);
                        }
                    } else {
                        streamInfo.FakeSeqNumber = streamInfo.BackupSeqNumber;
                    }
                }
                var backupLines = backupM3u8.replace('\r', '').split('\n');
                var segInfos = getSegmentInfos(streamInfo, lines, backupLines);
                newLines.push('#EXTM3U');
                newLines.push('#EXT-X-VERSION:3');
                newLines.push('#EXT-X-TARGETDURATION:' + segInfos.backup.targetDuration);
                newLines.push('#EXT-X-MEDIA-SEQUENCE:' + streamInfo.FakeSeqNumber);
                // The following will could cause issues when we stop stripping segments
                //newLines.push('#EXT-X-TWITCH-ELAPSED-SECS:' + streamInfo.backup.elapsedSecs);
                //newLines.push('#EXT-X-TWITCH-TOTAL-SECS:' + streamInfo.backup.totalSecs);
                var pushedLiveSegs = 0;
                var pushedBackupSegs = 0;
                var pushedPrefetchSegs = 0;
                for (var i = 0; i < segInfos.segs.length; i++) {
                    var seg = segInfos.segs[i];
                    var segData = null;
                    if (seg.main != null && !seg.main.isAd) {
                        pushedLiveSegs++;
                        segData = seg.main;
                    } else if (seg.backup != null) {
                        pushedBackupSegs++;
                        segData = seg.backup;
                    }
                    if (segData != null) {
                        if (segData.isPrefetch) {
                            pushedPrefetchSegs++;
                            newLines.push(segData.urlLine);
                        } else {
                            //newLines.push(segData.dateTimeLine);
                            newLines.push(segData.extInfLine);
                            newLines.push(segData.urlLine);
                        }
                    }
                }
                if (pushedLiveSegs > 0 || pushedBackupSegs > 0) {
                    console.log('liveSegs:' + pushedLiveSegs + ' backupSegs:' + pushedBackupSegs + ' prefetch:' + pushedPrefetchSegs + ' realSeq:' + streamInfo.RealSeqNumber + ' fakeSeq:' + streamInfo.FakeSeqNumber);
                } else {
                    console.log('TODO: If theres no backup data then we need to provide our own .ts file, otherwise the player will spam m3u8 requests (denial-of-service)');
                }
            }
            textStr = newLines.length > 0 ? newLines.join('\n') : lines.join('\n');
            //console.log(textStr);
        }
        return textStr;
    }
    function hookWorkerFetch() {
        var realFetch = fetch;
        fetch = async function(url, options) {
            if (typeof url === 'string') {
                if (OPT_MODE_STRIP_AD_SEGMENTS && url.endsWith('.ts')) {
                    var shownAdBanner = false;
                    for (const [channelName, streamInfo] of Object.entries(StreamInfos)) {
                        var seg = streamInfo.SegmentCache[url];
                        if (seg && !seg.isPrefetch) {
                            if (seg.main == null && seg.backup != null) {
                                shownAdBanner = true;
                                postMessage({key:'UboShowAdBanner',isMidroll:streamInfo.IsMidroll});
                            }
                            break;
                        }
                    }
                    if (!shownAdBanner) {
                        postMessage({key:'UboHideAdBanner'});
                    }
                }
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
                        if (OPT_MODE_PROXY_M3U8_FULL_URL || OPT_MODE_PROXY_M3U8_PARTIAL_URL) {
                            if (OPT_MODE_PROXY_M3U8_FULL_URL) {
                                url = OPT_MODE_PROXY_M3U8 + url;
                            } else {
                                url = OPT_MODE_PROXY_M3U8 + url.split('.m3u8')[0];
                            }
                            if (!OPT_MODE_PROXY_M3U8_OBFUSCATED) {
                                console.log('proxy-m3u8: ' + url);
                            }
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
                                        streamInfo.RootM3U8Url = url;
                                        streamInfo.RootM3U8Params = (new URL(url)).search;
                                        streamInfo.BackupUrl = null;
                                        streamInfo.BackupFailed = false;
                                        streamInfo.SegmentCache = [];
                                        streamInfo.IsMidroll = false;
                                        streamInfo.NotifyFirstTime = 0;
                                        streamInfo.NotifyObservedNoAds = false;
                                        streamInfo.RealSeqNumber = -1;
                                        streamInfo.BackupSeqNumber = -1;
                                        streamInfo.FakeSeqNumber = 0;
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
    function getAccessToken(channelName, playerType, realFetch) {
        var body = null;
        if (OPT_ACCESS_TOKEN_TEMPLATE) {
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
        } else {
            body = {
                operationName: 'PlaybackAccessToken',
                variables: {
                    isLive: true,
                    login: channelName,
                    isVod: false,
                    vodID: '',
                    playerType: playerType
                },
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: '0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712',
                    }
                }
            };
        }
        return gqlRequest(body, realFetch);
    }
    function gqlRequest(body, realFetch) {
        var fetchFunc = realFetch ? realFetch : fetch;
        return fetchFunc('https://gql.twitch.tv/gql', {
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
            if (i >= 0) {
                if (res == 1) {
                    console.log("no ad at req " + i);
                } else {
                    console.log('ad at req ' + i);
                }
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
                        if (url.includes('gql') && init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
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
                    if (gql_device_id && twitchMainWorker) {
                        twitchMainWorker.postMessage({
                            key: 'UboUpdateDeviceId',
                            value: gql_device_id
                        });
                    }
                    if (OPT_MODE_NOTIFY_ADS_WATCHED && OPT_MODE_NOTIFY_ADS_WATCHED_INITIAL_ATTEMPTS > 0) {
                        var tok = null, sig = null;
                        if (url.includes('gql') && init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                            return new Promise(async function(resolve, reject) {
                                var response = await realFetch(url, init);
                                if (response.status === 200) {
                                    for (var i = 0; i < OPT_MODE_NOTIFY_ADS_WATCHED_INITIAL_ATTEMPTS; i++) {
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
                        var accessTokenResponse = await getAccessToken(channelName, OPT_VIDEO_SWAP_PLAYER_TYPE);
                        if (accessTokenResponse.status === 200) {
                            var accessToken = await accessTokenResponse.json();
                            var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + channelName + '.m3u8?allow_source=true');
                            urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                            urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
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
