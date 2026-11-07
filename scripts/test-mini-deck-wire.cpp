// Reads pocket frames as hex lines (made by src/pocketProtocol.ts in src/firmwareLearning.test.ts),
// feeds them to firmware/PrivetMini_v0.7/PocketDeck.h's Receiver and Deck, and prints each loaded card
// as "flags<TAB>russian<TAB>meaning", so the test can compare both sides of the wire.
#include <stdio.h>
#include <string.h>
#include "PocketDeck.h"
using namespace PocketDeck;

int main() {
  static Receiver r;
  static Deck d;
  char line[128];
  while (fgets(line, sizeof line, stdin)) {
    uint8_t frame[20]; uint8_t n = 0;
    for (char *p = line; p[0] && p[1] && p[0] != '\n' && n < 20; p += 2) { unsigned v; sscanf(p, "%2x", &v); frame[n++] = uint8_t(v); }
    const Receiver::Reply reply = r.receive(frame, n);
    if (reply.action == Receiver::SEND_ACK) { printf("ack %u %u\n", reply.ack[6], reply.ack[7]); return 1; }
    if (reply.action == Receiver::DECK_READY) {
      if (!d.load(reply.deck, r.count, r.body, r.length)) { puts("refused"); return 1; }
      printf("deck %u %u\n", unsigned(d.id), unsigned(d.count));
      for (uint8_t i = 0; i < d.count; i++) printf("%u\t%s\t%s\n", d.cards[i].flags, d.cards[i].russian, d.cards[i].meaning);
    }
  }
  return 0;
}
