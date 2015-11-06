"use strict";

// TODO min.js consistency here and in html
importScripts(
  'libs/underscore-min.js',
  //'bower_components/es6-promise/promise.min.js',
  'libs/qtree.js',
  // can't include leaflet here unless I hackily define window={}... 'libs/leaflet/leaflet.js',
  'bower_components/long/dist/long.js',
  'bower_components/bytebuffer/dist/ByteBufferAB.js',
  'bower_components/protobuf/dist/ProtoBuf.js',
  'shared.js'
)
gtfsRealtimeBuilder = dcodeIO.ProtoBuf.loadProtoFile("./gtfs-realtime.proto");
gtfsRealtimeFeedMessage = gtfsRealtimeBuilder.build("transit_realtime.FeedMessage");

onmessage = function(e) {
  // I could make this worker take more responsibility
  // for taking initiative instead (and communicate back and forth
  // about how idle it should be).
  // I could have it post messages that split up the data into batches.
  if(e.data == 'loadVehiclePositions') {
    loadGtfsRealtimeUpdate('VehiclePositions.pb', function(data) {
      postMessage({type: 'loadedVehiclePositions', data: data})
    });
  }
};

var loadGtfsRealtimeUpdate = function(filename, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://www.idupree.com/services/mbta/'+filename);
  xhr.responseType = "arraybuffer";
  xhr.onload = function(e) {
    var decoded = gtfsRealtimeFeedMessage.decode(xhr.response);
    callback(decoded);
  }
  xhr.send(null);
};

