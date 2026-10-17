/* Privet ESP32 companion: Stage 4 (BLE + SSD1306 OLED + unloaded SG90 test).
 * Target: classic ESP32 / ESP-32S, Arduino-ESP32 3.x, built-in BLE library.
 * SG90 signal GPIO25; verified ~5V power and common GND.
 * Servo pulses 1300-1700 us, neutral 1500 us; no mechanical load for first tests.
 * No Wi-Fi, audio, bonding, or background reaction queue.
 * Required: ESP32Servo, Adafruit SSD1306, Adafruit GFX (+ dependencies).
 * Command: [1, 1, request-id uint32 LE, command, argument]
 * ACK:     [1, 2, same request-id, same command, result]
 * Commands: 1 HAPPY, 2 ENCOURAGE, 3 CELEBRATE, 4 IDLE. Argument always 0.
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
// upper bits are a revision so even repeated HAPPY commands restart the timer.
// BLE callbacks are the sole producer; loop() only reads this atomic value.
static std::atomic<uint32_t> faceMailbox{4};

enum Reaction : uint8_t { HAPPY = 1, ENCOURAGE = 2, CELEBRATE = 3, IDLE = 4 };

static void requestFace(uint8_t reaction) {
  const uint32_t previous = faceMailbox.load();
  faceMailbox.store(((previous + 256U) & 0xFFFFFF00U) | reaction);
}

static const char *reactionName(uint8_t reaction) {
  switch (reaction) {
    case HAPPY: return "happy";
    case ENCOURAGE: return "encourage";
    case CELEBRATE: return "celebrate";
    default: return "idle";
  }
}

static uint32_t reactionDuration(uint8_t reaction) {
  switch (reaction) {
    case HAPPY: return 2000;
    case ENCOURAGE: return 2200;
    case CELEBRATE: return 4500;
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
static uint32_t servoStarted = 0, servoLastStep = 0, servoSettledAt = 0;
static bool servoSettling = false;

static int servoTarget(uint8_t reaction, uint32_t age) {
  if (reaction == HAPPY) return age < 900 ? SERVO_MAX_US : SERVO_CENTER_US;
  if (reaction == CELEBRATE) {
    if (age < 900) return SERVO_MIN_US;
    if (age < 1800) return SERVO_MAX_US;
    if (age < 2700) return SERVO_MIN_US;
    if (age < 3600) return SERVO_MAX_US;
  }
  // ENCOURAGE stays centered: no head-shaking punishment for wrong answers.
  return SERVO_CENTER_US;
}

static void startServoReaction(uint8_t reaction, uint32_t now) {
  servoReaction = reaction;
  servoStarted = now;
  servoSettling = false;
  if (!SERVO_ENABLED) return;
  const bool needsMotion = reaction == HAPPY || reaction == CELEBRATE ||
                           servoPulseUs != SERVO_CENTER_US;
  if (!headServo.attached() && needsMotion) {
    headServo.setPeriodHertz(50);
    headServo.attach(SERVO_PIN, 500, 2500);
    if (!headServo.attached()) {
      Serial.println("[SERVO] PWM attach failed; BLE/OLED continue.");
      return;
    }
    // This is our last commanded pulse, not position feedback. An unloaded
    // servo may move farther on first use if its actual position is unknown.
    headServo.writeMicroseconds(servoPulseUs);
    servoLastStep = now;
  }
}

static void updateServo(uint32_t now) {
  if (!SERVO_ENABLED || !headServo.attached()) return;
  const uint32_t age = uint32_t(now - servoStarted);
  const int target = servoTarget(servoReaction, age);
  if (uint32_t(now - servoLastStep) >= 20 && servoPulseUs != target) {
    servoLastStep = now;
    const int remaining = target - servoPulseUs;
    servoPulseUs += constrain(remaining, -10, 10);
    servoPulseUs = constrain(servoPulseUs, SERVO_MIN_US, SERVO_MAX_US);
    headServo.writeMicroseconds(servoPulseUs);
  }
  const uint32_t gestureEnd = servoReaction == HAPPY ? 1500U :
                              servoReaction == CELEBRATE ? 4100U : 0U;
  if (age >= gestureEnd && servoPulseUs == SERVO_CENTER_US) {
    if (!servoSettling) { servoSettling = true; servoSettledAt = now; }
    if (uint32_t(now - servoSettledAt) >= 250) {
      headServo.detach();
      digitalWrite(SERVO_PIN, LOW);
      Serial.println("[SERVO] Centered target; PWM released.");
    }
  } else servoSettling = false;
}

static void drawSparkle(int x, int y, int radius) {
  display.drawFastHLine(x - radius, y, radius * 2 + 1, SSD1306_WHITE);
  display.drawFastVLine(x, y - radius, radius * 2 + 1, SSD1306_WHITE);
}

// All I2C and graphics run in loop(), never inside BLE callbacks.
static void drawFace(bool connected, uint8_t reaction, bool blink, uint32_t age) {
  display.clearDisplay();
  const bool joyful = reaction == HAPPY || reaction == CELEBRATE;
  const int bob = reaction == CELEBRATE ? ((age / 180U) % 2U ? -1 : 1) : 0;
  if (joyful) {
    for (int x : {34, 84}) {
      display.drawLine(x, 29 + bob, x + 5, 23 + bob, SSD1306_WHITE);
      display.drawLine(x + 5, 23 + bob, x + 10, 23 + bob, SSD1306_WHITE);
      display.drawLine(x + 10, 23 + bob, x + 15, 29 + bob, SSD1306_WHITE);
      display.drawLine(x, 30 + bob, x + 5, 24 + bob, SSD1306_WHITE);
      display.drawLine(x + 10, 24 + bob, x + 15, 30 + bob, SSD1306_WHITE);
    }
  } else if (reaction == ENCOURAGE) {
    // Soft, relaxed eyes and a small smile: no frown or punitive expression.
    display.fillRoundRect(34, 27, 15, 7, 3, SSD1306_WHITE);
    display.fillRoundRect(82, 27, 15, 7, 3, SSD1306_WHITE);
  } else if (blink) {
    display.fillRoundRect(34, 29, 14, 3, 1, SSD1306_WHITE);
    display.fillRoundRect(82, 29, 14, 3, 1, SSD1306_WHITE);
  } else {
    display.fillRoundRect(35, 21, 12, 19, 5, SSD1306_WHITE);
    display.fillRoundRect(83, 21, 12, 19, 5, SSD1306_WHITE);
  }

  display.drawLine(54, 43 + bob, 59, 48 + bob, SSD1306_WHITE);
  display.drawLine(59, 48 + bob, 68, 48 + bob, SSD1306_WHITE);
  display.drawLine(68, 48 + bob, 74, 43 + bob, SSD1306_WHITE);
  if (joyful) {
    display.drawLine(54, 44 + bob, 59, 49 + bob, SSD1306_WHITE);
    display.drawLine(59, 49 + bob, 68, 49 + bob, SSD1306_WHITE);
    display.drawLine(68, 49 + bob, 74, 44 + bob, SSD1306_WHITE);
  }
  if (reaction == CELEBRATE) {
    const int r = (age / 180U) % 2U ? 2 : 4;
    drawSparkle(15, 23, r);
    drawSparkle(112, 39, r);
    drawSparkle(65, 16, 2);
  }

  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(2, 1);
  display.print("Privet");
  display.fillCircle(122, 4, connected ? 3 : 1, SSD1306_WHITE);
  const char *label = reaction == HAPPY ? "Happy!" :
                      reaction == ENCOURAGE ? "Try again!" :
                      reaction == CELEBRATE ? "Well done!" :
                      connected ? "Connected" : "Ready BLE";
  display.setCursor((128 - int(strlen(label)) * 6) / 2, 56);
  display.print(label);
  display.display();
}

static void setupOLED() {
  Wire.begin(21, 22);
  Wire.setTimeOut(50);
  uint8_t address = 0;
  for (uint8_t candidate : {uint8_t(0x3C), uint8_t(0x3D)}) {
    Wire.beginTransmission(candidate);
    if (Wire.endTransmission() == 0) { address = candidate; break; }
  }
  if (!address) {
    Serial.println("[OLED] Not found at 0x3C or 0x3D. Check power/SDA/SCL.");
    Serial.println("[OLED] BLE will continue without display.");
    return;
  }
  // Wire was initialized explicitly above: periphBegin=false.
  oledReady = display.begin(SSD1306_SWITCHCAPVCC, address, true, false);
  if (!oledReady) {
    Serial.println("[OLED] Initialization failed; BLE will continue.");
    return;
  }
  display.setRotation(2);  // 180 degrees: OLED mounted upside down.
  display.dim(true);
  Serial.printf("[OLED] Initialized 128x64 at 0x%02X\n", address);
  drawFace(false, IDLE, false, 0);
}

static void updateOLED() {
  static uint32_t seenMailbox = 0, started = 0, lastFrame = 0;
  static uint8_t current = IDLE;
  static bool wasConnected = false;
  const uint32_t now = millis();
  const bool connected = phoneConnected.load();
  const uint32_t requested = faceMailbox.load();
  bool changed = connected != wasConnected;
  wasConnected = connected;
  if (requested != seenMailbox) {
    seenMailbox = requested;
    current = connected ? uint8_t(requested & 0xFFU) : uint8_t(IDLE);
    started = now;
    startServoReaction(current, now);
    changed = true;
  }
  if (!connected && current != IDLE) {
    current = IDLE; startServoReaction(IDLE, now); changed = true;
  }
  const uint32_t age = uint32_t(now - started);
  const uint32_t duration = reactionDuration(current);
  if (current != IDLE && age >= duration) {
    current = IDLE; startServoReaction(IDLE, now); changed = true;
  }
  updateServo(now);
  // A new command (including IDLE) bypasses the frame throttle. No animation
  // delay can prevent a newly received cancellation from being processed.
  if (!oledReady || (!changed && uint32_t(now - lastFrame) < 50)) return;
  lastFrame = now;
  const bool blink = current == IDLE && (now % 4300U < 130U);
  drawFace(connected, current, blink, age);
}

static const char *SERVICE_UUID = "7b5e0001-6d8a-4f3b-9c2e-1a0d8f6b4c91";
static const char *COMMAND_UUID = "7b5e0002-6d8a-4f3b-9c2e-1a0d8f6b4c91";
static const char *STATUS_UUID  = "7b5e0003-6d8a-4f3b-9c2e-1a0d8f6b4c91";

static BLECharacteristic *statusCharacteristic = nullptr;
static std::atomic<bool> restartAdvertising{false};

// Accessed only from BLE callbacks. Remember the most recent request so a
// duplicate packet is acknowledged without executing the reaction twice.
static bool haveLast = false;
static uint8_t lastCommand[8];
static uint8_t lastAck[8];

static void printPacket(const char *label, const uint8_t *packet) {
  Serial.print(label);
  for (size_t i = 0; i < 8; ++i) Serial.printf(" %02X", packet[i]);
  Serial.println();
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override {
    haveLast = false;
    requestFace(IDLE);
    phoneConnected.store(true);
    restartAdvertising.store(false);
    Serial.println("[BLE] iPhone connected. Waiting for a test command.");
  }

  void onDisconnect(BLEServer *) override {
    haveLast = false;
    phoneConnected.store(false);
    requestFace(IDLE);
    restartAdvertising.store(true);
    Serial.println("[BLE] Disconnected. No reactions are queued.");
  }
};

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    // auto works with the built-in BLE library's value type. Use length(),
    // never strlen(): this binary protocol contains zero bytes.
    const auto value = characteristic->getValue();
    if (value.length() != 8) {
      Serial.printf("[RX] Ignored invalid packet length: %u\n",
                    static_cast<unsigned>(value.length()));
      return;
    }

    uint8_t packet[8];
    memcpy(packet, value.c_str(), sizeof(packet));
    printPacket("[RX]", packet);

    if (packet[0] != 1 || packet[1] != 1) {
      Serial.println("[RX] Ignored unsupported version or message type.");
      return;
    }

    const uint32_t requestId = uint32_t(packet[2]) |
                              (uint32_t(packet[3]) << 8) |
                              (uint32_t(packet[4]) << 16) |
                              (uint32_t(packet[5]) << 24);

    if (haveLast && memcmp(packet + 2, lastCommand + 2, 4) == 0) {
      if (memcmp(packet, lastCommand, 8) != 0) {
        Serial.println("[RX] Ignored conflicting reuse of last request ID.");
        return;
      }
      statusCharacteristic->setValue(lastAck, sizeof(lastAck));
      statusCharacteristic->notify();
      Serial.println("[ACK] Duplicate request; reaction not repeated.");
      return;
    }

    uint8_t result = 0;
    if (packet[6] < HAPPY || packet[6] > IDLE) result = 1;
    else if (packet[7] != 0) result = 2;

    uint8_t ack[8];
    memcpy(ack, packet, sizeof(ack));
    ack[1] = 2;
    ack[7] = result;

    if (result == 0) {
      // Only signal loop(); no drawing, animation delays or I2C here.
      requestFace(packet[6]);
      Serial.printf("[REACTION] %s | request=%lu\n",
                    reactionName(packet[6]), static_cast<unsigned long>(requestId));
    } else {
      Serial.printf("[REJECTED] request=%lu result=%u\n",
                    static_cast<unsigned long>(requestId), result);
    }

    memcpy(lastCommand, packet, sizeof(lastCommand));
    memcpy(lastAck, ack, sizeof(lastAck));
    haveLast = true;
    statusCharacteristic->setValue(ack, sizeof(ack));
    statusCharacteristic->notify();
    printPacket("[ACK sent]", ack);
    // notify() is not delivery confirmation. The app must match the ACK and
    // show its own timeout if it does not receive the notification.
  }
};

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\nPrivet BLE + OLED + SG90 starting...");
  pinMode(SERVO_PIN, OUTPUT);
  digitalWrite(SERVO_PIN, LOW);
  Serial.println("[SERVO] GPIO25, 1300-1700 us; center 1500 us. PWM starts only for motion.");

  setupOLED();

  BLEDevice::init("Privet-ESP32");
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService *service = server->createService(SERVICE_UUID);

  statusCharacteristic = service->createCharacteristic(
    STATUS_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  statusCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *command = service->createCharacteristic(
    COMMAND_UUID, BLECharacteristic::PROPERTY_WRITE);
  command->setCallbacks(new CommandCallbacks());

  service->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  // Name can go in scan response; discovery should filter by service UUID.
  advertising->setScanResponse(true);
  advertising->start();
  Serial.println("[BLE] Advertising as Privet-ESP32. Connect from the app.");
}

void loop() {
  if (restartAdvertising.exchange(false)) {
    BLEDevice::startAdvertising();
    Serial.println("[BLE] Advertising again.");
  }
  updateOLED();
  delay(10);
}
