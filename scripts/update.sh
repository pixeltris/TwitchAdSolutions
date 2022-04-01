#!/bin/bash
vaft="$(curl -s https://api.github.com/repos/cleanlock/VideoAdBlockForTwitch/commits/master | jq -r "((now - (.commit.author.date | fromdateiso8601) )  / (60*60*24)  | trunc)")"

if [[ $vaft = 0 ]]; then
    cd ../vaft
    curl -o vaft-ublock-origin.js https://raw.githubusercontent.com/cleanlock/VideoAdBlockForTwitch/master/remove_video_ads.js
    echo -e "// This code is directly copied from https://github.com/cleanlock/VideoAdBlockForTwitch (only change is whitespace is removed for the ublock origin script - also indented)\ntwitch-videoad.js application/javascript\n(function() {\nif ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }\n$(cat vaft-ublock-origin.js)" > vaft-ublock-origin.js
    echo "})();" >> vaft-ublock-origin.js
    js-beautify -r vaft-ublock-origin.js
    curl -o vaft-user.js https://raw.githubusercontent.com/cleanlock/VideoAdBlockForTwitch/master/remove_video_ads.js
    echo -e "// ==UserScript==\n// @name         TwitchAdSolutions (vaft)\n// @namespace    https://github.com/pixeltris/TwitchAdSolutions\n// @version      5.3.5\n// @description  Multiple solutions for blocking Twitch ads (vaft)\n// @updateURL    https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft.user.js\n// @downloadURL  https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft.user.js\n// @author       https://github.com/cleanlock/VideoAdBlockForTwitch#credits\n// @match        *://*.twitch.tv/*\n// @run-at       document-start\n// @grant        none\n// ==/UserScript==\n// This code is directly copied from https://github.com/cleanlock/VideoAdBlockForTwitch (only change is whitespace is removed for the ublock origin script - also indented)\n(function() {\n    'use strict';\n$(cat vaft-ublock-origin.js)" > vaft.user.js
    echo "})();" >> vaft.user.js
    js-beautify -r vaft-user.js
else
    echo "Already updated."
fi