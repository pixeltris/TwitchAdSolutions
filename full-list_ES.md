Hubo una actualización el 31 de mayo de 2023 que puede haber roto algunas soluciones.

# Extensiones de navegador web

- `TTV LOL PRO` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol-pro/bpaoeijjlplfjbagceilcgbkcdjbomjd) / [firefox](https://addons.mozilla.org/addon/ttv-lol-pro/) / [código](https://github.com/younesaassila/ttv-lol-pro)
  - Una bifurcación de la extensión `TTV LOL` con amplias mejoras en sus capacidades de bloqueo de anuncios.
  - Se recomienda su uso con uBlock Origin.
  - **NOTA: Incompatible con proxies creados para el TTV LOL original.**
- `TTV LOL PRO (v1)` - [código](https://github.com/younesaassila/ttv-lol-pro/tree/v1)
  - La versión anterior y obsoleta de `TTV LOL PRO` que todavía utiliza proxies compatibles con TTV LOL. Úsala solo si tienes problemas con la versión actual y sabes lo que estás haciendo.
- `TTV LOL` - [chrome](https://chrome.google.com/webstore/detail/ttv-lol/ofbbahodfeppoklmgjiokgfdgcndngjm) / [código](https://github.com/TTV-LOL/extensions)
  - Utiliza un proxy en el archivo principal m3u8 para obtener una transmisión sin anuncios.
- `Alternate Player for Twitch.tv` - [chrome](https://chrome.google.com/webstore/detail/alternate-player-for-twit/bhplkbgoehhhddaoolmakpocnenplmhf) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/twitch_5/)
  - Elimina los segmentos de anuncios (sin reproducción hasta que se muestra la transmisión sin anuncios).
- `Purple AdBlock` - [chrome](https://chrome.google.com/webstore/detail/purple-adblock/lkgcfobnmghhbhgekffaadadhmeoindg) / [firefox](https://addons.mozilla.org/en-US/firefox/addon/purpleadblock/) / [código](https://github.com/arthurbolsoni/Purple-adblock/)
  - Sustituye los segmentos de anuncios por segmentos sin anuncios. La copia de seguridad del proxy está actualmente deshabilitada. Se muestra una rueda de carga cuando todos los métodos fallan.
- `AdGuard Extra (Beta)` - [chrome](https://chrome.google.com/webstore/detail/adguard-extra-beta/mglpocjcjbekdckiahfhagndealpkpbj) / [firefox](https://github.com/AdguardTeam/AdGuardExtra/#firefox)
  - Utiliza segmentos del reproductor `embed` durante los anuncios. Esto permite obtener una transmisión limpia más rápido, pero sufre de problemas de sincronización de audio/congelación.
- `Video Ad-Block, for Twitch` (bifurcación) - [código](https://github.com/cleanlock/VideoAdBlockForTwitch)
  - Sustituye los segmentos de anuncios por segmentos sin anuncios. Respaldo opcional del proxy durante los segmentos de anuncios cuando la transmisión sin anuncios falla localmente. Advierte sobre el bloqueador de anuncios cuando todos los métodos fallan.
- `ttv_adEraser` - [chrome](https://chrome.google.com/webstore/detail/ttv-aderaser/pjnopimdnmhiaanhjfficogijajbhjnc) / [firefox (instalación manual)](https://github.com/LeonHeidelbach/ttv_adEraser#mozilla-firefox) / [código](https://github.com/LeonHeidelbach/ttv_adEraser)
  - Cambia al reproductor `embed` cuando hay anuncios. Puede mostrar una pantalla morada si los anuncios y la pantalla morada se muestran al mismo tiempo.
- `ttv-tools` - [firefox (instalación manual)](https://github.com/Nerixyz/ttv-tools/releases) / [código](https://github.com/Nerixyz/ttv-tools)
  - Elimina los segmentos de anuncios (sin reproducción hasta que se muestra la transmisión sin anuncios).
---

*Compila desde la fuente*

- `luminous-ttv` - [código del servidor](https://github.com/AlyoshaVasilieva/luminous-ttv) / [código de la extensión](https://github.com/AlyoshaVasilieva/luminous-ttv-ext)
  - Utiliza un proxy en el archivo m3u8 principal para obtener una transmisión sin anuncios.

## Scripts de navegador web (uBlock Origin / userscript)

*Estos no han sido actualizados en un tiempo y probablemente no funcionan.*

- https://greasyfork.org/en/scripts/415412-twitch-refresh-on-advert/code
  - Recarga el reproductor (o la página) cuando detecta el banner de anuncios en el DOM.
- https://greasyfork.org/en/scripts/371186-twitch-mute-ads-and-optionally-hide-them/code
  - Silencia/oculta anuncios.

## Aplicaciones / sitios web de terceros
- `streamlink` - [código](https://github.com/streamlink/streamlink) / [sitio web](https://streamlink.github.io/streamlink-twitch-gui/)
  - Elimina los segmentos de anuncios (sin reproducción hasta que se muestra la transmisión sin anuncios).
  - Utiliza [este](https://github.com/2bc4/streamlink-ttvlol) archivo modificado para una reproducción ininterrumpida.
- `Xtra for Twitch` (bifurcación) - [apks](https://github.com/crackededed/Xtra/releases) / [código](https://github.com/crackededed/Xtra)
  - Un reproductor alternativo de Twitch para Android con funciones adicionales, incluido el bloqueo de anuncios. Actualmente solo utiliza la API TTV LOL para la intermediación. Sin embargo, TTV LOL ya no funciona, por lo que es necesario introducir una URL de proxy personalizada en la configuración para habilitar la capacidad de bloqueo de anuncios. Por ejemplo: `https://eu.luminous.dev/live/$channel?allow_source=true&allow_audio_only=true&fast_bread=true`
- `ReVanced` - [código](https://github.com/revanced)
  - Una colección de herramientas que te permite parchear Twitch y otras aplicaciones de Android como YouTube para eliminar anuncios. Los parches de Twitch de ReVanced utilizan los proxies TTV LOL y PurpleAdBlocker (se pueden alternar en la configuración). La configuración es complicada, así que cualquiera que quiera evitar complicaciones debería usar Xtra en su lugar.
- https://twitchls.com/
  - Utiliza el reproductor `embed`. La pantalla morada puede mostrarse cada 10-15 minutos.
- https://reddit.com/r/Twitch/comments/kisdsy/i_did_a_little_test_regarding_ads_on_twitch_and/
  - Algunos países no reciben anuncios. Se puede usar una VPN/VPS sencilla para bloquear anuncios mediante la intermediación del m3u8 sin necesidad de intermediar todo tu tráfico (solo el m3u8 inicial).

## Problemas con proxies

Las soluciones de proxy pueden tener tiempos de inactividad y es posible que veas anuncios o errores 2000. Esto no es una represalia de Twitch.

Puede producirse almacenamiento en búfer a resoluciones más altas. Esto sucede porque el tráfico proviene de un servidor de Twitch más cercano a la solicitud inicial de proxy m3u8. La única solución para esto es pedir al mantenedor del proxy que agregue un proxy en un país más cercano a ti. Si no lo hacen, deberás usar una resolución más baja o una solución de bloqueo de anuncios diferente. Una VPN también podría ser una mejor solución para ti.
