twitch-videoad.js application/javascript
(function() {
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    function declareOptions(scope) {
        // Options / globals
        scope.OPT_ROLLING_DEVICE_ID = true;
        scope.OPT_MODE_STRIP_AD_SEGMENTS = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_MIN_REQUESTS = false;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT = false;
        scope.OPT_BACKUP_PLAYER_TYPE = 'picture-by-picture';//'picture-by-picture';'thunderdome';
        scope.OPT_REGULAR_PLAYER_TYPE = 'site';
        scope.OPT_INITIAL_M3U8_ATTEMPTS = 1;
        scope.OPT_ACCESS_TOKEN_PLAYER_TYPE = 'site';
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
            this.onmessage = function(e) {
                // NOTE: Removed adDiv caching as '.video-player' can change between streams?
                if (e.data.key == 'UboShowAdBanner') {
                    var adDiv = getAdDiv();
                    if (adDiv != null) {
                        adDiv.P.textContent = 'Blocking' + (e.data.isMidroll ? ' midroll' : '') + ' ads...';
                        adDiv.style.display = 'block';
                    }
                }
                else if (e.data.key == 'UboHideAdBanner') {
                    var adDiv = getAdDiv();
                    if (adDiv != null) {
                        adDiv.style.display = 'none';
                    }
                }
                else if (e.data.key == 'UboFoundAdSegment') {
                    onFoundAd(e.data.isMidroll, e.data.streamM3u8);
                }
                else if (e.data.key == 'UboChannelNameM3U8Changed') {
                    //console.log('M3U8 channel name changed to ' + e.data.value);
                }
                else if (e.data.key == 'UboReloadPlayer') {
                    reloadTwitchPlayer();
                }
                else if (e.data.key == 'UboPauseResumePlayer') {
                    reloadTwitchPlayer(false, true);
                }
                else if (e.data.key == 'UboSeekPlayer') {
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
    async function processM3U8(url, textStr, realFetch) {
        var streamInfo = StreamInfosByUrl[url];
        if (streamInfo == null) {
            console.log('Unknown stream url ' + url);
            postMessage({key:'UboHideAdBanner'});
            return textStr;
        }
        if (!OPT_MODE_STRIP_AD_SEGMENTS) {
            return textStr;
        }
        var haveAdTags = textStr.includes(AD_SIGNIFIER);
        if (haveAdTags) {
            var currentResolution = null;
            for (const [resUrl, resName] of Object.entries(streamInfo.Urls)) {
                if (resUrl == url) {
                    currentResolution = resName;
                    //console.log(resName);
                    break;
                }
            }
            streamInfo.HadAds[url] = true;
            streamInfo.IsMidroll = textStr.includes('"MIDROLL"') || textStr.includes('"midroll"');
            postMessage({key:'UboShowAdBanner',isMidroll:streamInfo.IsMidroll});
            // Notify ads "watched" TODO: Keep crafting these requests even after ad tags are gone as sometimes it stops too early.
            // Deferred to after backup obtained to reduce slowdown. Midrolls are futile.
            if (OPT_MODE_NOTIFY_ADS_WATCHED && !streamInfo.IsMidroll && (streamInfo.BackupFailed || streamInfo.BackupUrl != null)) {
                await tryNotifyAdsWatchedM3U8(textStr);
            }
            postMessage({
                key: 'UboFoundAdSegment',
                isMidroll: streamInfo.IsMidroll,
                streamM3u8: textStr
            });
            if (!streamInfo.IsMidroll && OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT) {
                return '';
            }
            // NOTE: Got a bit of code duplication here, merge Backup/BackupReg in some form.
            // See if there's clean stream url to fetch (only do this after we have a regular backup, this should save time and you're unlikely to find a clean stream on first request)
            try {
                if (streamInfo.BackupRegRes != currentResolution) {
                    streamInfo.BackupRegRes = null;
                    streamInfo.BackupRegUrl = null;
                }
                if (currentResolution && streamInfo.BackupRegUrl == null && (streamInfo.BackupFailed || streamInfo.BackupUrl != null)) {
                    var accessTokenResponse = await getAccessToken(streamInfo.ChannelName, OPT_REGULAR_PLAYER_TYPE);
                    if (accessTokenResponse.status === 200) {
                        var accessToken = await accessTokenResponse.json();
                        var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + streamInfo.ChannelName + '.m3u8' + streamInfo.RootM3U8Params);
                        urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                        urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
                        var encodingsM3u8Response = await realFetch(urlInfo.href);
                        if (encodingsM3u8Response.status === 200) {
                            var encodingsM3u8 = await encodingsM3u8Response.text();
                            var encodingsLines = encodingsM3u8.replace('\r', '').split('\n');
                            for (var i = 0; i < encodingsLines.length; i++) {
                                if (!encodingsLines[i].startsWith('#') && encodingsLines[i].includes('.m3u8')) {
                                    if (i > 0 && encodingsLines[i - 1].startsWith('#EXT-X-STREAM-INF')) {
                                        var res = parseAttributes(encodingsLines[i - 1])['RESOLUTION'];
                                        if (res && res == currentResolution) {
                                            streamInfo.BackupRegUrl = encodingsLines[i];
                                            streamInfo.BackupRegRes = currentResolution;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (streamInfo.BackupRegUrl != null) {
                    var backupM3u8 = null;
                    var backupM3u8Response = await realFetch(streamInfo.BackupRegUrl);
                    if (backupM3u8Response.status == 200) {
                        backupM3u8 = await backupM3u8Response.text();
                    }
                    if (backupM3u8 != null && !backupM3u8.includes(AD_SIGNIFIER)) {
                        return backupM3u8;
                    } else {
                        //console.log('Try use regular resolution failed');
                        streamInfo.BackupRegRes = null;
                        streamInfo.BackupRegUrl = null;
                    }
                }
            } catch (err) {
                streamInfo.BackupRegRes = null;
                streamInfo.BackupRegUrl = null;
                console.log('Fetching backup (regular resolution) m3u8 failed');
                console.log(err);
            }
            // Fetch backup url
            try {
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
                if (streamInfo.BackupUrl != null) {
                    var backupM3u8 = null;
                    var backupM3u8Response = await realFetch(streamInfo.BackupUrl);
                    if (backupM3u8Response.status == 200) {
                        backupM3u8 = await backupM3u8Response.text();
                    }
                    if (backupM3u8 != null && !backupM3u8.includes(AD_SIGNIFIER)) {
                        return backupM3u8;
                    } else {
                        console.log('Backup m3u8 failed with ' + backupM3u8Response.status);
                    }
                }
            } catch (err) {
                console.log('Fetching backup m3u8 failed');
                console.log(err);
            }
            // Backups failed. Return nothing and reload the player (reload required as an empty result will terminate the stream).
            console.log('Ad blocking failed. Stream might break.');
            postMessage({key:'UboReloadPlayer'});
            streamInfo.BackupFailed = false;
            streamInfo.BackupUrl = null;
            return '';
        }
        if (streamInfo.HadAds[url]) {
            postMessage({key:'UboPauseResumePlayer'});
            streamInfo.HadAds[url] = false;
        }
        postMessage({key:'UboHideAdBanner'});
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
                    if (OPT_MODE_STRIP_AD_SEGMENTS) {
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
                                        streamInfo.Urls = [];// xxx.m3u8 -> "284x160" (resolution)
                                        streamInfo.RootM3U8Url = url;
                                        streamInfo.RootM3U8Params = (new URL(url)).search;
                                        streamInfo.BackupUrl = null;
                                        streamInfo.BackupFailed = false;
                                        streamInfo.BackupRegUrl = null;
                                        streamInfo.BackupRegRes = null;
                                        streamInfo.IsMidroll = false;
                                        streamInfo.HadAds = [];// xxx.m3u8 -> bool (had ads on prev request)
                                        var lines = encodingsM3u8.replace('\r', '').split('\n');
                                        for (var i = 0; i < lines.length; i++) {
                                            if (!lines[i].startsWith('#') && lines[i].includes('.m3u8')) {
                                                streamInfo.Urls[lines[i]] = -1;
                                                if (i > 0 && lines[i - 1].startsWith('#EXT-X-STREAM-INF')) {
                                                    var res = parseAttributes(lines[i - 1])['RESOLUTION'];
                                                    if (res) {
                                                        streamInfo.Urls[lines[i]] = res;
                                                    }
                                                }
                                                streamInfo.HadAds[lines[i]] = false;
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
        return fetchFunc('https://gql.twitch.tv/gql', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'client-id': CLIENT_ID,
                'X-Device-Id': OPT_ROLLING_DEVICE_ID ? gql_device_id_rolling : gql_device_id
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
                            newBody.variables.playerType = OPT_ACCESS_TOKEN_PLAYER_TYPE;
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
                    }
                }
            }
            return realFetch.apply(this, arguments);
        }
    }
    function onFoundAd(isMidroll, streamM3u8) {
        if (OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT && !isMidroll) {
            console.log('OPT_MODE_NOTIFY_ADS_WATCHED_RELOAD_PLAYER_ON_AD_SEGMENT');
            if (streamM3u8) {
                tryNotifyAdsWatchedM3U8(streamM3u8);
            }
            reloadTwitchPlayer();
        }
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
    }
    if (document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive") {
        onContentLoaded();
    } else {
        window.addEventListener("DOMContentLoaded", function() {
            onContentLoaded();
        });
    }
})();
