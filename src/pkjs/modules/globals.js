var self = module.exports = {
  DEBUG: 2,
  COORDINATE_SPOOFING: true,
  DEBUG_COORDINATES: [
    { "latitude": 55.835454, "longitude": -3.220819 },
    { "latitude": 55.839470, "longitude": -3.209767 },
    { "latitude": 55.834265, "longitude": -3.084412 },
    { "latitude": 55.792789, "longitude": -3.340874 },
  ],
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
    "REFRESH": 5
  }
};