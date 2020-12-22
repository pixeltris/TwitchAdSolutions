// Author: https://twitter.com/EthanShulman
twitch-videoad.js application/javascript
(function() {
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    window.addEventListener("DOMContentLoaded", function() {
        //current state of if video is disabled
        var disabledVideo = null;
        var originalVolume = 0;
        //repeatedly check for ad
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
            if (foundAd) {
                //if found ad and video is visible, black out video and mute
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
                    }
                }
            } else {
                //if no ad and video blacked out, unmute and disable black out
                if (disabledVideo) {
                    disabledVideo.volume = originalVolume;
                    disabledVideo.style.filter = "";
                    disabledVideo = null;
                }
            }
            setTimeout(checkForAd,100);
        }
        checkForAd();
    });
})();