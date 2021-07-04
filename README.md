# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

## Recommendations

Proxies are the most reliable way of avoiding ads ([buffering / downtime info](full-list.md#proxy-issues)).

- `TTV LOL` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol/ofbbahodfeppoklmgjiokgfdgcndngjm) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/ttv-lol/) / [code](https://github.com/TTV-LOL/extensions)
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [code](https://github.com/arthurbolsoni/Purple-adblock/)

Alternatively:

- `Video Ad-Block, for Twitch` - [chrome](https://chrome.google.com/webstore/detail/video-ad-block-for-twitch/kgeglempfkhalebjlogemlmeakondflc) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/video-ad-block-for-twitch/) / [code](https://github.com/saucettv/VideoAdBlockForTwitch)
- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
- `Ad-Free But 480p, for Twitch` - [chrome](https://chrome.google.com/webstore/detail/ad-free-but-480p-for-twit/kdicfccgckkckdkcbilhbeacnnkcmpeb) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/ad-free-but-480p-for-twitch/) / [code](https://github.com/saucettv/AdFreeBut480pForTwitch)
- `notify-strip` - see below

[Read this for a full list and descriptions.](full-list.md)

## Scripts

**There are better / easier to use methods in the above** `Recommendations`.

*Don't combine these scripts with other Twitch specific ad blockers.*

- notify-strip ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip.user.js))
  - Ad segments are replaced by low resolution stream segments.
  - Notifies Twitch that ads were "watched" (reduces preroll ad frequency).
  - *You may experience a small jump in time when the regular stream kicks in*.
- notify-reload ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-reload/notify-reload-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-reload/notify-reload.user.js))
  - Notifies that ads were watched, then reloads the player (preroll only, falls back to `notify-strip` on midroll).
  - Repeats this until no ads **(which may never happen ~ infinite reload)**.
  - You should expect 3-10 player reloads (give or take). Once successful you shouldn't see preroll ads for a while on any stream (10+ minutes?).
- low-res ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res.user.js))
  - No ads.
  - The stream is 480p for the duration of the stream.

## Applying a script (uBlock Origin)

- Navigate to the uBlock Origin Dashboard (the extension options)
- Under the `My filters` tab add `twitch.tv##+js(twitch-videoad)`.
- Under the `Settings` tab, enable `I am an advanced user`, then click the cog that appears. Modify the value of `userResourcesLocation` from `unset` to the full url of the solution you wish to use (if a url is already in use, add a space after the existing url). e.g. `userResourcesLocation https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip-ublock-origin.js` 
- To ensure uBlock Origin loads the script I recommend that you disable/enable the uBlock Origin extension (or restart your browser).

## Applying a script (userscript)

- Viewing one of the userscript files should prompt the given script to be added.