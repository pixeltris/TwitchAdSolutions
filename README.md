# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

**Don't combine Twitch specific ad blockers.**

## Recommendations

Proxies are the most reliable way of avoiding ads ([buffering / downtime info](full-list.md#proxy-issues)).

- `TTV LOL` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol/ofbbahodfeppoklmgjiokgfdgcndngjm) / [code](https://github.com/TTV-LOL/extensions)
- `TTV LOL PRO` - [code](https://github.com/younesaassila/ttv-lol-pro)

Alternatively:

- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
- `Video Ad-Block, for Twitch` (fork) - [chrome](https://chrome.google.com/webstore/detail/twitch-adblock/ljhnljhabgjcihjoihakgdiicdjncpkd) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch-adblock/) / [code](https://github.com/cleanlock/VideoAdBlockForTwitch)
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [code](https://github.com/arthurbolsoni/Purple-adblock/)
- `ttv-ublock` - [chrome](https://chrome.google.com/webstore/detail/ttv-ad-block/kndhknfnihidhcfnaacnndbolonbimai) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/ttv-adblock/) / [code](https://github.com/odensc/ttv-ublock)
- `AdGuard Extra (Beta)` - [chrome](https://chrome.google.com/webstore/detail/adguard-extra-beta/mglpocjcjbekdckiahfhagndealpkpbj) / [firefox](https://github.com/AdguardTeam/AdGuardExtra/#firefox)
- `video-swap-new` - see below

[Read this for a full list and descriptions.](full-list.md)

## Scripts

**There are better / easier to use methods in the above recommendations.**

- video-swap-new - [ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap-new/video-swap-new-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap-new/video-swap-new.user.js) / [ublock (permalink)](https://github.com/pixeltris/TwitchAdSolutions/raw/bc355dda0ae98e142577e8521ad1857ccdb3b724/video-swap-new/video-swap-new-ublock-origin.js)
  - Uses the embed player during ads.
  - *Full screen ad message displayed during ads.* [Read the twitch announcement](https://discuss.dev.twitch.tv/t/an-updated-twitch-embedded-player-viewer-experience/41718)
  - *You may notice a seemingly random player reload some time after the ad message is gone.*
- vaft - [ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft.user.js) / [ublock (permalink)](https://github.com/pixeltris/TwitchAdSolutions/raw/bc355dda0ae98e142577e8521ad1857ccdb3b724/vaft/vaft-ublock-origin.js)
  - `Video Ad-Block, for Twitch` (fork) as a script.
  - *Full screen ad message displayed during ads.*

*For the sake of security it's recommended to use a permalink when using uBlock Origin (permalinks do not auto update).*

## Applying a script (uBlock Origin)

- Navigate to the uBlock Origin Dashboard (the extension options)
- Under the `My filters` tab add `twitch.tv##+js(twitch-videoad)`.
- Under the `Settings` tab, enable `I am an advanced user`, then click the cog that appears. Modify the value of `userResourcesLocation` from `unset` to the full url of the solution you wish to use (if a url is already in use, add a space after the existing url). e.g. `userResourcesLocation https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft-ublock-origin.js` 
- To ensure uBlock Origin loads the script I recommend that you disable/enable the uBlock Origin extension (or restart your browser).

*To stop using a script remove the filter and make the url `unset`.*

## Applying a script (userscript)

- Viewing one of the userscript files should prompt the given script to be added.
