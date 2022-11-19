#include <pebble.h>
#include "c/modules/comm.h"
#include "c/find-o-matic.h"
#include "c/user_interface/loading_window.h"
#define CELL_HEIGHT ((const int16_t) 48)
#define CELL_WIDTH ((const int16_t) 40)


// Vector paths for the compass needles
static const GPathInfo NEEDLE_NORTH_POINTS = {
  3,
  (GPoint[]) { { -8, 0 }, { 8, 0 }, { 0, -36 } }
};
static const GPathInfo NEEDLE_SOUTH_POINTS = {
  3,
  (GPoint[]) { { 8, 0 }, { 0, 36 }, { -8, 0 } }
};

typedef struct {
  int32_t bearing;
  int32_t distance;
} DestinationData;

static DestinationData destination_data = {.bearing = 0, .distance = 0};
static Window *s_compass_window;
static BitmapLayer *s_bitmap_layer;
static GBitmap *s_background_bitmap;
static Layer *s_path_layer;
static TextLayer *s_heading_layer, *s_text_layer_calib_state;
static GPath *s_needle_north, *s_needle_south;



// //! Selection button callback, creates a new action window based on current row
// //! @param recognizer The click recognizer that detected a "click" pattern
// //! @param context Pointer to application specified data
// static void select_callback(ClickRecognizerRef ref, void *ctx) {
//   if (tile_array) {
//     uint8_t selected_row = menu_layer_get_selected_index(s_menu_layer).row;
//     action_window_push(tile_array->tiles[selected_row], selected_row);
//   }
// }

// //! Up button callback, Moves up one row in the menu list, wraps around to bottom of list
// //! @param recognizer The click recognizer that detected a "click" pattern
// //! @param context Pointer to application specified data
// static void up_callback(ClickRecognizerRef ref, void *ctx){
//   if (!tile_array) { return; }
//   if (menu_layer_get_selected_index(s_menu_layer).row == 0) {
//     menu_layer_set_selected_index(s_menu_layer,(MenuIndex) {.row = tile_array->used - 1, .section = 0}, MenuRowAlignCenter, true);
//   } else {
//     menu_layer_set_selected_next(s_menu_layer, true, MenuRowAlignCenter, true);
//   }
// }

// //! Down button callback, Moves down one row in the menu list, wraps around to top of list
// //! @param recognizer The click recognizer that detected a "click" pattern
// //! @param context Pointer to application specified data
// static void down_callback(ClickRecognizerRef ref, void *ctx){
//   if (!tile_array) { return; }
//   if (menu_layer_get_selected_index(s_menu_layer).row == tile_array->used - 1) {
//     menu_layer_set_selected_index(s_menu_layer,(MenuIndex) {.row = 0, .section = 0}, MenuRowAlignCenter, true);
//   } else {
//     menu_layer_set_selected_next(s_menu_layer, false, MenuRowAlignCenter, true);
//   }
// }


// static void click_config_handler(void *ctx) {
//   // scroll_layer_set_click_config_onto_window(menu_layer_get_scroll_layer(s_menu_layer), s_menu_window);
//   window_single_repeating_click_subscribe(BUTTON_ID_UP, 200, up_callback);
//   window_single_repeating_click_subscribe(BUTTON_ID_DOWN, 200, down_callback);
//   window_single_click_subscribe(BUTTON_ID_SELECT, select_callback);
// }

void update_heading_data(uint16_t bearing, uint32_t distance) {
  destination_data.bearing = bearing;
  destination_data.distance = distance;
}

