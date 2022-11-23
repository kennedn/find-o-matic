#include <pebble.h>
#include "c/user_interface/loading_window.h"
#include "c/modules/comm.h"
#include "c/find-o-matic.h"

VibePattern tiny_vibe = { 
    .durations = (uint32_t []) {30, 200},
    .num_segments = 2,};
VibePattern short_vibe = { 
    .durations = (uint32_t []) {50},
    .num_segments = 1,};
VibePattern long_vibe = { 
    .durations = (uint32_t []) {40,40,40},
    .num_segments = 3,};

GFont ubuntu18;
GFont ubuntu14;

static void init() {
  ubuntu18 = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_UBUNTU_BOLD_18));
  ubuntu14 = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_UBUNTU_BOLD_14));
  comm_init();
}

static void deinit() { 
  fonts_unload_custom_font(ubuntu18);
  fonts_unload_custom_font(ubuntu14);
  comm_deinit();
}

int main() {
  init();
  app_event_loop();
  deinit();
}
