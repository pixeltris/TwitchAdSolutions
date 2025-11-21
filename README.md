# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

**Don't combine Twitch specific ad blockers.**

## Recommendations

Proxies are the most reliable way of avoiding ads ([buffering / downtime info](full-list.md#proxy-issues)).

- `TTV LOL PRO` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol-pro/bpaoeijjlplfjbagceilcgbkcdjbomjd) / [firefox](https://addons.mozilla.org/addon/ttv-lol-pro/) / [code](https://github.com/younesaassila/ttv-lol-pro)

Alternatively:

- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [userscript](https://raw.githubusercontent.com/arthurbolsoni/Purple-adblock/refs/heads/main/platform/tampermonkey/dist/purpleadblocker.user.js) / [code](https://github.com/arthurbolsoni/Purple-adblock/)
- `AdGuard Extra` - [chrome](https://chrome.google.com/webstore/detail/adguard-extra-beta/mglpocjcjbekdckiahfhagndealpkpbj) / [firefox](https://github.com/AdguardTeam/AdGuardExtra/#firefox) / [userscript](https://userscripts.adtidy.org/release/adguard-extra/1.0/adguard-extra.user.js)
- `vaft` - see below

[Read this for a full list and descriptions.](full-list.md)

[Also see this list maintained by @zGato.](https://github.com/zGato/ScrewTwitchAds)

## Scripts

**There are better / easier to use methods in the above recommendations.**

- vaft - [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft.user.js) / [ublock](https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/master/vaft/vaft-ublock-origin.js) / [ublock (permalink)](https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/9cae451c04a9a94859da7de19c367b58afdd95bc/vaft/vaft-ublock-origin.js)
  - Attempts to get a clean stream as fast as it can
  - If it fails to get a clean stream it removes ad segments (no playback until ad-free stream is found)
- video-swap-new - [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap-new/video-swap-new.user.js) / [ublock](https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/master/video-swap-new/video-swap-new-ublock-origin.js) / [ublock (permalink)](https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/9cae451c04a9a94859da7de19c367b58afdd95bc/video-swap-new/video-swap-new-ublock-origin.js)
  - Attempts to get a clean stream
  - If it fails to get a clean stream it removes ad segments (no playback until ad-free stream is found)
  - Not recommended, `vaft` is a better script

## Applying a script (uBlock Origin)

- Navigate to the uBlock Origin Dashboard (the extension options)
- Under the `My filters` tab add `twitch.tv##+js(twitch-videoad)`.
- Under the `Settings` tab, enable `I am an advanced user`, then click the cog that appears. Modify the value of `userResourcesLocation` from `unset` to the full url of the solution you wish to use (if a url is already in use, add a space after the existing url). e.g. `userResourcesLocation https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/master/vaft/vaft-ublock-origin.js` 
- To ensure uBlock Origin loads the script I recommend that you disable/enable the uBlock Origin extension (or restart your browser).

To stop using a script remove the filter and make the url `unset`.

*For the sake of security it's recommended to use a permalink when using uBlock Origin (permalinks do not auto update).*

*The scripts __may randomly stop being applied by uBlock Origin__ for unknown reasons ([#200](https://github.com/pixeltris/TwitchAdSolutions/issues/200)). It's recommended to use the userscript versions instead.*

## Applying a script (userscript)

Viewing one of the userscript files should prompt the given script to be added when you have a userscript manager installed.

Userscript managers:

- https://violentmonkey.github.io/
- https://www.tampermonkey.net/
- https://apps.apple.com/us/app/userscripts/id1463298887

## Issues with the scripts

If the script doesn't work or you're experiencing freezing / buffering issues see [issues.md](issues.md)