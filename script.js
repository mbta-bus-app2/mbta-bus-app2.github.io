"use strict";


// https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API

var storage = function(key, value) {
  if (_.isUndefined(value)) {
    try {
      return JSON.parse(window.localStorage.getItem(key));
    } catch (e) {
      return void(0);
    }
  } else {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
};

var setCurrentStop = function(stop) {
  if (window.currentStop !== stop) {
    $('#predictions .last-update').hide();
  }
  window.currentStop = stop;
  window.currentStop.lastUpdate = 0;
};

var pushState = function(state) {
  if (window.history.pushState) {
    window.history.pushState(state, 'MBTA Bus App', '#' + state);
  }
};

// epochTime is in milliseconds
var formatPredictionRow = function(prediction) {
  var $li = $('<li class="prediction-item">');
  var $route = $('<span class="label label-primary pull-left route">');
  $route.text(prediction.route);
  var $dir = $('<span class="label label-info pull-left direction">');
  $dir.text(prediction.direction);
  var $time = $('<span class="badge pull-right time">');
  $time.data('occurs', prediction.unixTimeOfArrival);
  $time.text(displayUnixTimeOfArrival(prediction.unixTimeOfArrival));
  $li.append('&nbsp;', $route, $dir, $time);
  return $li;
};

var parsePredictions = function(xhrResult) {
  var ret = [];
  $(xhrResult).find('predictions').each(function() {
    var route = $(this).attr('routeTitle');
    $(this).find('direction').each(function() {
      var direction = $(this).attr('title');
      $(this).find('prediction').each(function() {
        ret.push({
          route: route,
          direction: direction,
          unixTimeOfArrival: Math.round($(this).attr('epochTime') / 1000),
          affectedByLayover: $(this).attr('affectedByLayover')
        });
      });
    });
  });
  return _.sortBy(ret, function(p) {
    return parseFloat(p.unixTimeOfArrival);
  });
};

var closeMenus = function() {
  $('#menu-nav').find('li').removeClass('active');
  $('.menu').hide();
};

var setupFavorites = function() {
  var $list = $('#favorites-list');
  var favorites = storage('favorites');
  $list.empty();
  _.each(favorites, function(stopId) {
    var stop = _.findWhere(stops, {id: stopId});
    $list.append(
      $('<li/>', {
        }).append(
        $('<a/>', {
//        "class": "list-group-item",
          "href": "#stops/"+stopId,
          "data-id": stop.id,
          "data-lat": stop.lat,
          "data-lon": stop.lon,
          "data-title": stop.title,
          text: stopNickname(stop)
          })));
  });
};

var toggleFavorite = function(stop) {
  $('.favorite').blur();
  var favorites = storage('favorites') || [];
  var index = favorites.indexOf(stop.id);
  if (index !== -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(stop.id);
  }
  storage('favorites', favorites);
  checkFavorite(stop);
  setupFavorites();
};

var checkFavorite = function(stop) {
  var favorites = storage('favorites') || [];
  if (favorites.indexOf(stop.id) !== -1) {
    $('.favorite').find('span')
      .removeClass('glyphicon-star-empty')
      .addClass('glyphicon-star')
      .css({color: '#d90'});
  } else {
    $('.favorite').find('span')
      .addClass('glyphicon-star-empty')
      .removeClass('glyphicon-star')
      .css({color: '#000'});
  }
};

var openStop = function(stop, xhrResult) {
  var $box = $('#predictions');
  var $head = $box.find('.panel-heading');
  var predictions = parsePredictions(xhrResult);
  var p;
  checkFavorite(stop);
  $head.find('.title').html(stop.title);
  $box.find('.list-group').html('');
  for (var i = 0; i < predictions.length; i++) {
    $box.find('.list-group').append(formatPredictionRow(predictions[i]));
  }
  currentStop.lastUpdate = Date.now();
  $box.show();
};

var loadStop = function(stop) {
  $('#predictions').find('.loading').css({ display: 'block' });
  $('#predictions').find('.refresh').hide();
  $.ajax({
    type: 'GET',
    url: 'http://webservices.nextbus.com/service/publicXMLFeed' +
      '?command=predictions&a=mbta&stopId=' + stop.id,
    dataType: 'xml',
    success: function(data) {
      $('#predictions').find('.loading').css({ display: 'none' });
      $('#predictions').find('.refresh').show();
      $('#predictions .last-update').hide();
      openStop(stop, data);
    },
    error: function() {
      $('#predictions').find('.loading').css({ display: 'none' });
      $('#predictions').find('.refresh').show();
      console.log('An Error occurred');
    }
  });
};

var autoReload = function() {
  if (currentStop) {
    loadStop(currentStop);
  }
  setTimeout(autoReload, 60 * 1000);
};

var currentStop;
var initialLocation;
var boston = { lat: 42.38, lng: -71.1, zoom: 12 };
var downtownBoston = { lat: 42.36, lng: -71.06 };
var browserSupportFlag;
var map;
var locationBeforeGmapsLoads;
function setLocation(lat, lng, zoom) {
  if(map) {
    map.setView([lat, lng], zoom);
  } else {
    locationBeforeGmapsLoads = { lat: lat, lng: lng, zoom: zoom };
  }
}
window.onGmapsLoad = function() {
  var mapboxToken = 'pk.eyJ1IjoiaWR1cHJlZSIsImEiOiJjaWc0YWptZ3gyajM1dTZtNGE3bTQ5eXpsIn0.3Qg8rPAocJzPYt5xKzABDg';
  var mapboxTiles = L.tileLayer(
    //'https://api.mapbox.com/v4/mapbox.streets/{z}/{x}/{y}.png?access_token={accessToken}', {
    //'https://api.mapbox.com/v4/mapbox.emerald/{z}/{x}/{y}.png?access_token={accessToken}', {
    'https://api.mapbox.com/v4/mapbox.run-bike-hike/{z}/{x}/{y}.png?access_token={accessToken}', {
    //'https://api.mapbox.com/v4/mapbox.streets-satellite/{z}/{x}/{y}.png?access_token={accessToken}', {
      attribution: '<a href="https://www.mapbox.com/about/maps/" target="_blank">Terms &amp; Feedback</a>',
      maxZoom: 18,
      accessToken: mapboxToken
    });

  var l = locationBeforeGmapsLoads;
  var center = (l ? [l.lat, l.lng] : [boston.lat, boston.lng]);
  var zoom = (l ? l.zoom : boston.zoom);
  map = L.map('map', {
    center: center,
    zoom: zoom,
    layers: mapboxTiles,
    // Perhaps max speed should depend on window/screen width so that
    // you can have at most a screen worth of inertia?
    // Max displacement from inertia is theoretically
    //     (1/2) * (inertiaMaxSpeed / inertiaDeceleration) * inertiaMaxSpeed
    // and I think max displacement should be at most
    // min(screen width, screen height) because it's too easy to hit the
    // maximum inertia in Leaflet (I wonder if there's a way to configure
    // that).
    // Time taken by inertia animation is at most
    //     (inertiaMaxSpeed / inertiaDeceleration)
    // and less if inertia doesn't start out going at max speed.
    inertiaMaxSpeed: 1000, // pixels/second
    inertiaDeceleration: 2000, // pixels/second/second
    // In the current leaflet beta:
    // - with canvas, zooming doesn't look as good
    // - in chrome, svg is super fast and awesome, and canvas is decently fast
    // - in firefox, svg is horribly slow and canvas is rather slow
    // - haven't tested in IE yet
    // Leaflet defaults to SVG.
    // This setting, if 'true', overrides that to default to canvas.
    // This is my current heuristic:
    preferCanvas: L.Browser.gecko
    });
  function onMapClick(e) {
    nearestStopsTo(e.latlng, 10000, stopsQuadtree, function(stop, distance) {
      setCurrentStop(stop);
      loadStop(stop);
      pushState('stops/' + stop.id);

      return false; //break
    });
  }
  map.on('click', onMapClick);
  map.on('move', function(e) {
    storage('zoom', map.getZoom());
    storage('lat', map.getCenter().lat);
    storage('lng', map.getCenter().lng);
  });
  // for now, assume stops is already loaded
  onGmapsAndStopsLoad();
}
function onGmapsAndStopsLoad() {
  for (var i = 0; i < stops.length; i++) {
    var stop = stops[i];
    L.circle([stop.lat, stop.lon], 10, {
      //stroke: false,
      //weight: 3,
      weight: 2,
      //color: '#f70',
      //fillColor: '#333',
      fillColor: '#423',
      color: '#768',
      // I want to tune this by zoom
      fillOpacity: 0.5,
      clickable: false
    }).addTo(map);
  }
}

function setLocationToNonGeolocatedDefault() {
  if (storage('zoom') && storage('lat') && storage('lng')) {
    setLocation(storage('lat'), storage('lng'), storage('zoom'));
  } else {
    setLocation(boston.lat, boston.lng, boston.zoom);
  }
}

var geolocate = function(callback) {
  // Try W3C Geolocation (Preferred)
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      setLocation(position.coords.latitude, position.coords.longitude, 17);
      if (_.isFunction(callback)) {
        callback(true);
      }
    }, function() {
      if (_.isFunction(callback)) {
        callback(false);
      }
    }, {
      timeout: 7000
    });
  }
};

