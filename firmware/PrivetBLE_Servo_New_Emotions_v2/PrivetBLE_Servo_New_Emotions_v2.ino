/* Privet ESP32 companion: BLE faces + negotiated learning cards + SG90.
 * Target: classic ESP32 / ESP-32S, Arduino-ESP32 3.x, built-in BLE library.
 * SG90 signal GPIO25; verified ~5V power and common GND.
 * Servo pulses 1300-1700 us, neutral 1500 us; no mechanical load for first tests.
 * No Wi-Fi, audio, bonding, or background reaction queue.
 * Required: U8g2 and ESP32Servo.
 * Command: [1, 1, request-id uint32 LE, command, argument]
 * ACK:     [1, 2, same request-id, same command, result]
 * Commands: 1 HAPPY, 2 ENCOURAGE, 3 CELEBRATE, 4 IDLE, 5 LISTENING,
 * 6 THINKING, 7 HINT, 8 STREAK, 9 CONNECTED. Argument always 0.
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
#include <Wire.h>
#include <U8g2lib.h>
#include "LearningCards.h"
#include "FacePresentation.h"
#include "ServoMotion.h"
#include "LearningLayout.h"
#include "DisplayRefresh.h"
#include <ESP32Servo.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

// OLED wiring: VCC -> 3V3, GND -> GND, SDA -> GPIO21, SCL -> GPIO22.
// Small geometry adapter preserves the existing face drawing coordinates.
static U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R2, U8X8_PIN_NONE);
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

enum Reaction : uint8_t {
  HAPPY = 1,
  ENCOURAGE = 2,
  CELEBRATE = 3,
  IDLE = 4,
  LISTENING = 5,
  THINKING = 6,
  HINT = 7,
  STREAK = 8,
  CONNECTED = 9
};

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
    default: return "idle";
  }
}

static uint32_t reactionDuration(uint8_t reaction) {
  switch (reaction) {
    case HAPPY: return 2000;
    case ENCOURAGE: return 2200;
    case CELEBRATE: return 4500;
    case LISTENING: return 2600;

    // THINKING remains active until another command replaces it.
    case THINKING: return 0;

    case HINT: return 2600;
    case STREAK: return 3600;
    case CONNECTED: return 2400;
    default: return 0;
  }
}

// Servo is controlled only by loop(), never inside BLE callbacks.
// Set false to keep BLE/OLED available while testing power or wiring.
static constexpr bool SERVO_ENABLED = true;
static constexpr int SERVO_PIN = 25;
static constexpr int SERVO_CENTER_US = 1500;
static constexpr int SERVO_MIN_US = 1300;
static constexpr int SERVO_MAX_US = 1700;

static Servo headServo;
static uint8_t servoReaction = IDLE;
static int servoPulseUs = SERVO_CENTER_US;
static int servoFromUs = SERVO_CENTER_US;
static uint32_t servoStarted = 0;
static uint32_t servoLastStep = 0;
static uint32_t servoSettledAt = 0;
static bool servoSettling = false;

static constexpr uint32_t AMBIENT_WINDOW_MS = 60000;

static int servoTarget(uint8_t reaction,uint32_t age){
 return PrivetMotion::target(reaction,age,servoFromUs);
}

static void startServoReaction(uint8_t reaction, uint32_t now) {
  servoFromUs=servoPulseUs;
  servoReaction = reaction;
  servoStarted = now;
  servoSettling = false;

  if (!SERVO_ENABLED) return;

  const bool needsMotion =
    reaction == HAPPY ||
    reaction == CELEBRATE ||
    reaction == ENCOURAGE ||
    reaction == HINT ||
    reaction == STREAK ||
    reaction == CONNECTED ||
    servoPulseUs != SERVO_CENTER_US;

  if (!headServo.attached() && needsMotion) {
    headServo.setPeriodHertz(50);
    headServo.attach(SERVO_PIN, 500, 2500);

    if (!headServo.attached()) {
      Serial.println("[SERVO] PWM attach failed; BLE/OLED continue.");
      return;
    }

    // This is our last commanded pulse, not position feedback.
    headServo.writeMicroseconds(servoPulseUs);
    servoLastStep = now;
  }
}

static void updateServo(uint32_t now) {
  if (!SERVO_ENABLED || !headServo.attached()) return;

  const uint32_t age = uint32_t(now - servoStarted);
  const int target = servoTarget(servoReaction, age);

  if (uint32_t(now - servoLastStep) >= 20 &&
      servoPulseUs != target) {
    servoLastStep = now;

    const int remaining = target - servoPulseUs;
    const int step = servoReaction == ENCOURAGE ? 4 : 10;

    servoPulseUs += constrain(remaining, -step, step);
    servoPulseUs =
      constrain(servoPulseUs, SERVO_MIN_US, SERVO_MAX_US);

    headServo.writeMicroseconds(servoPulseUs);
  }

  const uint32_t gestureEnd =
    servoReaction == HAPPY ? 1500U :
    servoReaction == CELEBRATE ? 4100U :
    servoReaction == ENCOURAGE ? 1700U :
    servoReaction == HINT ? 1500U :
    servoReaction == STREAK ? 2100U :
    servoReaction == CONNECTED ? 1300U :
    0U;

  if (age >= gestureEnd &&
      servoPulseUs == SERVO_CENTER_US) {
    if (!servoSettling) {
      servoSettling = true;
      servoSettledAt = now;
    }

    if (uint32_t(now - servoSettledAt) >= 250) {
      headServo.detach();

      // detach() removes the pin from the GPIO matrix, so a plain
      // digitalWrite() afterward is a no-op and leaves the signal line
      // floating (picking up BLE antenna noise and twitching the servo).
      // Re-claim the pin as a GPIO output before pulling it low.
      pinMode(SERVO_PIN, OUTPUT);
      digitalWrite(SERVO_PIN, LOW);
      Serial.println(
        "[SERVO] Centered target; PWM released."
      );
    }
  } else {
    servoSettling = false;
  }
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

// All I2C and graphics run in loop(), never inside BLE callbacks.
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
    reaction == STREAK;

  const int bob =
    reaction == CELEBRATE || reaction == STREAK
      ? ((age / 180U) % 2U ? -1 : 1)
      : 0;

  // Gentle droop and recovery during ENCOURAGE.
  const int sadShift =
    reaction != ENCOURAGE ? 0 :
    age < 800U ? int(age / 400U) :
    age < 1400U ? 2 :
    age < 2200U ? int((2200U - age) / 400U) :
    0;

  const uint32_t lookPhase = age % 7800U;
  int look = 0;

  if (reaction == IDLE &&
      connected &&
      age < AMBIENT_WINDOW_MS &&
      lookPhase >= 2200U &&
      lookPhase < 4000U) {
    const uint32_t t = lookPhase - 2200U;

    const int direction =
      (age / 7800U) % 2U ? -1 : 1;

    const int offset =
      t < 300U ? int(t) * 5 / 300 :
      t < 1500U ? 5 :
      int(1800U - t) * 5 / 300;

    look = direction * offset;
  }

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
  Wire.begin(21, 22);
  Wire.setTimeOut(50);

  uint8_t address = 0;

  for (uint8_t candidate :
       {uint8_t(0x3C), uint8_t(0x3D)}) {
    Wire.beginTransmission(candidate);

    if (Wire.endTransmission() == 0) {
      address = candidate;
      break;
    }
  }

  if (!address) {
    Serial.println(
      "[OLED] Not found at 0x3C or 0x3D. "
      "Check power/SDA/SCL."
    );

    Serial.println(
      "[OLED] BLE will continue without display."
    );

    return;
  }

  oled.setI2CAddress(address << 1);
  oled.setBusClock(400000); // Match the previous Adafruit SSD1306 transfer speed.
  oledReady=oled.begin();
  if(!oledReady){Serial.println("[OLED] Initialization failed; BLE/servo remain available.");return;}
  oled.setContrast(24);
  oled.enableUTF8Print();
  Serial.printf(
    "[OLED] Initialized 128x64 at 0x%02X\n",
    address
  );

  // First draw happens in loop(), like every other frame.
}

// Prefer large Russian text; compact both sections when either needs room.
// Up to two primary and two translation lines, all inside the 128x64 frame.
static void drawCard(const PrivetCards::Card &card){
 oled.clearBuffer();oled.setDrawColor(1);oled.drawDisc(123,3,1);
 const auto measure=[](const char *text){return oled.getUTF8Width(text);};
 oled.setFont(u8g2_font_6x13_t_cyrillic);
 const auto secondary=PrivetLayout::wrap(card.secondary,measure);
 oled.setFont(u8g2_font_9x15_t_cyrillic);
 auto primary=PrivetLayout::wrap(card.primary,measure);
 const bool compact=!primary.complete||(primary.count==2&&secondary.count==2);
 if(compact){oled.setFont(u8g2_font_6x13_t_cyrillic);primary=PrivetLayout::wrap(card.primary,measure);}
 const PrivetLayout::Frame frame(primary.count,secondary.count,compact);
 for(uint8_t i=0;i<primary.count;i++)oled.drawUTF8((128-int(oled.getUTF8Width(primary.text[i])))/2,frame.primaryBaseline(i),primary.text[i]);
 oled.setFont(u8g2_font_6x13_t_cyrillic);
 for(uint8_t i=0;i<secondary.count;i++)oled.drawUTF8((128-int(oled.getUTF8Width(secondary.text[i])))/2,frame.secondaryBaseline(i),secondary.text[i]);
 presentFrame();
}

static void updateOLED() {
  static uint32_t seenMailbox = 0;
  static uint32_t started = 0;
  static uint32_t lastFrame = 0;
  static uint32_t lastCommandAt = 0;
  static uint8_t current = IDLE;
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
  wasConnected = connected;

  // If the callback publishes between our link and mailbox reads, the first
  // awake frame must still consume the accepted reaction, not remain IDLE.
  if (requested != seenMailbox || waking) {
    lastCommandAt = now;
    seenMailbox = requested;

    current =
      connected
        ? uint8_t(requested & 0xFFU)
        : uint8_t(IDLE);

    started = now;
    startServoReaction(current, now);
    changed = true;
  }

  if (!connected && current != IDLE) {
    current = IDLE;
    startServoReaction(IDLE, now);
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
    // After HINT, return to THINKING because the
    // question remains unanswered.
    current =
      connected && current == HINT
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

  updateServo(now);

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

  const uint32_t transition=current==THINKING?700:current==LISTENING?500:reactionDuration(uint8_t(requested & 255));
  const bool validCard=connected&&shownCard.mode&&shownCard.face==latestFaceId.load();
  if(validCard&&PrivetFaces::cardExpired(shownCard.mode,now,cardAt,cardVisible,cardShownAt)){
    current=(shownCard.mode==2||shownCard.mode==4)?THINKING:IDLE;
    shownCard.mode=0;started=now; // Local safe expiry; no gesture restart.
  }
  if(validCard&&shownCard.mode&&uint32_t(now-lastCommandAt)>=transition){
    if(!cardVisible){cardVisible=true;cardShownAt=now;}
    drawCard(shownCard);return;
  }
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
 p[6]=oledReady?7:3;p[7]=20;p[8]=96;p[10]=64;p[11]=32;p[16]=0x88;p[17]=0x13;
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
  uint8_t result=packet[6]<1||packet[6]>10?1:packet[7]!=0?2:0;
  uint8_t ack[8];memcpy(ack,packet,8);ack[1]=2;ack[7]=result;
  if(!result&&packet[6]!=10){
   // Fixed buffers only. All OLED/servo work stays in loop().
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
    "\nPrivet BLE + OLED + SG90 starting..."
  );

  // Created before BLEDevice::init()/createServer() so sendStatus() is
  // always safe to call once the characteristic exists.
  bleNotifyMutex = xSemaphoreCreateMutex();

  pinMode(SERVO_PIN, OUTPUT);
  digitalWrite(SERVO_PIN, LOW);

  Serial.println(
    "[SERVO] GPIO25, 1300-1700 us; "
    "center 1500 us. PWM starts only for motion."
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
