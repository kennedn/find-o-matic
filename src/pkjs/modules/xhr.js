var globals = require('./globals');
var Promise = require('bluebird');
for (var key in globals) {
  window[key] = globals[key];
}

var self = module.exports = {
  xhrRequest: function(method, url, headers, data, maxRetries) {
    return new Promise(function(resolve, reject) {

      var xhrRetry = function(method, url, headers, data, maxRetries) {
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
              debug(3, "Response data: " + JSON.stringify(returnData));
            } catch(e) {
              debug(1, "---- Status: JSON parse failure");
              return reject();
            }

            return resolve(returnData);

          } else {
            if (maxRetries[1] > 0) {
              debug(1, "---- Status: " + this.status);
              setTimeout(function() { 
                debug(2, "Retrying XHR request, " + maxRetries[1] + " attempts remaining");
                xhrRetry(method, url, headers, data, [maxRetries[0], maxRetries[1] - 1]); 
              }, 307 * (maxRetries[0] - maxRetries[1]));
            } else {
              debug(1, "---- Status: Max retries reached");
              return reject();
            }
          }
        };

        debug(1, "XHR Type: Local");
        debug(1, "-- URL: " + url);
        debug(1, "-- Method: " + method);
        debug(1, "-- Data: " + JSON.stringify(data));

        request.onerror = request.ontimeout = function(e) { 
          return reject();
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
      xhrRetry(method, url, headers, data, maxRetries);
    });
  }
};
