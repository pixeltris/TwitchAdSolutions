# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

## Recommendations

M3U8 proxies (or full proxies / VPNs) are the most reliable way of avoiding ads.

- `TTV.LOL` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol/ofbbahodfeppoklmgjiokgfdgcndngjm) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/ttv-lol/) / [code](https://github.com/TTV-LOL/extensions)
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [code](https://github.com/arthurbolsoni/Purple-adblock/)

Alternatively:

- `Video Ad-Block, for Twitch` - [chrome](https://chrome.google.com/webstore/detail/video-ad-block-for-twitch/kgeglempfkhalebjlogemlmeakondflc) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/video-ad-block-for-twitch/)
- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
- `ttv_adEraser` - [chrome](https://chrome.google.com/webstore/detail/ttv-aderaser/pjnopimdnmhiaanhjfficogijajbhjnc) / [firefox (manual install)](https://github.com/LeonHeidelbach/ttv_adEraser#mozilla-firefox) / [code](https://github.com/LeonHeidelbach/ttv_adEraser)
- `ttv-tools` - [firefox (manual install)](https://github.com/Nerixyz/ttv-tools/releases) / [code](https://github.com/Nerixyz/ttv-tools)
- `notify-strip` - see below

[Read this for more info.](other-solutions.md)

## Current solutions

*Don't combine these scripts with other Twitch specific ad blockers.*

**There are more suitable / easier to use methods in the above** `Recommendations`.

- notify-strip ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip.user.js))
  - Ad segments are replaced by low resolution stream segments.
  - Notifies Twitch that ads were "watched" (reduces preroll ad frequency).
  - *Audio sync issues? Infinite loading on midrolls? Try ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/c3e1ee390ae684fe47d5159c689332d53e67094d/notify-strip/notify-strip-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/c3e1ee390ae684fe47d5159c689332d53e67094d/notify-strip/notify-strip.user.js)) TODO: Fix these issues [#17](https://github.com/pixeltris/TwitchAdSolutions/issues/17) [#24](https://github.com/pixeltris/TwitchAdSolutions/issues/24).*
- notify-reload ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-reload/notify-reload-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-reload/notify-reload.user.js))
  - Notifies that ads were watched, then reloads the player.
  - Repeats this until no ads **(which may never happen ~ infinite reload)**.
  - You should expect 3-10 player reloads (give or take). Once successful you shouldn't see preroll ads for a while on any stream (10+ minutes?).
- low-res ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res.user.js))
  - No ads.
  - The stream is 480p for the duration of the stream.
- mute-black ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/mute-black/mute-black-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/mute-black/mute-black.user.js))
  - Ads are muted / blacked out for the duration of the ad.
  - You might see tiny bits of the ad.

## Applying a solution (uBlock Origin)

- Navigate to the uBlock Origin Dashboard (the extension options)
- Under the `My filters` tab add `twitch.tv##+js(twitch-videoad)`.
- Under the `Settings` tab, enable `I am an advanced user`, then click the cog that appears. Modify the value of `userResourcesLocation` from `unset` to the full url of the solution you wish to use (if a url is already in use, add a space after the existing url). e.g. `userResourcesLocation https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip-ublock-origin.js` 
- To ensure uBlock Origin loads the script I recommend that you disable/enable the uBlock Origin extension (or restart your browser).

## Applying a solution (userscript)

- Viewing one of the userscript files should prompt the given script to be added.

## Other solutions / projects

For a more detailed description of the following please refer to [this](other-solutions.md).

- https://github.com/odensc/ttv-ublock (extension - purple screen may display every 10-15 mins)
- https://github.com/Nerixyz/ttv-tools (Firefox extension)
- https://github.com/LeonHeidelbach/ttv_adEraser (extension)
- https://github.com/instance01/Twitch-HLS-AdBlock (extension)
- https://github.com/Wilkolicious/twitchAdSkip (UserScript + FrankerFaceZ)
- https://gist.github.com/simple-hacker/ddd81964b3e8bca47e0aead5ad19a707 (UserScript + FrankerFaceZ(optional))
- https://greasyfork.org/en/scripts/415412-twitch-refresh-on-advert/code (UserScript + FrankerFaceZ(optional))
- [Alternate Player for Twitch.tv](https://chrome.google.com/webstore/detail/bhplkbgoehhhddaoolmakpocnenplmhf) - [code](https://robwu.nl/crxviewer/?crx=bhplkbgoehhhddaoolmakpocnenplmhf&qf=player.js) (extension)
- https://github.com/TTV-LOL/extensions (extension)
- https://github.com/arthurbolsoni/Purple-adblock (extension)
- [Video Ad-Block, for Twitch](https://github.com/saucettv/VideoAdBlockForTwitch) - [chrome](https://chrome.google.com/webstore/detail/video-ad-block-for-twitch/kgeglempfkhalebjlogemlmeakondflc) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/video-ad-block-for-twitch)

---

- https://github.com/streamlink/streamlink (desktop application)
- [multiChat for Twitch](https://play.google.com/store/apps/details?id=org.mchatty) (android app)
- https://twitchls.com/ (external site - purple screen may display every 10-15 mins)
- [Use a VPN targeting a region without ads](https://reddit.com/r/Twitch/comments/kisdsy/i_did_a_little_test_regarding_ads_on_twitch_and/)

## NOTE/TODO

NOTE: Many of these solutions could do with improvements.  
TODO: Test midroll ads.  
TODO: More testing in general.  
