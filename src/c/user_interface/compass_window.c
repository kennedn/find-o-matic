#include <pebble.h>
#include "c/modules/comm.h"
#include "c/find-o-matic.h"
#include "c/user_interface/loading_window.h"

// // Vector paths for the compass needles
// static const GPathInfo NEEDLE_NORTH_POINTS = {
//   4,
//   (GPoint[]) { {0, -20 }, { -8, -26 }, { 0, -46 }, { 8, -26 } }
// };

typedef struct {
  GPoint point;
  GPoint origin;
  int32_t rotation;
} GPointWithRotation;

static GPointWithRotation s_point;

typedef struct {
  bool hasData;
  int32_t bearing;
  int32_t distance;
  char name[64];
} DestinationData;

static DestinationData s_destination_data;
static Window *s_compass_window;
static BitmapLayer *s_bitmap_layer;
static GBitmap *s_background_bitmap;
static Layer *s_path_layer;
static TextLayer *s_heading_layer;
// static GPath *s_needle_north;
static bool s_compass_suppression;
static bool s_override_invalid_data;
static AppTimer *s_invalid_data_timer;
static void compass_heading_handler(CompassHeadingData heading);
static void set_text_layer_text(char *buffer, GFont font);
static void click_config_subscribe_handler(void *ctx);
static void click_config_unsubscribe_handler(void *ctx);

void update_heading_data(int32_t bearing, int32_t distance, char *name, bool init) {
  if (!s_compass_window) {return;}
  if(name) {strncpy(s_destination_data.name, name, ARRAY_LENGTH(s_destination_data.name));}
  s_destination_data.bearing = bearing;
  s_destination_data.distance = distance;
  if (init) {
    LONG_VIBE();
    s_destination_data.hasData = true;
    window_set_click_config_provider(s_compass_window, click_config_subscribe_handler);
  }
  // Trigger a manual refresh of the compass display, as it otherwise won't trigger until the watch is moved
  CompassHeadingData heading;
  compass_service_peek(&heading);
  compass_heading_handler(heading);
}

void unsuppress_compass() {
  s_compass_suppression = false;
  window_set_click_config_provider(s_compass_window, click_config_subscribe_handler);
  // layer_set_hidden(s_path_layer, false);
  static char s_heading_buf[64];
  snprintf(s_heading_buf,  ARRAY_LENGTH(s_heading_buf), "%dm", (int)s_destination_data.distance);
  set_text_layer_text(s_heading_buf, ubuntu18);
}

static void suppress_compass(bool suppress_clicks) {
  s_compass_suppression = true;
  if (suppress_clicks) {window_set_click_config_provider(s_compass_window, click_config_unsubscribe_handler);}
  // layer_set_hidden(s_path_layer, true);
}

// //! Selection button callback, submit refresh request to phone and display message
// //! @param recognizer The click recognizer that detected a "click" pattern
// //! @param context Pointer to application specified data
static void select_callback(ClickRecognizerRef ref, void *ctx) {
  suppress_compass(true);
  static char s_heading_buf[] = "Refreshing locations";
  set_text_layer_text(s_heading_buf, ubuntu14);
  SHORT_VIBE();
  comm_refresh_request();
  app_timer_register(500, unsuppress_compass, NULL);
}

//! Button depression callback, display name of current location
//! @param recognizer The click recognizer that detected a "click" pattern
//! @param context Pointer to application specified data
static void location_peek_callback(ClickRecognizerRef ref, void *ctx){
  suppress_compass(false);
  SHORT_VIBE();
  static char s_heading_buf[64];
  snprintf(s_heading_buf,  ARRAY_LENGTH(s_heading_buf), "%s", s_destination_data.name);
  debug(2, "name: %s", s_destination_data.name);
  set_text_layer_text(s_heading_buf, ubuntu14);
}

//! Button release callback, reset display to compass
//! @param recognizer The click recognizer that detected a "click" pattern
//! @param context Pointer to application specified data
static void location_peek_release_callback(ClickRecognizerRef ref, void *ctx){
  unsuppress_compass();
}

static void click_config_subscribe_handler(void *ctx) {
  window_long_click_subscribe(BUTTON_ID_UP, 50, location_peek_callback, location_peek_release_callback);
  window_long_click_subscribe(BUTTON_ID_DOWN, 50, location_peek_callback, location_peek_release_callback);
  window_single_click_subscribe(BUTTON_ID_SELECT, select_callback);
}

static void click_config_unsubscribe_handler(void *ctx) {
  window_long_click_subscribe(BUTTON_ID_UP, 50, NULL, NULL);
  window_long_click_subscribe(BUTTON_ID_DOWN, 50, NULL, NULL);
  window_single_click_subscribe(BUTTON_ID_SELECT, NULL);
}

