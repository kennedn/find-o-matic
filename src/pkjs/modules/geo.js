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
  watchID: null,
  stringInsert: function (template_string, insertion_object) {
    return template_string.replace(/%\w+%/g, function(placeholder) {
      return insertion_object[placeholder] || placeholder;
    });
  },
  queryAPI: function (search_query, geo) {
    return new Promise(function(resolve, reject) {
      debug(2, localStorage.getItem("search_query"));
      debug(2, search_query);
      XHR.xhrRequest("GET", self.stringInsert(NEARBY_API_TEMPLATE, {"%SEARCH%": search_query, "%LONGITUDE%": geo.deg_longitude, "%LATITUDE%": geo.deg_latitude}),
        {"Accept": "application/json"}, {}, 3).then(function(json) {
        if (!('results' in json) || json.results.length == 0) {
          debug(2, "API results returned empty, aborting update");
          return reject();
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
          debug(2, "Error retrieving nearby places");
          return reject();
       });
    });
  },
  getPosition: function (options) {
    return new Promise(function(resolve, reject) {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  },
  watchPosition: function (options) {
    if (self.watchID !== null) {
      navigator.geolocation.clearWatch(self.watchID);
      self.watchID = null;
    } 
    // Register handler to recalculate and broadcast to pebble on device position change
    self.watchID = navigator.geolocation.watchPosition(function(position) {
      self.geolocation = self.parseGeolocation(position);
      self.coords = self.parseGeoItems(self.geolocation, self.coords);
      self.bearingAppMessage(self.coords[0]);
    }, self.geoError, GEOLOCATION_OPTIONS);
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
    debug(2, "Closest Place: \n\t" + items[0].name + "\n\t" + items[0].address);
    return items;
  },
  geoError: function (err) {
    debug(2, "Geo Error: " + JSON.stringify(err));
  },
  apiError: function (err) {
    debug(2, "API Error: " + JSON.stringify(err));
  },
  bearingAppMessage: function (coord) {
    Pebble.sendAppMessage({
      "TransferType": TransferType.BEARING, 
      "Bearing": coord.bearing, 
      "Distance": coord.distance,
      "LocationString": coord.name},
    messageSuccess, messageFailure);
  },
  noClayAppMessage: function (message) {
    Pebble.sendAppMessage({"TransferType": TransferType.NO_CLAY}, messageSuccess, messageFailure);
  },
  refreshAppMessage: function () {
    Pebble.sendAppMessage({"TransferType": TransferType.REFRESH}, messageSuccess, messageFailure);
  },
  init: function () {  // Init geolocation, api response and watchPosition callback, send init bearing to watch
    if(localStorage.getItem("search_query") === null) {
      self.noClayAppMessage();
      return;
    }
    Pebble.sendAppMessage({"TransferType": TransferType.READY,}, messageSuccess, messageFailure);
    self.getPosition(GEOLOCATION_OPTIONS).then(function(position) {
      self.geolocation = self.parseGeolocation(position);
      // Retrieve nearby places with query and geolocation
      self.queryAPI(localStorage.getItem("search_query"), self.geolocation.coords).then(function(items) {
        // parse raw JSON to extract fields in required format
        self.coords = self.parseGeoItems(self.geolocation, items);

        self.watchPosition();

        // Send initial bearing message to watch
        self.bearingAppMessage(self.coords[0]);
      }, self.apiError);
    }, self.geoError);
  },
  findItems: function (search_query) {  
    return new Promise(function(resolve, reject) {
      self.getPosition(GEOLOCATION_OPTIONS).then(function(position) {
        self.geolocation = self.parseGeolocation(position);
        // Retrieve nearby places with query and geolocation
        self.queryAPI(search_query, self.geolocation.coords).then(function(items) {
          // parse raw JSON to extract fields in required format
          self.coords = self.parseGeoItems(self.geolocation, items);
          resolve(self.coords);
        }, reject);
      }, reject);
    });
  },
  refresh: function () {  // Refresh results from API
    self.queryAPI(localStorage.getItem("search_query"), self.geolocation.coords).then(function(items) {
      // parse raw JSON to extract fields in required format
      self.coords = self.parseGeoItems(self.geolocation, items);
      // Send initial bearing message to watch
      self.refreshAppMessage();
      self.bearingAppMessage(self.coords[0]);
    }, self.apiError);
  },

};
