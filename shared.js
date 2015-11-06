"use strict";

var pi = Math.PI;
var tau = 2*Math.PI;
var cos = Math.cos;
var sin = Math.sin;
var asin = Math.asin;
var atan2 = Math.atan2;
var deg_to_rad = tau/360;
var rad_to_deg = 360/tau
// one of the earth radius methods from https://en.wikipedia.org/wiki/Earth_radius
var rad_to_meters = 6371007;
var meters_to_rad = 1 / rad_to_meters;

// bearing in degrees clockwise from north; distance in meters
function offsetLatLngBy(latlng, bearing, distance) {
  latlng = L.latLng(latlng);
  var lat1 = latlng.lat * deg_to_rad;
  var lng1 = latlng.lng * deg_to_rad;
  var b = bearing*deg_to_rad;
  var d = distance*meters_to_rad;
  // formulae from http://williams.best.vwh.net/avform.htm#LL
  // (see the intro for what units it uses)
  var lat2 = asin(sin(lat1)*cos(d)+cos(lat1)*sin(d)*cos(b));
  var dlng = atan2(sin(b)*sin(d)*cos(lat1),cos(d)-sin(lat1)*sin(lat2));
  var lng2 = ((lng1 + dlng + pi) % tau ) - pi;
  return L.latLng(lat2*rad_to_deg, lng2*rad_to_deg);
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

// https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API

var displayTime = function(seconds) {
  var s = parseFloat(seconds);
  if (s > 0) {
    return (Math.floor(s / 60).toString() + 'm ' +
            (s % 60).toString() + 's');
  } else {
    return '...';
  }
};
var displayUnixTimeOfArrival = function(time) {
  return displayTime(time - Math.round(Date.now() / 1000));
};

var stopNickname = function(stop) {
  var routes = stop.routes;
  var routes_abbr;
  if(routes.length > 4) {
    routes_abbr = routes.slice(0, 3).join(', ') + '...';
  } else {
    routes_abbr = routes.join(', ');
  }
  return stop.title + ' (' + routes_abbr + ')';
}

// This returns a L.LatLngBounds that definitely includes
// everywhere within 'meters' radius along the Earth's surface,
// and probably (nay, definitely) includes some more area as well,
// but tries somewhat to minimize the size of that extra area.
function boundsThatEncompassEverywhereWithinADistanceFrom(latlng, meters) {
  latlng = L.latLng(latlng);
  var lat = latlng.lat;
  var lng = latlng.lng;
  console.assert(meters >= 0);
  // TODO go in the other direction if next to the pole:
  // (actually, if near the pole, we need a different algorithm -
  // such as cover every lng, and lat up to the pole and down by
  // meters*1.1)
  var latplus = L.latLng(lat + 1, lng);
  var lngplus = L.latLng(lat, lng + 1);
  var approxMetersPerLatDegree = latlng.distanceTo(latplus);
  var approxMetersPerLngDegree = latlng.distanceTo(lngplus);
  var approxLatDelta = meters / approxMetersPerLatDegree * 1.1;
  var approxLngDelta = meters / approxMetersPerLngDegree * 1.1;
  var northLat = lat + approxLatDelta;
  var southLat = lat - approxLatDelta;
  var eastLng = lng + approxLngDelta;
  var westLng = lng - approxLngDelta;
  console.assert(latlng.distanceTo([northLat, lng]) > meters);
  console.assert(latlng.distanceTo([northLat, lng]) < meters * 1.2);
  console.assert(latlng.distanceTo([southLat, lng]) > meters);
  console.assert(latlng.distanceTo([southLat, lng]) < meters * 1.2);
  console.assert(latlng.distanceTo([lat, eastLng]) > meters);
  console.assert(latlng.distanceTo([lat, eastLng]) < meters * 1.2);
  console.assert(latlng.distanceTo([lat, westLng]) > meters);
  console.assert(latlng.distanceTo([lat, westLng]) < meters * 1.2);
  return L.latLngBounds([southLat, westLng], [northLat, eastLng]);
}

// maxDistanceToLook is meters
//
// callback(stop, distance): "return false" to break,
//   return anything else or nothing to keep getting more stops.
//
// returns false if "breaked", true if maxDistanceToLook exceeded first.
function nearestStopsTo(latlng, maxDistanceToLook, stopsQuadtree, callback) {
  //if(maxDistanceToLook === undefined) {
  //  maxDistanceToLook = 10000;
  //}
  console.assert(maxDistanceToLook >= 0);
  var latlng = L.latLng(latlng);
  // the starting value of 'testRadiusInMeters' is only an optimization
  var testRadiusInMeters = 10;
  var aboutDone = false;
  var alreadyFound = {};
  while(!aboutDone) {
    if(testRadiusInMeters >= (maxDistanceToLook * 0.7)) {
      aboutDone = true;
      testRadiusInMeters = maxDistanceToLook;
    }
    var bounds = boundsThatEncompassEverywhereWithinADistanceFrom(latlng, testRadiusInMeters);
    var qualified = [];
    stopsQuadtree.get({
      x: bounds.getWest(),
      y: bounds.getSouth(),
      w: bounds.getEast() - bounds.getWest(),
      h: bounds.getNorth() - bounds.getSouth()
    }, function(leaf) {
      var stop = leaf.stop;
      if(!_.has(alreadyFound, stop.id)) {
        var distance = latlng.distanceTo([stop.lat, stop.lng]);
        if(distance <= testRadiusInMeters) {
          qualified.push([distance, stop]);
        }
      }
      return true; // don't break from the quadtree.get() loop
    });
    var sorted = _.sortBy(qualified, function(x){return x[0];});
    for(var i = 0; i < sorted.length; i++) {
      var distance = sorted[i][0];
      var stop = sorted[i][1];
      alreadyFound[stop.id] = true;
      if(callback(stop, distance) === false) {
        return false;
      }
    }
    testRadiusInMeters *= 2.5;
  }
  return true;
}

