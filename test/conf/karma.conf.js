'use strict';

module.exports = function(config) {
  config.set({
    basePath: '../../',

    files: [
      'test/conf/phantom-bind-polyfill.js',
      'frontend/components/angular/angular.js',
      'frontend/components/angular-mocks/angular-mocks.js',
      'frontend/components/chai/chai.js',
      'frontend/components/chai-spies/chai-spies.js',
      'frontend/components/yjs/y.js',
      'test/**/*.js',
      'frontend/js/**/*.js'
    ],

    frameworks: ['mocha'],
    colors: true,
    singleRun: true,
    autoWatch: true,
    browsers: ['PhantomJS', 'Chrome', 'Firefox'],
    reporters: ['coverage', 'spec'],
    preprocessors: {
      'frontend/js/**/*.js': ['coverage'],
    },
    plugins: [
      'karma-phantomjs-launcher',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-mocha',
      'karma-coverage',
      'karma-spec-reporter',
    ],

    junitReporter: {
      outputFile: 'test_out/unit.xml',
      suite: 'unit-frontend'
    },

    coverageReporter: {type: 'text', dir: '/tmp'}
  });
};
