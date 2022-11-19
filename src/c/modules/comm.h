#pragma once
#include <pebble.h>
void comm_init();

void comm_deinit();

#ifdef PBL_PLATFORM_APLITE
    #define INBOX_SIZE 256
#else
    #define INBOX_SIZE 8200
#endif

#define OUTBOX_SIZE 64