//! Center and display text element in the middle of compass
//! @param buffer String to display
//! @param GFont Font to display the string as
static void set_text_layer_text(char *buffer, GFont font) {
  Layer *window_layer = window_get_root_layer(s_compass_window);
  GRect bounds = layer_get_bounds(window_layer);
  bounds.origin.x = 25;
  bounds.size.w = bounds.size.w - 50;
  
  text_layer_set_font(s_heading_layer, font);
  GSize text_size = graphics_text_layout_get_content_size(buffer, font, bounds, GTextOverflowModeWordWrap, GTextAlignmentLeft);
  GRect text_bounds = GRect(bounds.origin.x + ((bounds.size.w - text_size.w) / 2), bounds.origin.y + ((bounds.size.h - text_size.h) / 2),
                            text_size.w, text_size.h * 2);
  layer_set_frame(text_layer_get_layer(s_heading_layer), text_bounds);
  text_layer_set_text(s_heading_layer, buffer);
}
static void set_override_invalid_data() {
  s_override_invalid_data = true;
}

static void only_unsuppress_compass() {
  s_compass_suppression = false;
}

static void compass_heading_handler(CompassHeadingData heading) {
  if (s_compass_suppression) {return;}

  static char s_heading_buf[64];
  if (!s_destination_data.hasData) {
    // layer_set_hidden(s_path_layer, true);
    strncpy(s_heading_buf, "Acquiring target", ARRAY_LENGTH(s_heading_buf));
    set_text_layer_text(s_heading_buf, ubuntu14);
  } else if (!s_override_invalid_data && heading.compass_status <= CompassStatusDataInvalid) {
    // layer_set_hidden(s_path_layer, true);
    debug(2, "Calibration status: %d", heading.compass_status);
    strncpy(s_heading_buf, "Move wrist to calibrate compass", ARRAY_LENGTH(s_heading_buf));
    set_text_layer_text(s_heading_buf, ubuntu14);
    if(!s_invalid_data_timer) {s_invalid_data_timer = app_timer_register(0, set_override_invalid_data, NULL);}
  } else {
    // layer_set_hidden(s_path_layer, false);
    int32_t corrected_heading = (heading.magnetic_heading + s_destination_data.bearing);
    // rotate needle accordingly
    // gpath_rotate_to(s_needle_north, corrected_heading);
    s_point.rotation = corrected_heading;
    // s_point.rotation = heading.magnetic_heading;
    
    snprintf(s_heading_buf,  ARRAY_LENGTH(s_heading_buf), "%dm", (int)s_destination_data.distance);
    set_text_layer_text(s_heading_buf, ubuntu18);

    // trigger layer for refresh
    layer_mark_dirty(s_path_layer);
  }
  // s_compass_suppression = true;
  // app_timer_register(100, only_unsuppress_compass, NULL);
}


static void path_layer_update_callback(Layer *path_layer, GContext *ctx) {
  if (!s_destination_data.hasData) {return;}
  graphics_context_set_stroke_width(ctx,2);
  const GRect bounds = layer_get_bounds(path_layer);
  const int32_t radius = (MIN(bounds.size.w, bounds.size.h) / 2);
  const int tick_count = 24;
  for (int i=0; i < tick_count; i++) {
    if (i == 0) {
      graphics_context_set_fill_color(ctx, PBL_IF_COLOR_ELSE(GColorRed, GColorWhite));
      graphics_context_set_stroke_color(ctx, PBL_IF_COLOR_ELSE(GColorRed, GColorWhite));
    } else {
      graphics_context_set_fill_color(ctx, GColorWhite);
      graphics_context_set_stroke_color(ctx, GColorWhite);
    }
    int32_t theta = s_point.rotation + (TRIG_MAX_ANGLE * i / tick_count);
    GPoint p0, p1, p2, p3;
    
    if(i % 6 == 0) {
      if (i == 0) {
        p0.x = (int16_t)(sin_lookup(theta) * (radius - 26) / TRIG_MAX_ANGLE) + s_point.origin.x;
        p0.y = (int16_t)(-cos_lookup(theta) * (radius - 26) / TRIG_MAX_ANGLE) + s_point.origin.y;
        p1.x = (int16_t)(sin_lookup(theta - (TRIG_MAX_ANGLE * 1 / (tick_count * 2))) * (radius - 16) / TRIG_MAX_ANGLE) + s_point.origin.x;
        p1.y = (int16_t)(-cos_lookup(theta - (TRIG_MAX_ANGLE * 1 / (tick_count * 2))) * (radius - 16) / TRIG_MAX_ANGLE) + s_point.origin.y;
        p2.x = (int16_t)(sin_lookup(theta) * (radius) / TRIG_MAX_ANGLE) + s_point.origin.x;
        p2.y = (int16_t)(-cos_lookup(theta) * (radius) / TRIG_MAX_ANGLE) + s_point.origin.y;
        p3.x = (int16_t)(sin_lookup(theta + (TRIG_MAX_ANGLE * 1 / (tick_count * 2))) * (radius - 16) / TRIG_MAX_ANGLE) + s_point.origin.x;
        p3.y = (int16_t)(-cos_lookup(theta + (TRIG_MAX_ANGLE * 1 / (tick_count * 2))) * (radius - 16) / TRIG_MAX_ANGLE) + s_point.origin.y;
        GPathInfo points = {4,(GPoint[]) {p0, p1, p2, p3},};
        GPath *path = gpath_create(&points);
        #if defined(PBL_COLOR)
          graphics_context_set_fill_color(ctx, GColorRed);
        #endif
        gpath_draw_filled(ctx, path);
        gpath_destroy(path);
      } else {
        p0.x = (int16_t)(sin_lookup(theta) * (radius - 10) / TRIG_MAX_ANGLE) + s_point.origin.x;
        p0.y = (int16_t)(-cos_lookup(theta) * (radius - 10) / TRIG_MAX_ANGLE) + s_point.origin.y;
        graphics_fill_circle(ctx, p0, 9);
      }
    } else {
      p0.x = (int16_t)(sin_lookup(theta) * (radius - 15) / TRIG_MAX_ANGLE) + s_point.origin.x;
      p0.y = (int16_t)(-cos_lookup(theta) * (radius - 15) / TRIG_MAX_ANGLE) + s_point.origin.y;
      p1.x = (int16_t)(sin_lookup(theta) * (radius - 5) / TRIG_MAX_ANGLE) + s_point.origin.x;
      p1.y = (int16_t)(-cos_lookup(theta) * (radius - 5) / TRIG_MAX_ANGLE) + s_point.origin.y;
      graphics_draw_line(ctx, p0, p1);
    }
    // debug(2, "theta: %x, x: %d, y: %d", (int)theta, p0.x, p0.y);

  }
}


