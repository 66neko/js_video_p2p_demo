/**
 * Stun Server 
 * 
 */
var configuration = {
    'iceServers': [
        {
            //'url': 'stun:stun.l.google.com:19302'
            'url': 'stun:invoker.tk:11000'
        },
        {
            'url': 'stun.ideasip.com'
        }
    ]
};
/**
 * chunk filename list
 * @type {Array}
 */
var _files = [
    //'1.webm',
    'fileSequence0.webm',
    'fileSequence1.webm',
    'fileSequence2.webm',
    'fileSequence3.webm',
    'fileSequence4.webm',
    'fileSequence5.webm',
    'fileSequence6.webm',
    'fileSequence7.webm',
    'fileSequence8.webm',
    'fileSequence9.webm',
    'fileSequence10.webm',
];
/**
 * MediaSource&SourceBuffer
 */
var _mediaSource = new MediaSource();
var _sourceBuffer;
var _loadedBuffers = [];
var _itemsAppendedToSourceBuffer = 0;
/**
 * connection status
 */
var _isConnection = false;

var video = document.getElementById('video');

/**
 * FILE LOADING
 * method:XMLHttpRequest
 */
function get(filename, callback) {
    var request = new XMLHttpRequest();
    request.responseType = 'arraybuffer';
    request.onreadystatechange = function () {
        if (request.readyState == 4 && (request.status == 200 || request.status == 304)) {
            callback(request.response);
        }
    };
    var file = 'chunks/' + filename;
    request.open('GET', file, true);
    request.send();
};

/**
 * start File LOADING
 */
function startFileLoading(i) {
    // Load the chunk
    get(_files[i], function (result) {

        console.log('XMLHttpRequest: loaded', _files[i]);

        // Cache the buffer
        _loadedBuffers.push(result);

        //if connect with webRTC ,sendMediaData to anothoer user
        if (_isConnection) {
            //peer.sendData(result);
            for (var index = 0; index < _peerIndex; index++) {
                peerlist[index].sendData(result);
            }
        }

        if (!_sourceBuffer.updating) {
            //setTimeout(loadNextBuffer,3000); 
            loadNextBuffer();
        }

        if (i == 0) {
            // Start playback
            if (video.paused) {
                video.play();
            }
        }

        i++;
        if (i == _files.length) {
            i = 0;
        }
        // Recursively load next chunk (if one exists)
        if (i < _files.length) {
            setTimeout(function () { startFileLoading(i); }, 9000);
            //startFileLoading(i);
        }
    });
}

/**
 * video stuff
 * It appends puts the next cached buffer into the source buffer.
 */
function loadNextBuffer() {
    if (_loadedBuffers.length) {
        console.log('SourceBuffer: appending', _itemsAppendedToSourceBuffer);
        // append the next one into the source buffer.
        _sourceBuffer.appendBuffer(_loadedBuffers.shift());
        _itemsAppendedToSourceBuffer++;
    }

    /*
    if (_itemsAppendedToSourceBuffer >= _files.length && !_sourceBuffer.updating) {
        // else close the stream
        _mediaSource.endOfStream();
    }
    */
}

/**
 * Will be executed when the MediaSource is open and it will start
 * loading the chunks recursively.
 */
function sourceOpenCallback() {
    console.log('mediaSource readyState: ' + this.readyState);
    // Create the source buffer where we are going to append the
    // new chunks.
    _sourceBuffer = _mediaSource.addSourceBuffer('video/webm; codecs="vp8,vorbis"');
    //_sourceBuffer.addEventListener('updateend', loadNextBuffer, false);
    _sourceBuffer.mode = 'sequence';

    // Start
    startFileLoading(0);
}

function sourceOpenFromWebRTC() {
    console.log('mediaSource Init from WebRTC');
    // Create the source buffer where we are going to append the
    // new chunks.

    _sourceBuffer = _mediaSource.addSourceBuffer('video/webm; codecs="vp8,vorbis"');
    _sourceBuffer.mode = 'sequence';

}
// // Necessary event listeners
// _mediaSource.addEventListener('sourceopen', sourceOpenCallback, false);
// _mediaSource.addEventListener('webkitsourceopen', sourceOpenCallback, false);


