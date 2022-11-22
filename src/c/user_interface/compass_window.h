#pragma once
void compass_window_push();
void update_heading_data(int32_t bearing, int32_t distance, char *name, bool init);
void unsuppress_compass();