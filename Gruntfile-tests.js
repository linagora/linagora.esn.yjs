'use strict';

module.exports = function(grunt) {

  grunt.initConfig({
    concat: {
      options: {
        separator: ';'
      }
    },

    splitfiles: {
      options: {
        chunk: 10
      }
    },
    mochacli: {
      options: {
        require: ['chai'],
        reporter: 'spec',
        timeout: process.env.TEST_TIMEOUT || 20000,
        env: {
          ESN_CUSTOM_TEMPLATES_FOLDER: 'testscustom'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-mocha-cli');

  grunt.registerTask('test-frontend', 'run the FrontEnd tests', function() {
    var done = this.async();

    var child = require('child_process').spawn('./node_modules/karma/bin/karma', ['start', '--browsers', 'PhantomJS', './test/conf/karma.conf.js']);

    child.stdout.on('data', function(chunk) { grunt.log.write(chunk); });
    child.stderr.on('data', function(chunk) { grunt.log.error(chunk); });
    child.on('close', function(code) { done(code ? false : true); });
  });

  grunt.registerTask('test-frontend-all', 'run the FrontEnd tests on all possible browsers', function() {
    var done = this.async();

    var child = require('child_process').spawn('./node_modules/karma/bin/karma', ['start', '--browsers', 'PhantomJS,Firefox,Chrome', './test/conf/karma.conf.js']);

    child.stdout.on('data', function(chunk) { grunt.log.write(chunk); });
    child.stderr.on('data', function(chunk) { grunt.log.error(chunk); });
    child.on('close', function(code) { done(code ? false : true); });
  });
  grunt.registerTask('test', ['test-frontend']);
  grunt.registerTask('default', ['test']);
};
