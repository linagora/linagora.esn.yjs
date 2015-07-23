'use strict';

/* global chai: false */
var expect = chai.expect;

describe('delayedStack', function() {
  var YjsConnectorFactory, DelayedStack, yjsService, connectionCallback, $window;
  var dataChannelOpenListener, dataChannelCloseListener, peerListener;
  var easyRtcServiceMock;
  beforeEach(angular.mock.module('yjs'));

  beforeEach(angular.mock.module(function($provide) {
      easyRtcServiceMock = {
      connection: function() {
        return {
          then: function(cb) {
            connectionCallback = cb;
          }
        };
      },
      myEasyrtcid: function() {
        return 'sqmlkqjsfdqsdf';
      },
      addDataChannelOpenListener: function(cb) {
        dataChannelOpenListener = cb;
      },
      addDataChannelCloseListener: function(cb) {
        dataChannelCloseListener = cb;
      },
      setPeerListener: function(cb) {
        peerListener = cb;
      },
      getOpenedDataChannels: function() {
        return [];
      },
      sendData: function() {

      },
      broadcastData: function() {

      }
    };
    $provide.value('easyRTCService', easyRtcServiceMock);
  }));

  beforeEach(angular.mock.inject(function(_YjsConnectorFactory_, _DelayedStack_, _yjsService_, _$window_) {
    YjsConnectorFactory = _YjsConnectorFactory_;
    DelayedStack = _DelayedStack_;
    yjsService = _yjsService_;
    $window = _$window_;
  }));

  describe('yjsService', function() {
    it('should return an object', function() {
      expect(yjsService())
      .to.be.an('object')
      .to.have.property('y');
      expect(yjsService())
      .to.have.property('connector');
    });
  });

  describe('YjsConnectorFactory', function() {
    var connector;

    beforeEach(function() {
      connector = yjsService().connector;
    });

    it('should delay the initialization until bound to Y', function() {
      var connector = new YjsConnectorFactory(easyRtcServiceMock);
      connector.init = chai.spy();
      connectionCallback();
      expect(connector.init).to.have.been.called.once;
    });

    it('should call connector.init on connection', function() {
      connector.init = chai.spy();

      expect(connector.init).to.not.have.been.called;
      connectionCallback();
      expect(connector.init).to.have.been.called.once;
    });

    describe('peer connection when the connection is set', function() {
      var peerName = 'hey, I\m a peer';

      beforeEach(function() {
        connectionCallback();
      });

      it('should call userJoined peer when a peer connects', function () {
        connector.userJoined = chai.spy();

        // Add a peer
        expect(connector.userJoined).to.not.have.been.called;
        dataChannelOpenListener(peerName);

        expect(connector.userJoined).to.have.been.called.once
          .with(peerName);

      });

      it('should call userLeft when a registered peer leaves', function() {
        connector.userLeft = chai.spy();

        dataChannelOpenListener(peerName);

        expect(connector.userLeft).to.not.have.been.called;
        dataChannelCloseListener(peerName);
        expect(connector.userLeft).to.have.been.called.once.with(peerName);
      });

      it('should not call userLeft when a registered peer leaves', function() {
        connector.userLeft = chai.spy();

        dataChannelOpenListener(peerName);

        expect(connector.userLeft).to.not.have.been.called;
        dataChannelCloseListener('I don\'t know how I arrived there, but I\m mostly useless…');
        expect(connector.userLeft).to.not.have.been.called;
      });

      it('should call receiveMessage for each message received', function() {
        var id = 'qsfdqsdf', msgType = 'we don\t care', msgData = ['message 0', 'message 1'];
        connector.receiveMessage = chai.spy();

        peerListener(id, msgType, msgData);

        expect(connector.receiveMessage).to.have.been.called.twice
          .with(id, msgData[0])
          .with(id, msgData[1]);
      });

      it('shoud be able to send a message to a connected peer', function(done) {
        dataChannelOpenListener('foo');
        // we flush, because yjs sends extra information
        connector.peersStack.foo.flush();

        easyRtcServiceMock.sendData = function(id, name, messages) {
          expect(id).to.equal('foo');
          expect(name).to.equal('yjs');
          expect(messages[0]).to.equal('Hey, what\'s up?');
          expect(messages[1]).to.equal('Still me.');

          done();
        };
        connector.send('foo', 'Hey, what\'s up?');
        connector.send('foo', 'Still me.');
      });

      it('shoud be able to broadcast a message to all connected peers', function(done) {
        dataChannelOpenListener('foo');
        dataChannelOpenListener('bar');
        // we flush, because yjs sends extra information
        connector.broadcastStack.flush();

        easyRtcServiceMock.broadcastData = function(name, messages) {
          expect(name).to.equal('yjs');
          expect(messages[0]).to.equal('Hey, what\'s up?');
          expect(messages[1]).to.equal('Still me.');

          done();
        };
        connector.broadcast('Hey, what\'s up?');
        connector.broadcast('Still me.');
      });

      it('should create a DelayedStack object for each peer and remove it when the peer disconnects', function() {
          var peers = ['foo', 'bar'];
          var delayer;
          /* We check that:
           * the delayed stack object is created on user joined
           * the delayed stack object is deleted on user left
           * the delayed stack's destroy function is called
           */

          peers.forEach(function(peer) {
            dataChannelOpenListener(peer);
            expect(connector.peersStack).to.have.property(peer)
              .and.to.be.an('object');

            delayer = connector.peersStack[peer];
            delayer.destroy = chai.spy();
            dataChannelCloseListener(peer);

            expect(delayer.destroy).to.have.been.called.once;
            expect(connector.peersStack).to.not.have.property(peer);
          });
      });

    });

  });

  describe('DelayedStack', function() {
    var delayedStack, spy;
    beforeEach(function() {
      spy = chai.spy();
      delayedStack = new DelayedStack(spy);
    });

    it('should be a class', function() {
      expect(DelayedStack).to.be.a('function');
    });

    describe('the push method', function() {
      var myElems = [1,2,3];

      it('should exist', function() {
        expect(delayedStack).to.have.property('push')
          .and.to.be.a('function');
      });

      it('should store the pushed elements in an array in the same order', function() {
        myElems.forEach(function(element) {
          delayedStack.push(element);
        });

        expect(delayedStack.stack).to.be.an('array')
          .and.to.have.property('length', myElems.length);

        myElems.forEach(function(element, index) {
          expect(delayedStack.stack[index]).to.equal(element);
        });
      });

      it('should call flush asynchronously', function(done) {
        delayedStack.callback = function(content) {
          myElems.forEach(function(element, index) {
            expect(content[index]).to.equal(element);
          });
          done();
        };

        myElems.forEach(function(element) {
          delayedStack.push(element);
        });
      });

      it('should call flush synchronously if too many messages are pending', function() {
        delayedStack.flush = chai.spy();
        for (var i = 0; i < delayedStack.maxStackSize - 1; i++) {
          delayedStack.push(i);
        }

        expect(delayedStack.flush).to.not.have.been.called();
        delayedStack.push('the straw that broke the camel');
        expect(delayedStack.flush).to.have.been.called.once();
      });

      it('should not call flush twice (too quickly)', function(done) {
        delayedStack.flush = chai.spy();

        myElems.forEach(function(element) {
          delayedStack.push(element);
        });

        $window.setTimeout(function() {
          expect(delayedStack.flush).to.have.been.called.once;
          done();
        }, delayedStack.delayTime * 2);
      });

    });

    describe('the flush method', function() {
      var tab = [1,2,3];

      it('should exist', function() {
        expect(delayedStack).to.have.property('flush')
          .and.to.be.a('function');
      });

      it('should call the callback with all stacked messages', function() {
        delayedStack.stack = tab;

        delayedStack.flush();

        expect(spy).to.have.been.called.once.with(tab);
      });

      it('should clean the stack', function() {
        delayedStack.stack = tab;

        delayedStack.flush();

        expect(delayedStack.stack)
          .to.be.an('array')
          .and.to.have.property('length', 0);
      });

      it('should reset the \'pending\' flag to false', function() {
        delayedStack.stack = tab;
        delayedStack.pending = true;

        delayedStack.flush();

        expect(delayedStack.pending).to.be.false;
      });
    });

    describe('the destroy method', function() {
      it('should exist', function() {
        expect(delayedStack).to.have.property('destroy')
          .and.to.be.a('function');
      });

      it('should delete the stack of message', function() {
        delayedStack.stack = [1, 2, 3];
        delayedStack.destroy();

        expect(delayedStack.stack).to.be.an('array')
          .and.have.property('length', 0);
      });

      it('should remove the callback', function() {
        delayedStack.destroy();

        expect(delayedStack.callback).to.be.null;
      });
    });
  });
});
