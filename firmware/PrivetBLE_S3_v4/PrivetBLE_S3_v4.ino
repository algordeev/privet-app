/* Privet v2 companion: BLE faces + negotiated learning cards + pan/tilt head.
 * v4: DFPlayer Mini sound effects for reactions (UART1: RX GPIO18, TX GPIO17,
 * BUSY GPIO16); files /mp3/NNNN.mp3 on the SD card, see the sound table below.
 * Target: ESP32-S3-DevKitC-1 N16R8, Arduino-ESP32 3.x, built-in BLE library.
 * 1.3" SH1106 OLED on SPI; pan servo GPIO4, tilt servo GPIO5 (SG90 or MG90S)
 * on ~5V with common GND. Pinout matches pcb/privet-v2-kicad-spec.md.
 * Head angles, limits and gestures are in degrees: see the tuning block in ServoMotion.h.
 * No Wi-Fi, BLE audio, bonding, or background reaction queue.
 * Required: U8g2, DFRobotDFPlayerMini. Servos use the core's LEDC PWM directly.
 * Command: [1, 1, request-id uint32 LE, command, argument]
 * ACK:     [1, 2, same request-id, same command, result]
 * Commands: 1 HAPPY, 2 ENCOURAGE, 3 CELEBRATE, 4 IDLE, 5 LISTENING,
 * 6 THINKING, 7 HINT, 8 STREAK, 9 CONNECTED, 11 NOD, 12 ON_FIRE
 * (11-12 advertised by capability bit 8). Argument 0, except ON_FIRE: the combo.
 * ACK result: 0 accepted, 1 unsupported command, 2 invalid argument.
 * Separate control code 10 negotiates bounded v2 cards; see LearningCards.h
 * and docs/companion-ble.md. No partial content is drawn.
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <atomic>
#include <SPI.h>
#include <U8g2lib.h>
#include <DFRobotDFPlayerMini.h>
#include "LearningCards.h"
#include "FacePresentation.h"
#include "ServoMotion.h"
#include "LearningLayout.h"
#include "DisplayRefresh.h"
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

// OLED wiring (7-pin SH1106 SPI): GND, VCC -> 3V3, SCK -> GPIO12,
// SDA (MOSI) -> GPIO11, RES -> GPIO14, DC -> GPIO13, CS -> GPIO10.
// Use U8G2_R2 instead of U8G2_R0 if the face appears upside down.
static constexpr int OLED_SCK = 12, OLED_MOSI = 11, OLED_CS = 10, OLED_DC = 13, OLED_RES = 14;
// Small geometry adapter preserves the existing face drawing coordinates.
static U8G2_SH1106_128X64_NONAME_F_4W_HW_SPI oled(U8G2_R0, OLED_CS, OLED_DC, OLED_RES);
static constexpr uint8_t SSD1306_WHITE=1, SSD1306_BLACK=0;
static void presentFrame();
struct FaceCanvas {
 void clearDisplay(){oled.clearBuffer();} void display(){presentFrame();}
 void fillRoundRect(int x,int y,int w,int h,int r,int c){
  if(w<=0||h<=0)return;
  r=PrivetFaces::roundedRadius(w,h,r);oled.setDrawColor(c);
  if(r)oled.drawRBox(x,y,w,h,r);else oled.drawBox(x,y,w,h);
 }
 void fillRect(int x,int y,int w,int h,int c){oled.setDrawColor(c);oled.drawBox(x,y,w,h);}
 void fillCircle(int x,int y,int r,int c){oled.setDrawColor(c);oled.drawDisc(x,y,r);}
 void drawCircle(int x,int y,int r,int c){oled.setDrawColor(c);oled.drawCircle(x,y,r);}
 void drawLine(int x,int y,int a,int b,int c){oled.setDrawColor(c);oled.drawLine(x,y,a,b);}
 void drawFastHLine(int x,int y,int w,int c){oled.setDrawColor(c);oled.drawHLine(x,y,w);}
 void drawFastVLine(int x,int y,int h,int c){oled.setDrawColor(c);oled.drawVLine(x,y,h);}
} display;
static PrivetCards::Receiver cards;
static portMUX_TYPE cardsMux=portMUX_INITIALIZER_UNLOCKED;
static uint32_t connectionNonce=0;
static std::atomic<uint32_t> latestFaceId{0};
static bool oledReady = false;
static std::atomic<bool> phoneConnected{false};
static PrivetFaces::WakeTransition wakeTransition;

// One latest-state mailbox, not an animation queue. Low byte is the command;
// upper bits are a revision so even repeated commands restart the timer.
// BLE callbacks are the sole producer; loop() only reads this atomic value.
static std::atomic<uint32_t> faceMailbox{4};
// ON_FIRE's argument: the answer combo (first tries in a row) shown on the face.
// Stored before the mailbox is published, so loop() sees it with the reaction.
static std::atomic<uint8_t> fireCombo{0};

enum Reaction : uint8_t {
  HAPPY = 1,
  ENCOURAGE = 2,
  CELEBRATE = 3,
  IDLE = 4,
  LISTENING = 5,
  THINKING = 6,
  HINT = 7,
  STREAK = 8,
  CONNECTED = 9,
  // Code 10 is the capability control command, not a reaction.
  NOD = 11,
  ON_FIRE = 12
};

// ---- Sound (v4) ----
// Which file in /mp3 on the SD card each reaction plays: 4 plays /mp3/0004.mp3.
// The files come from firmware/sounds. Reactions not listed are silent:
// LISTENING because the phone is speaking a Russian word, THINKING because it
// is the resting state of a question, and IDLE.
struct ReactionSound { uint8_t reaction; uint16_t track; };
static constexpr ReactionSound REACTION_SOUNDS[] = {
  {CONNECTED, 12},  // wake-up chirp
  {HAPPY,      4},  // happy chirp
  {ENCOURAGE,  5},  // soft "aww" with a hopeful lift
  {CELEBRATE,  6},  // jingle
  {HINT,       7},  // "aha!"
  {STREAK,     8},  // fanfare
  {NOD,        9},  // tiny tick
  {ON_FIRE,   10},  // excited warble and chime
};

// DFPlayer volume, 0-30. The speaker is only 0.5 W, so it never goes above 22.
static constexpr uint8_t SOUND_VOLUME = 18;
static_assert(SOUND_VOLUME <= 22, "SOUND_VOLUME above 22 overdrives the 0.5 W speaker");
// A new sound replaces the one playing, but no sooner than this after the last
// one started; a request inside the window waits for it (the latest one wins),
// so rapid commands such as a NOD for every match pair don't stutter.
static constexpr uint32_t SOUND_COOLDOWN_MS = 250;
// The DFPlayer ignores commands for a moment after power-up.
static constexpr uint32_t SOUND_POWER_UP_MS = 1500;
// DFPlayer TX -> GPIO18 (ESP32 RX); DFPlayer RX <- GPIO17 through ~1 kOhm;
// BUSY -> GPIO16, LOW while playing.
static constexpr int SOUND_RX_PIN = 18, SOUND_TX_PIN = 17, SOUND_BUSY_PIN = 16;

static void requestFace(uint8_t reaction) {
  const uint32_t previous = faceMailbox.load();
  faceMailbox.store(((previous + 256U) & 0xFFFFFF00U) | reaction);
}

static const char *reactionName(uint8_t reaction) {
  switch (reaction) {
    case HAPPY: return "happy";
    case ENCOURAGE: return "encourage";
    case CELEBRATE: return "celebrate";
    case LISTENING: return "listening";
    case THINKING: return "thinking";
    case HINT: return "hint";
    case STREAK: return "streak";
    case CONNECTED: return "connected";
    case NOD: return "nod";
    case ON_FIRE: return "on fire";
    default: return "idle";
  }
}

static uint32_t reactionDuration(uint8_t reaction) {
  switch (reaction) {
    case HAPPY: return 2000;
    case ENCOURAGE: return 2200;
    case CELEBRATE: return 4500;
    // LISTENING lasts as long as the audio: the app ends it when speech finishes.
    // This is only a safety cap in case that message never arrives.
    case LISTENING: return 15000;

    // THINKING remains active until another command replaces it.
    case THINKING: return 0;

    case HINT: return 1500;
    case STREAK: return 3600;
    case CONNECTED: return 2400;
    // A correct match pair; the question continues, so NOD returns to THINKING.
    case NOD: return 900;
    case ON_FIRE: return 2200;
    default: return 0;
  }
}

// Servos are controlled only by loop(), never inside BLE callbacks.
// Set false to keep BLE/OLED available while testing power or wiring.
static constexpr bool SERVO_ENABLED = true;
static constexpr bool TILT_ENABLED = true;
// Flip if "up" on your tilt joint moves the head down. True on the owner's v2
// head: sleep droops and the wake-up nod lifts, as intended.
static constexpr bool TILT_INVERTED = true;
// Flip if the head turns away from the side the eyes look to.
static constexpr bool PAN_INVERTED = false;
static constexpr int PAN_PIN = 4;
static constexpr int TILT_PIN = 5;
static constexpr int SERVO_CENTER_US = 1500;

// Head speed (degrees per second) and acceleration (degrees per second squared).
// Lower SPEED for calmer movement; lower ACCEL for softer starts and stops.
// PERKY: happy, celebrate, hint, nod, on fire. GENTLE: encourage, sleep and
// settling back to rest. NORMAL: connected and streak.
// Slow, tiny steps make loaded SG90s buzz without visibly moving, so even
// GENTLE stays reasonably brisk.
static constexpr float SERVO_SPEED_DEG_S = 50.0f;
static constexpr float SERVO_ACCEL_DEG_S2 = 225.0f;
static constexpr float SERVO_PERKY_SPEED_DEG_S = 80.0f;
static constexpr float SERVO_PERKY_ACCEL_DEG_S2 = 540.0f;
static constexpr float SERVO_GENTLE_SPEED_DEG_S = 32.0f;
static constexpr float SERVO_GENTLE_ACCEL_DEG_S2 = 180.0f;
static constexpr uint32_t SERVO_TICK_MS = 20;  // one PWM period
// How far (degrees) the head turns when it follows the eyes' idle glance.
static constexpr int IDLE_GLANCE_DEG = 5;

// PWM is released once an axis has reached the end of its gesture and stayed
// still this long, so idle servos are silent instead of humming. It comes back
// at the last commanded pulse when the next gesture needs motion. There is no
// position feedback: if the head was pushed while released, it returns there
// (smoothly limited only from the re-attach point onward).
static constexpr uint32_t SERVO_RELEASE_AFTER_MS = 300;

// Each servo owns one LEDC channel for the whole run; "release" is duty 0
// (line held low, no pulses), never a detach. ESP32Servo on the S3 hands out
// MCPWM outputs by count when re-attaching, so after one servo was released
// both pins could end up on the same output: the tilt then followed the pan's
// pulse (e.g. 1700 us during HAPPY) and the head shot to its top position.
static constexpr uint32_t SERVO_PWM_HZ = 50;
static constexpr uint8_t SERVO_PWM_BITS = 14;
static constexpr uint32_t SERVO_PERIOD_US = 1000000UL / SERVO_PWM_HZ;

static constexpr uint32_t AMBIENT_WINDOW_MS = 60000;

// One axis: gesture path -> smooth follower -> PWM. Pulses are logical
// (1500 = centre); the tilt axis can be mirrored at the pin.
struct ServoAxis {
  const char *name;
  int pin;
  bool enabled;
  bool inverted;
  PrivetMotion::Axis axis;
  PrivetMotion::Follower follower;
  int writtenUs = -1;
  int fromUs = SERVO_CENTER_US;
  uint32_t lastStep = 0;
  uint32_t settledAt = 0;
  bool settling = false;
  bool ready = false;      // LEDC channel attached (once, in begin())
  bool energized = false;  // pulses currently being sent

  ServoAxis(const char *n, int p, bool e, bool inv, PrivetMotion::Axis a)
    : name(n), pin(p), enabled(e), inverted(inv), axis(a) {}

  bool active() const { return SERVO_ENABLED && enabled && ready; }

  void write(int pulse) {
    if (pulse == writtenUs) return;  // identical pulses add nothing but noise
    writtenUs = pulse;
    // pulse is already inside this axis's limits; only a mirrored mount flips it.
    const int out = inverted ? 2 * SERVO_CENTER_US - pulse : pulse;
    ledcWrite(pin, (uint32_t(out) << SERVO_PWM_BITS) / SERVO_PERIOD_US);
  }

  bool energize(uint32_t now) {
    if (energized) return true;
    // Resume exactly at the last commanded pulse; no position feedback exists.
    energized = true;
    writtenUs = -1;
    write(int(follower.position + 0.5f));
    lastStep = now;
    return true;
  }

  void release() {
    ledcWrite(pin, 0);
    energized = false;
    writtenUs = -1;
  }

  // Called once from setup(): the only intentional jump, to the resting pose at power-on.
  void begin(uint32_t now) {
    follower.limits(axis);
    follower.reset(PrivetMotion::home(axis));
    if (!SERVO_ENABLED || !enabled) return;
    ready = ledcAttach(pin, SERVO_PWM_HZ, SERVO_PWM_BITS);
    if (!ready) {
      Serial.printf("[SERVO] %s PWM setup failed; BLE/OLED continue.\n", name);
      return;
    }
    energize(now);
  }

  void start() {
    // Every gesture path begins at the follower's current position.
    // update() re-attaches PWM within one tick if this gesture needs it.
    fromUs = int(follower.position + 0.5f);
    settling = false;
  }

  // offset: extra pulse on top of the gesture (the idle glance on the pan axis).
  void update(uint8_t motion, uint32_t started, uint32_t now, int offset) {
    if (!active()) return;

    const uint32_t elapsed = uint32_t(now - lastStep);
    if (elapsed < SERVO_TICK_MS) return;
    lastStep = now;

    const uint32_t age = uint32_t(now - started);
    const int target = PrivetMotion::clampPulse(axis, PrivetMotion::target(axis, motion, age, fromUs) + offset);

    if (!energized) {
      // Stay silent until the gesture path actually leaves the resting pulse.
      if (follower.settled(float(target))) return;
      energize(now);
    }

    const float dt = (elapsed > 100 ? 100 : elapsed) / 1000.0f;
    const PrivetMotion::Style style = PrivetMotion::style(motion);
    const float speed = PrivetMotion::US_PER_DEGREE * (style == PrivetMotion::PERKY ? SERVO_PERKY_SPEED_DEG_S : style == PrivetMotion::GENTLE ? SERVO_GENTLE_SPEED_DEG_S : SERVO_SPEED_DEG_S);
    const float accel = PrivetMotion::US_PER_DEGREE * (style == PrivetMotion::PERKY ? SERVO_PERKY_ACCEL_DEG_S2 : style == PrivetMotion::GENTLE ? SERVO_GENTLE_ACCEL_DEG_S2 : SERVO_ACCEL_DEG_S2);
    write(follower.step(float(target), dt, speed, accel));

    const bool resting =
      age >= PrivetMotion::gestureEnd(axis, motion) &&
      follower.settled(float(target));

    if (!resting) {
      settling = false;
      return;
    }
    if (!settling) {
      settling = true;
      settledAt = now;
    }
    if (uint32_t(now - settledAt) >= SERVO_RELEASE_AFTER_MS) {
      release();
      settling = false;
      Serial.printf("[SERVO] %s still; PWM released.\n", name);
    }
  }
};

static ServoAxis panServo("pan", PAN_PIN, true, PAN_INVERTED, PrivetMotion::PAN);
static ServoAxis tiltServo("tilt", TILT_PIN, TILT_ENABLED, TILT_INVERTED, PrivetMotion::TILT);
static uint8_t servoReaction = IDLE;  // the gesture playing (a reaction, or SLEEP)
static uint32_t servoStarted = 0;
static int servoGlanceUs = 0;         // set by updateOLED() while the face glances

static void startServoReaction(uint8_t reaction, uint32_t now) {
  servoReaction = reaction;
  servoStarted = now;
  servoGlanceUs = 0;
  panServo.start();
  tiltServo.start();
}

static void updateServo(uint32_t now) {
  panServo.update(servoReaction, servoStarted, now, servoReaction == IDLE ? servoGlanceUs : 0);
  tiltServo.update(servoReaction, servoStarted, now, 0);
}

// The DFPlayer, like the servos and the display, is driven only from loop().
// It runs without ACKs, so no command waits for a reply; the library still
// pauses 10 ms after sending each one.
static HardwareSerial soundSerial(1);
static DFRobotDFPlayerMini dfPlayer;
static bool soundReady = false;
static uint16_t soundPending = 0;  // track waiting for the cooldown, 0 = none
static uint16_t soundTrackPlaying = 0;
static uint32_t soundStartedAt = 0;
static bool soundBusy = false;     // last BUSY reading, to log when a track ends
// BUSY goes LOW only shortly after a play command, so a just-started track
// counts as playing for this long even if BUSY is still HIGH.
static constexpr uint32_t SOUND_BUSY_DELAY_MS = 300;

static uint16_t reactionTrack(uint8_t reaction) {
  for (const ReactionSound &sound : REACTION_SOUNDS)
    if (sound.reaction == reaction) return sound.track;
  return 0;
}

static bool soundPlaying(uint32_t now) {
  return digitalRead(SOUND_BUSY_PIN) == LOW ||
         (soundTrackPlaying && uint32_t(now - soundStartedAt) < SOUND_BUSY_DELAY_MS);
}

static void stopSound(uint32_t now, const char *why) {
  soundPending = 0;
  if (!soundReady || !soundPlaying(now)) return;
  dfPlayer.stop();
  Serial.printf("[SOUND] Stopped %04u.mp3 (%s).\n", unsigned(soundTrackPlaying), why);
  soundTrackPlaying = 0;
}

// Called when a reaction starts on the face. LISTENING silences the robot at
// once, because the phone is about to speak; a reaction without a sound
// cancels one still waiting for the cooldown but lets a playing one finish.
static void requestSound(uint8_t reaction, uint32_t now) {
  if (!soundReady) return;
  if (reaction == LISTENING) {
    stopSound(now, "phone speaking");
    return;
  }
  soundPending = reactionTrack(reaction);
}

static void updateSound(uint32_t now) {
  if (!soundReady) return;
  // Read the module's own messages without waiting; only errors matter.
  if (dfPlayer.available()) {
    const uint8_t type = dfPlayer.readType();
    const uint16_t value = dfPlayer.read();
    if (type == DFPlayerError) Serial.printf("[SOUND] DFPlayer error %u (6 = file not found in /mp3).\n", unsigned(value));
    else if (type == DFPlayerCardRemoved) Serial.println("[SOUND] SD card removed.");
  }
  const bool busy = digitalRead(SOUND_BUSY_PIN) == LOW;
  if (soundBusy && !busy && soundTrackPlaying) {
    Serial.printf("[SOUND] Finished %04u.mp3.\n", unsigned(soundTrackPlaying));
    soundTrackPlaying = 0;
  }
  soundBusy = busy;

  if (!soundPending || (soundStartedAt && uint32_t(now - soundStartedAt) < SOUND_COOLDOWN_MS)) return;
  // Starting a track replaces the one playing; no stop is needed first.
  dfPlayer.playMp3Folder(soundPending);
  Serial.printf("[SOUND] Playing /mp3/%04u.mp3.\n", unsigned(soundPending));
  soundTrackPlaying = soundPending;
  soundPending = 0;
  soundStartedAt = now ? now : 1;
}

// Runs once in setup(), after BLE is advertising, so the wait for the module
// never delays BLE. Without the module or a readable SD card, sound stays off
// and everything else works as before.
static void setupSound() {
  pinMode(SOUND_BUSY_PIN, INPUT_PULLUP);
  soundSerial.begin(9600, SERIAL_8N1, SOUND_RX_PIN, SOUND_TX_PIN);
  while (millis() < SOUND_POWER_UP_MS) delay(10);

  // Resets the module and waits up to 2 s for it to announce the SD card.
  dfPlayer.begin(soundSerial, false, true);
  const uint8_t announced = dfPlayer.readType();
  // Some clones don't announce the card; asking for the file count (up to
  // 0.5 s per try) also proves the module answers and the card is readable.
  int files = -1;
  bool answered = announced != TimeOut;
  for (int attempt = 0; attempt < 2 && files <= 0; attempt++) {
    files = dfPlayer.readFileCounts(DFPLAYER_DEVICE_SD);
    if (dfPlayer.readType() != TimeOut) answered = true;
  }

  if (announced != DFPlayerCardOnline && files <= 0) {
    Serial.println(answered
      ? "[SOUND] DFPlayer found, but no readable SD card with files; sound disabled."
      : "[SOUND] No reply from the DFPlayer (check power, GPIO17/18 wiring); sound disabled.");
    return;
  }
  dfPlayer.volume(SOUND_VOLUME);
  soundReady = true;
  soundBusy = digitalRead(SOUND_BUSY_PIN) == LOW;
  if (files > 0) Serial.printf("[SOUND] DFPlayer ready: %d files on the SD card, volume %u/30.\n", files, unsigned(SOUND_VOLUME));
  else Serial.printf("[SOUND] DFPlayer ready, volume %u/30.\n", unsigned(SOUND_VOLUME));
}

// Only send changed tile spans; static cards no longer rewrite all eight rows.
// Preserve short servo service intervals without a separate writer or task.
static PrivetDisplay::Refresh displayRefresh;
static void presentFrame(){
 displayRefresh.present(oled.getBufferPtr(),[](uint8_t x,uint8_t row,uint8_t width,const uint8_t *data){
  updateServo(millis());
  u8x8_DrawTile(oled.getU8x8(),x,row,width,const_cast<uint8_t*>(data));
 });
 updateServo(millis());
}

static void drawSparkle(int x, int y, int radius) {
  display.drawFastHLine(
    x - radius,
    y,
    radius * 2 + 1,
    SSD1306_WHITE
  );

  display.drawFastVLine(
    x,
    y - radius,
    radius * 2 + 1,
    SSD1306_WHITE
  );
}

static void drawSleepingFace(uint32_t age) {
  // Very small breathing motion; the servo stays detached and silent.
  const uint32_t breathPhase = age % 3200U;

  const int breathe =
    breathPhase < 1600U
      ? int(breathPhase / 800U)
      : int((3200U - breathPhase) / 800U);

  // Closed, relaxed eyes.
  for (int thickness = 0; thickness < 2; ++thickness) {
    display.drawLine(
      28,
      26 + breathe + thickness,
      37,
      29 + breathe + thickness,
      SSD1306_WHITE
    );

    display.drawLine(
      37,
      29 + breathe + thickness,
      47,
      26 + breathe + thickness,
      SSD1306_WHITE
    );

    display.drawLine(
      80,
      26 + breathe + thickness,
      90,
      29 + breathe + thickness,
      SSD1306_WHITE
    );

    display.drawLine(
      90,
      29 + breathe + thickness,
      99,
      26 + breathe + thickness,
      SSD1306_WHITE
    );
  }

  // Small sleeping mouth.
  display.drawCircle(
    64,
    46 + breathe,
    3,
    SSD1306_WHITE
  );

  // Three rising sleep bubbles.
  const uint8_t bubbleCount =
    1 + uint8_t((age / 650U) % 3U);

  if (bubbleCount >= 1) {
    display.drawCircle(102, 23, 1, SSD1306_WHITE);
  }

  if (bubbleCount >= 2) {
    display.drawCircle(108, 16, 2, SSD1306_WHITE);
  }

  if (bubbleCount >= 3) {
    display.drawCircle(116, 8, 3, SSD1306_WHITE);
  }
}

// All display drawing runs in loop(), never inside BLE callbacks.
static void drawFace(
  bool connected,
  uint8_t reaction,
  bool blink,
  uint32_t age
) {
  display.clearDisplay();

  if (!connected) {
    drawSleepingFace(age);
    display.fillCircle(122, 4, 1, SSD1306_WHITE);
    display.display();
    return;
  }

  const bool joyful =
    reaction == HAPPY ||
    reaction == CELEBRATE ||
    reaction == STREAK ||
    reaction == NOD ||
    reaction == ON_FIRE;

  const int bob =
    reaction == CELEBRATE || reaction == STREAK || reaction == ON_FIRE
      ? ((age / 180U) % 2U ? -1 : 1)
      : 0;

  // Gentle droop and recovery during ENCOURAGE.
  const int sadShift =
    reaction != ENCOURAGE ? 0 :
    age < 800U ? int(age / 400U) :
    age < 1400U ? 2 :
    age < 2200U ? int((2200U - age) / 400U) :
    0;

  // The head follows the same glance (see updateOLED()).
  const int look =
    reaction == IDLE && connected && age < AMBIENT_WINDOW_MS
      ? PrivetMotion::glance(age) * 5 / 1000
      : 0;

  if (joyful) {
    for (int x : {28, 80}) {
      for (int thickness = 0;
           thickness < 3;
           ++thickness) {
        display.drawLine(
          x,
          27 + bob + thickness,
          x + 7,
          19 + bob + thickness,
          SSD1306_WHITE
        );

        display.drawLine(
          x + 7,
          19 + bob + thickness,
          x + 13,
          19 + bob + thickness,
          SSD1306_WHITE
        );

        display.drawLine(
          x + 13,
          19 + bob + thickness,
          x + 20,
          27 + bob + thickness,
          SSD1306_WHITE
        );
      }
    }
  } else if (reaction == ENCOURAGE) {
    for (int thickness = 0;
         thickness < 3;
         ++thickness) {
      display.drawLine(
        28,
        29 + sadShift + thickness,
        47,
        24 + sadShift + thickness,
        SSD1306_WHITE
      );

      display.drawLine(
        80,
        24 + sadShift + thickness,
        99,
        29 + sadShift + thickness,
        SSD1306_WHITE
      );
    }
  } else if (reaction == HINT) {
    display.fillRoundRect(
      28, 14, 20, 23, 6, SSD1306_WHITE
    );

    display.fillRoundRect(
      80, 26, 20, 3, 1, SSD1306_WHITE
    );
  } else if (
    reaction == CONNECTED &&
    age < 500U
  ) {
    const int height =
      3 + int(age) * 20 / 500;

    display.fillRoundRect(
      28,
      37 - height,
      20,
      height,
      5,
      SSD1306_WHITE
    );

    display.fillRoundRect(
      80,
      37 - height,
      20,
      height,
      5,
      SSD1306_WHITE
    );
  } else if (blink) {
    display.fillRoundRect(
      28 + look,
      26,
      20,
      3,
      1,
      SSD1306_WHITE
    );

    display.fillRoundRect(
      80 + look,
      26,
      20,
      3,
      1,
      SSD1306_WHITE
    );
  } else {
    int stateLook =
      reaction == LISTENING ? -2 : look;

    int eyeY = 14;

    if (reaction == THINKING) {
      // Begin at the neutral-eye position, then ease into a
      // subtle repeating side/up glance.
      const uint32_t enterAge =
        age < uint32_t(600)
          ? age
          : uint32_t(600);

      const uint32_t cycle =
        age % 3600U;

      const int drift =
        cycle < 1800U
          ? int(cycle) * 2 / 1800
          : int(3600U - cycle) * 2 / 1800;

      stateLook =
        int(enterAge) * (3 + drift) / 600;

      eyeY =
        14 - int(enterAge) * 2 / 600;
    }

    display.fillRoundRect(
      28 + stateLook,
      eyeY,
      20,
      23,
      6,
      SSD1306_WHITE
    );

    display.fillRoundRect(
      80 + stateLook,
      eyeY,
      20,
      23,
      6,
      SSD1306_WHITE
    );
  }

  if (reaction == ENCOURAGE) {
    for (int thickness = 0;
         thickness < 2;
         ++thickness) {
      display.drawLine(
        54,
        48 + sadShift + thickness,
        59,
        44 + sadShift + thickness,
        SSD1306_WHITE
      );

      display.drawLine(
        59,
        44 + sadShift + thickness,
        69,
        44 + sadShift + thickness,
        SSD1306_WHITE
      );

      display.drawLine(
        69,
        44 + sadShift + thickness,
        74,
        48 + sadShift + thickness,
        SSD1306_WHITE
      );
    }
  } else if (reaction == LISTENING) {
    display.drawCircle(
      64, 47, 4, SSD1306_WHITE
    );
  } else if (reaction == THINKING) {
    const uint32_t mouthPhase =
      age % 2400U;

    const int mouthMove =
      mouthPhase < 1200U
        ? int(mouthPhase / 1200U)
        : int((2400U - mouthPhase) / 1200U);

    display.drawLine(
      58,
      47 - mouthMove,
      70,
      44 + mouthMove,
      SSD1306_WHITE
    );

    // Thought dots appear one at a time,
    // pause, and then restart.
    const uint32_t dotPhase =
      age % 3000U;

    const uint8_t visibleDots =
      dotPhase < 500U ? 1 :
      dotPhase < 1000U ? 2 :
      3;

    const int pulse =
      (age / 300U) % 2U;

    if (visibleDots >= 1) {
      display.fillCircle(
        55,
        8,
        1 + pulse,
        SSD1306_WHITE
      );
    }

    if (visibleDots >= 2) {
      display.fillCircle(
        63,
        6,
        2,
        SSD1306_WHITE
      );
    }

    if (visibleDots >= 3) {
      display.fillCircle(
        72,
        4,
        2 + pulse,
        SSD1306_WHITE
      );
    }
  } else {
    for (int thickness = 0;
         thickness < 2;
         ++thickness) {
      display.drawLine(
        44,
        41 + bob + thickness,
        54,
        48 + bob + thickness,
        SSD1306_WHITE
      );

      display.drawLine(
        54,
        48 + bob + thickness,
        73,
        48 + bob + thickness,
        SSD1306_WHITE
      );

      display.drawLine(
        73,
        48 + bob + thickness,
        84,
        41 + bob + thickness,
        SSD1306_WHITE
      );
    }
  }

  if (
    reaction == CELEBRATE ||
    reaction == STREAK
  ) {
    const int radius =
      (age / 180U) % 2U ? 2 : 4;

    drawSparkle(11, 19, radius);
    drawSparkle(116, 43, radius);
    drawSparkle(64, 10, 2);
  } else if (reaction == ON_FIRE) {
    // A flickering flame above the eyes with the combo count ("x3"), and sparkles at the sides.
    const int flicker = (age / 120U) % 2U;
    display.fillCircle(56, 10, 3, SSD1306_WHITE);
    display.drawLine(53, 9, 56, 2 - flicker, SSD1306_WHITE);
    display.drawLine(59, 9, 56, 2 - flicker, SSD1306_WHITE);
    display.drawLine(54, 8, 56, 3 - flicker, SSD1306_WHITE);
    display.drawLine(58, 8, 56, 3 - flicker, SSD1306_WHITE);
    const uint8_t combo = fireCombo.load();
    if (combo >= 2) {
      char text[5];
      snprintf(text, sizeof text, "x%u", unsigned(combo));
      oled.setDrawColor(1);
      oled.setFont(u8g2_font_6x13_t_cyrillic);
      oled.drawStr(63, 12, text);
    }
    const int radius = (age / 180U) % 2U ? 2 : 4;
    drawSparkle(11, 19, radius);
    drawSparkle(116, 43, radius);
  } else if (reaction == LISTENING) {
    const int wave =
      2 + int((age / 220U) % 3U);

    display.drawCircle(
      10,
      27,
      wave * 2,
      SSD1306_WHITE
    );

    display.fillRect(
      0, 16, 9, 23, SSD1306_BLACK
    );

    display.drawCircle(
      117,
      27,
      wave * 2,
      SSD1306_WHITE
    );

    display.fillRect(
      119, 16, 9, 23, SSD1306_BLACK
    );
  } else if (reaction == HINT) {
    const int pulse =
      (age / 180U) % 2U ? 2 : 4;

    drawSparkle(110, 12, pulse);
    drawSparkle(17, 43, 2);
  } else if (reaction == CONNECTED) {
    const int pulse =
      2 + int((age / 180U) % 3U);

    display.drawCircle(
      64,
      8,
      pulse,
      SSD1306_WHITE
    );
  }

  // Only the persistent connection dot remains.
  display.fillCircle(
    122,
    4,
    connected ? 3 : 1,
    SSD1306_WHITE
  );

  display.display();
}

static void setupOLED() {
  // SPI has no address to probe, so a missing panel cannot be detected here;
  // BLE and servos keep working either way.
  SPI.begin(OLED_SCK, -1, OLED_MOSI, OLED_CS);
  oledReady=oled.begin();
  if(!oledReady){Serial.println("[OLED] Initialization failed; BLE/servo remain available.");return;}
  oled.setContrast(24);
  oled.enableUTF8Print();
  Serial.println("[OLED] SH1106 128x64 on SPI initialized.");

  // First draw happens in loop(), like every other frame.
}

// Prefer large Russian text; compact both sections when either needs room.
// Up to two primary and two translation lines, all inside the 128x64 frame.
//
// Wrapping/measurement (PrivetLayout::wrap, getUTF8Width) is the expensive
// part: per-substring width lookups for every candidate line break. The card
// itself is static while shown, but updateOLED() re-enters drawCard() every
// ~50ms via the frame throttle, so without caching this reran on every frame.
// Card::revision already uniquely (monotonically) identifies "this exact
// card content", so it is the cache key: layout is recomputed only when a
// genuinely new card arrives, never on a repeat draw of the same one.
struct CardLayout {
 uint32_t revision=0;bool valid=false,compact=false;
 PrivetLayout::Lines primary,secondary;
 int primaryX[2]={},secondaryX[2]={};
};
static CardLayout cardLayout;

static void layoutCard(const PrivetCards::Card &card){
 if(cardLayout.valid&&cardLayout.revision==card.revision)return;
 const auto measure=[](const char *text){return oled.getUTF8Width(text);};
 oled.setFont(u8g2_font_6x13_t_cyrillic);
 cardLayout.secondary=PrivetLayout::wrap(card.secondary,measure);
 oled.setFont(u8g2_font_9x15_t_cyrillic);
 cardLayout.primary=PrivetLayout::wrap(card.primary,measure);
 cardLayout.compact=!cardLayout.primary.complete||(cardLayout.primary.count==2&&cardLayout.secondary.count==2);
 if(cardLayout.compact){oled.setFont(u8g2_font_6x13_t_cyrillic);cardLayout.primary=PrivetLayout::wrap(card.primary,measure);}
 // Precompute each line's centered x offset now, under the same font that
 // will be active when it is actually drawn, so the draw path below never
 // calls getUTF8Width() again.
 oled.setFont(cardLayout.compact?u8g2_font_6x13_t_cyrillic:u8g2_font_9x15_t_cyrillic);
 for(uint8_t i=0;i<cardLayout.primary.count;i++)cardLayout.primaryX[i]=(128-int(oled.getUTF8Width(cardLayout.primary.text[i])))/2;
 oled.setFont(u8g2_font_6x13_t_cyrillic);
 for(uint8_t i=0;i<cardLayout.secondary.count;i++)cardLayout.secondaryX[i]=(128-int(oled.getUTF8Width(cardLayout.secondary.text[i])))/2;
 cardLayout.revision=card.revision;cardLayout.valid=true;
}

static void drawCard(const PrivetCards::Card &card){
 layoutCard(card);
 const PrivetLayout::Frame frame(cardLayout.primary.count,cardLayout.secondary.count,cardLayout.compact);
 oled.clearBuffer();oled.setDrawColor(1);oled.drawDisc(123,3,1);
 oled.setFont(cardLayout.compact?u8g2_font_6x13_t_cyrillic:u8g2_font_9x15_t_cyrillic);
 for(uint8_t i=0;i<cardLayout.primary.count;i++)oled.drawUTF8(cardLayout.primaryX[i],frame.primaryBaseline(i),cardLayout.primary.text[i]);
 oled.setFont(u8g2_font_6x13_t_cyrillic);
 for(uint8_t i=0;i<cardLayout.secondary.count;i++)oled.drawUTF8(cardLayout.secondaryX[i],frame.secondaryBaseline(i),cardLayout.secondary.text[i]);
 presentFrame();
}

static void updateOLED() {
  static uint32_t seenMailbox = 0;
  static uint32_t started = 0;
  static uint32_t lastFrame = 0;
  static uint32_t lastCommandAt = 0;
  static uint8_t current = IDLE;
  static uint32_t cardDelay = 0;  // set per command; see PrivetFaces::cardDelay()
  static bool wasConnected = false;
  static PrivetCards::Card shownCard;
  static uint32_t cardAt=0,cardShownAt=0;
  static bool cardVisible=false;
  PrivetCards::Card incoming;
  portENTER_CRITICAL(&cardsMux);
  incoming=cards.completed;
  portEXIT_CRITICAL(&cardsMux);
  if(incoming.revision!=shownCard.revision){shownCard=incoming;cardAt=millis();cardVisible=false;}

  const uint32_t now = millis();
  const bool connected = wakeTransition.awake(phoneConnected.load());
  const uint32_t requested = faceMailbox.load();

  bool changed =
    connected != wasConnected;

  const bool waking=connected&&!wasConnected;
  // No sound while the phone is away and the face sleeps.
  if (wasConnected && !connected) stopSound(now, "asleep");
  wasConnected = connected;

  // If the callback publishes between our link and mailbox reads, the first
  // awake frame must still consume the accepted reaction, not remain IDLE.
  if (requested != seenMailbox || waking) {
    lastCommandAt = now;
    seenMailbox = requested;
    const uint8_t previous = current;

    current =
      connected
        ? uint8_t(requested & 0xFFU)
        : uint8_t(IDLE);

    cardDelay = PrivetFaces::cardDelay(current, previous, reactionDuration(current));
    started = now;
    startServoReaction(connected ? current : uint8_t(PrivetMotion::SLEEP), now);
    if (connected) requestSound(current, now);
    changed = true;
  }

  // Without a phone the face sleeps and the head droops; the CONNECTED
  // wake-up nod lifts it again.
  if (!connected && (current != IDLE || servoReaction != PrivetMotion::SLEEP)) {
    current = IDLE;
    if (servoReaction != PrivetMotion::SLEEP) startServoReaction(PrivetMotion::SLEEP, now);
    changed = true;
  }

  uint32_t age =
    uint32_t(now - started);

  const uint32_t duration =
    reactionDuration(current);

  if (
    duration > 0 &&
    age >= duration
  ) {
    // After HINT or a match-pair NOD, return to THINKING because the
    // question remains unanswered.
    current =
      connected && (current == HINT || current == NOD)
        ? THINKING
        : IDLE;

    startServoReaction(current, now);
    changed = true;
    started = now;
    age = 0;
  }

  const bool ambientAwake =
    connected &&
    uint32_t(now - lastCommandAt) <
      AMBIENT_WINDOW_MS;

  // The head follows the face's idle glance, but not while a card is shown.
  static bool cardOnScreen = false;
  servoGlanceUs =
    current == IDLE && ambientAwake && !cardOnScreen && age < AMBIENT_WINDOW_MS
      ? int(lroundf(PrivetMotion::glance(age) * IDLE_GLANCE_DEG * PrivetMotion::US_PER_DEGREE / 1000.0f))
      : 0;

  updateServo(now);
  updateSound(now);

  // New commands bypass the frame throttle.
  if (
    !oledReady ||
    (!changed &&
     uint32_t(now - lastFrame) < 50)
  ) {
    return;
  }

  lastFrame = now;

  const bool blink =
    current == IDLE &&
    (now % 4300U < 130U);

  const uint32_t displayAge =
    !connected
      ? now
      : current == IDLE && !ambientAwake
        ? AMBIENT_WINDOW_MS
        : age;

  const uint32_t transition=cardDelay;
  const bool validCard=connected&&shownCard.mode&&shownCard.face==latestFaceId.load();
  if(validCard&&PrivetFaces::cardExpired(shownCard.mode,current,now,cardAt,cardVisible,cardShownAt)){
    current=(shownCard.mode==2||shownCard.mode==4)?THINKING:IDLE;
    shownCard.mode=0;started=now;
    // Local safe expiry: THINKING keeps the head still; IDLE restarts only so
    // the head's glance stays in step with the face's.
    if(current==IDLE)startServoReaction(IDLE,now);
  }
  if(validCard&&shownCard.mode&&uint32_t(now-lastCommandAt)>=transition){
    if(!cardVisible){cardVisible=true;cardShownAt=now;}
    cardOnScreen=true;
    drawCard(shownCard);return;
  }
  cardOnScreen=false;
  drawFace(
    connected,
    current,
    blink,
    displayAge
  );
}

static const char *SERVICE_UUID =
  "7b5e0001-6d8a-4f3b-9c2e-1a0d8f6b4c91";

static const char *COMMAND_UUID =
  "7b5e0002-6d8a-4f3b-9c2e-1a0d8f6b4c91";

static const char *STATUS_UUID =
  "7b5e0003-6d8a-4f3b-9c2e-1a0d8f6b4c91";

static BLECharacteristic *statusCharacteristic =
  nullptr;

// Guards the setValue()+notify() pair on statusCharacteristic. The BLE task
// (onWrite/sendCapabilities) and the loop() task (card-expiry notifications)
// both send status updates; without this lock a second setValue() can
// overwrite the first before its notify() is sent, dropping or corrupting
// an ACK the app is waiting on.
static SemaphoreHandle_t bleNotifyMutex = NULL;

static void sendStatus(const uint8_t *data, size_t length) {
  if (xSemaphoreTake(bleNotifyMutex, portMAX_DELAY) == pdTRUE) {
    statusCharacteristic->setValue(const_cast<uint8_t *>(data), length);
    statusCharacteristic->notify();
    xSemaphoreGive(bleNotifyMutex);
  }
}

static std::atomic<bool> restartAdvertising{false};

// Accessed only from BLE callbacks.
// An exact duplicate request is acknowledged without
// executing its reaction a second time.
static bool haveLast = false;
static uint8_t lastCommand[8];
static uint8_t lastAck[8];

static void printPacket(
  const char *label,
  const uint8_t *packet
) {
  Serial.print(label);

  for (size_t i = 0; i < 8; ++i) {
    Serial.printf(" %02X", packet[i]);
  }

  Serial.println();
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override {
    haveLast = false;

    wakeTransition.reset();
    phoneConnected.store(true);
    connectionNonce=esp_random();if(!connectionNonce)connectionNonce=1;
    latestFaceId.store(0);
    portENTER_CRITICAL(&cardsMux);cards.connection(connectionNonce);portEXIT_CRITICAL(&cardsMux);
    requestFace(IDLE); // Only the app's ACK-tracked code 9 starts CONNECTED.

    restartAdvertising.store(false);

    Serial.println(
      "[BLE] iPhone connected. "
      "Waiting for subscribed app command."
    );
  }

  void onDisconnect(BLEServer *) override {
    haveLast = false;

    wakeTransition.reset();
    phoneConnected.store(false);
    portENTER_CRITICAL(&cardsMux);cards.connection(0);portEXIT_CRITICAL(&cardsMux);
    latestFaceId.store(0);
    requestFace(IDLE);

    restartAdvertising.store(true);

    Serial.println(
      "[BLE] Disconnected. "
      "No reactions are queued."
    );
  }
};

static void sendCapabilities(uint32_t requestId){
 uint8_t p[20]={2,0x80};
 for(int i=0;i<4;i++){p[i+2]=uint8_t(requestId>>(8*i));p[i+12]=uint8_t(connectionNonce>>(8*i));}
 // Bit 3 (8): reactions 11 NOD and 12 ON_FIRE are supported; the app sends
 // them only when this bit is set.
 p[6]=(oledReady?7:3)|8;p[7]=20;p[8]=96;p[10]=64;p[11]=32;p[16]=0x88;p[17]=0x13;
 sendStatus(p,20);
}
class CommandCallbacks : public BLECharacteristicCallbacks {
 void onWrite(BLECharacteristic *characteristic) override {
  const size_t length=characteristic->getLength();
  if(length<2)return;
  uint8_t packet[20];memcpy(packet,characteristic->getData(),length>20?20:length);
  if(packet[0]==2){
   portENTER_CRITICAL(&cardsMux);const auto reply=cards.receive(packet,length,millis(),oledReady);portEXIT_CRITICAL(&cardsMux);
   if(reply.send)sendStatus(reply.bytes,8);
   return;
  }
  if(length!=8||packet[0]!=1||packet[1]!=1)return;
  const uint32_t requestId=PrivetCards::u32(packet+2);if(!requestId)return;
  if(haveLast&&PrivetCards::u32(lastCommand+2)==requestId){
   if(memcmp(packet,lastCommand,8))return;
   sendStatus(lastAck,8);
   if(packet[6]==10&&lastAck[7]==0)sendCapabilities(requestId);
   return;
  }
  // Only ON_FIRE carries an argument (its combo); every other command requires 0.
  uint8_t result=packet[6]<1||packet[6]>ON_FIRE?1:packet[7]!=0&&packet[6]!=ON_FIRE?2:0;
  uint8_t ack[8];memcpy(ack,packet,8);ack[1]=2;ack[7]=result;
  if(!result&&packet[6]!=10){
   // Fixed buffers only. All OLED/servo work stays in loop().
   if(packet[6]==ON_FIRE)fireCombo.store(packet[7]);
   portENTER_CRITICAL(&cardsMux);cards.face(requestId);portEXIT_CRITICAL(&cardsMux);
   latestFaceId.store(requestId);requestFace(packet[6]);
   wakeTransition.acceptReaction(); // Publish after the face mailbox is ready.
  }
  memcpy(lastCommand,packet,8);memcpy(lastAck,ack,8);haveLast=true;
  sendStatus(ack,8);
  if(!result&&packet[6]==10)sendCapabilities(requestId);
 }
};

void setup() {
  Serial.begin(115200);
  delay(300);

  Serial.println(
    "\nPrivet S3 v4 BLE + OLED + pan/tilt + sound starting..."
  );

  // Created before BLEDevice::init()/createServer() so sendStatus() is
  // always safe to call once the characteristic exists.
  bleNotifyMutex = xSemaphoreCreateMutex();

  // Centre once at power-on; PWM is released once still (SERVO_RELEASE_AFTER_MS).
  panServo.begin(millis());
  tiltServo.begin(millis());

  Serial.println(
    "[SERVO] Pan GPIO4, tilt GPIO5, limits in ServoMotion.h; "
    "center 1500 us. Smooth follower; PWM off when still."
  );

  setupOLED();

  BLEDevice::init("Privet-ESP32");

  BLEServer *server =
    BLEDevice::createServer();

  server->setCallbacks(
    new ServerCallbacks()
  );

  BLEService *service =
    server->createService(SERVICE_UUID);

  statusCharacteristic =
    service->createCharacteristic(
      STATUS_UUID,
      BLECharacteristic::PROPERTY_NOTIFY
    );

  statusCharacteristic->addDescriptor(
    new BLE2902()
  );

  BLECharacteristic *command =
    service->createCharacteristic(
      COMMAND_UUID,
      BLECharacteristic::PROPERTY_WRITE
    );

  command->setCallbacks(
    new CommandCallbacks()
  );

  service->start();

  BLEAdvertising *advertising =
    BLEDevice::getAdvertising();

  advertising->addServiceUUID(
    SERVICE_UUID
  );

  advertising->setScanResponse(true);
  advertising->start();

  Serial.println(
    "[BLE] Advertising as Privet-ESP32. "
    "Connect from the app."
  );

  setupSound();
}

void loop() {
  portENTER_CRITICAL(&cardsMux);
  const auto expired=cards.expire(millis());
  portEXIT_CRITICAL(&cardsMux);
  if(expired.send&&phoneConnected.load()&&statusCharacteristic)sendStatus(expired.bytes,8);

  if (restartAdvertising.exchange(false)) {
    BLEDevice::startAdvertising();

    Serial.println(
      "[BLE] Advertising again."
    );
  }

  updateOLED();
  delay(10);
}
