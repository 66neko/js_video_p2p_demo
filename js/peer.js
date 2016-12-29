/**
 * class Peer
 */
var readBuffer;
var sendMessage;
var _dc;
function Peer() {
    this.id;
    this.peerConn;
    this.dataChannel = null;
    this.isInitiator;
    this.CreatePeerConnection = createPeerConnection;
    this.SignalingMessageCallback = signalingMessageCallback;
    this.SetReadBufferCallback = function (cb) { readBuffer = cb };
    this.SetSendMessage = function (cb) { sendMessage = cb };
    this.onDataChannelCreated = onDataChannelCreated;
    this.receiveDataChromeFactory = receiveDataChromeFactory;
    this.receiveDataFirefoxFactory = receiveDataFirefoxFactory;
    this.sendData = sendData;

    function signalingMessageCallback(_id,message) {
        if (message.type === 'offer') {
            console.log('Got offer. Sending answer to peer.');
            this.peerConn.setRemoteDescription(new RTCSessionDescription(message), function () { },
                logError);
            //this.peerConn.createAnswer(this.onLocalSessionCreated, logError);
            var peerC = this.peerConn;
            this.peerConn.createAnswer().then(function (offer) {
                return peerC.setLocalDescription(offer);
            }).then(function(){
                sendMessage(_id, peerC.localDescription);
            }).catch(function(reason){
                logError(reason);
            });

        } else if (message.type === 'answer') {
            console.log('Got answer.');
            this.peerConn.setRemoteDescription(new RTCSessionDescription(message), function () { },
                logError);

        } else if (message.type === 'candidate') {
            this.peerConn.addIceCandidate(new RTCIceCandidate({
                candidate: message.candidate
            }));

        } else if (message === 'bye') {
            // TODO: cleanup RTC connection?
        }
    }

    function createPeerConnection(_id, _isInitiator, config) {
        this.id = _id;
        this.isInitiator = _isInitiator;
        console.log('Creating Peer connection as initiator?', this.isInitiator, 'config:',
            config);
        //peerConn = new RTCPeerConnection(config);
        this.peerConn = new RTCPeerConnection();
        // send any ice candidates to the other peer
        this.peerConn.onicecandidate = function (event) {
            console.log('icecandidate event:', event);
            if (event.candidate) {
                sendMessage(_id, {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                });
                log(event.candidate.candidate)
            } else {
                console.log('End of candidates.');
            }
        };
        //dataChannel
        var _datachannel;
        if (this.isInitiator) {
            console.log('Creating Data Channel');
            this.dataChannel = this.peerConn.createDataChannel('video');
            this.onDataChannelCreated(this.dataChannel);

            console.log('Creating an offer');
            var peerC = this.peerConn;
            //var _id = this.id;
            //this.peerConn.createOffer(this.onLocalSessionCreated, logError);
            this.peerConn.createOffer().then(function (offer) {
                return peerC.setLocalDescription(offer);
            }).then(function(){
                console.log('this ID is ',_id);
                sendMessage(_id, peerC.localDescription);
            }).catch(function(reason){
                logError(reason);
            });
        } else {
            this.peerConn.ondatachannel = function (event) {
                console.log('ondatachannel:', event.channel);
                _dc = event.channel;
                onDataChannelCreated(_dc);
            };
        }
    }

    function onDataChannelCreated(channel) {
        console.log('onDataChannelCreated:', channel);

        channel.onopen = function () {
            console.log('CHANNEL opened!!!');
            _isConnection = true;
        };

        channel.onmessage = (adapter.browserDetails.browser === 'firefox') ?
            receiveDataFirefoxFactory() : receiveDataChromeFactory();
    }

    function receiveDataChromeFactory() {
        var buf, count;

        return function onmessage(event) {
            if (typeof event.data === 'string') {
                buf = window.buf = new Uint8ClampedArray(parseInt(event.data));
                count = 0;
                console.log('Expecting a total of ' + buf.byteLength + ' bytes');
                return;
            }

            var data = new Uint8ClampedArray(event.data);
            buf.set(data, count);

            count += data.byteLength;
            console.log('count: ' + count);

            if (count === buf.byteLength) {
                // we're done: all data chunks have been received
                console.log('Done. Rendering video.');
                //renderPhoto(buf);
                readBuffer(buf);
            }
        };
    }

    function receiveDataFirefoxFactory() {
        var count, total, parts;

        return function onmessage(event) {
            if (typeof event.data === 'string') {
                total = parseInt(event.data);
                parts = [];
                count = 0;
                console.log('Expecting a total of ' + total + ' bytes');
                return;
            }

            parts.push(event.data);
            count += event.data.size;
            console.log('Got ' + event.data.size + ' byte(s), ' + (total - count) +
                ' to go.');

            if (count === total) {
                console.log('Assembling payload');
                var buf = new Uint8ClampedArray(total);
                var compose = function (i, pos) {
                    var reader = new FileReader();
                    reader.onload = function () {
                        buf.set(new Uint8ClampedArray(this.result), pos);
                        if (i + 1 === parts.length) {
                            console.log('Done. Rendering video.');
                            //renderPhoto(buf);
                            readBuffer(buf);
                        } else {
                            compose(i + 1, pos + this.result.byteLength);
                        }
                    };
                    reader.readAsArrayBuffer(parts[i]);
                };
                compose(0, 0);
            }
        };
    }

    function sendData(buf) {
        //var blob = new Blob([buf], { type: 'video/webm' });
        var blob = new Blob([buf], { type: 'video/webm' });
        // Split data channel message in chunks of this byte length.
        var CHUNK_LEN = 64000;
        var len = blob.size;
        var n = len / CHUNK_LEN | 0;

        console.log('Sending a total of ' + len + ' byte(s)');
        this.dataChannel.send(len);

        // split the photo and send in chunks of about 64KB
        for (var i = 0; i < n; i++) {
            var start = i * CHUNK_LEN,
                end = (i + 1) * CHUNK_LEN;
            console.log(start + ' - ' + (end - 1));
            this.dataChannel.send(blob.slice(start, end));
        }

        // send the reminder, if any
        if (len % CHUNK_LEN) {
            console.log('last ' + len % CHUNK_LEN + ' byte(s)');
            this.dataChannel.send(blob.slice(n * CHUNK_LEN));
        }
    }
}
function logError(err) {
    console.log(err.toString(), err);
}