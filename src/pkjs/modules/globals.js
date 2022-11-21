var self = module.exports = {
  DEBUG: 0,
  GEOLOCATION_OPTIONS: {
    "enableHighAccuracy": true, "timeout": 5000, "maximumAge": 0
  },
  NEARBY_API_TEMPLATE: "https://duckduckgo.com/local.js?q=%SEARCH%&tg=maps_places&latitude=%LATITUDE%&longitude=%LONGITUDE%&location_type=obfuscated",
  debug: function(level, msg) {
    if (level <= self.DEBUG) {
      console.log(msg);
    }
  },
  messageSuccess: function() {
    self.debug(3, "Message send succeeded.");  
  },
  messageFailure: function() {
    self.debug(3,"Message send failed.");
  },

  TransferType: {
    "BEARING": 0,
    "ERROR": 1,
    "ACK": 2,
    "READY": 3,
    "NO_CLAY": 4,
    "CLAY": 5,
    "REFRESH": 6
  }
};