// locations are "lng, lat" in the quadtree, to make "x, y" make more sense
var stopsQuadtree = QuadTree(-180, -90, 360, 180);
function onStopsLoad() {
  for (var i = 0; i < stops.length; i++) {
    var stop = stops[i];
    // Everything else calls it lng not lon. TODO possibly
    // call it lng in stops.js as well:
    stop.lng = stop.lon;
    stopsQuadtree.put({x: +stop.lon, y: +stop.lat, w: 0, h: 0, id: stop.id, stop: stop});
  }
}
// currently it is synchronously loaded, so:
onStopsLoad();

function close_predictions() {
  $('#predictions').hide();
  currentStop = null;
  pushState('map');
}

function initialize() {
  setLocationToNonGeolocatedDefault();
  geolocate();

  $('#predictions').find('.panel-heading').click(function(e) {
    e.stopPropagation();
    e.preventDefault();
  });
  $('#predictions').click(function(e) {
    e.stopPropagation();
    e.preventDefault();
    close_predictions();
  });

  $('#predictions').find('.close-predictions').click(function() {
    close_predictions();
  });

  $('.menu').find('.close-menu').click(function() {
    closeMenus();
    if ($('#predictions').is(':visible')) {
      pushState('stops/' + currentStop.id);
    } else {
      pushState('map');
    }
  });

  $('#predictions').find('.refresh').click(function() {
    if (currentStop) {
      loadStop(currentStop);
    }
  });

  $('#predictions').find('.favorite').click(function() {
    if (currentStop) {
      toggleFavorite(currentStop);
    }
  });

  $('#menu-nav').find('a.geolocate').click(function(){
    geolocate();
    $('#predictions').hide();
    closeMenus();
    pushState('map');
  });

  $('#menu-nav').find('a.favorites').click(function() {
    setupFavorites();
    closeMenus();
    $('#menu-nav li.favorites').addClass('active');
    $('.menu.favorites').show();
    $('.menu.favorites button.close-menu').focus();
    pushState('favorites');
  });

  $('#menu-nav').find('a.search').click(function() {
    closeMenus();
    $('#menu-nav li.search').addClass('active');
    $('.menu.search').show();
    pushState('search');
  });

  $('#menu-nav').find('a.settings').click(function() {
    closeMenus();
    $('#menu-nav li.settings').addClass('active');
    $('.menu.settings').show();
    pushState('settings');
  });

  $('.menu.settings').find('.clear-data').click(function() {
    if (confirm('Are you sure?  This will remove your favorites.')) {
      window.localStorage.clear();
      setupFavorites();
      checkFavorite(currentStop);
      alert('Favorites and most recent location have been cleared from this device');
    }
  });

  $('#favorites-list').on('click', 'a', function() {
    var stop = $(this).data();
    setLocation(stop.lat, stop.lon, 17);
    setCurrentStop(stop);
    loadStop(stop);
    closeMenus();
  });

  window.onpopstate = function(event) {
    var m;
    if (event.state === 'favorites') {
      setupFavorites();
      closeMenus();
      $('#menu-nav li.favorites').addClass('active');
      $('.menu.favorites').show();
    } else if (event.state === 'search') {
      closeMenus();
      $('#menu-nav li.search').addClass('active');
      $('.menu.search').show();
    } else if (event.state === 'settings') {
      closeMenus();
      $('#menu-nav li.settings').addClass('active');
      $('.menu.settings').show();
    } else if (m = /^stops\/(\d+)$/.exec(event.state)) {
      var stop = _.findWhere(stops, {id: m[1]});
      setLocation(stop.lat, stop.lon, 17);
      setCurrentStop(stop);
      loadStop(stop);
      closeMenus();
    } else {
      closeMenus();
      $('#predictions').hide();
    }
  };

  autoReload();
}

