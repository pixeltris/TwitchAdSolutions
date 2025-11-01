# Issues with `vaft` / `video-swap-new`

## Neither script works

If you're using the uBlock Origin version of the script you need to make sure that it's set up correctly based on the instructions in the README. Check the script is active by opening your browsers developer console, refreshing a stream, and searching for `hookWorkerFetch (vaft)` / `hookWorkerFetch (video-swap-new)`. If you don't see this, then the script isn't being injected and you need to find the reason why.

## Streams sometimes appear offline when ads occur

This needs to be fixed but currently the exact cause is unknown.

## `vaft`

### Freezing / buffering

The stream may have playback problems during ads. There is an integrated solution that attempts to automatically press pause/play if buffering occurs during ads. If this isn't working you could try changing `AlwaysReloadPlayerOnAd` from `false` to `true` which will trigger a player reload as it enters/leaves ads which may add some stability. If neither of those are working how you'd like you can disable the pause/play buffer fixing attempt by modifying the userscript and change `FixPlayerBufferingInsideAds` from `true` to `false`. You then need to find an alternative solution to the buffering such as the folloing:

- https://github.com/pixeltris/TwitchAdSolutions/issues/299#issuecomment-2509500697
- https://github.com/pixeltris/TwitchAdSolutions/issues/313

If you're still having problems it's recommended to switch to using `video-swap-new` (which is the recommended script in the README).

### Audio desyncs

This script can be susceptible to audio desyncs due to the way that it works. There currently isn't any fix for this. Try a different script / solution.

### Freezing / buffering after ads

You can try changing `FixPlayerBufferingOutsideAds` from `false` to `true` which will scan the player for buffering when ads aren't happening and will trigger a pause/play which may work for you.

## `video-swap-new`

### Long black screen during ads

The script reloads the player as it enters/leaves ads to switch the active m3u8 file that is being used. On some systems this may cause a long period of time where the player is black as the player is loading back in. There currently isn't any fix for this. Try a different script / solution. *This also applies to `vaft` where the streamer has a 2k/4k quality setting as a player reload is required to handle these.*

### Freezing / buffering during ads

Generally `video-swap-new` should be less susceptible to buffering / freezing than `vaft` as all it does is switch the active m3u8 file as it enters / leaves ads. There currently isn't a fix for freezing / buffering issues for `video-swap-new`. Try a different script / solution.
