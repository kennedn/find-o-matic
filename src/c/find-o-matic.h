#pragma once
#include <pebble.h>

#define DEBUG 0
#define debug(level, ...) \
  do { if (level <= DEBUG) APP_LOG(APP_LOG_LEVEL_DEBUG, __VA_ARGS__); } while (0)


extern GFont ubuntu18;
extern GFont ubuntu14;
extern VibePattern tiny_vibe; 
extern VibePattern short_vibe; 
extern VibePattern long_vibe; 

#define RETRY_READY_TIMEOUT 500
#define LONG_LOAD_TIMEOUT 6500
#define TINY_VIBE() if(!quiet_time_is_active()) { vibes_enqueue_custom_pattern(tiny_vibe); }
#define SHORT_VIBE() if(!quiet_time_is_active()) { vibes_enqueue_custom_pattern(short_vibe); }
#define LONG_VIBE() if(!quiet_time_is_active()) { vibes_enqueue_custom_pattern(long_vibe); }
#define MIN(a,b) (((a)<(b))?(a):(b))
#define MAX(a,b) (((a)>(b))?(a):(b))


typedef enum {
  TRANSFER_TYPE_BEARING = 0,
  TRANSFER_TYPE_ERROR = 1,
  TRANSFER_TYPE_ACK = 2,
  TRANSFER_TYPE_READY = 3,
  TRANSFER_TYPE_NO_CLAY = 4,
  TRANSFER_TYPE_CLAY = 5,
  TRANSFER_TYPE_REFRESH = 6
} TransferType;
