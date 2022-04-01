#!/bin/bash
vaft="$(curl -s https://api.github.com/repos/cleanlock/VideoAdBlockForTwitch/commits/master | jq -r "((now - (.commit.author.date | fromdateiso8601) )  / (60*60*24)  | trunc)")"

if [[ $vaft = 0 ]]; then
    cd ../vaft
    curl -o vaft-ublock-origin.js https://raw.githubusercontent.com/cleanlock/VideoAdBlockForTwitch/master/remove_video_ads.js
    echo -e "// This code is directly copied from https://github.com/cleanlock/VideoAdBlockForTwitch (only change is whitespace is removed for the ublock origin script - also indented)\ntwitch-videoad.js application/javascript\n(function() {\nif ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }\n$(cat vaft-ublock-origin.js)" > vaft-ublock-origin.js
    echo "})();" >> vaft-ublock-origin.js
    js-beautify -r vaft-ublock-origin.js
else
    echo "Already updated."
fi