'use strict';

(function(angular) {
  function EasyRTCConnector(webrtc) {
    var connector = this;
    connector.webrtc = webrtc;
    var connected_peers = [];
    var add_missing_peers = function() {
      if (connector.is_initialized) {
        var peer = connected_peers.pop();
        while (peer !== undefined) {
          connector.userJoined(peer, 'slave');
          peer = connected_peers.pop();
        }
      }
    };
    var when_bound_to_y = function() {
      connector.init({
        role: 'slave',
        syncMethod: 'syncAll',
        user_id: webrtc.myEasyrtcid
      });
      add_missing_peers();
    };

    webrtc.setDataChannelOpenListener(function(peerId) {
      // Add all the connected peers
      connected_peers.push(peerId);
      if (connector.is_bound_to_y) {
        when_bound_to_y();
      } else {
        connector.on_bound_to_y = when_bound_to_y();
      }
      add_missing_peers();
    });

    webrtc.setPeerListener(function(id, msgType, msgData) {
      if (connector.is_initialized) {
        connector.receiveMessage(id, JSON.parse(msgData));
      }
    }, 'yjs');

    webrtc.setDataChannelCloseListener(function(peerId) {
      var index = connected_peers.indexOf(peerId);
      // If index in connected peers, remove it
      if (index > -1) {
        connected_peers.splice(index, 1);
      }
      if (connector.is_initialized) {
        connector.userLeft(peerId);
      }
    });
  }

  EasyRTCConnector.prototype.send = function(user_id, message) {
    this.webrtc.sendData(user_id, 'yjs', JSON.stringify(message));
  };
  EasyRTCConnector.prototype.broadcast = function(message) {
    this.webrtc.broadcastData('yjs', JSON.stringify(message));
  };

  angular.module('yjs', ['op.live-conference'])
    .service('yjsService', ['easyRTCService', '$log', function(easyRTCService, $log) {
      var connector = new EasyRTCConnector(easyRTCService);
      var y = new window.Y(connector);
      $log.info('Created yjs instance', y, connector);
      return function() {
        return {
          y: y,
          connector: connector
        };
      };
    }]);
})(angular);
