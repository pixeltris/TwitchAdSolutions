*There was an update on 31st May 2023 which may have broken some solutions.*

## Web browser extensions

- `TTV LOL PRO` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol-pro/bpaoeijjlplfjbagceilcgbkcdjbomjd) / [firefox](https://addons.mozilla.org/addon/ttv-lol-pro/) / [code](https://github.com/younesaassila/ttv-lol-pro)
  - A fork of the `TTV LOL` extension with sweeping improvements to its ad blocking abilities.
  - Recommended to be used with uBlock Origin.
  - **NOTE: Incompatible with proxies made for the original TTV LOL.**
- `TTV LOL PRO (v1)` - [code](https://github.com/younesaassila/ttv-lol-pro/tree/v1)
  - The older, deprecated version of `TTV LOL PRO` that still uses TTV LOL-compatible proxies. Only use this if you're having issues with the current version and know what you're doing.
- `TTV LOL` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol/ofbbahodfeppoklmgjiokgfdgcndngjm) / [code](https://github.com/TTV-LOL/extensions)
  - Uses a proxy on the main m3u8 file to get a stream without ads.
- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
  - Removes ad segments (no playback until ad-free stream).
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [code](https://github.com/arthurbolsoni/Purple-adblock/)
  - Replaces ad segments with ad-free segments. Proxy fallback which is currently broken. Loading wheel when all methods fail.
- `AdGuard Extra (Beta)` - [chrome](https://chrome.google.com/webstore/detail/adguard-extra-beta/mglpocjcjbekdckiahfhagndealpkpbj) / [firefox](https://github.com/AdguardTeam/AdGuardExtra/#firefox)
  - Uses segments from the `embed` player during ads. This can get a clean stream faster but suffers from audio sync / freezing issues.
- `Video Ad-Block, for Twitch` (fork) - [code](https://github.com/cleanlock/VideoAdBlockForTwitch)
  - Replaces ad segments with ad-free segments. Opt-in proxy fallback during ad segments when the ad-free stream fails locally. Adblocker warning when all methods fail.
- `ttv_adEraser` - [chrome](https://chrome.google.com/webstore/detail/ttv-aderaser/pjnopimdnmhiaanhjfficogijajbhjnc) / [firefox (manual install)](https://github.com/LeonHeidelbach/ttv_adEraser#mozilla-firefox) / [code](https://github.com/LeonHeidelbach/ttv_adEraser)
  - Switches to the `embed` player when there's ads. May display purple screen if both ads and purple screen show at the same time?
- `ttv-tools` - [firefox (manual install)](https://github.com/Nerixyz/ttv-tools/releases) / [code](https://github.com/Nerixyz/ttv-tools)
  - Removes ad segments (no playback until ad-free stream).
  
---

*Compile from source*

- `luminous-ttv` - [server code](https://github.com/AlyoshaVasilieva/luminous-ttv) / [extension code](https://github.com/AlyoshaVasilieva/luminous-ttv-ext)
  - Uses a proxy on the main m3u8 file to get a stream without ads.

## Web browser scripts (uBlock Origin / userscript)

*These haven't been updated in a while and probably don't work.*

- https://greasyfork.org/en/scripts/415412-twitch-refresh-on-advert/code
  - Reloads the player (or page) when it detects the ad banner in DOM.
- https://greasyfork.org/en/scripts/371186-twitch-mute-ads-and-optionally-hide-them/code
  - Mutes / hides ads.

## Applications / third party websites
- `streamlink` - [code](https://github.com/streamlink/streamlink) / [website](https://streamlink.github.io/streamlink-twitch-gui/)
  - Removes ad segments (no playback until ad-free stream).
  - Use [this](https://github.com/2bc4/streamlink-ttvlol) modified file for uninterrupted playback.
- `Xtra for Twitch` (fork) - [apks](https://github.com/crackededed/Xtra/releases) / [code](https://github.com/crackededed/Xtra)
  - An alternate Twitch player for Android with extra features, including ad blocking. This currently only uses the TTV LOL API for proxying. However, TTV LOL itself no longer works, so entering a custom proxy URL in settings is required for ad-blocking capabilities. For example: `https://eu.luminous.dev/live/$channel?allow_source=true&allow_audio_only=true&fast_bread=true`
- `ReVanced` - [code](https://github.com/revanced)
  - A collection of tools that allows you to patch Twitch and other Android apps such as YouTube to remove ads. ReVanced's Twitch patches use the TTV LOL and PurpleAdBlocker proxies (can be toggled between in settings). The setup is complicated, so anyone who doesn't want the hassle should just use Xtra instead.
- https://twitchls.com/
  - Uses the `embed` player. Purple screen may display every 10-15 mins.
- https://reddit.com/r/Twitch/comments/kisdsy/i_did_a_little_test_regarding_ads_on_twitch_and/
  - Some countries don't get ads. A simple VPN/VPS could be used to block ads by proxying the m3u8 without having to proxy all your traffic (just the initial m3u8).

## Proxy issues

Proxy solutions can have downtime and you'll either see ads or error 2000. This isn't Twitch retaliating.

Buffering may occur at higher resolutions. This happens because traffic comes from a Twitch server closest to the initial m3u8 proxy request. The only solution to this is asking the proxy maintainer to add a proxy in a country closer to you. If they wont then you'll need to use a lower resolution, or use a different ad blocking solution. A VPN might also be better solution for you.
