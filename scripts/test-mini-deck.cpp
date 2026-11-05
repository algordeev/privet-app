// Host checks for firmware/PrivetMini_v0.7/PocketDeck.h: deck transfer (order, size, CRC, stray and
// broken frames), card validation, answers (first only, kept until CLEAR), the round order with missed
// cards once more, RESULT frames and the local day. Frames are built like src/pocketProtocol.ts.
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <vector>
#include "PocketDeck.h"
using namespace PocketDeck;

typedef std::vector<uint8_t> Bytes;
static void le32(Bytes &b, uint32_t v) { for (int i = 0; i < 4; i++) b.push_back(uint8_t(v >> (8 * i))); }
static Bytes head(uint8_t type, uint32_t id) { Bytes b = {2, type}; le32(b, id); return b; }
static Bytes body(const std::vector<std::pair<const char *, const char *>> &cards, bool englishFirst = false) {
  Bytes b;
  for (auto &c : cards) {
    b.push_back(englishFirst ? 1 : 0); b.push_back(uint8_t(strlen(c.first))); b.push_back(uint8_t(strlen(c.second)));
    b.insert(b.end(), c.first, c.first + strlen(c.first)); b.insert(b.end(), c.second, c.second + strlen(c.second));
  }
  return b;
}
static std::vector<Bytes> frames(uint32_t id, uint32_t deck, uint8_t count, const Bytes &b) {
  std::vector<Bytes> out;
  Bytes begin = head(BEGIN, id); le32(begin, deck); begin.push_back(count);
  begin.push_back(uint8_t(b.size())); begin.push_back(uint8_t(b.size() >> 8));
  const uint16_t c = crc16(b.data(), uint16_t(b.size())); begin.push_back(uint8_t(c)); begin.push_back(uint8_t(c >> 8));
  out.push_back(begin);
  for (size_t at = 0, i = 0; at < b.size(); at += DATA, i++) {
    const size_t n = b.size() - at < DATA ? b.size() - at : DATA;
    Bytes d = head(DATA_FRAME, id); d.push_back(uint8_t(i)); d.push_back(uint8_t(n)); d.insert(d.end(), b.begin() + at, b.begin() + at + n);
    out.push_back(d);
  }
  Bytes commit = head(COMMIT, id); commit.push_back(0); commit.push_back(0); out.push_back(commit);
  return out;
}
static Receiver::Reply feed(Receiver &r, const std::vector<Bytes> &all) {
  Receiver::Reply last;
  for (auto &f : all) { last = r.receive(f.data(), uint8_t(f.size())); if (last.action == Receiver::SEND_ACK) return last; }
  return last;
}

