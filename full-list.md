## Web browser extensions

- `TTV LOL` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol/ofbbahodfeppoklmgjiokgfdgcndngjm) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/ttv-lol/) / [code](https://github.com/TTV-LOL/extensions)
  - Uses a proxy on the main m3u8 file to get a stream without ads.
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [code](https://github.com/arthurbolsoni/Purple-adblock/)
  - Uses a proxy on the main m3u8 file to get a stream without ads.
- `Video Ad-Block, for Twitch` (fork) - [chrome](https://chrome.google.com/webstore/detail/twitch-adblock/ljhnljhabgjcihjoihakgdiicdjncpkd) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch-adblock/) / [code](https://github.com/cleanlock/VideoAdBlockForTwitch)
  - Replaces ad segments with ad-free segments (480p resolution). Afterwards it invokes a pause/play to resync the player which then continues normally (normal resolution).
- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
  - Removes ad segments (no playback until ad-free stream).
- `ttv_adEraser` - [chrome](https://chrome.google.com/webstore/detail/ttv-aderaser/pjnopimdnmhiaanhjfficogijajbhjnc) / [firefox (manual install)](https://github.com/LeonHeidelbach/ttv_adEraser#mozilla-firefox) / [code](https://github.com/LeonHeidelbach/ttv_adEraser)
  - Switches to the `embed` player when there's ads. May display purple screen if both ads and purple screen show at the same time?
- `ttv-tools` - [firefox (manual install)](https://github.com/Nerixyz/ttv-tools/releases) / [code](https://github.com/Nerixyz/ttv-tools)
  - Removes ad segments (no playback until ad-free stream).
- `ttv-ublock` - [chrome](https://chrome.google.com/webstore/detail/ttv-ad-block/kndhknfnihidhcfnaacnndbolonbimai) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/ttv-adblock/) / [code](https://github.com/odensc/ttv-ublock)
  - Switches to the `embed` player at a network level. No ads but Twitch detects this and may display a purple screen every 10-15 mins asking the user to remove ad blockers (depends on time of day).
- `Twitch-HLS-AdBlock` - [chrome / firefox (manual install)](https://github.com/instance01/Twitch-HLS-AdBlock#installation) / [code](https://github.com/instance01/Twitch-HLS-AdBlock)
  - Removes ad segments (no playback until ad-free stream).

---

*Compile from source*

- `luminous-ttv` - [server code](https://github.com/AlyoshaVasilieva/luminous-ttv) / [extension code](https://github.com/AlyoshaVasilieva/luminous-ttv-ext)
  - Uses a proxy on the main m3u8 file to get a stream without ads.

## Web browser scripts (uBlock Origin / userscript)

- https://github.com/pixeltris/TwitchAdSolutions#Scripts
  - A few scripts using different techniques.
- https://github.com/Wilkolicious/twitchAdSkip
- https://gist.github.com/simple-hacker/ddd81964b3e8bca47e0aead5ad19a707/
- https://greasyfork.org/en/scripts/415412-twitch-refresh-on-advert/code
  - Reloads the player (or page) when it detects the ad banner in DOM.
- https://greasyfork.org/en/scripts/371186-twitch-mute-ads-and-optionally-hide-them/code
  - Mutes / hides ads.
- https://greasyfork.org/en/scripts/425139-twitch-ad-fix/code
  - Uses a proxy on the main m3u8 file to get a stream without ads.

## Applications / third party websites
- `streamlink` - [code](https://github.com/streamlink/streamlink) / [website](https://streamlink.github.io/streamlink-twitch-gui/)
  - Removes ad segments (no playback until ad-free stream).
- `Xtra for Twitch` (fork) - [apks](https://github.com/crackededed/Xtra/releases) / [code](https://github.com/crackededed/Xtra)
  - Android app. I think this blocks ads, but I'm not 100% sure. If not maybe try [Twire](https://github.com/twireapp/Twire).
- https://twitchls.com/
  - Uses the `embed` player. Purple screen may display every 10-15 mins.
- https://reddit.com/r/Twitch/comments/kisdsy/i_did_a_little_test_regarding_ads_on_twitch_and/
  - Some countries don't get ads. A simple VPN/VPS could be used to block ads by proxying the m3u8 without having to proxy all your traffic (just the initial m3u8).

## Proxy issues

Proxy solutions can have downtime and you'll either see ads or error 2000. This isn't Twitch retaliating.

Buffering may occur at higher resolutions. This happens because traffic comes from a Twitch server closest to the initial m3u8 proxy request. The only solution to this is asking the proxy maintainer to add a proxy in a country closer to you. If they wont then you'll need to use a lower resolution, or use a different ad blocking solution. A VPN might also be better solution for you.