$(initialize);

var countDownTimer;
var countDown = function() {
  $('.time').each(function() {
    var time = $(this).data('occurs');
    $(this).text(displayUnixTimeOfArrival(time));
  });
  if (currentStop && currentStop.lastUpdate) {
    var seconds = Math.round((Date.now() - currentStop.lastUpdate) / 1000);
    if (seconds > 0) {
      $('.last-update-time').text(displayTime(seconds) + ' ago');
      $('.last-update').show();
    }
  }
  countDownTimer = setTimeout(countDown, 1000);
};
countDown();


var loadedGtfsRealtimeProto = $.Deferred();
var loadedStops = $.Deferred().done();
var loadedLeaflet = $.Deferred();//.done();
var loadedProtobuf = $.Deferred();//.done();


var workerForLoadingUpdates = new Worker("worker.js");
var vehiclePositionsCallbacks = [];
workerForLoadingUpdates.onmessage = function(e) {
  if(e.data.type == 'loadedVehiclePositions') {
    var cbs = vehiclePositionsCallbacks;
    vehiclePositionsCallbacks = [];
    cbs.forEach(function(cb) {
      cb(e.data.data);
    });
  }
};
var loadGtfsRealtimeUpdate = function(filename) {
  var deferred = $.Deferred();
  vehiclePositionsCallbacks.push(function(data) {
    deferred.resolve(data);
  });
  workerForLoadingUpdates.postMessage('loadVehiclePositions');
  return deferred.promise();
}