// // This starts the entire flow. This will trigger the 'sourceopen' event
// video.src = window.URL.createObjectURL(_mediaSource);


/**
 * next P2P webRTC
 */
//RTC
/****************************************************************************
* Signaling server
****************************************************************************/

// Connect to the signaling server
var socket = io.connect();
var isInitiator;
var room = window.location.hash.substring(1);
if (!room) {
    room = window.location.hash = randomToken();
}
//var peerConn;
//var dataChannel;

//Object Peer
var peerlist = [];
for (var index = 0; index < 10; index++) {
    var peer = new Peer();
    peer.SetReadBufferCallback(readData);
    peer.SetSendMessage(SendMessage);
    peerlist.push(peer);
}
var _peerIndex = 0;
var myClientID = 0;
// var peer = new Peer();
// peer.SetReadBufferCallback(readData);
// peer.SetSendMessage(SendMessage);

socket.on('ipaddr', function (ipaddr) {
    console.log('Server IP address is: ' + ipaddr);
    //log(ipaddr)
    // updateRoomURL(ipaddr);
});

socket.on('created', function (room, clientId) {
    console.log('Created room', room, '- my client ID is', clientId);
    isInitiator = true;
    //Get media data from server
    // Necessary event listeners
    _mediaSource.addEventListener('sourceopen', sourceOpenCallback, false);
    _mediaSource.addEventListener('webkitsourceopen', sourceOpenCallback, false);


    // This starts the entire flow. This will trigger the 'sourceopen' event
    video.src = window.URL.createObjectURL(_mediaSource);
});

socket.on('joined', function (room, clientId, _id) {
    console.log('This peer has joined room', room, 'with client ID', clientId, 'my peer ID', _id);
    isInitiator = false;

    myClientID = _id;
    peerlist[myClientID].CreatePeerConnection(myClientID, isInitiator, configuration);
    //_peerIndex++;
    _mediaSource.addEventListener('sourceopen', sourceOpenFromWebRTC, false);
    _mediaSource.addEventListener('webkitsourceopen', sourceOpenFromWebRTC, false);

    // This starts the entire flow. This will trigger the 'sourceopen' event
    video.src = window.URL.createObjectURL(_mediaSource);
});

socket.on('full', function (room) {
    alert('Room ' + room + ' is full. We will create a new room for you.');
    window.location.hash = '';
    window.location.reload();
});

socket.on('ready', function () {
    console.log('Socket is ready');
    peerlist[_peerIndex].CreatePeerConnection(_peerIndex, isInitiator, configuration);
    _peerIndex++;
});

socket.on('log', function (array) {
    console.log.apply(console, array);
});

socket.on('message', function (message) {

    if (!isInitiator && myClientID == message.ID) {
        console.log('Client received message:', message);
        //signalingMessageCallback(message);
        console.log('Client received ID:', message.ID);
        peerlist[message.ID].SignalingMessageCallback(message.ID, message.message);
        return;
    }
    else if (isInitiator) {
        console.log('Client received message:', message);
        //signalingMessageCallback(message);
        console.log('Client received ID:', message.ID);
        peerlist[message.ID].SignalingMessageCallback(message.ID, message.message);
    }
});

// Join a room
socket.emit('create or join', room);
socket.emit('ipaddr', '');
if (location.hostname.match(/localhost|127\.0\.0/)) {
    socket.emit('ipaddr');
}

/**
* Send message to signaling server
*/
function SendMessage(peerId, message) {
    console.log('Client sending message: ', message);
    socket.emit('message', { ID: peerId, message });
}

function readData(buf) {
    console.log('SourceBuffer: appending', _itemsAppendedToSourceBuffer);
    // append the next one into the source buffer.
    _sourceBuffer.appendBuffer(buf);
    _itemsAppendedToSourceBuffer++;
    if (video.paused) {
        video.play();
    }
}

function log(str) {
    var p = document.createElement('p')
    p.innerHTML = str
    document.querySelector('.log').appendChild(p)
}
function randomToken() {
    return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

