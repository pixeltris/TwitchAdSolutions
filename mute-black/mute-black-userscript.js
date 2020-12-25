// ==UserScript==
// @name         TwitchAdSolutions (low-res)
// @namespace    https://github.com/pixeltris/TwitchAdSolutions
// @version      1.0
// @description  Twitch ads are muted / blacked out for the duration of the ad
// @author       pixeltris
// @match        *://*.twitch.tv/*
// @downloadURL  https://github.com/pixeltris/TwitchAdSolutions/raw/master/mute-black/mute-black-userscript.js
// @run-at       document-start
// @grant        none
// ==/UserScript==
// Author: https://twitter.com/EthanShulman
(function() {
    'use strict';
    ////////////////////////////
    // BEGIN WORKER
    ////////////////////////////
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
                ${detectAds.toString()}
                ${hookWorkerFetch.toString()}
                hookWorkerFetch();
                importScripts('${jsURL}');
            `
            super(URL.createObjectURL(new Blob([newBlobStr])));
            this.onmessage = function(e) {
                if (e.data.key == 'HideAd') {
                    onFoundAd();
                }
            }
        }
    }
    function getWasmWorkerUrl(twitchBlobUrl) {
        var req = new XMLHttpRequest();
        req.open('GET', twitchBlobUrl, false);
        req.send();
        return req.responseText.split("'")[1];
    }
    async function detectAds(url, textStr) {
        if (!textStr.includes(',live') && textStr.includes('stitched-ad')) {
            postMessage({key:'HideAd'});
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
                            var str = await detectAds(url, await response.text());
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
            }
            return realFetch.apply(this, arguments);
        }
    }
    ////////////////////////////
    // END WORKER
    ////////////////////////////
    var disabledVideo = null;
    var foundAdContainer = false;
    var foundBannerPrev = false;
    var originalVolume = 0;
    /*//Maybe a bit heavy handed...
    var originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function() {
        originalAppendChild.apply(this, arguments);
        if (arguments[0] && arguments[0].innerHTML && arguments[0].innerHTML.includes('tw-c-text-overlay') && arguments[0].innerHTML.includes('ad-banner')) {
            onFoundAd();
        }
    };*/
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
                    foundBannerPrev = true;
                    break;
                }
            }
            if (foundAd) {
                onFoundAd();
            } else if (!foundAd && foundBannerPrev) {
                //if no ad and video blacked out, unmute and disable black out
                if (disabledVideo) {
                    disabledVideo.volume = originalVolume;
                    disabledVideo.style.filter = "";
                    disabledVideo = null;
                    foundAdContainer = false;
                    foundBannerPrev = false;
                }
            }
            setTimeout(checkForAd,100);
        }
        checkForAd();
    });
})();