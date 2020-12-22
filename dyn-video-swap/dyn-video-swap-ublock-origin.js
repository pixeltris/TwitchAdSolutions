// Adapted from dyn / mute-black
twitch-videoad.js application/javascript
(function() {
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    var tempVideo = null;
    var disabledVideo = null;
    var originalVolume = 0;
    var originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function() {
        originalAppendChild.apply(this, arguments);
        if (arguments[0] && arguments[0].innerHTML && arguments[0].innerHTML.includes('tw-c-text-overlay') && arguments[0].innerHTML.includes('ad-banner')) {
            onFoundAd();
        }
    };
    function onFoundAd() {
        if (!disabledVideo) {
            //get livestream video element
            var liveVid = document.getElementsByTagName("video");
            if (liveVid.length) {
                disabledVideo = liveVid = liveVid[0];
                //mute
                originalVolume = liveVid.volume;
                liveVid.volume = 0;
                //black out
                liveVid.style.filter = "brightness(0%)";
                //hide ad contianers
                var adContainers = document.querySelectorAll('[data-test-selector="sad-overlay"]');
                for (var i = 0; i < adContainers.length; i++) {
                    adContainers[i].style.display = "none";
                }
                var createTempStream = async function() {
                    // Create new video stream TODO: Do this with callbacks
                    var channelName = window.location.pathname.substr(1);// TODO: Better way of determining the channel name
                    var playerType = "thunderdome";
                    var CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
                    var tempM3u8 = null;
                    var accessTokenResponse = await fetch('https://api.twitch.tv/api/channels/' + channelName + '/access_token?oauth_token=undefined&need_https=true&platform=web&player_type=' + playerType + '&player_backend=mediaplayer', {headers:{'client-id':CLIENT_ID}});
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
                                tempM3u8 = streamM3u8Url;
                            } else {
                                console.log('Backup url request (streamM3u8) failed with ' + streamM3u8Response.status);
                            }
                        } else {
                            console.log('Backup url request (encodingsM3u8) failed with ' + encodingsM3u8Response.status);
                        }
                    } else {
                        console.log('Backup url request (accessToken) failed with ' + accessTokenResponse.status);
                    }
                    if (tempM3u8 != null) {
                        tempVideo = document.createElement('video');
                        tempVideo.autoplay = true;
                        tempVideo.volume = originalVolume;
                        disabledVideo.parentElement.insertBefore(tempVideo, disabledVideo.nextSibling);
                        if (Hls.isSupported()) {
                            tempVideo.hls = new Hls();
                            tempVideo.hls.loadSource(tempM3u8);
                            tempVideo.hls.attachMedia(tempVideo);
                        }
                        //console.log(tempVideo);
                        //console.log(tempM3u8);
                    }
                }
                createTempStream();
            }
        }
    }
    window.addEventListener("DOMContentLoaded", function() {
        function checkForAd() {
            //check ad by looking for text banner
            var adBanner = document.querySelectorAll("span.tw-c-text-overlay");
            var foundAd = false;
            for (var i = 0; i < adBanner.length; i++) {
                if (adBanner[i].attributes["data-test-selector"]) {
                    foundAd = true;
                    break;
                }
            }
            if (tempVideo && disabledVideo && tempVideo.paused != disabledVideo.paused) {
                if (disabledVideo.paused) {
                    tempVideo.pause();
                } else {
                    tempVideo.play();
                }
            }
            if (foundAd && typeof Hls !== 'undefined') {
                onFoundAd();
            } else {
                //if no ad and video blacked out, unmute and disable black out
                if (disabledVideo) {
                    disabledVideo.volume = originalVolume;
                    disabledVideo.style.filter = "";
                    disabledVideo = null;
                    if (tempVideo) {
                        tempVideo.hls.stopLoad();
                        tempVideo.remove();
                        tempVideo = null;
                    }
                }
            }
            setTimeout(checkForAd,100);
        }
        checkForAd();
        if (typeof Hls === 'undefined') {
            var script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
            document.head.appendChild(script);
        }
    });
})();