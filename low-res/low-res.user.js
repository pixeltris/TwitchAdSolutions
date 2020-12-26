// ==UserScript==
// @name         TwitchAdSolutions (low-res)
// @namespace    https://github.com/pixeltris/TwitchAdSolutions
// @version      1.0
// @description  Avoids Twitch ads by using a lower resolution live stream without ads
// @author       pixeltris
// @match        *://*.twitch.tv/*
// @downloadURL  https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res-userscript.js
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function() {
    'use strict';
    function hookFetch() {
        var OPT_ACCESS_TOKEN_PLAYER_TYPE = 'thunderdome';//480p
        //var OPT_ACCESS_TOKEN_PLAYER_TYPE = 'picture-by-picture';//360p
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
    hookFetch();
})();