int main() {
  const Bytes three = body({{"кофе", "coffee"}, {"чай", "tea"}, {"Спасибо!", "Thank you!"}});
  {  // A deck arrives intact: COMMIT says DECK_READY with OK; the cards load whole.
    Receiver r; Deck d;
    const auto reply = feed(r, frames(5, 77, 3, three));
    assert(reply.action == Receiver::DECK_READY && reply.deck == 77 && reply.ack[1] == ACK && reply.ack[6] == COMMIT && reply.ack[7] == OK);
    assert(d.load(reply.deck, r.count, r.body, r.length));
    assert(d.valid() && d.id == 77 && d.count == 3 && d.left() == 3);
    assert(!strcmp(d.cards[0].russian, "кофе") && !strcmp(d.cards[2].meaning, "Thank you!") && !d.cards[1].englishFirst());
  }
  {  // Broken transfers are refused once, with REJECTED, and nothing loads.
    Receiver r;
    auto f = frames(5, 77, 3, three);
    auto bad = f; bad[2][8] ^= 1;  // a flipped byte: CRC
    assert(feed(r, bad).ack[7] == REJECTED);
    auto skip = f; skip.erase(skip.begin() + 2);  // a missing fragment: out of order
    const auto s = feed(r, skip); assert(s.action == Receiver::SEND_ACK && s.ack[6] == DATA_FRAME && s.ack[7] == REJECTED);
    auto early = f; early.erase(early.end() - 2);  // COMMIT before all bytes
    assert(feed(r, early).ack[7] == REJECTED);
    Bytes tooMany = head(BEGIN, 6); le32(tooMany, 1); tooMany.push_back(21); tooMany.push_back(10); tooMany.push_back(0); tooMany.push_back(0); tooMany.push_back(0);
    assert(r.receive(tooMany.data(), uint8_t(tooMany.size())).ack[7] == REJECTED);
    // A stray DATA frame of another transfer is ignored without a reply.
    Receiver q; feed(q, {f[0]}); Bytes stray = f[1]; stray[2] = 9;
    assert(q.receive(stray.data(), uint8_t(stray.size())).action == Receiver::NONE);
  }
  {  // Only drawable, well-sized cards load, and the body must hold exactly `count` cards.
    Deck d;
    const Bytes emoji = body({{"кофе \xE2\x98\x95", "coffee"}});
    assert(!d.load(1, 1, emoji.data(), uint16_t(emoji.size())));
    const Bytes empty = body({{"", "x"}}); assert(!d.load(1, 1, empty.data(), uint16_t(empty.size())));
    char longMeaning[34]; memset(longMeaning, 'w', 33); longMeaning[33] = 0;
    const Bytes tooLong = body({{"да", longMeaning}}); assert(!d.load(1, 1, tooLong.data(), uint16_t(tooLong.size())));
    assert(!d.load(1, 2, three.data(), uint16_t(three.size())) && !d.load(1, 4, three.data(), uint16_t(three.size())));
    Bytes badFlags = body({{"да", "yes"}}); badFlags[0] = 2; assert(!d.load(1, 1, badFlags.data(), uint16_t(badFlags.size())));
    const Bytes recall = body({{"да", "yes"}}, true);
    assert(d.load(1, 1, recall.data(), uint16_t(recall.size())) && d.cards[0].englishFirst());
    assert(d.count == 1 && !d.load(0, 1, recall.data(), uint16_t(recall.size())));
  }
  {  // A round: unanswered cards in order, a miss comes back once; only first answers count.
    Deck d; assert(d.load(7, 3, three.data(), uint16_t(three.size())));
    Round round; round.start(d);
    assert(round.length == 3 && round.current() == 0);
    round.answer(d, true, 20398);   // card 0 known
    round.answer(d, false, 20398);  // card 1 missed: comes back at the end
    round.answer(d, true, 20399);   // card 2 known
    assert(round.current() == 1);
    round.answer(d, true, 20399);   // card 1 again: does not change its answer
    assert(round.done() && d.answered == 3 && d.left() == 0);
    assert(d.answers[1].card == 1 && d.answers[1].knew == 0 && d.answers[1].day == 20398);
    // RESULT frames: one per answer, then CLEAR forgets the deck and its answers.
    uint8_t out[16];
    d.result(9, 1, out);
    assert(out[0] == 2 && out[1] == RESULT && u32(out + 2) == 9 && u32(out + 6) == 7 && out[10] == 1 && out[11] == 3 && out[12] == 1 && out[13] == 0 && u16(out + 14) == 20398);
    assert(!d.clear(8) && d.answered == 3);
    assert(d.clear(7) && d.answered == 0 && d.count == 0);
    Deck none; none.result(4, 0, out); assert(out[10] == 0 && out[11] == 0);
  }
  {  // A part-answered deck: a new deck is refused until the app has the answers (CLEAR), then loads.
    Deck d; assert(d.load(7, 3, three.data(), uint16_t(three.size())));
    Round round; round.start(d); round.answer(d, true, 1);
    const Bytes two = body({{"да", "yes"}, {"нет", "no"}});
    assert(!d.load(8, 2, two.data(), uint16_t(two.size())) && d.id == 7 && d.answered == 1);
    assert(d.clear(7) && d.count == 0 && d.answered == 0 && d.id == 0 && d.valid());
    Round empty; empty.start(d); assert(empty.done());
    assert(d.load(8, 2, two.data(), uint16_t(two.size())) && d.id == 8 && d.count == 2);
    // A sitting started later skips cards already answered.
    d.answer(0, true, 1); Round later; later.start(d); assert(later.length == 1 && later.current() == 1);
    // An unanswered deck can simply be replaced.
    Deck fresh; assert(fresh.load(8, 2, two.data(), uint16_t(two.size())) && fresh.load(9, 3, three.data(), uint16_t(three.size())) && fresh.id == 9);
  }
  {  // TIME, READ and CLEAR frames, sizes checked.
    Receiver r;
    Bytes time = head(TIME, 3); le32(time, 1762400000); time.push_back(0xD4); time.push_back(0xFE);  // -300
    auto t = r.receive(time.data(), uint8_t(time.size()));
    assert(t.action == Receiver::SET_TIME && t.time == 1762400000 && t.offset == -300 && t.ack[6] == TIME && t.ack[7] == OK);
    Bytes read = head(READ, 4); read.push_back(0); read.push_back(0);
    assert(r.receive(read.data(), uint8_t(read.size())).action == Receiver::SEND_RESULTS);
    Bytes clear = head(CLEAR, 5); le32(clear, 77);
    auto c = r.receive(clear.data(), uint8_t(clear.size())); assert(c.action == Receiver::CLEAR_ANSWERS && c.deck == 77);
    clear.pop_back(); assert(r.receive(clear.data(), uint8_t(clear.size())).ack[7] == BAD);
    Bytes far = head(TIME, 3); le32(far, 1); far.push_back(0x00); far.push_back(0x10);  // +4096 min
    assert(r.receive(far.data(), uint8_t(far.size())).ack[7] == BAD);
  }
  // Local day numbers match the app's (2026-11-06 is day 20763 since 1970-01-01).
  assert(localDay(1793923200, 0) == 20763);              // 2026-11-06 00:00 UTC
  assert(localDay(1793923200 - 1, 0) == 20762);
  assert(localDay(1793923200 - 3600, 120) == 20763);     // 23:00 UTC is already the 6th at UTC+2
  assert(localDay(1793923200 + 3600, -300) == 20762);    // 01:00 UTC is still the 5th at UTC-5
  puts("deck ok");
  return 0;
}
