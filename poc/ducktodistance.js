let coords = require('./coords.json');
let geo = {"latitude": 55.8366571, "longitude": -3.2199992};

function radians(d) {return (d * Math.PI) / 180.0;}

function equirectDistance(c1,c2) {
  // Calculate latitude delta
  x = radians(c2.latitude) - radians(c1.latitude);
  // Calculate longitude delta and multiply with an approximate scaler based on the cosine of the median latitude
  y = (radians(c2.longitude) - radians(c1.longitude)) * Math.cos((radians(c2.latitude) + radians(c1.latitude)) * 0.5);
  // earth_radius * sqrt(x^2 + y^2)
  return 6367449 * Math.sqrt(x*x + y*y);
}

function equirectBearing(c1,c2) {
  y = Math.sin(radians(c2.longitude) - radians(c1.longitude)) * Math.cos(radians(c2.latitude));
  x = Math.cos(radians(c1.latitude)) * Math.sin(radians(c2.latitude)) - 
      Math.sin(radians(c1.latitude)) * Math.cos(radians(c2.latitude)) * Math.cos(radians(c2.longitude) - radians(c1.longitude));
  theta = Math.atan2(y, x);
  return ((theta * 0x8000 / Math.PI) + 0x10000) % 0x10000;
}


coords.forEach(item => {
  item.distance = (equirectDistance(geo, item.coordinates));
  item.bearing = (equirectBearing(geo, item.coordinates));
});

coords.sort((a,b) => (a.distance < b.distance) ? -1 : 1);
console.log(coords);
