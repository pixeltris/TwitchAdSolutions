twitch-videoad.js application/javascript
(function() {   
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    function declareOptions(scope) {
        // Options / globals
        scope.OPT_INITIAL_M3U8_ATTEMPTS = 1;
        scope.OPT_ACCESS_TOKEN_PLAYER_TYPE = "";//'embed';
        scope.AD_SIGNIFIER = 'stitched-ad';
        scope.LIVE_SIGNIFIER = ',live';
        scope.CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
        // These are only really for Worker scope...
        scope.StreamInfos = [];
        scope.StreamInfosByUrl = [];
    }
    // Worker injection by instance01 (https://github.com/instance01/Twitch-HLS-AdBlock)
    const oldWorker = window.Worker;
    window.Worker = class Worker extends oldWorker {
        constructor(twitchBlobUrl) {
            var jsURL = getWasmWorkerUrl(twitchBlobUrl);
            var version = jsURL.match(/wasmworker\.min\-(.*)\.js/)[1];
            var newBlobStr = `
                var Module = {
                    WASM_BINARY_URL: '${jsURL.replace('.js', '.wasm')}',
                    WASM_CACHE_MODE: true
                }
                ${stripAds.toString()}
                ${getSegmentTimes.toString()}
                ${hookWorkerFetch.toString()}
                ${declareOptions.toString()}
                declareOptions(self);
                hookWorkerFetch();
                importScripts('${jsURL}');
            `
            super(URL.createObjectURL(new Blob([newBlobStr])));
            var adDiv = null;
            this.onmessage = function(e) {
                if (e.data.key == 'UboShowAdBanner') {
                    if (adDiv == null) { adDiv = getAdDiv(); }
                    adDiv.style.display = 'block';
                }
                else if (e.data.key == 'UboHideAdBanner') {
                    if (adDiv == null) { adDiv = getAdDiv(); }
                    adDiv.style.display = 'none';
                }
            }
            function getAdDiv() {
                var msg = 'uBlock Origin is waiting for ads to finish...';
                var playerRootDiv = document.querySelector('.video-player');
                var adDiv = null;
                if (playerRootDiv != null) {
                    adDiv = playerRootDiv.querySelector('.ubo-overlay');
                    if (adDiv == null) {
                        adDiv = document.createElement('div');
                        adDiv.className = 'ubo-overlay';
                        adDiv.innerHTML = '<div class="player-ad-notice" style="color: white; background-color: rgba(0, 0, 0, 0.8); position: absolute; top: 0px; left: 0px; padding: 10px;"><p>' + msg + '</p></div>';
                        adDiv.style.display = 'none';
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
    async function stripAds(url, textStr, realFetch) {
        var haveAdTags = textStr.includes(AD_SIGNIFIER);
        var streamInfo = StreamInfosByUrl[url];
        if (streamInfo == null) {
            console.log('Unknown stream url!');
            return textStr;
        }
        if (haveAdTags && !textStr.includes(LIVE_SIGNIFIER)) {
            postMessage({key:'UboShowAdBanner'});
        } else {
            postMessage({key:'UboHideAdBanner'});
        }
        if (haveAdTags) {
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
                    // Based on https://github.com/jpillora/xhook
                    return new Promise(function(resolve, reject) {
                        var processAfter = async function(response) {
                            var str = await stripAds(url, await response.text(), realFetch);
                            var modifiedResponse = new Response(str);
                            resolve(modifiedResponse);
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
                                    var channelName = (new URL(url)).pathname.match(/([^\/]+)(?=\.\w+$)/)[0];
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
            return realFetch.apply(this, arguments);
        }
    }
    // This hooks fetch in the global scope (which is different to the Worker scope, and therefore different to the Worker fetch hook)
    function hookFetch() {
        var realFetch = window.fetch;
        window.fetch = function(url, init, ...args) {
            if (typeof url === 'string') {
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
            }
            return realFetch.apply(this, arguments);
        }
    }
    declareOptions(window);
    hookFetch();
})();