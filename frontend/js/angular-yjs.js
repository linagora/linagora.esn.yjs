'use strict';

angular.module('yjs', ['op.live-conference'])
  .constant('YJS_CONSTANTS', {
    DELAY_BEFORE_SENDING: 100, // ms
    MAX_MESSAGE_GROUP_LENGTH: 0 // if ≤0, do not group
  })
  .factory('YjsConnectorFactory', ['$log', 'DelayedStack', 'compressMessages', function($log, DelayedStack, compressMessages) {
    function EasyRTCConnector(webrtc) {
      var connector = this;
      connector.webrtc = webrtc;
      this.connected_peers = [];
      this.peersStack = {};

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

      var when_bound_to_y = function() {
        connector.init({
          role: 'slave',
          syncMethod: 'syncAll',
          user_id: webrtc.myEasyrtcid()
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

      /** Expect msgData in the form
        * {
        *   data: [],
        *   map: {},
        * }
        */
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

      connector.broadcastStack = new DelayedStack(function(messages) {
        var map = messages[messages.length - 1].map;
        var data = messages.map(function(message) {
          return message.data;
        });

        connector.webrtc.broadcastData('yjs', {map: map, data: data});
      });
    }

    EasyRTCConnector.prototype.send = function(user_id, message) {
      this.peersStack[user_id].push(compressMessages.encode(message));
    };


    EasyRTCConnector.prototype.broadcast = function(message) {
      this.broadcastStack.push(compressMessages.encode(message));
    };

    return EasyRTCConnector;
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

          // When compressing, add to the seen string and if already in, create an alias for it
          if (map === COMPRESS_MAP) {
            var returnAlias = false;

            if (extraCompress.seen.has(data)) {
              returnAlias = true;
            } else {
              extraCompress.seen.add(data);
            }

            // special case if the string starts with '\u0000', then we force to compress it
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

          } else {
            // When the first char is the magic char, it should be in extraMap
            if (data[0] === magic_prefix) {
              return extraMap[data];
            }
          }
        }
        return data;
      }
    }

    return {
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
      decode: function(obj) {
        var data = obj.data;
        var map = obj.map;
        return coder(data, DECOMPRESS_MAP, map);
      }
    };
  }])
  .factory('DelayedStack', ['$timeout', 'YJS_CONSTANTS', function($timeout, YJS_CONSTANTS) {
    function Delayer(callback) {
      this.stack = [];
      this.callback = callback;
      this.pending = false;
      this.delayTime = YJS_CONSTANTS.DELAY_BEFORE_SENDING;
      this.maxStackSize = YJS_CONSTANTS.MAX_MESSAGE_GROUP_LENGTH;
    }

    Delayer.prototype.push = function(element) {
      this.stack.push(element);

      if (!this.pending) {
        this.pending = true;
        $timeout(this.flush.bind(this), this.delayTime);
      } else if (this.maxStackSize > 0 && this.stack.length >= this.maxStackSize) {
        this.flush();
      }
    };

    Delayer.prototype.destroy = function() {
      this.stack = [];
      this.callback = null;
    };

    Delayer.prototype.flush = function() {
      if (this.callback) {
        this.callback(this.stack);
      }

      this.stack = [];
      this.pending = false;
    };

    return Delayer;
  }])
  .service('yjsService', ['easyRTCService', 'YjsConnectorFactory', '$log', function(easyRTCService, YjsConnectorFactory, $log) {
    var connector = new YjsConnectorFactory(easyRTCService);
    var y = new window.Y(connector);
    $log.info('Created yjs instance', y, connector);
    return function() {
      return {
        y: y,
        connector: connector
      };
    };
  }]);
