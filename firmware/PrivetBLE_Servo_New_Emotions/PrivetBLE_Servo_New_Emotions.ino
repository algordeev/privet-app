/* Privet ESP32 companion: Stage 4 (BLE + SSD1306 OLED + unloaded SG90 test).
 * Target: classic ESP32 / ESP-32S, Arduino-ESP32 3.x, built-in BLE library.
 * SG90 signal GPIO25; verified ~5V power and common GND.
 * Servo pulses 1300-1700 us, neutral 1500 us; no mechanical load for first tests.
 * No Wi-Fi, audio, bonding, or background reaction queue.
 * Required: ESP32Servo, Adafruit SSD1306, Adafruit GFX (+ dependencies).
 * Command: [1, 1, request-id uint32 LE, command, argument]
 * ACK:     [1, 2, same request-id, same command, result]
 * Commands: 1 HAPPY, 2 ENCOURAGE, 3 CELEBRATE, 4 IDLE, 5 LISTENING,
 * 6 THINKING, 7 HINT, 8 STREAK, 9 CONNECTED. Argument always 0.
 * ACK result: 0 accepted, 1 unsupported command, 2 invalid argument.
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <atomic>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>

// OLED wiring: VCC -> 3V3, GND -> GND, SDA -> GPIO21, SCL -> GPIO22.
static Adafruit_SSD1306 display(128, 64, &Wire, -1);
static bool oledReady = false;
static std::atomic<bool> phoneConnected{false};

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
static uint32_t servoStarted = 0;
static uint32_t servoLastStep = 0;
static uint32_t servoSettledAt = 0;
static bool servoSettling = false;

static constexpr uint32_t AMBIENT_WINDOW_MS = 60000;

static int servoTarget(uint8_t reaction, uint32_t age) {
  if (reaction == ENCOURAGE) {
    return age < 900 ? SERVO_CENTER_US - 80 : SERVO_CENTER_US;
  }

  if (reaction == HAPPY) {
    return age < 900 ? SERVO_MAX_US : SERVO_CENTER_US;
  }

  if (reaction == CELEBRATE) {
    if (age < 900) return SERVO_MIN_US;
    if (age < 1800) return SERVO_MAX_US;
    if (age < 2700) return SERVO_MIN_US;
    if (age < 3600) return SERVO_MAX_US;
  }

  if (reaction == HINT) {
    return age < 700 ? SERVO_CENTER_US + 100 : SERVO_CENTER_US;
  }

  if (reaction == STREAK) {
    if (age < 650) return SERVO_CENTER_US - 130;
    if (age < 1300) return SERVO_CENTER_US + 130;
    return SERVO_CENTER_US;
  }

  if (reaction == CONNECTED) {
    return age < 550 ? SERVO_CENTER_US - 100 : SERVO_CENTER_US;
  }

  // Listening and thinking stay quiet; idle returns gently to center.
  return SERVO_CENTER_US;
}

static void startServoReaction(uint8_t reaction, uint32_t now) {
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
      digitalWrite(SERVO_PIN, LOW);
      Serial.println(
        "[SERVO] Centered target; PWM released."
      );
    }
  } else {
    servoSettling = false;
  }
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

  oledReady = display.begin(
    SSD1306_SWITCHCAPVCC,
    address,
    true,
    false
  );

  if (!oledReady) {
    Serial.println(
      "[OLED] Initialization failed; BLE will continue."
    );

    return;
  }

  // OLED is physically mounted upside down.
  display.setRotation(2);
  display.dim(true);

  Serial.printf(
    "[OLED] Initialized 128x64 at 0x%02X\n",
    address
  );

  drawFace(false, IDLE, false, 0);
}

static void updateOLED() {
  static uint32_t seenMailbox = 0;
  static uint32_t started = 0;
  static uint32_t lastFrame = 0;
  static uint32_t lastCommandAt = 0;
  static uint8_t current = IDLE;
  static bool wasConnected = false;

  const uint32_t now = millis();
  const bool connected = phoneConnected.load();
  const uint32_t requested = faceMailbox.load();

  const bool becameConnected =
    connected && !wasConnected;

  bool changed =
    connected != wasConnected;

  wasConnected = connected;

  if (requested != seenMailbox) {
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

  // The BLE link itself always starts with CONNECTED,
  // even if loop() runs between callback updates.
  if (
    becameConnected &&
    current != CONNECTED
  ) {
    current = CONNECTED;
    started = now;
    startServoReaction(CONNECTED, now);
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

    phoneConnected.store(true);
    requestFace(CONNECTED);

    restartAdvertising.store(false);

    Serial.println(
      "[BLE] iPhone connected. "
      "Showing welcome reaction."
    );
  }

  void onDisconnect(BLEServer *) override {
    haveLast = false;

    phoneConnected.store(false);
    requestFace(IDLE);

    restartAdvertising.store(true);

    Serial.println(
      "[BLE] Disconnected. "
      "No reactions are queued."
    );
  }
};

class CommandCallbacks :
  public BLECharacteristicCallbacks {
  void onWrite(
    BLECharacteristic *characteristic
  ) override {
    const auto value =
      characteristic->getValue();

    if (value.length() != 8) {
      Serial.printf(
        "[RX] Ignored invalid packet length: %u\n",
        static_cast<unsigned>(value.length())
      );

      return;
    }

    uint8_t packet[8];
    memcpy(
      packet,
      value.c_str(),
      sizeof(packet)
    );

    printPacket("[RX]", packet);

    if (
      packet[0] != 1 ||
      packet[1] != 1
    ) {
      Serial.println(
        "[RX] Ignored unsupported version "
        "or message type."
      );

      return;
    }

    const uint32_t requestId =
      uint32_t(packet[2]) |
      (uint32_t(packet[3]) << 8) |
      (uint32_t(packet[4]) << 16) |
      (uint32_t(packet[5]) << 24);

    if (
      haveLast &&
      memcmp(
        packet + 2,
        lastCommand + 2,
        4
      ) == 0
    ) {
      if (
        memcmp(
          packet,
          lastCommand,
          8
        ) != 0
      ) {
        Serial.println(
          "[RX] Ignored conflicting reuse "
          "of last request ID."
        );

        return;
      }

      statusCharacteristic->setValue(
        lastAck,
        sizeof(lastAck)
      );

      statusCharacteristic->notify();

      Serial.println(
        "[ACK] Duplicate request; "
        "reaction not repeated."
      );

      return;
    }

    uint8_t result = 0;

    if (
      packet[6] < HAPPY ||
      packet[6] > CONNECTED
    ) {
      result = 1;
    } else if (packet[7] != 0) {
      result = 2;
    }

    uint8_t ack[8];

    memcpy(
      ack,
      packet,
      sizeof(ack)
    );

    ack[1] = 2;
    ack[7] = result;

    if (result == 0) {
      // Signal loop only. No drawing, servo,
      // animation delays, or I2C here.
      requestFace(packet[6]);

      Serial.printf(
        "[REACTION] %s | request=%lu\n",
        reactionName(packet[6]),
        static_cast<unsigned long>(requestId)
      );
    } else {
      Serial.printf(
        "[REJECTED] request=%lu result=%u\n",
        static_cast<unsigned long>(requestId),
        result
      );
    }

    memcpy(
      lastCommand,
      packet,
      sizeof(lastCommand)
    );

    memcpy(
      lastAck,
      ack,
      sizeof(lastAck)
    );

    haveLast = true;

    statusCharacteristic->setValue(
      ack,
      sizeof(ack)
    );

    statusCharacteristic->notify();

    printPacket("[ACK sent]", ack);
  }
};

void setup() {
  Serial.begin(115200);
  delay(300);

  Serial.println(
    "\nPrivet BLE + OLED + SG90 starting..."
  );

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
  if (restartAdvertising.exchange(false)) {
    BLEDevice::startAdvertising();

    Serial.println(
      "[BLE] Advertising again."
    );
  }

  updateOLED();
  delay(10);
}
