var globals = require('./globals');
var MathHelper = require('./math_helper');
var XHR = require('./xhr');
var Promise = require('bluebird');
for (var key in globals) {
  window[key] = globals[key];
}

var self = module.exports = {
  coords: [],
  geolocation: {},
  geoWatchID: null,
  timerID: null,
  geoCheckID: null,
  stringInsert: function (template_string, insertion_object) {
    return template_string.replace(/%\w+%/g, function(placeholder) {
      return insertion_object[placeholder] || placeholder;
    });
  },
  queryAPI: function (search_query, geo, maxRetries) {
    return new Promise(function(resolve, reject) {
      // Clear previous Clay state by removing ClayJSON key 
      var claySettings = localStorage.getItem("clay-settings");
      try {
        claySettings = JSON.parse(claySettings);
      } catch(err) {}
      delete claySettings['ClayJSON'];
      localStorage.setItem("clay-settings", JSON.stringify(claySettings));

      XHR.xhrRequest("GET", self.stringInsert(NEARBY_API_TEMPLATE, {"%SEARCH%": search_query, "%LONGITUDE%": geo.deg_longitude, "%LATITUDE%": geo.deg_latitude}),
        {"Accept": "application/json"}, {}, maxRetries).then(function(json) {
        if (!('results' in json) || json.results.length == 0) {
          debug(2, "API results returned empty, aborting update");
          return reject("API found no results\n\nTry searching for something else");
        }
        coords = [];
        for (var i in json.results) {
          var item = json.results[i];
          coords.push({
            "name": item.name,
            "address": item.address,
            "coords": {
              "latitude": MathHelper.degToRadians(item.coordinates.latitude),
              "longitude": MathHelper.degToRadians(item.coordinates.longitude),
            }
          });
        }
        return resolve(coords);
        }, function() {
          debug(2, "Unable to reach nearest places API");
          return reject("Unable to reach nearest places API");
       });
    });
  },
  getPosition: function (options, maxRetries) {
    return new Promise(function(resolve, reject) {
      var _getPosition = function(options, maxRetries) {
        if (typeof(maxRetries) == 'number') {
          maxRetries = [maxRetries, maxRetries];
        }

        var retry = function(err, maxRetries) {
          if (maxRetries[1] > 0) {
            debug(2, "Retrying geolocation request, " + maxRetries[1] + " attempts remaining");
            _getPosition(options, [maxRetries[0], maxRetries[1] - 1]); 
          } else {
            debug(2, "Max retries reached for geolocation");
            reject(err);
          }
        };

        navigator.geolocation.getCurrentPosition(resolve, function(err) {retry(err, maxRetries);}, options);
      };
      _getPosition(options, maxRetries);
    });
  },
  watchPosition: function (options) {
    if (self.geoWatchID !== null) {
      navigator.geolocation.clearWatch(self.geoWatchID);
      self.geoWatchID = null;
    } 
    if (self.timerID !== null) {
      clearInterval(self.timerID);
      self.timerID = null;
    }
    if (self.geoCheckID !== null) {
      clearInterval(self.geoCheckID);
      self.geoCheckID = null;
    }
    // Register handler to recalculate coords on position update
    self.geoWatchID = navigator.geolocation.watchPosition(function(position) {
      self.geoErrorCount = 0;
      self.geolocation = self.parseGeolocation(position);
      self.coords = self.parseGeoItems(self.geolocation, self.coords);
    }, null, GEOLOCATION_OPTIONS);

    // Send bearing message to watch at 3 second intervals
    self.timerID = setInterval(function() {
      self.bearingAppMessage(false);
    }, 1000);

    // WatchPosition does not error on signal loss, so check that geo-coordinates are still obtainable on a 8 second timer
    var geoCheck = function() {
      self.getPosition(GEOLOCATION_OPTIONS, GEOLOCATION_MAXRETRY).then(function() {
        self.geoCheckID = setTimeout(function() {geoCheck();}, 5000);
      }, self.geoError);
    };
    geoCheck();
  },
  parseGeolocation: function (position) {
    geolocation = {};
    geolocation.coords = {
      "latitude": MathHelper.degToRadians(position.coords.latitude),
      "longitude": MathHelper.degToRadians(position.coords.longitude),
      "deg_latitude": position.coords.latitude,
      "deg_longitude": position.coords.longitude
    };
    return geolocation;
  },
  parseGeoItems: function (position, items) {
    items.forEach(function(item)  {
      item.distance = (MathHelper.calculateDistance(position.coords, item.coords));
      item.bearing = (MathHelper.calculateBearing(position.coords, item.coords));
    });
    items.sort(function(a,b) {return (a.distance < b.distance) ? -1 : 1;});
    return items;
  },
  geoError: function (err) {
    if (self.geoWatchID !== null) {
      navigator.geolocation.clearWatch(self.geoWatchID);
      self.geoWatchID = null;
    } 
    if (self.timerID !== null) {
      clearInterval(self.timerID);
      self.timerID = null;
    }
    if (self.geoCheckID !== null) {
      clearInterval(self.geoCheckID);
      self.geoCheckID = null;
    }
    debug(2, (err) ? err.message : "Geo Error");
    appMessage({"TransferType": TransferType.ERROR, "String": "Geolocation error, check phone settings"}); 
  },
  apiError: function (err) {
    debug(2, err);
    appMessage({"TransferType": TransferType.ERROR, "String": err}); 
  },
  bearingAppMessage: function (init) {
    var coord = self.coords[0];
    if (init) {debug(2, "Closest Place: \n\t" + coord.name + "\n\t" + coord.address);}
    appMessage({
      "TransferType": TransferType.BEARING, 
      "Bearing": coord.bearing, 
      "Distance": coord.distance,
      "String": coord.name,
      "Init": (init) ? 1 : 0  // JS bools are weird
    });
  },
  init: function (search_query) { 
    return new Promise(function(resolve, reject) {
      search_query = search_query || localStorage.getItem("search_query");
      if(!search_query) {
        appMessage({"TransferType": TransferType.NO_CLAY});
        return;
      }
      self.getPosition(GEOLOCATION_OPTIONS, GEOLOCATION_MAXRETRY).then(function(position) {
        self.geolocation = self.parseGeolocation(position);
        // Retrieve nearby places with query and geolocation
        self.queryAPI(search_query, self.geolocation.coords, XHR_MAXRETRY).then(function(items) {
          // parse raw JSON to extract fields in required format
          self.coords = self.parseGeoItems(self.geolocation, items);
          self.bearingAppMessage(true);
          self.watchPosition();
          resolve(self.coords);
        }, self.apiError);
      }, self.geoError);
    });
  },
  refresh: function () {  // Refresh results from API
    self.queryAPI(localStorage.getItem("search_query"), self.geolocation.coords, XHR_MAXRETRY).then(function(items) {
      // parse raw JSON to extract fields in required format
      self.coords = self.parseGeoItems(self.geolocation, items);
      // Send initial bearing message to watch
      appMessage({"TransferType": TransferType.REFRESH});
      self.bearingAppMessage(true);
    }, self.apiError);
  },
};