static void compass_heading_handler(CompassHeadingData heading_data) {

  int32_t corrected_heading = heading_data.magnetic_heading + destination_data.bearing;
  // rotate needle accordingly
  gpath_rotate_to(s_needle_north, corrected_heading);
  gpath_rotate_to(s_needle_south, corrected_heading);

  // Modify alert layout depending on calibration state
  GRect bounds = layer_get_frame(window_get_root_layer(s_compass_window));
  GRect alert_bounds;
  if(heading_data.compass_status == CompassStatusDataInvalid) {
    // Tell user to move their arm
    alert_bounds = GRect(0, 0, bounds.size.w, bounds.size.h);
    text_layer_set_background_color(s_text_layer_calib_state, GColorBlack);
    text_layer_set_text_color(s_text_layer_calib_state, GColorWhite);
    text_layer_set_font(s_text_layer_calib_state, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
    text_layer_set_text(s_text_layer_calib_state, "Compass is calibrating!\n\nMove your arm to aid calibration.");
  } else if (heading_data.compass_status == CompassStatusCalibrating) {
    // Show status at the top
    alert_bounds = GRect(0, -3, bounds.size.w, bounds.size.h / 7);
    text_layer_set_background_color(s_text_layer_calib_state, GColorClear);
    text_layer_set_text_color(s_text_layer_calib_state, GColorBlack);
    text_layer_set_font(s_text_layer_calib_state, fonts_get_system_font(FONT_KEY_GOTHIC_18));
    text_layer_set_text(s_text_layer_calib_state, "Tuning...");
  }
  text_layer_set_text_alignment(s_text_layer_calib_state, GTextAlignmentCenter);
  layer_set_frame(text_layer_get_layer(s_text_layer_calib_state), alert_bounds);
  // display heading in degrees and radians
  static char s_heading_buf[64];
  snprintf(s_heading_buf, sizeof(s_heading_buf),
    " dist:\n%dm",
    (int)destination_data.distance
  );
  text_layer_set_text(s_heading_layer, s_heading_buf);

  // trigger layer for refresh
  layer_mark_dirty(s_path_layer);
}


static void path_layer_update_callback(Layer *path_layer, GContext *ctx) {
  graphics_context_set_fill_color(ctx, PBL_IF_COLOR_ELSE(GColorRed, GColorWhite));
  gpath_draw_filled(ctx, s_needle_north);

  graphics_context_set_fill_color(ctx, GColorWhite);
  gpath_draw_outline(ctx, s_needle_south);

  // creating centerpoint
  GRect bounds = layer_get_frame(path_layer);
  GPoint path_center = grect_center_point(&bounds);
  graphics_fill_circle(ctx, path_center, 3);

  // then put a white circle on top
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_circle(ctx, path_center, 2);
}


static void menu_window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(s_compass_window);
  GRect bounds = layer_get_bounds(window_layer);

   // Create the bitmap for the background and put it on the screen
  s_bitmap_layer = bitmap_layer_create(bounds);
  s_background_bitmap = gbitmap_create_with_resource(RESOURCE_ID_COMPASS_BACKGROUND);
  bitmap_layer_set_bitmap(s_bitmap_layer, s_background_bitmap);

  // Make needle background 'transparent' with GCompOpAnd
  bitmap_layer_set_compositing_mode(s_bitmap_layer, GCompOpSet);
  layer_add_child(window_layer, bitmap_layer_get_layer(s_bitmap_layer));

  // Create the layer in which we will draw the compass needles
  s_path_layer = layer_create(bounds);

  //  Define the draw callback to use for this layer
  layer_set_update_proc(s_path_layer, path_layer_update_callback);
  layer_add_child(window_layer, s_path_layer);

  // Initialize and define the two paths used to draw the needle to north and to south
  s_needle_north = gpath_create(&NEEDLE_NORTH_POINTS);
  s_needle_south = gpath_create(&NEEDLE_SOUTH_POINTS);

  // Move the needles to the center of the screen.
  GPoint center = GPoint(bounds.size.w / 2, bounds.size.h / 2);
  gpath_move_to(s_needle_north, center);
  gpath_move_to(s_needle_south, center);

  // Place text layers onto screen: one for the heading and one for calibration status
  s_heading_layer = text_layer_create(
    GRect(PBL_IF_ROUND_ELSE(40, 8), PBL_IF_ROUND_ELSE(40, 8), bounds.size.w / 4, bounds.size.h / 5));
  text_layer_set_text(s_heading_layer, "No Data");
  layer_add_child(window_layer, text_layer_get_layer(s_heading_layer));

  s_text_layer_calib_state = text_layer_create(GRect(0, 0, bounds.size.w, bounds.size.h / 7));
  text_layer_set_text_alignment(s_text_layer_calib_state, GTextAlignmentLeft);
  text_layer_set_background_color(s_text_layer_calib_state, GColorClear);

  layer_add_child(window_layer, text_layer_get_layer(s_text_layer_calib_state));

#if defined(PBL_ROUND)
  text_layer_enable_screen_text_flow_and_paging(s_text_layer_calib_state, 5);
#endif

}

static void menu_window_unload(Window *window) {
  if (s_compass_window) {
    text_layer_destroy(s_heading_layer);
    text_layer_destroy(s_text_layer_calib_state);
    gpath_destroy(s_needle_north);
    gpath_destroy(s_needle_south);
    layer_destroy(s_path_layer);
    gbitmap_destroy(s_background_bitmap);
    bitmap_layer_destroy(s_bitmap_layer);
    compass_service_unsubscribe();
    window_destroy(s_compass_window);
    s_compass_window = NULL;
    s_bitmap_layer = NULL;
    s_background_bitmap = NULL;
    s_path_layer = NULL;
    s_needle_south = NULL;
    s_needle_north = NULL;
    s_text_layer_calib_state = NULL;
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

