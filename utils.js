var defaultChannel = '';
var defaultName = 'test1';
var inputWidth = '100px';
var playerWidth = '800px';
var defaultVolume = 1;
//
const STATE_STOPPED = 1;
const STATE_RECORDING = 2;
const STATE_REPLAYING = 3;
const STATE_WAITING = 4;
var state = STATE_STOPPED;
//
var channelElement = null;
var nameElement = null;
var stateInfoElement = null;
var streamNormal = null;
var streamMini = null;
var streamOutput = null;
var streamAlt = null;
var streams = [];
//
function updateStateInfo(newState) {
    if (newState) {
        state = newState;
    }
    if (!streamNormal || !streamMini || !streamOutput || !streamAlt) {
        return;
    }
    var stateStr = '';
    switch (state) {
        case STATE_STOPPED: stateStr = 'stopped'; break;
        case STATE_RECORDING: stateStr = 'recording'; break;
        case STATE_REPLAYING: stateStr = 'replaying'; break;
        case STATE_WAITING: stateStr = 'waiting'; break;
    }
    stateInfoElement.textContent = ' state: ' + stateStr;
}
function updateStreamInfo(stream) {
    stream.InfoElement.textContent = '[' + stream.StreamName + ']';
}
function setStreamSrc(stream, src) {
    stream.hls.loadSource('/' + src + '/' + channelElement.value + '|' + nameElement.value);
    stream.hls.attachMedia(stream);
}
function recordOrReplayStream(newState, type) {
    if (!channelElement.value) {
        alert('Channel name textbox is empty');
        return;
    }
    stopStream();
    updateStateInfo(STATE_WAITING);
    fetch('/' + type + '-begin/' + channelElement.value + '|' + nameElement.value).then(async function(response) {
        if (response.status == 200) {
            var str = await response.text();
            if (str) {
                updateStateInfo(newState);
                setStreamSrc(streamNormal, 'm3u8_normal');
                setStreamSrc(streamMini, 'm3u8_mini');
                setStreamSrc(streamOutput, 'm3u8_output');
                setStreamSrc(streamAlt, 'm3u8_alt');
            } else {
                stopStream();
            }
        } else {
            stopStream();
        }
    });
}
function recordStream() {
    recordOrReplayStream(STATE_RECORDING, 'record');
}
function replayStream() {
    alert('TODO');
    //recordOrReplayStream(STATE_REPLAYING, 'replay');
}
function stopStream() {
    for (var i = 0; i < streams.length; i++) {
        streams[i].hls.stopLoad();
        streams[i].pause();
    }
    updateStateInfo(STATE_STOPPED);
}
function createStreamElement(name) {
    /////////////////////////////////////////
    var containerElement = document.createElement('div');
    containerElement.style.display = 'inline-block';
    containerElement.style.width = 'auto';
    document.body.appendChild(containerElement);
    /////////////////////////////////////////
    var infoElement = document.createElement('span');
    containerElement.appendChild(infoElement);
    containerElement.appendChild(document.createElement('br'));
    /////////////////////////////////////////
    var stream = document.createElement('video');
    stream.style.maxWidth = playerWidth;
    stream.style.width = playerWidth;
    stream.InfoElement = infoElement;
    stream.StreamName = name;
    stream.autoplay = true;
    stream.volume = defaultVolume;
    stream.hls = new Hls();
    containerElement.appendChild(stream);
    /////////////////////////////////////////
    streams.push(stream);
    updateStreamInfo(stream);
    return stream;
}
function onHlsLoaded() {
    /////////////////////////////////////////
    var label1 = document.createElement('span');
    label1.textContent = 'channel:';
    document.body.appendChild(label1);
    /////////////////////////////////////////
    channelElement = document.createElement('input');
    channelElement.value = defaultChannel;
    channelElement.style.width = inputWidth;
    document.body.appendChild(channelElement);
    /////////////////////////////////////////
    var label2 = document.createElement('span');
    label2.textContent = 'name:';
    document.body.appendChild(label2);
    /////////////////////////////////////////
    nameElement = document.createElement('input');
    nameElement.value = defaultName;
    nameElement.style.width = inputWidth;
    document.body.appendChild(nameElement);
    /////////////////////////////////////////
    var recordBtn = document.createElement('button');
    recordBtn.textContent = 'record';
    recordBtn.onclick = recordStream;
    document.body.appendChild(recordBtn);
    /////////////////////////////////////////
    var replayBtn = document.createElement('button');
    replayBtn.textContent = 'replay';
    replayBtn.onclick = replayStream;
    document.body.appendChild(replayBtn);
    /////////////////////////////////////////
    var stopBtn = document.createElement('button');
    stopBtn.textContent = 'stop';
    stopBtn.onclick = stopStream;
    document.body.appendChild(stopBtn);
    /////////////////////////////////////////
    stateInfoElement = document.createElement('span');
    document.body.appendChild(stateInfoElement);
    /////////////////////////////////////////
    document.body.appendChild(document.createElement('br'));
    /////////////////////////////////////////
    streamNormal = createStreamElement('normal');
    streamMini = createStreamElement('mini');
    streamOutput = createStreamElement('output');
    streamAlt = createStreamElement('alt');
    updateStateInfo();
}
function onContentLoaded() {
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    script.onload = function() {
        onHlsLoaded();
    };
    document.head.appendChild(script);
}
if (document.readyState === 'complete' || document.readyState === 'loaded' || document.readyState === 'interactive') {
    onContentLoaded();
} else {
    window.addEventListener('DOMContentLoaded', function() {
        onContentLoaded();
    });
}