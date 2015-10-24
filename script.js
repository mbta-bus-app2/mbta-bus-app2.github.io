
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

// epochTime is in milliseconds
var formatPredictionRow = function(prediction) {
  var $li = $('<li class="list-group-item">');
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
    nearestStopsTo(e.latlng, 10000, function(stop, distance) {
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
      weight: 3,
      color: '#f70',
      fillOpacity: 0.7
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
function nearestStopsTo(latlng, maxDistanceToLook, callback) {
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

function initialize() {
  setLocationToNonGeolocatedDefault();
  geolocate();

  $('#predictions').find('.close-predictions').click(function() {
    $('#predictions').hide();
    currentStop = null;
    pushState('map');
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
