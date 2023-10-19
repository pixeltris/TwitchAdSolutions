# TwitchAdSolutions

Este repositorio tiene como objetivo proporcionar múltiples soluciones para bloquear los anuncios de Twitch.

**No combines bloqueadores de anuncios específicos de Twitch.**

## Recomendaciones

Los proxies son la forma más fiable de evitar los anuncios ([información sobre buffering/downtime](full-list.md#proxy-issues)).

- `TTV LOL PRO` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol-pro/bpaoeijjlplfjbagceilcgbkcdjbomjd) / [firefox](https://addons.mozilla.org/addon/ttv-lol-pro/) / [código](https://github.com/younesaassila/ttv-lol-pro)
- `TTV LOL` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol/ofbbahodfeppoklmgjiokgfdgcndngjm) / [código](https://github.com/TTV-LOL/extensions)

Alternativamente:

- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [código](https://github.com/arthurbolsoni/Purple-adblock/)
- `AdGuard Extra (Beta)` - [chrome](https://chrome.google.com/webstore/detail/adguard-extra-beta/mglpocjcjbekdckiahfhagndealpkpbj) / [firefox](https://github.com/AdguardTeam/AdGuardExtra/#firefox)
- `Video Ad-Block, for Twitch` (bifurcación) - [código](https://github.com/cleanlock/VideoAdBlockForTwitch)
- `video-swap-new` - ver abajo

[Lee esto para ver una lista completa y descripciones.](full-list.md)

*Hubo una actualización el 31 de mayo de 2023 que podría haber afectado algunas soluciones.*

## Scripts

**Hay métodos mejores y más fáciles de usar en las recomendaciones anteriores.**

- video-swap-new - [ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap-new/video-swap-new-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/video-swap-new/video-swap-new.user.js) / [ublock (enlace permanente)](https://github.com/pixeltris/TwitchAdSolutions/raw/a285eeda5046a304c5eb38b958c875afca066daa/video-swap-new/video-swap-new-ublock-origin.js)
  - Utiliza el reproductor embebido durante los anuncios.
  - *Se muestra un mensaje de anuncio a pantalla completa durante los anuncios.* [Lee el anuncio de Twitch](https://discuss.dev.twitch.tv/t/an-updated-twitch-embedded-player-viewer-experience/41718)
  - *Es posible que notes una recarga aparentemente aleatoria del reproductor después de que desaparezca el mensaje del anuncio.*
- vaft - [ublock](https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft-ublock-origin.js) / [userscript](https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft.user.js) / [ublock (enlace permanente)](https://github.com/pixeltris/TwitchAdSolutions/raw/a285eeda5046a304c5eb38b958c875afca066daa/vaft/vaft-ublock-origin.js)
  - `Video Ad-Block, for Twitch` (bifurcación) como script.
  - *Se muestra un mensaje de anuncio a pantalla completa durante los anuncios.*

*Por motivos de seguridad, se recomienda usar un enlace permanente al usar uBlock Origin (los enlaces permanentes no se actualizan automáticamente).*

## Aplicación de un script (uBlock Origin)

- Ve al panel de control de uBlock Origin (las opciones de la extensión).
- En la pestaña "Mis filtros", agrega `twitch.tv##+js(twitch-videoad)`.
- En la pestaña "Configuración", habilita "Soy un usuario avanzado" y luego haz clic en el engranaje que aparece. Modifica el valor de "userResourcesLocation" de "unset" a la URL completa de la solución que deseas usar (si ya hay una URL en uso, agrega un espacio después de la URL existente), por ejemplo, `userResourcesLocation https://github.com/pixeltris/TwitchAdSolutions/raw/master/vaft/vaft-ublock-origin.js`.
- Para asegurarte de que uBlock Origin cargue el script, te recomiendo que deshabilites/habilites la extensión de uBlock Origin (o reinicies tu navegador).

*Para dejar de usar un script, elimina el filtro y establece la URL en "unset".*

## Aplicación de un script (userscript)

- Ver uno de los archivos de userscript debería provocar que se agregue el script correspondiente.
