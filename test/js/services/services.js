'use strict';

/* global chai: false */
var expect = chai.expect;

describe('delayedStack', function() {
  var YjsConnectorFactory, DelayedStack, compressMessages, yjsService, connectionCallback, $timeout, YJS_CONSTANTS, COMPRESS_MAP;
  var dataChannelOpenListener, dataChannelCloseListener, peerListener;
  var webRtcServiceMock;
  beforeEach(angular.mock.module('yjs'));

  beforeEach(angular.mock.module(function($provide) {
      webRtcServiceMock = {
      connection: function() {
        return {
          then: function(cb) {
            connectionCallback = cb;
          }
        };
      },
      myRtcid: function() {
        return {
          then: function(cb) {
            return cb('sqmlkqjsfdqsdf');
          }
        };
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
    $provide.value('webRTCService', webRtcServiceMock);
  }));

  beforeEach(angular.mock.inject(function(_YjsConnectorFactory_, _DelayedStack_, _compressMessages_, _yjsService_, _$timeout_, _YJS_CONSTANTS_, _COMPRESS_MAP_) {
    YjsConnectorFactory = _YjsConnectorFactory_;
    DelayedStack = _DelayedStack_;
    compressMessages = _compressMessages_;
    yjsService = _yjsService_;
    $timeout = _$timeout_;
    YJS_CONSTANTS = _YJS_CONSTANTS_;
    COMPRESS_MAP = _COMPRESS_MAP_;
  }));

  describe('yjsService', function() {
    it('should return an object', function() {
      expect(yjsService)
      .to.be.an('object')
      .to.have.property('y');
      expect(yjsService)
      .to.have.property('connector');
    });
  });

  describe('YjsConnectorFactory', function() {
    var connector;

    beforeEach(function() {
      connector = yjsService.connector;
      compressMessages.encode = function(message) {
        return {
          data: message,
          map: {}
        };
      };
      compressMessages.decode = function(message) {
        return message.data;
      };
    });

    it('should delay the initialization until bound to Y', function() {
      var connector = new YjsConnectorFactory(webRtcServiceMock);
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

        peerListener(id, msgType, {data: msgData, map: {}});

        expect(connector.receiveMessage).to.have.been.called.twice
          .with(id)
          .with(id);
      });

      it('shoud be able to send a message to a connected peer', function(done) {
        dataChannelOpenListener('foo');
        // we flush, because yjs sends extra information
        connector.peersStack.foo.flush();

        webRtcServiceMock.sendData = function(id, name, data) {
          expect(id).to.equal('foo');
          expect(name).to.equal('yjs');
          expect(data).to.have.property('data')
            .and.be.an('array');
          expect(data).to.have.property('map')
            .and.be.an('object');
          expect(data.data[0]).to.equal('Hey, what\'s up?');
          expect(data.data[1]).to.equal('Still me.');

          done();
        };
        connector.send('foo', 'Hey, what\'s up?');
        connector.send('foo', 'Still me.');

        $timeout.flush();
      });

      it('should be able to broadcast a message to all connected peers', function(done) {
        dataChannelOpenListener('foo');
        dataChannelOpenListener('bar');
        // we flush, because yjs sends extra information
        connector.broadcastStack.flush();

        webRtcServiceMock.broadcastData = function(name, data) {
          expect(name).to.equal('yjs');
          expect(data).to.have.property('data')
            .and.be.an('array');
          expect(data).to.have.property('map')
            .and.be.an('object');
          expect(data.data[0]).to.equal('Hey, what\'s up?');
          expect(data.data[1]).to.equal('Still me.');

          done();
        };
        connector.broadcast('Hey, what\'s up?');
        connector.broadcast('Still me.');

        $timeout.flush();
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
  describe('compressMessages service', function() {
    it('should have an encode and a decode method', function() {
      expect(compressMessages.encode).to.be.a('function');
      expect(compressMessages.decode).to.be.a('function');
    });

    describe('the encode method', function() {
      it('should return an object', function() {
        var ret = compressMessages.encode('foo');

        /* The return value has the data compressed and a map that gives the alias */
        expect(ret).to.have.property('data');
        expect(ret).to.have.property('map');
      });

      it('should compress frequent strings', function() {
        var ret0 = compressMessages.encode({foo: 'bar'});
        expect(ret0.map).to.deep.equal({});

        var ret1 = compressMessages.encode({notfoo: 'bar'});
        expect(ret1.map).to.deep.equal({_0: 'bar'});
        expect(ret1.data).to.deep.equal({notfoo: '_0'});
      });

      it('should compress objects\' keys that are in the COMPRESS_MAP', function() {
        for (var knownKey in COMPRESS_MAP) {
          var compressMe = {};
          compressMe[knownKey] = knownKey;
          var ret = compressMessages.encode(compressMe);

          var expected = {};
          expected[COMPRESS_MAP[knownKey]] = knownKey;
          expect(ret.data).to.deep.equal(expected);
        }
      });

      it('should compress recursively', function() {
        COMPRESS_MAP = {
          'foo': '1',
          'bar': '2'
        };

        // sync_step maps to 'A' and send_again to 'B'
        var obj0 = {'sync_step' : '0'};
        var obj1 = {'send_again': obj0};
        var ret = compressMessages.encode(obj1);

        expect(ret.data).to.deep.equal({'B' : { 'A': '0'}});
      });

      it('should compress arrays', function() {
        var obj = [{'sync_step': 0}, {'sync_step' : 1}];

        var ret = compressMessages.encode(obj);

        expect(ret.data).to.be.an('array')
        .and.to.deep.equal([{'A': 0}, {'A': 1}]);
      });

      it('should not compress other objects', function() {
        var obj = [1];

        var ret = compressMessages.encode(obj);

        expect(ret.data).to.deep.equal([1]);
      });

      it('should force the encoding of _-starting strings', function() {
        var string = '_foo';

        var ret = compressMessages.encode(string);
        expect(ret.map._0).to.exist
          .and.to.equal('_foo');
      });
    });

    describe('the decode method', function() {
      it('should be able to decode the input of encode', function() {
        var object = {
          'foo': 'bar',
          'otherfoo': 'bar',
          'arrayTest': [1, 2, 'foo', 'bar']};
        var ret = compressMessages.encode(object);
        expect(compressMessages.decode(ret)).to.deep.equal(object);
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

        $timeout.flush();
      });

      it('should call flush synchronously if too many messages are pending', function() {
        YJS_CONSTANTS.MAX_MESSAGE_GROUP_LENGTH = 100;
        delayedStack = new DelayedStack();
        delayedStack.flush = chai.spy();
        for (var i = 0; i < delayedStack.maxStackSize - 1; i++) {
          delayedStack.push(i);
        }

        expect(delayedStack.flush).to.not.have.been.called();
        delayedStack.push('the straw that broke the camel');
        expect(delayedStack.flush).to.have.been.called.once();
      });

      it('should call flush asynchronously if the max number of messages is ≤ 0', function() {
        YJS_CONSTANTS.MAX_MESSAGE_GROUP_LENGTH = 0;
        delayedStack = new DelayedStack();
        delayedStack.flush = chai.spy();
        for (var i = 0; i < delayedStack.maxStackSize - 1; i++) {
          delayedStack.push(i);
        }

        expect(delayedStack.flush).to.not.have.been.called();
        delayedStack.push('the straw that didn\'t broke the camel');
        expect(delayedStack.flush).to.not.have.been.called();

        $timeout.flush();
        expect(delayedStack.flush).to.have.been.called.once();
      });

      it('should not call flush twice (too quickly)', function() {
        delayedStack.flush = chai.spy();

        myElems.forEach(function(element) {
          delayedStack.push(element);
        });

        $timeout.flush();

        expect(delayedStack.flush).to.have.been.called.once;
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
