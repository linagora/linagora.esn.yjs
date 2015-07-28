'use strict';

if (!window.Set) {
  var Set = function() {};
  Set.prototype._set = [];

  Set.prototype.add = function(element) {
    if (!this.has(element)) {
      this._set.push(element);
    }
  };

  Set.prototype.remove = function(element) {
    this._set = this._set.filter(function(el) {
      return el !== element;
    });
  };

  Set.prototype.has = function(element) {
    return this._set.indexOf(element) > -1;
  };

  window.Set = Set;
}