var protobufUpdateTimeout = null;
var vehiclesLayerGroups = null;
var nextPositions = function() {
  loadGtfsRealtimeUpdate('VehiclePositions.pb').done(function(positions) {
    if(vehiclesLayerGroups != null) {
      map.removeLayer(vehiclesLayerGroups);
    }
    vehiclesLayerGroups = L.layerGroup().addTo(map);
    _.each(positions.entity, function(entity) {
      var vehicle = entity.vehicle;
      var position = vehicle.position;
      var lat = position.latitude;
      var lng = position.longitude;
      var latlng = L.latLng(lat, lng);
      // bearing is in degrees clockwise from North
      var bearing = position.bearing;
      if(bearing == null) {
        bearing = 0; //for now
      }
      var back = bearing + 180;
      var back1 = back + 15;
      var back2 = back - 15;
      var trip = vehicle.trip;
      if(trip) {
        var route_id = trip.route_id;
      }
      if(route_id == null) {
        route_id = '';
      }
      //var color = '#000';
      //var fillColor;
      var style = {
          weight: 3,
          //color: '#f27',
          color: '#000',
          fillOpacity: 0.9,
          clickable: false
      };
      // len in meters. Lol, I expanded everything so you can see it.
      // Approximate relative sizes see http://www.transithistory.org/roster/
      // scale() is a hack which I should probably do based on zoom instead?
      // maybe?
      var len = 60;
      var distanceFromDowntown = latlng.distanceTo(downtownBoston);
      function scale(minDist, maxDist, amount) {
        var range = maxDist - minDist;
        var extra = Math.min(range, Math.max(0, distanceFromDowntown - minDist)) / range;
        return amount * extra;
      }
      // TODO find out if the MBTA has official sRGB colors for its colored routes
      if(route_id.startsWith("CR-")) {
         style.weight = 1.5;
         style.fillColor = '#e4c';
         len = 250 + scale(10000, 30000, 2000);
      } else if(route_id.startsWith("Green")) {
         style.weight = 1;
         style.fillColor = '#7f7';
         // TODO: can we find out how many cars each
         // GL train has, and show each of them
         // or probably actually more clearly,
         // a longer train if more cars?  EVEN BETTER:
         // can we tell which cars are Type 7 vs Type 8
         // for preemptive accessibility alignment?
         len = 120 + scale(9000, 11000, 300);
      } else if(route_id.startsWith("Red")) {
         style.weight = 1;
         style.fillColor = '#f22';
         //lol the length is right but too wide: len = 6*100;
         len = 200 + scale(8000, 10000, 150);
      } else if(route_id.startsWith("Orange")) {
         style.weight = 1;
         style.fillColor = '#f70';
         len = 200;
         if(lat > downtownBoston.lat) {
           len += scale(2000, 3000, 150);
         }
      } else if(route_id.startsWith("Blue")) {
         style.weight = 1;
         style.fillColor = '#33f';
         len = 165 + scale(2000, 3000, 80);
      }
      vehiclesLayerGroups.addLayer(L.polygon([
        offsetLatLngBy(latlng, back1, len),
        latlng,
        offsetLatLngBy(latlng, back2, len)
        ], style));
        //.addTo(map);
    });

    var now = Date.now();
    lastProtobufUpdate = now;
    // Keep on updating for a few minutes after the window is hidden,
    // because the user is likely to come back to it and it
    // doesn't cost drastically more than using the app in the
    // first place.
    //
    // The multiple idle-checking methods are there because we
    // really don't want to waste mobile users' data plans, and we
    // only somewhat mind making multi-windowed desktop users have
    // their thing get out of date?? I could detect whether it's a
    // large screen but they can use mobile tethering too; mobile
    // data can be faster than landline; I could detect whether the
    // user's current IP address is a mobile one. Lol.  I could also
    // have a setting, if the user feels reliable about choosing the
    // right setting.
    var minute = 60000;
    var estimatedInactivityTime = Math.max(
      ((lastVisible == null) ? (0) : (now - lastVisible)),
      ((lastFocused == null) ? (0) : (now - lastFocused - 5*minute)),
      (now - lastUserActivity - 5*minute));
    if(estimatedInactivityTime < 1.5*minute) {
      protobufUpdateTimeout = setTimeout(nextPositions, 0.25*minute);
    } else if(estimatedInactivityTime < 3*minute) {
      protobufUpdateTimeout = setTimeout(nextPositions, 0.40*minute);
    } else if(estimatedInactivityTime < 6*minute) {
      protobufUpdateTimeout = setTimeout(nextPositions, 0.75*minute);
    } else if(estimatedInactivityTime < 12*minute) {
      protobufUpdateTimeout = setTimeout(nextPositions, 2*minute);
    } else if(estimatedInactivityTime < 24*minute) {
      protobufUpdateTimeout = setTimeout(nextPositions, 4*minute);
    } else {
      protobufUpdateTimeout = null;
    }
  });
};

