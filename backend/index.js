'use strict';

var AwesomeModule = require('awesome-module');
var Dependency = AwesomeModule.AwesomeModuleDependency;

var AwesomeYjsModule = new AwesomeModule('linagora.esn.yjs', {
  dependencies: [
    new Dependency(Dependency.TYPE_NAME, 'webserver.wrapper', 'webserver-wrapper'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.io.webrtc', 'webrtc')
  ],
  states: {
    lib: function(dependencies, callback) {
      return callback();
    },
    deploy: function(dependencies, callback) {
      // register the webapp
      var app = require('./webserver/application')(dependencies);
      var webserver = dependencies('webserver-wrapper');

      var depList = ['yjs/build/browser/y.js', 'y-list/y-list.js',
        'y-selections/y-selections.js', 'y-richtext/y-richtext.js'];
      var i;
      for (i = 0; i < depList.length; i++) {
        depList[i] = '../components/' + depList[i];
      }

      webserver.injectAngularModules('yjs', ['app.js'], 'yjs', ['live-conference']);
      webserver.injectJS('yjs', depList, ['live-conference']);
      webserver.addApp('yjs', app);

      return callback(null, {});
    },
    start: function(dependencies, callback) {
      callback();
    }
  }
});

module.exports = AwesomeYjsModule;
