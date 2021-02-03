// ==UserScript==
// @name         TwitchAdSolutions mute black
// @namespace    https://github.com/pixeltris/TwitchAdSolutions
// @version      1.4
// @updateURL    https://github.com/pixeltris/TwitchAdSolutions/raw/master/mute-black/mute-black.user.js
// @downloadURL  https://github.com/pixeltris/TwitchAdSolutions/raw/master/mute-black/mute-black.user.js
// @description  Multiple solutions for blocking Twitch ads (mute-black)
// @author       pixeltris, Mathnerd314
// @match        *://*.twitch.tv/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function() {
    'use strict';
    ////////////////////////////////////
    // stream mute
    ////////////////////////////////////
    var disabledVideo = null;// The original video element (disabled for the duration of the ad)
    var originalVolume = 0;// The volume of the original video element
    var foundAdContainer = false;// Have ad containers been found (the clickable ad)
    var foundAdBanner = false;// Is the ad banner visible (top left of screen)

	function onFoundAd() {
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
                console.log("muting video");
                //mute
                originalVolume = liveVid.volume;
                liveVid.volume = 0;
                //black out
                liveVid.style.filter = "brightness(0%)";
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
        if (foundAd) {
            onFoundAd();
        } else if (!foundAd && foundAdBanner) {
            if (disabledVideo) {
                disabledVideo.volume = originalVolume;
                disabledVideo.style.filter = "";
                disabledVideo = null;
                foundAdContainer = false;
                foundAdBanner = false;
            }
        }
    }
    let observer = null;
	function onContentLoaded() {
		pollForAds();

		observer = new MutationObserver(pollForAds);
		observer.observe(document.body, {
			childList: true
			, subtree: true
			, attributes: false
			, characterData: false
		});
    }
    if (document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive") {
        onContentLoaded();
    } else {
        window.addEventListener("DOMContentLoaded", function() {
            onContentLoaded();
        });
    }
})();

