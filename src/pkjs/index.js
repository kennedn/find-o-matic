require('./polyfills/strings');
var coords = require('./data/coords');
var globals = require('./modules/globals');
for (var key in globals) {
  window[key] = globals[key];
}
var XHR = require('./modules/xhr');

function radians(d) {return (d * Math.PI) / 180.0;}

function equirectDistance(c1,c2) {
  // Calculate latitude delta
  x = radians(c2.latitude) - radians(c1.latitude);
  // Calculate longitude delta and multiply with an approximate scaler based on the cosine of the median latitude
  y = (radians(c2.longitude) - radians(c1.longitude)) * Math.cos((radians(c2.latitude) + radians(c1.latitude)) * 0.5);
  // earth_radius * sqrt(x^2 + y^2)
  return parseInt(6367449 * Math.sqrt(x*x + y*y));
}

function equirectBearing(c1,c2) {
  y = Math.sin(radians(c2.longitude) - radians(c1.longitude)) * Math.cos(radians(c2.latitude));
  x = Math.cos(radians(c1.latitude)) * Math.sin(radians(c2.latitude)) - 
      Math.sin(radians(c1.latitude)) * Math.cos(radians(c2.latitude)) * Math.cos(radians(c2.longitude) - radians(c1.longitude));
  theta = Math.atan2(y, x);
  return ((theta * 0x8000 / Math.PI) + 0x10000) % 0x10000;
}

// Called when incoming message from the Pebble is received
Pebble.addEventListener("appmessage", function(e) {
  var dict = e.payload;
  debug(3, 'Got message: ' + JSON.stringify(dict));

  switch(dict.TransferType) {
    case TransferType.READY:
      debug(2, "Sending Ready message");
      Pebble.sendAppMessage({"TransferType": TransferType.READY}, messageSuccess, messageFailure);
    break;

    case TransferType.REFRESH:
      debug(2, "Refresh message received");
    break;

    case TransferType.BEARING:
      debug(2, "Bearing message received");
        navigator.geolocation.getCurrentPosition(
          function success(pos) {
              coords.forEach(function(item)  {
                item.distance = (equirectDistance(pos.coords, item.coordinates));
                item.bearing = (equirectBearing(pos.coords, item.coordinates));
              });
              coords.sort(function(a,b) {return (a.distance > b.distance) ? 1 : -1;});
              var closestItem = coords[0];
              debug(2, "Closest Item: \n\t" + coords[0].name);
              Pebble.sendAppMessage({"TransferType": TransferType.BEARING, "Bearing": closestItem.bearing, "Distance": closestItem.distance}, messageSuccess, messageFailure);
          },
          function error(err) {
            debug(2, "geolocation error, (" + err.code + "): " + err.message);
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 0
        });
    break;
  }
});


Pebble.addEventListener('ready', function() {
  console.log("And we're back");
  Pebble.sendAppMessage({"TransferType": TransferType.READY,}, messageSuccess, messageFailure);
  
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
