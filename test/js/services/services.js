'use strict';

/* global chai: false */

var expect = chai.expect;

describe('delayedStack', function() {
  var YjsConnectorFactory, delayedStack, yjsService;
  beforeEach(angular.mock.module('yjs'));

  beforeEach(angular.mock.module(function($provide) {
  }));

  beforeEach(angular.mock.inject(function(_YjsConnectorFactory_, _delayedStack_, _yjsService_) {
    YjsConnectorFactory = _YjsConnectorFactory_;
    delayedStack = _delayedStack_;
    yjsService = _yjsService_;
  }))
});