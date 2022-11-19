var self = module.exports = {
  DEBUG: 2,
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