# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

## Current solutions

- dyn-skip ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/dyn-skip/dyn-skip-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/dyn-skip/dyn-skip.user.js))
  - Notifies Twitch that ads were watched before requesting the main live stream.
  - May slightly slow down loading of streams.
  - Falls back to mute-black if this fails (use an alternative solution if it always fails for you, as it adds additional load).
  - **Currently only handles pre-rolls** (mid-roll ads should be blacked out) (mid-rolls will requires a player reload, which currently isn't implemented)
- dyn-video-swap ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/dyn-video-swap/dyn-video-swap-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/dyn-video-swap/dyn-video-swap.user.js))
  - Ads are replaced by a low resolution stream for the duration of the ad.
  - Similar to `dyn`, but skips closer to 20 seconds when switching to the live stream.
  - You might see tiny bits of the ad.
  - Audio controls wont work whilst the ad is playing.
- dyn ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/dyn/dyn-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/dyn/dyn.user.js))
  - Ad segments are replaced by a low resolution stream segments (on a m3u8 level).
  - Skips 2-3 seconds when switching to the live stream.
  - Stuttering and looping of segments often occur (during the ad segments).
  - **NOTE: Removing segments doesn't notify Twitch that ads were watched (aka more served ads).**
- low-res ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res.user.js))
  - No ads.
  - The stream is 480p for the duration of the stream.
- mute-black ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/mute-black/mute-black-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/mute-black/mute-black.user.js))
  - Ads are muted / blacked out for the duration of the ad.
  - You might see tiny bits of the ad.

## Applying a solution (uBlock Origin)

uBlock Origin solutions are single files, suffixed by `ublock-origin.js` e.g. `low-res-ublock-origin.js`.

- Navigate to the uBlock Origin Dashboard (the extension options)
- Under the `My filters` tab add `twitch.tv##+js(twitch-videoad)`.
- Under the `Settings` tab, enable `I am an advanced user`, then click the cog that appears. Modify the value of `userResourcesLocation` from `unset` to the full url of the solution you wish to use (if a url is already in use, add a space after the existing url). e.g. `userResourcesLocation https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/master/dyn/dyn-ublock-origin.js` 

## Applying a solution (userscript)

Tampermonkey / Greasemonkey can be used on the files suffixed by `user.js` e.g. `low-res.user.js`

- Viewing one of the userscript files should prompt the given script to be added

## Other solutions / projects

- https://github.com/odensc/ttv-ublock (extension, purple screen may display every 10-15 mins)
- https://github.com/Nerixyz/ttv-tools (Firefox extension)
- https://github.com/LeonHeidelbach/ttv_adEraser (extension)
- https://github.com/Wilkolicious/twitchAdSkip (UserScript + FrankerFaceZ)
- https://gist.github.com/simple-hacker/ddd81964b3e8bca47e0aead5ad19a707 (UserScript + FrankerFaceZ(optional))
- https://greasyfork.org/en/scripts/415412-twitch-refresh-on-advert/code (UserScript + FrankerFaceZ(optional))
- Alternate Player for Twitch.tv - [code](https://robwu.nl/crxviewer/?crx=bhplkbgoehhhddaoolmakpocnenplmhf&qf=player.js)

## NOTE/TODO

NOTE: Many of these solutions could do with improvements.  
TODO: Add script to auto generate all configured scripts from the base script.  
TODO: Test midroll ads.  
TODO: More testing in general.  
