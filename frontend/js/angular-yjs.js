'use strict';

(function(angular) {
  function EasyRTCConnector(webrtc) {
    var connector = this;
    connector.webrtc = webrtc;
    var connected_peers;
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
        user_id: webrtc.myEasyrtcid()
      });
      connected_peers = webrtc.getOpenedDataChannels();
      add_missing_peers();
    };

    webrtc.connection().then(function() {
      if (connector.is_bound_to_y) {
        when_bound_to_y();
      } else {
        connector.on_bound_to_y = when_bound_to_y();
      }
    }, function(errorCode, message) {
      console.log('Error while getting connection to server.', errorCode, message);
    });

    webrtc.setDataChannelOpenListeners(function(peerId) {
      if (connector.is_initialized) {
        connected_peers.push(peerId);
        add_missing_peers();
      }
    });

    webrtc.setPeerListeners(function(id, msgType, msgData) {
      if (connector.is_initialized) {
        connector.receiveMessage(id, JSON.parse(msgData));
      }
    }, 'yjs');

    webrtc.setDataChannelCloseListeners(function(peerId) {
      var index = connected_peers.indexOf(peerId);
      if (index > -1) {
        connected_peers.splice(index, 1);
      }
      if (connector.is_initialized) {
        connector.userLeft(peerId);
      }
    });
  }

  EasyRTCConnector.prototype.send = function(user_id, message) {
    this.webrtc.sendData(user_id, 'yjs', message);
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
