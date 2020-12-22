# TwitchAdSolutions

This repo aims to provide multiple solutions for blocking Twitch ads.

## Current solutions

- dyn
  - Ad segments are replaced by a low resolution stream segments (on a m3u8 level).
  - Stuttering and looping of segments my occur.
- dyn-video-swap
  - Ads are replaced by a low resolution stream for the duration of the ad.
  - Similar to `dyn`, but may have a larger jump in time.
  - You might see tiny bits of the ad.
  - Audio controls wont work whilst the ad is playing.
- low-res
  - No ads.
  - The stream is 480p for the duration of the stream.
- mute-black
  - Ads are muted / blacked out for the duration of the ad.
  - You might see tiny bits of the ad.

## Applying a solution (uBlock Origin)

uBlock Origin solutions single files, suffixed by `ublock-origin.js` e.g. `low-res-ublock-origin.js`.

- Navigate to the uBlock Origin Dashboard (the extension options)
- Under the `My filters` tab add `twitch.tv##+js(twitch-videoad)`.
- Under the `Settings` tab, enable `I am an advanced user`, then click the cog that appears. Modify the value of `userResourcesLocation` from `unset` to the full url of the solution you wish to use (if a url is already in use, add a space after the existing url). e.g. `userResourcesLocation `


## Other solutions / projects

- https://github.com/odensc/ttv-ublock (extension, outdated)
- https://github.com/Wilkolicious/twitchAdSkip (UserScript + FrankerFaceZ extension)
- https://gist.github.com/simple-hacker/ddd81964b3e8bca47e0aead5ad19a707 (UserScript + FrankerFaceZ extension)

## NOTE/TODO

Many of these solutions could do with improvements. Ports to UserScript should also be made.
