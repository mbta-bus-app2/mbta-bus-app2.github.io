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
    map.setCenter(new google.maps.LatLng(lat, lng));
    map.setZoom(zoom);
  } else {
    locationBeforeGmapsLoads = { lat: lat, lng: lng, zoom: zoom };
  }
}
window.onGmapsLoad = function() {
  var myOptions = {
    zoom: 12,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  map = new google.maps.Map(document.getElementById("map"), myOptions);
  google.maps.event.addListener(map, 'bounds_changed', function() {
    storage('zoom', map.getZoom());
    storage('lat', map.getCenter().lat());
    storage('lng', map.getCenter().lng());
  });
  var l = locationBeforeGmapsLoads;
  if(l) {
    setLocation(l.lat, l.lng, l.zoom);
  }
  // for now, assume stops is already loaded
  onGmapsAndStopsLoad();
}
function onGmapsAndStopsLoad() {
  for (var i = 0; i < stops.length; i++) {
    (function(stop) {
      var pos =  new google.maps.LatLng(stop.lat, stop.lon);
      var marker = new google.maps.Marker({
        position: pos,
        map: map,
        title: stop.title
      });
      google.maps.event.addListener(marker, 'click', function() {
        setCurrentStop(stop);
        loadStop(stop);
        pushState('stops/' + stop.id);
      });
    })(stops[i]);
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

function initialize() {
  setLocationToNonGeolocatedDefault();
  geolocate();

  $('#predictions').find('.close-predictions').click(function() {
    $('#predictions').hide();
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
