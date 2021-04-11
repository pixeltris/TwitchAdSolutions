Web browser extensions / scripts:

- https://github.com/odensc/ttv-ublock
  - Simulates `embed` Twitch player at a network level (doesn't modify DOM).
  - Twitch detects this and may display a purple screen every 10-15 mins asking the user to remove ad blockers.
- https://github.com/Nerixyz/ttv-tools
  - Notifies Twitch that ads were watched and then reloads the player.
  - Can replace ad segments with a custom video (instead of ad skipping).
  - Can keep stream at lowest latency (speeds up stream if too far behind).
- https://github.com/LeonHeidelbach/ttv_adEraser
  - Modifies DOM to switch between the `embed` player when there's ads. May display purple screen if both ads and purple screen show at the same time?
- https://github.com/instance01/Twitch-HLS-AdBlock
  - Removes ad segments. May result in m3u8 being requested quickly in succession if all segments are removed.
- https://github.com/Wilkolicious/twitchAdSkip
- https://gist.github.com/simple-hacker/ddd81964b3e8bca47e0aead5ad19a707/
- https://greasyfork.org/en/scripts/415412-twitch-refresh-on-advert/code
  - Reloads the player (or page) when it detects the ad banner in DOM.
- [Alternate Player for Twitch.tv](https://chrome.google.com/webstore/detail/bhplkbgoehhhddaoolmakpocnenplmhf) - [code](https://robwu.nl/crxviewer/?crx=bhplkbgoehhhddaoolmakpocnenplmhf&qf=player.js)
  - Removes ad segments which cannot be skipped. The player will freeze on the last live frame until no more ads.
- https://github.com/TTV-LOL/extensions
  - Uses a proxy on the main m3u8 file to get a stream without ads (no prerolls / midrolls).

Applications / third party websites:
- https://github.com/streamlink/streamlink
  - Removes ad segments (I assume this will freeze on the last live frame until no more ads).
- [multiChat for Twitch](https://play.google.com/store/apps/details?id=org.mchatty)
  - Unsure how this one blocks ads, but it claims that it does.
- https://twitchls.com/
  - Uses the `embed` player. Purple screen may display every 10-15 mins.
- https://reddit.com/r/Twitch/comments/kisdsy/i_did_a_little_test_regarding_ads_on_twitch_and/
  - Some countries don't get ads. A simple VPN/VPS could be used to block ads by proxying the m3u8 without having to proxy all your traffic (just the initial m3u8).
