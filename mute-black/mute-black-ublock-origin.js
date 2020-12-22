// Author: https://twitter.com/EthanShulman
twitch-videoad.js application/javascript
(function() {
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    var disabledVideo = null;
    var foundAdContainer = false;
    var originalVolume = 0;
    var originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function() {
        originalAppendChild.apply(this, arguments);
        if (arguments[0] && arguments[0].innerHTML && arguments[0].innerHTML.includes('tw-c-text-overlay') && arguments[0].innerHTML.includes('ad-banner')) {
            onFoundAd();
        }
    };
    function onFoundAd() {
        if (!foundAdContainer) {
            //hide ad contianers
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
                //mute
                originalVolume = liveVid.volume;
                liveVid.volume = 0;
                //black out
                liveVid.style.filter = "brightness(0%)";
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
            if (foundAd) {
                onFoundAd();
            } else {
                //if no ad and video blacked out, unmute and disable black out
                if (disabledVideo) {
                    disabledVideo.volume = originalVolume;
                    disabledVideo.style.filter = "";
                    disabledVideo = null;
                    foundAdContainer = false;
                }
            }
            setTimeout(checkForAd,100);
        }
        checkForAd();
    });
})();