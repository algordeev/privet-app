// Host checks for firmware/PrivetMini_v0.6/MiniFaces.h.
// 1. Every reaction, local face (motion, buttons) and tilted look draws a
//    visible face for its whole duration.
// 2. For each stdin line "<face> <age> <now>" (face: sleeping or a reaction code),
//    prints the 128x64 frame as one line of 0/1 characters, so the app's
//    src/miniFaces.ts can be compared pixel for pixel.
#include <cstdio>
#include <cstring>
#include <cstdint>
#include "MiniFaces.h"

static uint8_t frame[MiniFaces::W * MiniFaces::H];
struct Plot { void operator()(int x, int y, bool on) const { frame[y * MiniFaces::W + x] = on; } };

static int lit() { int n = 0; for (uint8_t p : frame) n += p; return n; }

int main() {
  const struct { uint8_t code; uint32_t ms; } reactions[] = {
    {1, 2000}, {2, 2200}, {3, 4500}, {4, 70000}, {5, 15000}, {6, 9000}, {7, 1500}, {8, 3600}, {9, 2400}, {11, 900}, {12, 2200}};
  for (const auto &r : reactions) for (uint32_t age = 0; age < r.ms; age += 10) {
    memset(frame, 0, sizeof frame);
    MiniFaces::Pen<Plot> pen{Plot{}};
    MiniFaces::reaction(pen, r.code, age, age, 7);
    if (lit() < 40) { printf("reaction %u at %u ms draws only %d pixels\n", r.code, age, lit()); return 1; }
  }
  const struct { uint8_t face; uint32_t ms; } locals[] = {
    {MiniFaces::STIR, MiniFaces::STIR_MS}, {MiniFaces::WHEE, MiniFaces::WHEE_MS}, {MiniFaces::DIZZY, MiniFaces::DIZZY_MS},
    {MiniFaces::GIGGLE, MiniFaces::GIGGLE_MS}, {MiniFaces::HUG, 10000},
    {MiniFaces::PROUD, MiniFaces::PROUD_MS}};
  for (const auto &l : locals) for (uint32_t t = 0; t < l.ms; t += 10) {
    memset(frame, 0, sizeof frame);
    MiniFaces::Pen<Plot> pen{Plot{}};
    MiniFaces::local(pen, l.face, t, t + 12345);
    if (lit() < 40) { printf("local face %u at %u ms draws only %d pixels\n", l.face, t, lit()); return 1; }
  }
  for (int dx = -16; dx <= 16; dx++) for (int dy = -8; dy <= 2; dy++) for (uint32_t now : {1000U, 4300U * 3 + 10}) {
    memset(frame, 0, sizeof frame);
    MiniFaces::Pen<Plot> pen{Plot{}};
    MiniFaces::look(pen, dx, dy, now);
    if (lit() < 40) { printf("look %d,%d draws only %d pixels\n", dx, dy, lit()); return 1; }
  }
  char face[16]; unsigned long age, now;
  while (scanf("%15s %lu %lu", face, &age, &now) == 3) {
    memset(frame, 0, sizeof frame);
    MiniFaces::Pen<Plot> pen{Plot{}};
    if (!strcmp(face, "sleeping")) MiniFaces::sleeping(pen, uint32_t(age));
    else MiniFaces::reaction(pen, uint8_t(atoi(face)), uint32_t(age), uint32_t(now), 0);
    for (uint8_t p : frame) putchar(p ? '1' : '0');
    putchar('\n');
  }
  return 0;
}
