require('./polyfills/strings');
var globals = require('./modules/globals');
var Promise = require('bluebird');
for (var key in globals) {
  window[key] = globals[key];
}
var XHR = require('./modules/xhr');

var geolocation = {};
var coords = [];

var geolocation_options =   {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
};


function radians(d) {return (d * Math.PI) / 180.0;}

// Calculate distance between two geo locations using equirect approximation
function calculateDistance(c1,c2) {
  // Calculate latitude delta
  var x = radians(c2.latitude) - radians(c1.latitude);
  // Calculate longitude delta and multiply with an approximate scaler based on the cosine of the median latitude
  var y = (radians(c2.longitude) - radians(c1.longitude)) * Math.cos((radians(c2.latitude) + radians(c1.latitude)) * 0.5);
  // earth_radius * sqrt(x^2 + y^2)
  return parseInt(6367449 * Math.sqrt(x*x + y*y));
}

function calculateBearing(c1,c2) {
  var y = Math.sin(radians(c2.longitude) - radians(c1.longitude)) * Math.cos(radians(c2.latitude));
  var x = Math.cos(radians(c1.latitude)) * Math.sin(radians(c2.latitude)) - 
      Math.sin(radians(c1.latitude)) * Math.cos(radians(c2.latitude)) * Math.cos(radians(c2.longitude) - radians(c1.longitude));
  var theta = Math.atan2(y, x);  // Calculate bearing in radians
  return ((theta * 0x8000 / Math.PI) + 0x10000) % 0x10000; // Translate radians to Pebble linear scale
}

function stringInsert(template_string, insertion_object) {
  return template_string.replace(/%\w+%/g, function(placeholder) {
    return insertion_object[placeholder] || placeholder;
  });
}

function queryAPI(search_query, geo) {
    return new Promise(function(resolve, reject) {
      XHR.xhrRequest("GET", stringInsert(NEARBY_API_TEMPLATE, {"%SEARCH%": search_query, "%LONGITUDE%": geo.longitude, "%LATITUDE%": geo.latitude}),
                      {"Accept": "application/json"}, {}, 3).then(function(json) {
          if (!('results' in json) || json.results.length == 0) {
            debug(2, "API results returned empty, aborting update");
            return;
          }
          coords = [];
          for (var i in json.results) {
            var item = json.results[i];
            coords.push({
              "name": item.name,
              "address": item.address,
              "coords": item.coordinates
            });
          }
          return resolve(coords);
        }, function() {
            debug(2, "Error retrieving nearby places");
            return reject();
        });
    });
}

function getPosition(options) {
  return new Promise(function(resolve, reject) {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function parseGeoItems(position, items) {
  geolocation = position;
  items.forEach(function(item)  {
    item.distance = (calculateDistance(geolocation.coords, item.coords));
    item.bearing = (calculateBearing(geolocation.coords, item.coords));
  });
  items.sort(function(a,b) {return (a.distance < b.distance) ? -1 : 1;});
  debug(2, "Closest Place: \n\t" + coords[0].name + "\n\t" + coords[0].address);
  return items;
}

function geoError(err) {
    debug(2, JSON.stringify(err));
}


// Called when incoming message from the Pebble is received
Pebble.addEventListener("appmessage", function(e) {
  var dict = e.payload;
  debug(3, 'Got message: ' + JSON.stringify(dict));

  switch(dict.TransferType) {
    case TransferType.READY:
      debug(2, "Sending Ready message");
      if (coords.length == 0 || Object.keys(geolocation).length === 0) {return;}
      Pebble.sendAppMessage({"TransferType": TransferType.READY}, messageSuccess, messageFailure);
    break;

    case TransferType.REFRESH:
      debug(2, "Refresh message received");
      if (COORDINATE_SPOOFING) {
        geolocation = {};
        geolocation.coords = DEBUG_COORDINATES[Math.floor(Math.random() * DEBUG_COORDINATES.length)];
        debug(2, JSON.stringify(geolocation));
        coords = parseGeoItems(geolocation, coords);
        Pebble.sendAppMessage({
          "TransferType": TransferType.BEARING, 
          "Bearing": coords[0].bearing, 
          "Distance": coords[0].distance,
          "LocationString": coords[0].name}, messageSuccess, messageFailure);
      }
    break;

    case TransferType.BEARING:
      coords = parseGeoItems(geolocation, coords);
      Pebble.sendAppMessage({
        "TransferType": TransferType.BEARING, 
        "Bearing": coords[0].bearing, 
        "Distance": coords[0].distance,
        "LocationString": coords[0].name}, messageSuccess, messageFailure);
      debug(2, "Bearing message received");
    break;
  }
});


Pebble.addEventListener('ready', function() {
  console.log("And we're back");
  // Get Position manually once
  getPosition(geolocation_options).then(function(position) {
    geolocation = position;
    debug(2, JSON.stringify(position));
    // Retrieve nearby places with query and geolocation
    queryAPI("Pubs", position.coords).then(function(items) {
      // Format output of call
      coords = parseGeoItems(position, items);
      // Register handler to recalculate and broadcast to pebble on device position change
      if (!COORDINATE_SPOOFING) {
        navigator.geolocation.watchPosition(function(position) {
          geolocation = position;
          coords = parseGeoItems(geolocation, coords);
        }, geoError, geolocation_options);
      }
      // Now ready to receive requests from pebble
      Pebble.sendAppMessage({"TransferType": TransferType.READY,}, messageSuccess, messageFailure);
    }, null);
  }, geoError);
});


// Pebble.addEventListener('showConfiguration', function(e) {
//   TRANSFER_LOCK = true;
//   var message = localStorage.getItem('clay-param-message');
//   var action = localStorage.getItem('clay-param-action');
//   ClayHelper.openURL(clay, message, action);
// });


// Pebble.addEventListener('webviewclosed', function(e) {
//   localStorage.removeItem('clay-param-message');
//   localStorage.removeItem('clay-param-action');
//   TRANSFER_LOCK = false;
//   if (e && !e.response) {
//     return;
//   }
//   // Get the keys and values from each config item
//   var response = JSON.parse(LZString.decompressFromEncodedURIComponent(e.response));
//   // var clayJSON = JSON.parse(dict[messageKeys.ClayJSON]);
//   var tiles = response.payload;

//   switch(response.action) {
//     case "AddTile":
//       var message = ClayHelper.addTile(tiles);
//       ClayHelper.openURL(clay, message, ClayAction.TILE_ADD);
//       break;
//     case "RemoveTile":
//       ClayHelper.removeTile(tiles, response.param);
//       ClayHelper.openURL(clay, "Tile removed", ClayAction.TILE_REMOVE);
//       break;
//     case "AddIcon":
//       image.load(response.param.url, response.param.label, function(img){
//         debug(2, "IMG message: " + img.message);
//         ClayHelper.openURL(clay, img.message, (img.status == 200) ? ClayAction.ICON_ADD : ClayAction.ICON_REMOVE);
//       });
//       break;
//     case "RemoveIcon":
//       icon.remove(response.param, function(){
//         ClayHelper.openURL(clay, "Icon removed", ClayAction.ICON_REMOVE);
//       });
//       break;
//     case "Submit":
//       ClayHelper.clayToTiles(tiles, function() {
//         ClayHelper.openURL(clay, "Failed to parse JSON", ClayAction.JSON_SUBMIT);
//       });
//       break;
//   }
// });
