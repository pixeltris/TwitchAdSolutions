twitch-videoad.js application/javascript
(function() {
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    function hookFetch() {
        var realFetch = window.fetch;
        window.fetch = function(url, init, ...args) {
            if (typeof url === 'string' && url.includes('gql') && typeof init.body == 'string' && init.body.includes('PlaybackAccessToken') && !init.body.includes('"isVod":true')) {
                if (typeof init.headers['Authorization'] === 'string') {
                    init.headers['Authorization'] = '';
                }
                if (typeof init.headers['X-Device-Id'] === 'string') {
                    init.headers['X-Device-Id'] = 'twitch-web-wall-mason';
                }
                if (typeof init.headers['Device-ID'] === 'string') {
                    init.headers['Device-ID'] = 'twitch-web-wall-mason';
                }
            }
            return realFetch.apply(this, arguments);
        }
    }
    hookFetch();
})();