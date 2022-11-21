#pragma once
void compass_window_push();
void update_heading_data(uint16_t bearing, uint32_t distance, char *name);
void unsupress_compass();