static void menu_window_load(Window *window) {
  s_compass_suppression = false;
  s_destination_data.bearing = 0;
  s_destination_data.distance = 0;
  s_destination_data.name[0] = '\0';
  s_destination_data.hasData = false;
  s_override_invalid_data = false;
  s_invalid_data_timer = NULL;
  Layer *window_layer = window_get_root_layer(s_compass_window);
  GRect bounds = layer_get_bounds(window_layer);

  //  // Create the bitmap for the background and put it on the screen
  // s_bitmap_layer = bitmap_layer_create(bounds);
  // s_background_bitmap = gbitmap_create_with_resource(RESOURCE_ID_COMPASS_BACKGROUND);
  // bitmap_layer_set_bitmap(s_bitmap_layer, s_background_bitmap);

  // bitmap_layer_set_compositing_mode(s_bitmap_layer, GCompOpSet);
  // layer_add_child(window_layer, bitmap_layer_get_layer(s_bitmap_layer));

  s_path_layer = layer_create(bounds);

  layer_set_update_proc(s_path_layer, path_layer_update_callback);
  layer_add_child(window_layer, s_path_layer);

 // s_needle_north = gpath_create(&NEEDLE_NORTH_POINTS);

  s_point.point = GPoint(0, -60);
  // Move the needles to the center of the screen.
  s_point.origin = GPoint(bounds.size.w / 2, bounds.size.h / 2);



  s_heading_layer = text_layer_create(bounds);
  text_layer_set_text_alignment(s_heading_layer, GTextAlignmentLeft);
  text_layer_set_background_color(s_heading_layer, GColorClear);
  text_layer_set_text_color(s_heading_layer, GColorWhite);
  layer_add_child(window_layer, text_layer_get_layer(s_heading_layer));
}

static void menu_window_unload(Window *window) {
  if (s_compass_window) {
    text_layer_destroy(s_heading_layer);
    layer_destroy(s_path_layer);
    gbitmap_destroy(s_background_bitmap);
    bitmap_layer_destroy(s_bitmap_layer);
    compass_service_unsubscribe();
    window_destroy(s_compass_window);
    s_compass_window = NULL;
    s_bitmap_layer = NULL;
    s_background_bitmap = NULL;
    s_path_layer = NULL;
    s_heading_layer = NULL;
  }
}

void compass_window_push() {
  if (!s_compass_window) {
    compass_service_set_heading_filter(DEG_TO_TRIGANGLE(2));
    compass_service_subscribe(&compass_heading_handler);

    s_compass_window = window_create();
    window_set_background_color(s_compass_window, GColorBlack);
    window_set_window_handlers(s_compass_window, (WindowHandlers) {
      .load = menu_window_load,
      .unload = menu_window_unload,
    });
    window_stack_push(s_compass_window, true);
  }
}

