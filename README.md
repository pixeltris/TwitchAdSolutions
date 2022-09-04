# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

**Don't combine Twitch specific ad blockers.**

## Recommendations

Proxies are the most reliable way of avoiding ads ([buffering / downtime info](full-list.md#proxy-issues)).

- `TTV LOL` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol/ofbbahodfeppoklmgjiokgfdgcndngjm) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/ttv-lol/) / [code](https://github.com/TTV-LOL/extensions)

Alternatively:

- `Video Ad-Block, for Twitch` (fork) - [chrome](https://chrome.google.com/webstore/detail/twitch-adblock/ljhnljhabgjcihjoihakgdiicdjncpkd) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch-adblock/) / [code](https://github.com/cleanlock/VideoAdBlockForTwitch)
- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [code](https://github.com/arthurbolsoni/Purple-adblock/)
- `ttv-ublock` - [chrome](https://chrome.google.com/webstore/detail/ttv-ad-block/kndhknfnihidhcfnaacnndbolonbimai) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/ttv-adblock/) / [code](https://github.com/odensc/ttv-ublock)
- `vaft` - see below

[Read this for a full list and descriptions.](full-list.md)

## Scripts

**There are better / easier to use methods in the above recommendations.**

- vaft - [ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft.user.js) / [ublock (permalink)](https://github.com/pixeltris/TwitchAdSolutions/raw/338dadc691551a3ed3a82c2e336f59072e6d7167/vaft/vaft-ublock-origin.js)
  - `Video Ad-Block, for Twitch` (fork) as a script.
  - *If the ad-free stream fails you'll see an adblocker warning. For more info see [#89](https://github.com/pixeltris/TwitchAdSolutions/issues/89).*

*For the sake of security it's recommended to use a permalink when using uBlock Origin (permalinks do not auto update).*

## Applying a script (uBlock Origin)

- Navigate to the uBlock Origin Dashboard (the extension options)
- Under the `My filters` tab add `twitch.tv##+js(twitch-videoad)`.
- Under the `Settings` tab, enable `I am an advanced user`, then click the cog that appears. Modify the value of `userResourcesLocation` from `unset` to the full url of the solution you wish to use (if a url is already in use, add a space after the existing url). e.g. `userResourcesLocation https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft-ublock-origin.js` 
- To ensure uBlock Origin loads the script I recommend that you disable/enable the uBlock Origin extension (or restart your browser).

You can also view a recording of the above steps [from here](https://replayable.io/replay/6313ed2021d6ce0063d2b76e/?share=HJXBZTN8hjg8OLrHOpxiEQ).

*To stop using a script remove the filter and make the url `unset`.*

## Applying a script (userscript)

- Viewing one of the userscript files should prompt the given script to be added.
