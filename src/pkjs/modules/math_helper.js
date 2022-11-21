var globals = require('./globals');
for (var key in globals) {
  window[key] = globals[key];
}

var self = module.exports = {
  degToRadians: function (deg) {return (deg * Math.PI) / 180.0;},
  calculateDistance: function (c1,c2) { // Calculate the distance between two geocoordinates using equirect approximation
    // Calculate latitude delta
    var x = c2.latitude - c1.latitude;
    // Calculate longitude delta and multiply with an approximate scaler based on the cosine of the median latitude
    var y = (c2.longitude - c1.longitude) * Math.cos((c2.latitude + c1.latitude) * 0.5);
    // earth_radius * sqrt(x^2 + y^2)
    return parseInt(6367449 * Math.sqrt(x*x + y*y));
  },
  calculateBearing: function (c1,c2) {  // Calculate the bearing between two geocoordinates on a spherical earth
    var y = Math.sin(c2.longitude - c1.longitude) * Math.cos(c2.latitude);
    var x = Math.cos(c1.latitude) * Math.sin(c2.latitude) - 
      Math.sin(c1.latitude) * Math.cos(c2.latitude) * Math.cos(c2.longitude - c1.longitude);
    var theta = Math.atan2(y, x);  // Calculate bearing in radians
    return ((theta * 0x8000 / Math.PI) + 0x10000) % 0x10000; // Translate radians to Pebble linear scale (0x10000 = 360 deg)
  }
};
