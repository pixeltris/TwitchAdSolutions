twitch-videoad.js application/javascript
(function() {   
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    function hookFetch() {
        var OPT_ACCESS_TOKEN_PLAYER_TYPE = 'thunderdome';//480p
        //var OPT_ACCESS_TOKEN_PLAYER_TYPE = 'picture-by-picture';//360p
        var realFetch = window.fetch;
        window.fetch = function(url, init, ...args) {
            if (typeof url === 'string') {
                if (OPT_ACCESS_TOKEN_PLAYER_TYPE) {
                    if (url.includes('/access_token')) {
                        var modifiedUrl = new URL(url);
                        modifiedUrl.searchParams.set('player_type', OPT_ACCESS_TOKEN_PLAYER_TYPE);
                        arguments[0] = modifiedUrl.href;
                    }
                    else if (url.includes('gql') && init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                        const newBody = JSON.parse(init.body);
                        newBody.variables.playerType = OPT_ACCESS_TOKEN_PLAYER_TYPE;
                        init.body = JSON.stringify(newBody);
                    }
                }
            }
            return realFetch.apply(this, arguments);
        }
    }
    hookFetch();
})();