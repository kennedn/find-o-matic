var globals = require('./globals');
var Promise = require('bluebird');
for (var key in globals) {
  window[key] = globals[key];
}

var self = module.exports = {
  colorAppMessage: function(color, hash) {
    Pebble.sendAppMessage({"TransferType": TransferType.COLOR, "Color": color, "Hash": hash}, messageSuccess, messageFailure);
  },

  localXHRRequest: function(button, url, headers, hash) {
    var data = {};
    var highlight_idx = ColorAction.VIBRATE_RESPONSE;
    if (Array.isArray(button.data)) {
      if (button.index == null) { 
        button.index = 0;
      }
      data = button.data[button.index];
      if (button.data.length == 2) { highlight_idx = button.index; }
      button.index = (button.index + 1) % button.data.length;
    } else {
      data = button.data;
    }
    debug(2, "highlight idx: " + highlight_idx);
    self.xhrRequest(button.method, url, headers, data, hash, 2).then(function(xhr_data) {
      self.colorAppMessage(highlight_idx, xhr_data.hash);
    }, function(hash) {
      self.colorAppMessage(ColorAction.ERROR, hash);
    });
  },
  xhrRequest: function(method, url, headers, data, origin_hash, maxRetries) {
    return new Promise(function(resolve, reject) {

      var xhrRetry = function(method, url, headers, data, origin_hash, maxRetries) {
        if (typeof(maxRetries) == 'number'){
          maxRetries = [maxRetries, maxRetries];
        }

        var request = new XMLHttpRequest();
        request.onload = function() {
          if(this.status < 400) {
            debug(1, "---- Status: " + this.status);
            var returnData = {};
            try {
              returnData = JSON.parse(this.responseText);
              debug(2, "Response data: " + JSON.stringify(returnData));
            } catch(e) {
              debug(1, "---- Status: JSON parse failure");
              return reject(origin_hash);
            }

            return resolve({ data: returnData, hash: origin_hash});

          } else {
            if (maxRetries[1] > 0) {
              debug(1, "---- Status: " + this.status);
              setTimeout(function() { 
                xhrRetry(method, url, headers, data, origin_hash, [maxRetries[0], maxRetries[1] - 1]); 
              }, 307 * (maxRetries[0] - maxRetries[1]));
            } else {
              debug(1, "---- Status: Max retries reached");
              return reject(origin_hash);
            }
          }
        };

        debug(1, "XHR Type: Local");
        debug(1, "-- URL: " + url);
        debug(1, "-- Method: " + method);
        debug(1, "-- Data: " + JSON.stringify(data));

        request.onerror = request.ontimeout = function(e) { 
          return reject(origin_hash);
        };

        request.open(method, url);
        request.timeout = 5000;
        for (var key in headers) {
          if(headers.hasOwnProperty(key)) {
          debug(1, "-- Header: " + key + ": " + headers[key]);
          request.setRequestHeader(key, headers[key]);
          }
        }
        request.send(JSON.stringify(data)); 
      };
      xhrRetry(method, url, headers, data, origin_hash, maxRetries);
    });
  }
};
