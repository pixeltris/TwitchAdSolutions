# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

## Recommendations

M3U8 proxies (or full proxies / VPNs) are currently the most reliable way of avoiding ads. More proxy hosts would be ideal (see [#8](https://github.com/pixeltris/TwitchAdSolutions/issues/8)).

- `TTV.LOL` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol/ofbbahodfeppoklmgjiokgfdgcndngjm) / [code](https://github.com/TTV-LOL/extensions)
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [code](https://github.com/arthurbolsoni/Purple-adblock/)
- *`Twitch AdBlock` was taken down on March 31 (see [#22](https://github.com/pixeltris/TwitchAdSolutions/issues/22)).*

Alternatively:

- `notify-strip` is ok-ish.
- `Alternate Player for Twitch.tv` consistently updates with new ad-blocking methods.
- `ttv_adEraser` somewhat fixes the purple screen issue of `ttv-ublock`.
- `ttv-tools` (firefox) has nice features.

## Current solutions

*These solutions generally aren't compatible with other Twitch ad blockers. e.g. `ttv-ublock` will break some of these.*

**If you want a perfect solution, please use** `TTV.LOL` or `Purple AdBlock`.

- notify-strip ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip.user.js))
  - The same as `strip`, but notifies Twitch that ads were "watched" (reduces preroll ad frequency).
  - *Audio sync issues? Infinite loading on midrolls? Try ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/c3e1ee390ae684fe47d5159c689332d53e67094d/notify-strip/notify-strip-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/c3e1ee390ae684fe47d5159c689332d53e67094d/notify-strip/notify-strip.user.js)) TODO: Fix these issues [#17](https://github.com/pixeltris/TwitchAdSolutions/issues/17) [#24](https://github.com/pixeltris/TwitchAdSolutions/issues/24).*
- notify-reload ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-reload/notify-reload-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-reload/notify-reload.user.js))
  - Notifies that ads were watched, then reloads the player.
  - Repeats this until no ads **(which may never happen ~ infinite reload)**.
  - You should expect 3-10 player reloads (give or take). Once successful you shouldn't see preroll ads for a while on any stream (10+ minutes?).
- strip ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/strip/strip-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/strip/strip.user.js))
  - Ad segments are replaced by low resolution stream segments (on a m3u8 level).
  - *TODO: Fix midrolls issues (stream freezes for several seconds / potentially longer low res than needed).*
  - **NOTE: Removing segments doesn't notify Twitch that ads were watched (aka more served ads).**
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
- [Ad-Free But 480p, for Twitch](https://gist.github.com/saucettv/06c470c4150398d4505381bfad67bf0b) - [firefox](https://addons.mozilla.org/en-GB/firefox/addon/ad-free-but-480p-for-twitch/)

---

- https://github.com/streamlink/streamlink (desktop application)
- [multiChat for Twitch](https://play.google.com/store/apps/details?id=org.mchatty) (android app)
- https://twitchls.com/ (external site - purple screen may display every 10-15 mins)
- [Use a VPN targeting a region without ads](https://reddit.com/r/Twitch/comments/kisdsy/i_did_a_little_test_regarding_ads_on_twitch_and/)

## NOTE/TODO

NOTE: Many of these solutions could do with improvements.  
TODO: Test midroll ads.  
TODO: More testing in general.  
