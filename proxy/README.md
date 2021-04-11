This gives an overview of using proxies to avoid Twitch ads (without having to proxy all of your traffic ~ just the initial m3u8 per-stream).

`proxy-server` fetches the m3u8 (hopefully ad-free). `extension` contains a Chrome / Firefox compatible extension for sending the m3u8 request. `proxy-m3u8` (uBlock Origin / userscript) scripts also work as an alternative to the extension.

## Socks5

- Put your socks5 proxy info into `proxy-server-info.txt` and run `proxy-server.exe` (install `Mono` if using Linux/Mac and run via `mono proxy-server.exe`).
- Load the `extension` folder as an unpacked extension in your browser. Alternatively use `proxy-m3u8` `uBlock Origin` / `userscript` scripts ([ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/proxy-m3u8/proxy-m3u8-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/proxy-m3u8/proxy-m3u8.user.js)). (TODO: more helpful info).

## VPN + VMWare

- Set up `VMWare Workstation` with `Windows` and your desired VPN.
- In your VM `Settings` under the `Hardware` tab select `Network Adapter` and change the `Network connection` to `Bridged`. This is to simplify connecting to `proxy-server` from your host. You can do it without bridged but it requires additional VMWare network configuration.
- Add `proxy-server.exe` to your Windows VM Firewall (or disable your Windows Firewall in the VM) and then run `proxy-server.exe`.
- Modify `extension/background.js` and change the IP to your VM IP (obtained via `ipconfig` inside your VM). If you're using `proxy-m3u8` change the IP there.

NOTE: See "mixed-content" below.

## VPS

- Run `proxy-server.exe` on your VPS which is hosted in an ad-free country (install `Mono` if using Linux and run via `mono proxy-server.exe`).
- Modify the url in `extension/background.js` to point to your VPS and load the `extension` folder as an unpacked extension. If using `proxy-m3u8` scripts find the equivalent urls there and modify them where applicable (you'll likely need to fork to do this).

NOTE: See "mixed-content" below.

## Notes

- Running the `HttpListener` on https has many convoluted steps. On localhost (127.0.0.1) Chrome / Firefox allow mixed content requests so there aren't any issues there. For other IPs (i.e. in the VPS/VPN example) you'll need to enable "mixed-content" (also known as "Insecure content") for twitch.tv or otherwise you'll get CORS errors.
- `proxy-server.exe` needs to be ran as Admin to listen on the desired IP/Port.
- Disable other Twitch ad blocking extensions / scripts as they may interfere.
- You will likely have to try multiple locations until you find something that works.
- If you're having problems use Wireshark (or similar) to make sure the m3u8 is being re-routed.
- To build `proxy-server.cs` yourself run `proxy-server-build.bat`. If you're on Mac/Linux build it with `msbuild` which should come with `Mono` or `.NET Core` (TODO: more helpful info).
- `proxy-server` should be visible over LAN/WAN assuming correct firewall settings, however if you wish to connect to it from another machine you'll need to edit the IP in `extension/background.js`.
- TODO:  Provide an authenticated option to allow Twitch Turbo to be used to provide streams to non-Turbo users.

I would only really recommend using the info + code here as a starting point for building a more robust solution.