# Issues with `vaft` / `video-swap-new`

## Neither script works

If you're using the uBlock Origin version of the script you need to make sure that it's set up correctly based on the instructions in the README. Check the script is active by opening your browsers developer console, refreshing a stream, and searching for `hookWorkerFetch (vaft)` / `hookWorkerFetch (video-swap-new)`. If you don't see this, then the script isn't being injected and you need to find the reason why.

## Streams sometimes appear offline when ads occur

This needs to be fixed but currently the exact cause is unknown. https://github.com/pixeltris/TwitchAdSolutions/issues/477

## The player shows a loading wheel for a long time

If it says `Blocking ads (stripping)` in the top left of the stream then it's actively removing the ad segments but doesn't have a backup stream to show you. If it doesn't say `Blocking ads (stripping)` provide additional information in https://github.com/pixeltris/TwitchAdSolutions/issues/474

## The script don't work on mobile (m.twitch.tv)

There are no plans of implementing the scripts on m.twitch.tv but there are other solutions which blocking ads on Twitch for mobile. See https://github.com/pixeltris/TwitchAdSolutions/blob/master/full-list.md

## Long black screen during ads

The scripts can reload the player when entering/leaving ads. On some systems this may cause a long period of time where the player is black as the player is loading back in. There currently isn't any fix for this. Try a different script / solution.

## `vaft`

### Freezing / buffering / repeating segments / audio desyncs

`vaft` has a long standing problem of playback problems (freezing / buffering / repeating segments / audio desyncs).

This happens because the script forces the player to consume multiple different m3u8 files during ads and it screws with the player. Simply pressing pause/play often fixes this.

The script is configured to do this automatically for you:

```js
PlayerBufferingFix = true;// If true this will pause/play the player when it gets stuck buffering
PlayerBufferingDelay = 500;// How often should we check the player state (in milliseconds)
PlayerBufferingSameStateCount = 3;// How many times of seeing the same player state until we trigger pause/play (it will only trigger it one time until the player state changes again)
PlayerBufferingDangerZone = 1;// The buffering time left (in seconds) when we should ignore the players playback position in the player state check
PlayerBufferingDoPlayerReload = false;// If true this will do a player reload instead of pause/play (player reloading is better at fixing the playback issues but it takes slightly longer)
PlayerBufferingMinRepeatDelay = 5000;// Minimum delay (in milliseconds) between each pause/play (this is to avoid over pressing pause/play when there are genuine buffering problems)
```

- If it triggers but it still freezes try setting `PlayerBufferingDoPlayerReload` to `true`. Player reloads generally have less problems.
- If you're having issues with it triggering when the player is genuinely buffering then adjust `PlayerBufferingDelay` / `PlayerBufferingSameStateCount`.
- If it triggers too frequently then increase the value of `PlayerBufferingMinRepeatDelay`. Decrease this if it triggers, freezes, then has to wait a long time to re-trigger.
- If you don't want to use this and would like to fix the buffering manually yourself you can set `PlayerBufferingFix` to `false`.
- Setting `AlwaysReloadPlayerOnAd` to `true` may reduce freezing issues when entering into ads.

## `video-swap-new`

### Freezing / buffering during ads

There currently isn't a fix for freezing / buffering issues for `video-swap-new`. Try a different script / solution.
