require('./polyfills/strings');
var globals = require('./modules/globals');
for (var key in globals) {
  window[key] = globals[key];
}
var Geo = require('./modules/geo');
var LZString = require ('./vendor/LZString');

var Clay = require('pebble-clay');
var customClay = require('./data/clay_function');
var clayConfig = require('./data/clay_config');
var clay = new Clay(clayConfig, customClay, {autoHandleEvents: false});


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
      Geo.refresh();
    break;
  }
});


Pebble.addEventListener('ready', function() {
  // Set default search query if in debug
  // localStorage.setItem("search_query", "Pubs");
  console.log("And we're back");
  Pebble.sendAppMessage({"TransferType": TransferType.READY,}, messageSuccess, messageFailure);
  Geo.init();
});


Pebble.addEventListener('showConfiguration', function(e) {
  var claySettings = localStorage.getItem("clay-settings");
  try {
    claySettings = JSON.parse(claySettings);
  } catch(e) {}

  if(Geo.coords.length > 0 && claySettings) {
    claySettings['ClayJSON'] = JSON.stringify(Geo.coords[0]);
    localStorage.setItem("clay-settings", JSON.stringify(claySettings));
  }
    
  Pebble.openURL(clay.generateUrl());
});


Pebble.addEventListener('webviewclosed', function(e) {
  if (e && !e.response) {
    return;
  }
  // Get the keys and values from each config item
  var response = JSON.parse(LZString.decompressFromEncodedURIComponent(e.response));
  

  switch(response.action) {
    case "Search":
      Geo.findItems(response.payload).then(function(items) {
        var claySettings = {};
        claySettings['SearchInput'] = response.payload;
        claySettings['ClayJSON'] = JSON.stringify(items[0]);
        localStorage.setItem('clay-settings', JSON.stringify(claySettings));
        localStorage.setItem('search_query', response.payload);
        Geo.watchPosition();
        Geo.bearingAppMessage(items[0]);
      }, function(err) {
        debug(2, "findItems error");
      });
      break;
  }
});
