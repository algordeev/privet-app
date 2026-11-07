#pragma once
#include <stdint.h>
#include <string.h>

// Pocket review deck: today's due review words, copied from the app, quizzed on the Mini off the phone,
// and the answers handed back on the next connection (src/pocketProtocol.ts has the app's side and the
// frame layouts). Pure logic with no BLE, flash or display code, so the host test
// (scripts/test-mini-deck.cpp) runs exactly this code.
//
// - Receiver: reassembles a deck from BEGIN / DATA / COMMIT frames and recognises TIME, READ and CLEAR.
// - Deck: the saved cards and the first answer to each (kept until the app is done with them: CLEAR).
// - Round: the order cards are asked in; a missed card comes back once at the end (only its first answer
//   counts).
namespace PocketDeck {

constexpr uint8_t CARDS = 20, RUSSIAN = 64, MEANING = 32, DATA = 12;
constexpr uint16_t BODY = CARDS * (3 + RUSSIAN + MEANING);
constexpr uint8_t ENGLISH_FIRST = 1;
constexpr uint32_t MAGIC = 0x50444B31;  // "PDK1": the flash layout version
enum Frame : uint8_t { TIME = 0x20, BEGIN = 0x21, DATA_FRAME = 0x22, COMMIT = 0x23, READ = 0x24, CLEAR = 0x25, ACK = 0xA0, RESULT = 0xA4 };
enum Result : uint8_t { OK = 0, BAD = 1, REJECTED = 2, STORAGE = 3 };

inline uint32_t u32(const uint8_t *p) { return uint32_t(p[0]) | uint32_t(p[1]) << 8 | uint32_t(p[2]) << 16 | uint32_t(p[3]) << 24; }
inline uint16_t u16(const uint8_t *p) { return uint16_t(p[0] | p[1] << 8); }
inline void put32(uint8_t *p, uint32_t v) { for (int i = 0; i < 4; i++) p[i] = uint8_t(v >> (8 * i)); }
inline uint16_t crc16(const uint8_t *bytes, uint16_t n) {
  uint16_t crc = 0xFFFF;
  for (uint16_t i = 0; i < n; i++) {
    crc ^= uint16_t(bytes[i]) << 8;
    for (int b = 0; b < 8; b++) crc = crc & 0x8000 ? uint16_t(crc << 1 ^ 0x1021) : uint16_t(crc << 1);
  }
  return crc;
}
// Russian and meanings hold printable ASCII and Cyrillic (D0/D1 lead bytes) only, like learning cards.
inline bool drawable(const uint8_t *s, uint8_t n) {
  for (uint8_t i = 0; i < n; i++) {
    const uint8_t c = s[i];
    if (c >= 0x20 && c < 0x7F) continue;
    if ((c == 0xD0 || c == 0xD1) && i + 1 < n && (s[i + 1] & 0xC0) == 0x80) { i++; continue; }
    return false;
  }
  return n > 0;
}

struct Card {
  uint8_t flags;
  char russian[RUSSIAN + 1];
  char meaning[MEANING + 1];
  bool englishFirst() const { return flags & ENGLISH_FIRST; }
};
struct Answer {
  uint8_t card, knew;
  uint16_t day;  // local day number (days since 1970-01-01), 0 if the clock was unknown
};

// Plain data, saved to flash as one blob.
struct Deck {
  uint32_t magic = MAGIC, id = 0;
  uint8_t count = 0, answered = 0;
  Card cards[CARDS] = {};
  Answer answers[CARDS] = {};

