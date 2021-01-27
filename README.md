# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

## Recommendations

M3U8 proxies (or full proxies / VPNs) are currently the most reliable way of avoiding ads. More proxy hosts would be ideal (see [#8](https://github.com/pixeltris/TwitchAdSolutions/issues/8)).

- `Twitch AdBlock` - [chrome](https://chrome.google.com/webstore/detail/twitch-adblock/mipdalemhlhfenbikcloloheedmmecme) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch-adblock/) - [code](https://robwu.nl/crxviewer/?crx=mipdalemhlhfenbikcloloheedmmecme&qf=js/background.js)

Alternatively:

- `dyn-skip-midroll-alt` is ok-ish.
- `Alternate Player for Twitch.tv` consistently updates with new ad-blocking methods.
- `ttv_adEraser` somewhat fixes the purple screen issue of `ttv-ublock`.
- `ttv-tools` (firefox) has nice features.

## Current solutions

*These solutions generally aren't compatible with other Twitch ad blockers. e.g. `ttv-ublock` will break some of these.*

**If you want a perfect solution, please use `Twitch AdBlock`.**

- notify-strip ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip.user.js))
  - Similar to `strip`, but notifies Twitch that ads were "watched" (reduces preroll ad frequency).
  - The `strip` variant used here should't have looping issues on preroll ads, but may suffer more issues on midroll ads.
- notify-strip-reload
  - Adds a reload step to `notify-strip` which may reduce issues transitioning away from the low resolution stream.
- notify-reload ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip-reload/notify-strip-reload-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip-reload/notify-strip-reload.user.js))
  - Notifies that ads were watched, then reloads the player.
  - Repeats this until no ads **(which may never happen ~ infinite reload)**.
- strip ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/strip/strip-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/strip/strip.user.js))
  - Ad segments are replaced by low resolution stream segments (on a m3u8 level).
  - Skips 2-3 seconds when switching to the live stream.
  - Stuttering and looping of segments often occur (during the ad segments).
  - **NOTE: Removing segments doesn't notify Twitch that ads were watched (aka more served ads).**
- low-res ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res.user.js))
  - No ads.
  - The stream is 480p for the duration of the stream.
- mute-black ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/mute-black/mute-black-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/mute-black/mute-black.user.js))
  - Ads are muted / blacked out for the duration of the ad.
  - You might see tiny bits of the ad.
- video-swap ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap/video-swap-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap/video-swap.user.js))
  - Ads are replaced by a low resolution stream for the duration of the ad.
  - Similar to `strip`, but skips closer to 20 seconds when switching to the live stream (TODO: low latency support).
  - You might see tiny bits of the ad.
  - Audio controls wont work whilst the ad is playing.
  - *There are Various UX/UI issues with this script which need to be addressed.*
- ~~proxy-m3u8 ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/proxy-m3u8/proxy-m3u8-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/proxy-m3u8/proxy-m3u8.user.js))~~ **(proxy currently points to a dead url)**
  - Uses a proxy server to fetch an ad-free stream.
  - Currently only the initial m3u8 is proxied, so there shouldn't be any additional latency.
  - **Assumes the proxy server acts in good faith and maintains a good uptime.**

*A number of changes were made on 27th Jan 2021, including name changes and removal of scripts. Deprecated scripts will be removed from master branch on 1st March 2021. Obtain a permalink if you want to keep using any of the following:*

- `dyn` renamed to `strip` as this better reflects the functionality (strips ad segments).
- `dyn-skip` removed as it no longer works.
- `dyn-skip-midroll` renamed to `notify-reload` as the original name has lost its meaning.
- `dyn-skip-midroll-alt` renamed to `notify-strip` as the original name has lost its meaning.
- `dyn-video-swap` renamed to `video-swap`.

## Applying a solution (uBlock Origin)

- Navigate to the uBlock Origin Dashboard (the extension options)
- Under the `My filters` tab add `twitch.tv##+js(twitch-videoad)`.
- Under the `Settings` tab, enable `I am an advanced user`, then click the cog that appears. Modify the value of `userResourcesLocation` from `unset` to the full url of the solution you wish to use (if a url is already in use, add a space after the existing url). e.g. `userResourcesLocation https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/master/dyn/dyn-ublock-origin.js` 
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
- [Twitch AdBlock](https://chrome.google.com/webstore/detail/twitch-adblock/mipdalemhlhfenbikcloloheedmmecme) - [code](https://robwu.nl/crxviewer/?crx=mipdalemhlhfenbikcloloheedmmecme&qf=js/background.js) (extension)

---

- https://github.com/streamlink/streamlink (desktop application)
- https://github.com/nopbreak/TwitchMod (android app)
- https://twitchls.com/ (external site - purple screen may display every 10-15 mins)
- [Use a VPN targeting a region without ads](https://reddit.com/r/Twitch/comments/kisdsy/i_did_a_little_test_regarding_ads_on_twitch_and/)

## NOTE/TODO

NOTE: Many of these solutions could do with improvements.  
TODO: Test midroll ads.  
TODO: More testing in general.  
