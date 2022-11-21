#include "c/modules/comm.h"
#include "c/find-o-matic.h"
#include "c/user_interface/loading_window.h"
#include "c/user_interface/compass_window.h"
static AppTimer *s_ready_timer;
static bool s_clay_needs_config = false;
static bool s_is_ready = false;
static int s_outbox_attempts = 0;
static void comm_bluetooth_event(bool connected);

//! Handle Javascript inbound communication
//! @param dict A dictionary iterator containing any sent keys from JS side
//! @param context Pointer to any application specific data
static void inbox(DictionaryIterator *dict, void *context) {
    Tuple *type_t = dict_find(dict, MESSAGE_KEY_TransferType);
    Tuple *bearing_t = dict_find(dict, MESSAGE_KEY_Bearing);
    Tuple *distance_t = dict_find(dict, MESSAGE_KEY_Distance);
    Tuple *location_t = dict_find(dict, MESSAGE_KEY_LocationString);
    switch(type_t->value->int32) {
      case TRANSFER_TYPE_BEARING:
        debug(3, "Received bearing");
        s_clay_needs_config = false;
        compass_window_push();
        debug(2, "Bearing: %d", (int)bearing_t->value->int32);
        debug(2, "Distance: %d", (int)distance_t->value->int32);
        if(location_t) {
          debug(2, "Name: %s", location_t->value->cstring);
        }

        update_heading_data(bearing_t->value->int32, distance_t->value->int32, (location_t) ? location_t->value->cstring : NULL);
        break;
      case TRANSFER_TYPE_REFRESH:
        debug(2, "Received refresh success");
        LONG_VIBE();
        unsupress_compass();
        break;
      case TRANSFER_TYPE_ERROR:
        debug(2, "Received error");
        break;
      case TRANSFER_TYPE_CLAY:
        debug(2, "Received clay update prompt");
        LONG_VIBE();
        compass_window_push();
        debug(2, "Received acknowledge");
        break;
      case TRANSFER_TYPE_READY:
        debug(2, "Pebblekit environment ready");
        s_is_ready = true;
        compass_window_push();
        break;
      case TRANSFER_TYPE_NO_CLAY:
        debug(2, "No clay config present");
        if(!s_clay_needs_config) {
          s_clay_needs_config = true;
          window_stack_pop_all(true);
          loading_window_push("Watch app not configured");
        }
        break;
    }
}


void comm_ready_callback(void *data) {
  if (s_clay_needs_config) {
    s_ready_timer = NULL;
    return;
  }

  if (!s_is_ready) {
    if (s_outbox_attempts == 3) {
      window_stack_pop_all(true);
      loading_window_push(NULL);
    }
    DictionaryIterator *dict;
    uint32_t result = app_message_outbox_begin(&dict);
    debug(3, "Ready result: %d", (int)result);
    if (result == APP_MSG_OK) {
      dict_write_uint8(dict, MESSAGE_KEY_TransferType, TRANSFER_TYPE_READY);
      dict_write_end(dict);
      app_message_outbox_send();
    }
    s_outbox_attempts = MIN(30, s_outbox_attempts + 1);
    debug(3, "Not ready, waiting %d ms", RETRY_READY_TIMEOUT * s_outbox_attempts);
    s_ready_timer = app_timer_register(RETRY_READY_TIMEOUT * s_outbox_attempts, comm_ready_callback, NULL);
  } else {
    s_ready_timer = NULL;
  }
}

//! Asks pebblekit to perform a refresh, this will clear down localstorage
//! @param data NULL pointer
void comm_refresh_request(void *data) {
    DictionaryIterator *dict;
    uint32_t result = app_message_outbox_begin(&dict);
    debug(3, "Refresh result: %d", (int)result);
    if (result == APP_MSG_OK) {
      dict_write_uint8(dict, MESSAGE_KEY_TransferType, TRANSFER_TYPE_REFRESH);
      dict_write_end(dict);
      app_message_outbox_send();
    }
}

void comm_callback_start() {
  s_is_ready = false;
  s_clay_needs_config = false;
  s_outbox_attempts = 0;
  if (s_ready_timer) {app_timer_cancel(s_ready_timer);}
  s_ready_timer = NULL;
  app_timer_register(RETRY_READY_TIMEOUT, comm_ready_callback, NULL);
}


//! Callback function for pebble connectivity events
//! @param connected Connection state of pebble
static void comm_bluetooth_event(bool connection_state) {
  debug(2, "Connection state changed to %u", connection_state);
  if (connection_state) {
    window_stack_pop_all(true);
    loading_window_push(NULL);

    // comm_callback_start had the ability to call data_retrieve_persist. Calling this function too early
    // causes undocumented behaviour in the SDK. Using app_timer_register delays enough to work around this. 
    app_timer_register(0, comm_callback_start, NULL);
  } else if(!connection_state) {
    window_stack_pop_all(true);
    loading_window_push("No connection to phone");
  }
}

//! Initialise AppMessage, timers and icon_array
void comm_init() {
  s_ready_timer = NULL;
  app_message_register_inbox_received(inbox);

  app_message_open(INBOX_SIZE, OUTBOX_SIZE);

  connection_service_subscribe((ConnectionHandlers) {
    .pebble_app_connection_handler = comm_bluetooth_event,
    .pebblekit_connection_handler = comm_bluetooth_event
  });
  comm_bluetooth_event(connection_service_peek_pebble_app_connection());
}

//! Deinitialise  AppMesage, timers, arrays and any left over data
void comm_deinit() {
  connection_service_unsubscribe();
  app_message_deregister_callbacks();
  if (s_ready_timer) {app_timer_cancel(s_ready_timer);}
  s_ready_timer = NULL;
}
