# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

**Don't combine Twitch specific ad blockers.**

## Recommendations

Proxies are the most reliable way of avoiding ads ([buffering / downtime info](full-list.md#proxy-issues)).

- `TTV LOL PRO` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol-pro/bpaoeijjlplfjbagceilcgbkcdjbomjd) / [firefox](https://addons.mozilla.org/addon/ttv-lol-pro/) / [code](https://github.com/younesaassila/ttv-lol-pro)

Alternatively:

- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [code](https://github.com/arthurbolsoni/Purple-adblock/)
- `AdGuard Extra` - [chrome](https://chrome.google.com/webstore/detail/adguard-extra-beta/mglpocjcjbekdckiahfhagndealpkpbj) / [firefox](https://github.com/AdguardTeam/AdGuardExtra/#firefox) / [userscript](https://userscripts.adtidy.org/release/adguard-extra/1.0/adguard-extra.user.js)
- `video-swap-new` - see below

[Read this for a full list and descriptions.](full-list.md)

[Also see this list maintained by @zGato.](https://github.com/zGato/ScrewTwitchAds)

## Scripts

**There are better / easier to use methods in the above recommendations.**

- video-swap-new - [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap-new/video-swap-new.user.js) / [ublock](https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/master/video-swap-new/video-swap-new-ublock-origin.js) / [ublock (permalink)](https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/e09ca6471c73734386056ed951734126d13ab713/video-swap-new/video-swap-new-ublock-origin.js)
  - Uses a lower resolution stream during ads.
- vaft - [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft.user.js) / [ublock](https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/master/vaft/vaft-ublock-origin.js) / [ublock (permalink)](https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/e09ca6471c73734386056ed951734126d13ab713/vaft/vaft-ublock-origin.js)
  - The same as `video-swap-new` but attempts to get a clean stream faster (may suffer from more freezing / playback issues).

## Applying a script (uBlock Origin)

- Navigate to the uBlock Origin Dashboard (the extension options)
- Under the `My filters` tab add `twitch.tv##+js(twitch-videoad)`.
- Under the `Settings` tab, enable `I am an advanced user`, then click the cog that appears. Modify the value of `userResourcesLocation` from `unset` to the full url of the solution you wish to use (if a url is already in use, add a space after the existing url). e.g. `userResourcesLocation https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/master/video-swap-new/video-swap-new-ublock-origin.js` 
- To ensure uBlock Origin loads the script I recommend that you disable/enable the uBlock Origin extension (or restart your browser).

To stop using a script remove the filter and make the url `unset`.

*For the sake of security it's recommended to use a permalink when using uBlock Origin (permalinks do not auto update).*

*The scripts __may randomly stop being applied by uBlock Origin__ for unknown reasons ([#200](https://github.com/pixeltris/TwitchAdSolutions/issues/200)). It's recommended to use the userscript versions instead.*

## Applying a script (userscript)

- Viewing one of the userscript files should prompt the given script to be added (assuming you have a userscript manager).
