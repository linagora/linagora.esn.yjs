'use strict';

angular.module('yjs', ['op.live-conference'])
  .constant('YJS_CONSTANTS', {
    DELAY_BEFORE_SENDING: 100, // ms
    MAX_MESSAGE_GROUP_LENGTH: 0 // if ≤0, do not group
  })
  .factory('YjsConnectorFactory', ['$log', 'DelayedStack', 'compressMessages', function($log, DelayedStack, compressMessages) {
    /**
      * A connector for WebRTC
      * @param {object} webrtc an webrtc object
      **/
    function WebRTCConnector(webrtc) {
      var connector = this;
      connector.webrtc = webrtc;
      this.connected_peers = [];
      this.peersStack = {};

      /** When the connection is up, we want to be notified of all the connected peers.
        * Moreover, each pear should have a DelayedStack to delay messages before being
        * sent.
        **/
      var add_missing_peers = function() {
        if (connector.is_initialized) {

          connector.connected_peers.forEach(function(peer) {
            connector.peersStack[peer] = connector.peersStack[peer] ||
              new DelayedStack(function(messages) {
                var map = messages[messages.length - 1].map;
                var data = messages.map(function(message) {
                  return message.data;
                });
                connector.webrtc.sendData(peer, 'yjs', {map: map, data: data});
              });

            connector.userJoined(peer, 'slave');
          });
        }
      };

      /** This function will be called when the connector will be bound to yjs,
        * a.k.a when Y(connector) will have been called.
        **/
      var when_bound_to_y = function() {
        connector.init({
          role: 'slave',
          syncMethod: 'syncAll',
          user_id: webrtc.myRtcid()
        });
        connector.connected_peers = webrtc.getOpenedDataChannels();
        add_missing_peers();
      };

      webrtc.connection().then(function() {
        if (connector.is_bound_to_y) {
          when_bound_to_y();
        } else {
          connector.on_bound_to_y = when_bound_to_y();
        }
      }, function(errorCode, message) {
        $log.error('Error while getting connection to server.', errorCode, message);
      });

      webrtc.addDataChannelOpenListener(function(peerId) {
        if (connector.is_initialized) {
          connector.connected_peers.push(peerId);
          add_missing_peers();
        }
      });

      /**
        * Expect msgData to be a compressed message with data and a map that
        * gives compression information. See compressMessages methods
        * Example
        * {
        *   data: [],
        *   map: {},
        * }
        **/
      webrtc.setPeerListener(function(id, msgType, msgData) {
        var data, map;
        if (connector.is_initialized) {
          data = msgData.data;
          map = msgData.map;
          data.forEach(function(message) {
            connector.receiveMessage(id, compressMessages.decode({data: message, map: map}));
          });
        }
      }, 'yjs');


      /** Notify of user deconnection and delete the peer stack of the user **/
      webrtc.addDataChannelCloseListener(function(peerId) {
        var index = connector.connected_peers.indexOf(peerId);
        if (index > -1) {
          connector.connected_peers.splice(index, 1);
          connector.peersStack[peerId].destroy();
          delete connector.peersStack[peerId];

          if (connector.is_initialized) {
            connector.userLeft(peerId);
          }
        }
      });

      /** Initialize a DelayedStack for braodcasting.
        * Since the encoding function appends new element to the map, only send
        * the last map along with the messages
        **/
      connector.broadcastStack = new DelayedStack(function(messages) {
        var map = messages[messages.length - 1].map;
        var data = messages.map(function(message) {
          return message.data;
        });

        connector.webrtc.broadcastData('yjs', {map: map, data: data});
      });
    }

    /** Sends a message to an user
      * @param {String} user_id the id of the receiver
      * @param {*} message a stringifiable object
      **/
    WebRTCConnector.prototype.send = function(user_id, message) {
      this.peersStack[user_id].push(compressMessages.encode(message));
    };

    /** Broadcasts a message to all user
      * @param {*} message a stringifiable object
      **/
    WebRTCConnector.prototype.broadcast = function(message) {
      this.broadcastStack.push(compressMessages.encode(message));
    };

    return WebRTCConnector;
  }])
  .constant('COMPRESS_MAP', {
    'sync_step': 'A',
    'send_again': 'B',
    'data': 'C',
    'type': 'D',
    'uid': 'E',
    'creator': 'F',
    'op_number': 'G',
    'custom_type': 'H',
    'content': 'I',
    'prev': 'J',
    'next': 'K',
    'origin': 'L',
    'parent': 'M',
    'sub': 'N',
    'user': 'O',
    'state': 'P',
    'composition_value': 'Q',
    'composition_value_operations': 'R',
    'composition_ref': 'S',
    'content_operations': 'T',
    'selections': 'U',
    'characters': 'V',
    'cursors': 'W',
    'attrs': 'X',
    'overwrite': 'Y',
    'from': 'Z',
    'to': 'a',
    'sent_again': 'b',
    'deletes': 'c'
  })
  .factory('compressMessages', ['COMPRESS_MAP', function(COMPRESS_MAP) {
    var magic_prefix = '_';

    var keySet = new Set();
    var DECOMPRESS_MAP = {};
    for (var key in COMPRESS_MAP) {
      DECOMPRESS_MAP[COMPRESS_MAP[key]] = key;
    }

    // Contain information about already seen values
    var extraCompress = {
      seen: new Set(),
      list: [],
      lastIndex: 0
    };

    /**
      * Generic function that converts any javascript object using the map and extraMap.
      * @param {*} data any javascript type
      * @param {Object} map an associative map between keys
      * @param {Object=} extraMap an extra optional associative map between keys
          it is used to encode frequently used strings
      ** @return {*} returns an encoded/decoded variable of the same type as the input
      **/
    function coder(data, map, extraMap) {
      var val;
      if (data instanceof Array) {
        return data.map(function(element) {
          return coder(element, map, extraMap);
        });

      } else if (data instanceof Object) {
        var encoded = {};

        for (var key in data) {
          val = coder(data[key], map, extraMap);

          if (map[key]) {
            encoded[map[key]] = val;
          } else {
            if (map === COMPRESS_MAP) {
              keySet.add(key);
            }
            encoded[key] = val;
          }
        }
        return encoded;

      } else {
        // Store the strings seen in an object for later compression
        if (typeof data === 'string') {
          if (map === COMPRESS_MAP) {
            /* when compressing, the data can either:
             * - be a new string, we add it to the 'seen' Set
             * - be a once-seen string, we create a shortname for it and return it
             * - be a more-than-one-seen string, we return its shortname
             * - start with the 'magic_prefix', we then force it to be replace by its shortcut
                 so that any string starting with the magic_prefix is encoded
             */
            var returnAlias = false;

            if (extraCompress.seen.has(data)) {
              returnAlias = true;
            } else {
              extraCompress.seen.add(data);
            }

            if (data[0] === magic_prefix) {
              returnAlias = true;
            }

            if (returnAlias) {
              var index = extraCompress.list.indexOf(data);
              if (extraCompress.list.indexOf(data) === -1) {
                index = extraCompress.list.length;
                extraCompress.list.push(data);
              }

              return magic_prefix + index;
            }

          } else if (data[0] === magic_prefix) {
            return extraMap[data];
          }
        }
        return data;
      }
    }

    return {
      /** Encode the data and return it with an map of the shortcuts used
        * @param {*} data any javascript variable
        * @return {Object} an object containing the map in 'map' and the encoded data in 'data'
        **/
      encode: function(data) {
        var encoded = coder(data, COMPRESS_MAP);
        var map = {};
        extraCompress.list.forEach(function(element, index) {
          map[magic_prefix + index] = element;
        });

        return {
          data: encoded,
          map: map
        };
      },
      /** Decode an object
        * @param {Object} obj and object that has a 'map' and a 'data' properties
        * @return {*} the decoded message
        **/
      decode: function(obj) {
        var data = obj.data;
        var map = obj.map;
        return coder(data, DECOMPRESS_MAP, map);
      }
    };
  }])
  /** Return the DelayedStack constructor
    * @return {DelayedStack} the DelayedStack constructor
    **/
  .factory('DelayedStack', ['$timeout', 'YJS_CONSTANTS', function($timeout, YJS_CONSTANTS) {
    /**
      * Create an instance of DelayedStack. It calls the given callback with the pushed elements at frequent intervals.
      * @constructor
      * @param {function} callback the callback
      **/
    function Delayer(callback) {
      this.stack = [];
      this.callback = callback;
      this.pending = false;
      this.delayTime = YJS_CONSTANTS.DELAY_BEFORE_SENDING;
      this.maxStackSize = YJS_CONSTANTS.MAX_MESSAGE_GROUP_LENGTH;
    }

    /**
      * Push an element into the stack
      * @param {*} element any javascript variable
      **/
    Delayer.prototype.push = function(element) {
      this.stack.push(element);

      if (!this.pending) {
        this.pending = true;
        $timeout(this.flush.bind(this), this.delayTime);
      } else if (this.maxStackSize > 0 && this.stack.length >= this.maxStackSize) {
        this.flush();
      }
    };

    /**
      * Empty the stack and unbind the callback function
      **/
    Delayer.prototype.destroy = function() {
      this.stack = [];
      this.callback = null;
    };

    /**
      * Force the callback to be called synchronously
      **/
    Delayer.prototype.flush = function() {
      if (this.callback) {
        this.callback(this.stack);
      }

      this.stack = [];
      this.pending = false;
    };

    return Delayer;
  }])
  .service('yjsService', ['$window', 'webRTCService', 'YjsConnectorFactory', '$log', function($window, webRTCService, YjsConnectorFactory, $log) {
    var connector = new YjsConnectorFactory(webRTCService);
    var y = new $window.Y(connector);
    var ret = {
      connector: connector,
      y: y
    };
    $log.info('Created yjs instance', y, connector);
    return ret;
  }]);
