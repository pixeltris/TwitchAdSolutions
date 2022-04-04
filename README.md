# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

**Don't combine Twitch specific ad blockers.**

## Recommendations

Proxies are the most reliable way of avoiding ads ([buffering / downtime info](full-list.md#proxy-issues)).

- `TTV LOL` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol/ofbbahodfeppoklmgjiokgfdgcndngjm) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/ttv-lol/) / [code](https://github.com/TTV-LOL/extensions)
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [code](https://github.com/arthurbolsoni/Purple-adblock/)

Alternatively:

- `Video Ad-Block, for Twitch` (fork) - [chrome](https://chrome.google.com/webstore/detail/twitch-adblock/ljhnljhabgjcihjoihakgdiicdjncpkd) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch-adblock/) / [code](https://github.com/cleanlock/VideoAdBlockForTwitch)
- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
- `notify-strip` / `notify-swap` / `vaft` - see below

[Read this for a full list and descriptions.](full-list.md)

## Scripts

**There are better / easier to use methods in the above** `Recommendations`.

- notify-strip - [ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip.user.js) / [ublock (permalink)](https://github.com/pixeltris/TwitchAdSolutions/raw/71bed117fc0f7074a9c7a7e89000dbf7db1feb04/notify-strip/notify-strip-ublock-origin.js)
  - Ad segments are replaced by low resolution stream segments.
  - Notifies Twitch that ads were "watched" (reduces preroll ad frequency).
  - *You may experience a small jump in time when the regular stream kicks in*.
- notify-swap - [ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-swap/notify-swap-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-swap/notify-swap.user.js) / [ublock (permalink)](https://github.com/pixeltris/TwitchAdSolutions/raw/71bed117fc0f7074a9c7a7e89000dbf7db1feb04/notify-swap/notify-swap-ublock-origin.js)
  - The same as `notify-strip` with a slightly different method to fix freezing issues (especially on Firefox).
  - *The ad/non-ad transition takes slightly longer than `notify-strip`*.
- vaft - [ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft.user.js) / [ublock (permalink)](https://github.com/pixeltris/TwitchAdSolutions/raw/71bed117fc0f7074a9c7a7e89000dbf7db1feb04/vaft/vaft-ublock-origin.js)
  - `Video Ad-Block, for Twitch` (fork) as a script.
- low-res - [ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/low-res/low-res.user.js) / [ublock (permalink)](https://github.com/pixeltris/TwitchAdSolutions/raw/71bed117fc0f7074a9c7a7e89000dbf7db1feb04/low-res/low-res-ublock-origin.js)
  - No ads.
  - The stream is 480p for the duration of the stream.

*For the sake of security it's recommended to use a permalink when using uBlock Origin (these links do not auto update).*

## Applying a script (uBlock Origin)

- Navigate to the uBlock Origin Dashboard (the extension options)
- Under the `My filters` tab add `twitch.tv##+js(twitch-videoad)`.
- Under the `Settings` tab, enable `I am an advanced user`, then click the cog that appears. Modify the value of `userResourcesLocation` from `unset` to the full url of the solution you wish to use (if a url is already in use, add a space after the existing url). e.g. `userResourcesLocation https://github.com/pixeltris/TwitchAdSolutions/raw/master/notify-strip/notify-strip-ublock-origin.js` 
- To ensure uBlock Origin loads the script I recommend that you disable/enable the uBlock Origin extension (or restart your browser).

*To stop using a script remove the filter and make the url `unset`.*

## Applying a script (userscript)

- Viewing one of the userscript files should prompt the given script to be added.