  bool valid() const { return magic == MAGIC && count <= CARDS && answered <= count && (count ? id != 0 : true); }
  bool has(uint8_t card) const {
    for (uint8_t i = 0; i < answered; i++) if (answers[i].card == card) return true;
    return false;
  }
  uint8_t left() const { return uint8_t(count - answered); }
  // The first answer to each card counts; later ones (a missed card asked again) do not.
  bool answer(uint8_t card, bool knew, uint16_t day) {
    if (card >= count || has(card)) return false;
    answers[answered++] = {card, uint8_t(knew ? 1 : 0), day};
    return true;
  }
  // Replaces the deck with a received body. Refused while answers to another deck are still waiting for
  // the app (they would be lost), or if the body does not hold exactly `n` valid cards.
  bool load(uint32_t newId, uint8_t n, const uint8_t *body, uint16_t length) {
    if (!newId || !n || n > CARDS || (answered && newId != id)) return false;
    Deck next;
    next.id = newId;
    uint16_t at = 0;
    for (uint8_t i = 0; i < n; i++) {
      if (at + 3 > length) return false;
      const uint8_t flags = body[at], r = body[at + 1], m = body[at + 2];
      at += 3;
      if (flags & ~ENGLISH_FIRST || !r || r > RUSSIAN || !m || m > MEANING || at + r + m > length) return false;
      if (!drawable(body + at, r) || !drawable(body + at + r, m)) return false;
      Card &c = next.cards[i];
      c.flags = flags;
      memcpy(c.russian, body + at, r); c.russian[r] = 0;
      memcpy(c.meaning, body + at + r, m); c.meaning[m] = 0;
      at += r + m;
    }
    if (at != length) return false;
    next.count = n;
    if (answered && newId == id) { memcpy(next.answers, answers, sizeof answers); next.answered = answered; }
    *this = next;
    return true;
  }
  // The app has saved the answers to this deck and is done with it: forget the deck and its answers
  // (the app sends today's new deck straight after).
  bool clear(uint32_t deckId) {
    if (!deckId || deckId != id) return false;
    *this = Deck();
    return true;
  }
  // RESULT frame `part` of `parts` (parts = answered; one empty frame when there is nothing to report).
  void result(uint32_t requestId, uint8_t part, uint8_t out[16]) const {
    memset(out, 0, 16);
    out[0] = 2; out[1] = RESULT;
    put32(out + 2, requestId); put32(out + 6, id);
    out[10] = answered ? part : 0; out[11] = answered;
    if (answered && part < answered) {
      out[12] = answers[part].card; out[13] = answers[part].knew;
      out[14] = uint8_t(answers[part].day); out[15] = uint8_t(answers[part].day >> 8);
    }
  }
};

// The order of one sitting: every unanswered card, then each card missed in it once more.
struct Round {
  uint8_t order[CARDS * 2] = {}, length = 0, at = 0;
  void start(const Deck &deck) {
    length = at = 0;
    for (uint8_t i = 0; i < deck.count; i++) if (!deck.has(i)) order[length++] = i;
  }
  bool done() const { return at >= length; }
  int current() const { return done() ? -1 : order[at]; }
  // Records the answer (first one only) and moves on; a miss comes back at the end, once.
  void answer(Deck &deck, bool knew, uint16_t day) {
    if (done()) return;
    const uint8_t card = order[at];
    const bool first = deck.answer(card, knew, day);
    if (!knew && first && length < sizeof order) order[length++] = card;
    at++;
  }
};

// Reassembles a deck and recognises the other pocket frames. receive() returns what to do; the caller
// does the work (saving, the clock, sending results) and sends the ACK.
struct Receiver {
  enum Action : uint8_t { NONE, SEND_ACK, DECK_READY, SET_TIME, SEND_RESULTS, CLEAR_ANSWERS };
  struct Reply {
    Action action = NONE;
    uint8_t ack[8] = {};
    uint32_t time = 0, deck = 0;
    int16_t offset = 0;
  };
  bool open = false;
  uint32_t request = 0, deck = 0;
  uint8_t count = 0, next = 0;
  uint16_t length = 0, crc = 0, got = 0;
  uint8_t body[BODY] = {};

  static void ackFor(Reply &r, uint32_t id, uint8_t type, uint8_t result) {
    r.ack[0] = 2; r.ack[1] = ACK; put32(r.ack + 2, id); r.ack[6] = type; r.ack[7] = result;
  }
  // A failed transfer is answered once and forgotten; the app sends a whole new deck later.
  Reply fail(uint32_t id, uint8_t type, uint8_t result) {
    open = false;
    Reply r; r.action = SEND_ACK; ackFor(r, id, type, result);
    return r;
  }
  Reply receive(const uint8_t *p, uint8_t n) {
    Reply r;
    if (n < 8 || p[0] != 2) return r;
    const uint8_t type = p[1];
    const uint32_t id = u32(p + 2);
    if (!id) return r;
    switch (type) {
      case TIME:
        if (n != 12) return fail(id, type, BAD);
        r.action = SET_TIME; r.time = u32(p + 6); r.offset = int16_t(u16(p + 10));
        if (r.offset < -14 * 60 || r.offset > 14 * 60) return fail(id, type, BAD);
        ackFor(r, id, type, OK);
        return r;
      case BEGIN:
        if (n != 15 || !u32(p + 6) || !p[10] || p[10] > CARDS || !u16(p + 11) || u16(p + 11) > BODY) return fail(id, type, REJECTED);
        open = true; request = id; deck = u32(p + 6); count = p[10]; length = u16(p + 11); crc = u16(p + 13); got = 0; next = 0;
        return r;
      case DATA_FRAME: {
        const uint8_t size = p[7];
        if (!open || id != request) return r;  // a stray fragment of an old transfer
        if (p[6] != next || !size || size > DATA || n != 8 + size || got + size > length) return fail(id, type, REJECTED);
        memcpy(body + got, p + 8, size); got += size; next++;
        return r;
      }
      case COMMIT:
        if (n != 8) return fail(id, type, BAD);
        if (!open || id != request || got != length || crc16(body, length) != crc) return fail(id, type, REJECTED);
        open = false;
        r.action = DECK_READY; r.deck = deck;
        ackFor(r, id, type, OK);  // the caller changes the result if the deck is refused or not saved
        return r;
      case READ:
        if (n != 8) return fail(id, type, BAD);
        r.action = SEND_RESULTS; ackFor(r, id, type, OK);
        return r;
      case CLEAR:
        if (n != 10) return fail(id, type, BAD);
        r.action = CLEAR_ANSWERS; r.deck = u32(p + 6); ackFor(r, id, type, OK);
        return r;
      default:
        return r;
    }
  }
};

// Local day number from Unix seconds and the learner's offset from UTC in minutes.
inline uint16_t localDay(uint32_t unixSeconds, int16_t offsetMinutes) {
  const int64_t local = int64_t(unixSeconds) + int64_t(offsetMinutes) * 60;
  return local > 0 ? uint16_t(local / 86400) : 0;
}

}  // namespace PocketDeck
