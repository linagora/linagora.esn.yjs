'use strict';

angular.module('yjs', ['op.live-conference'])
  .constant('YJS_CONSTANTS', {
    DELAY_BEFORE_SENDING: 100, // ms
    MAX_MESSAGE_GROUP_LENGTH: 0 // if ≤0, do not group
  })
  .factory('YjsConnectorFactory', ['$log', 'DelayedStack', function($log, DelayedStack) {
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
                connector.webrtc.sendData(peer, 'yjs', messages);
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

      webrtc.setPeerListener(function(id, msgType, msgData) {
        if (connector.is_initialized) {
          msgData.forEach(function(message) {
            connector.receiveMessage(id, message);
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
        connector.webrtc.broadcastData('yjs', messages);
      });
    }


    EasyRTCConnector.prototype.send = function(user_id, message) {
      this.peersStack[user_id].push(message);
    };


    EasyRTCConnector.prototype.broadcast = function(message) {
      this.broadcastStack.push(message);
    };

    return EasyRTCConnector;
  }])
  .factory('DelayedStack', ['$window', 'YJS_CONSTANTS', function($window, YJS_CONSTANTS) {
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
        $window.setTimeout(this.flush.bind(this), this.delayTime);
      } else if (this.maxStackSize > 0 && this.stack.length >= this.maxStackSize) {
        this.flush();
      }
    };

    Delayer.prototype.destroy = function() {
      this.stack = [];
      this.callback = null;
    };

    Delayer.prototype.flush = function() {
      var callback = this.callback || function() {};
      callback(this.stack);
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