var lastUserActivity = Date.now();
function userActivity() {
  lastUserActivity = Date.now();
}
// Not 'resize' or 'contextmenu' events because that
// might be annoying for development and doesn't matter much.
//
// Should I consider removing mousemove, or removing it
// if it's happened recently, to save CPU?
//
// I include redundant things like click and mousedown and touchstart
// because different input methods can trigger different combinations
// of events, and because it doesn't hurt.
$(document).on('click mousemove keydown mousedown touchstart mouseenter scroll wheel dblclick paste dragstart', userActivity);

function awakeFromSlumber() {
  userActivity();
  if(lastProtobufUpdate + 15000 < Date.now()) {
    clearTimeout(protobufUpdateTimeout);
    nextPositions();
  }
}

var lastProtobufUpdate = null;
var lastVisible = null;
$(document).on('visibilitychange', function() {
  console.log('visibilitychange', Date.now(), document.hidden);
  if(document.hidden) {
    lastVisible = Date.now();
    //for testing: $(document.body).css('transform', 'rotate(60deg)');
  } else {
    lastVisible = null;
    awakeFromSlumber();
  }
});
var lastFocused = null;
$(window).on('blur', function() {
  console.log('window blur', Date.now());
  lastFocused = Date.now();
});
$(window).on('focus', function() {
  console.log('window focus', Date.now());
  lastFocused = null;
  awakeFromSlumber();
});

// at the moment, just once, repeating will be later
loadedGtfsRealtimeProto.done(function() {
  nextPositions();
});

// hmm, I could request the file text in parallel with protobuf really
loadedProtobuf.done(function() {
  dcodeIO.ProtoBuf.loadProtoFile("./gtfs-realtime.proto",
    function(err, loaded) {
      gtfsRealtimeBuilder = loaded;
      gtfsRealtimeFeedMessage = gtfsRealtimeBuilder.build("transit_realtime.FeedMessage");
      loadedGtfsRealtimeProto.resolve();
    });
});

