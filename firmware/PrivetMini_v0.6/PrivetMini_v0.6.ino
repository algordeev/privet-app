/* Privet Mini (keychain) v0.6: OLED + BLE link to the Privet app, plus an
 * MPU6050 motion sensor and two buttons for local reactions and pocket words.
 *
 * Board:  Seeed XIAO ESP32-S3, Arduino-ESP32 3.x, built-in BLE and Preferences.
 * Needs:  U8g2 library (same as the big robot). The MPU6050 is read with raw
 *         register reads over Wire: no extra library.
 * Wiring (one I2C bus for the OLED and the MPU6050):
 *   OLED    VCC 3V3, GND, SDA D4 (GPIO5), SCL D5 (GPIO6), address 0x3C
 *   MPU6050 VCC 3V3, GND, same SDA/SCL, address 0x68 (AD0 open), INT D8 (GPIO7),
 *           lying flat on the same side as the screen
 *   Left button  D7 (GPIO44) to GND, right button D9 (GPIO8) to GND (internal pull-ups)
 *   Battery divider (not fitted yet) to D0 (GPIO1): see BATTERY_DIVIDER_FITTED
 *
 * Speaks the same BLE protocol as PrivetBLE_S3 (same service and
 * characteristic UUIDs), so the app sees it like the big robot:
 *   Command: [1, 1, request-id uint32 LE, command, argument]
 *   ACK:     [1, 2, same request-id, same command, result]
 *   Commands 1-9, 11, 12 are face reactions; 10 asks for capabilities.
 *   Result: 0 accepted, 1 unsupported command, 2 invalid argument.
 * Learning cards (code 10 negotiation + protocol 2) use the same receiver as
 * the big robot (LearningCards.h / LearningLayout.h in this folder). The app
 * only sends ON_FIRE (combo) and NOD when the capability offer is complete,
 * which requires the card bits. No sound or servos.
 *
 * On screen: a sleeping face until the app's first reaction (CONNECTED) after
 * connecting, then the reaction faces and word cards. The faces are the
 * Mini's own set (MiniFaces.h), not the desk robot's; there is no corner
 * connection dot. The orange user LED (GPIO21) is on while a phone is connected.
 *
 * Local, never sent to the app (the BLE protocol is unchanged):
 *   Motion (MiniMotion.h): the IDLE eyes follow the tilt; a real shake makes
 *   it dizzy; a toss makes it go "whee".
 *   Buttons: right = pocket words (word, flip to meaning, next word), left =
 *   pat (giggle) or close the words; hold left = hug, hold right = status,
 *   hold both 2 s = reconnect.
 *   Pocket words (PocketWords.h): the last 30 Russian words the app showed
 *   with their meaning (discovery and answer cards), kept in flash.
 * Power (MiniPower.h): the CPU runs at 80 MHz and the MPU6050's gyro is off.
 *   After a minute of no use the screen dims and redraws less often; after 5
 *   minutes untouched with no phone connected it goes to deep sleep; only the
 *   right button (D9) wakes it.
 * Every command, ACK, motion and button event is printed to Serial at 115200.
 */

#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>
#include <atomic>
#include <driver/rtc_io.h>
#include <esp_sleep.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#include "LearningCards.h"
#include "LearningLayout.h"
#include "MiniButtons.h"
#include "MiniFaces.h"
#include "MiniMotion.h"
#include "MiniPower.h"
#include "PocketWords.h"

// Defined before any function: the Arduino build declares functions that
// take it near the top of the sketch.
struct CardLayout {
  uint32_t revision = 0; bool valid = false, compact = false;
  PrivetLayout::Lines primary, secondary;
  int primaryX[2] = {}, secondaryX[2] = {};
};

// ---- Pins ----
static constexpr int I2C_SDA_PIN = 5;        // D4: OLED and MPU6050
static constexpr int I2C_SCL_PIN = 6;        // D5
static constexpr int MPU_INT_PIN = 7;        // D8: MPU6050 INT, high on motion
static constexpr int LEFT_BUTTON_PIN = 44;   // D7, to GND
static constexpr int RIGHT_BUTTON_PIN = 8;   // D9, to GND
static constexpr int BATTERY_PIN = 1;        // D0 (A0), battery divider
static constexpr int LED_PIN = 21;           // XIAO user LED, LOW = on

// ---- Battery ----
// Set to true once a divider from the battery + to D0 is fitted (two equal
// resistors, e.g. 2 x 220 kOhm, give BATTERY_DIVIDER = 2). Until then the
// battery is not read and the status screen leaves it out.
static constexpr bool BATTERY_DIVIDER_FITTED = false;
static constexpr float BATTERY_DIVIDER = 2.0f;
static constexpr uint32_t BATTERY_READ_MS = 10000;

// ---- Motion ----
// -1: the MPU6050's +Z points into the board, away from you (the SY-104
// module's chip is on its underside, facing the board). +1 if +Z points out
// of the screen. Wrong sign: left and right are swapped, and the eyes look
// down instead of up when it lies on its back.
static constexpr int8_t MOTION_SCREEN_SIGN = -1;
static constexpr int LOOK_MAX_X_PX = 10;  // eyes: furthest sideways
static constexpr int LOOK_MAX_UP_PX = 8;  // eyes: furthest up (lying on its back)
// Motion interrupt on INT (D8): above MOT_THR x 2 mg (after the 5 Hz
// high-pass) for MOT_DUR ms. It is only logged.
static constexpr uint8_t MPU_MOTION_THRESHOLD = 20;
static constexpr uint8_t MPU_MOTION_DURATION_MS = 1;
// The input task samples the buttons every 10 ms and the MPU6050 every 20 ms,
// also while loop() sends a frame to the screen.
static constexpr uint32_t INPUT_TICK_MS = 10;

// ---- Local reactions ----
// Awake, motion and the left button play only over a resting face (IDLE or
// THINKING), and any app command ends them at once. Asleep (the sleeping
// face), a shake, a toss or the left button gives a drowsy stir, at most once
// per STIR_GAP_MS.
static constexpr uint32_t STIR_GAP_MS = 4000;
static constexpr uint32_t STATUS_SHOW_MS = 3000;     // hold right
static constexpr uint32_t RECONNECT_SHOW_MS = 1500;  // hold both
// Pocket words open only asleep or over IDLE, never while a lesson question
// or hint is on, so the screen cannot give an answer away.
static constexpr uint32_t WORDS_CLOSE_MS = 30000;    // closes after this long untouched
static constexpr uint8_t WORDS_PROUD_AFTER = 5;      // meanings seen before a proud face

// ---- Power ---- (the timings are in MiniPower.h)
static constexpr uint32_t CPU_MHZ = 80;            // the lowest that keeps BLE running
static constexpr uint8_t CONTRAST_BRIGHT = 0xCF;   // U8g2's SSD1306 default
static constexpr uint8_t CONTRAST_DIM = 0x01;
static constexpr uint32_t FRAME_MS = 33, FRAME_DIM_MS = 100;  // 30 fps, 10 fps dimmed

// The app finds companions by service UUID; the name tells it which device
// this is (the big robot advertises "Privet-ESP32").
static const char *BLE_NAME = "Privet-Mini";

static const char *SERVICE_UUID = "7b5e0001-6d8a-4f3b-9c2e-1a0d8f6b4c91";
static const char *COMMAND_UUID = "7b5e0002-6d8a-4f3b-9c2e-1a0d8f6b4c91";
static const char *STATUS_UUID  = "7b5e0003-6d8a-4f3b-9c2e-1a0d8f6b4c91";

// If the I2C scan finds the screen but the picture is garbled or shifted,
// swap SSD1306 for SH1106 in this line (some cheap boards use that chip).
static U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE, I2C_SCL_PIN, I2C_SDA_PIN);
static bool oledReady = false;
static Preferences prefs;  // flash: "up" and the pocket words

enum Reaction : uint8_t {
  HAPPY = 1, ENCOURAGE = 2, CELEBRATE = 3, IDLE = 4, LISTENING = 5,
  THINKING = 6, HINT = 7, STREAK = 8, CONNECTED = 9,
  CAPABILITIES = 10,  // control code, not a reaction
  NOD = 11, ON_FIRE = 12
};
static constexpr uint8_t SET_VOLUME = 13;  // big robot only; unsupported here

static const char *reactionName(uint8_t r) {
  switch (r) {
    case HAPPY: return "happy"; case ENCOURAGE: return "encourage";
    case CELEBRATE: return "celebrate"; case LISTENING: return "listening";
    case THINKING: return "thinking"; case HINT: return "hint";
    case STREAK: return "streak"; case CONNECTED: return "connected";
    case NOD: return "nod"; case ON_FIRE: return "on fire";
    default: return "idle";
  }
}

// How long a reaction shows before falling back to the resting face.
// 0 = stays until the next command (THINKING, IDLE).
static uint32_t reactionDuration(uint8_t r) {
  switch (r) {
    case HAPPY: return 2000; case ENCOURAGE: return 2200; case CELEBRATE: return 4500;
    case LISTENING: return 15000; case HINT: return 1500; case STREAK: return 3600;
    case CONNECTED: return 2400; case NOD: return 900; case ON_FIRE: return 2200;
    default: return 0;
  }
}

// ---- Shared state: BLE callbacks write, loop() reads ----
// Low byte = reaction, upper bits = revision so a repeated command restarts it.
static std::atomic<uint32_t> faceMailbox{IDLE};
static std::atomic<uint8_t> fireCombo{0};
static std::atomic<bool> phoneConnected{false};
static std::atomic<bool> restartAdvertising{false};
// Like the big robot: the link alone does not wake the face; the first
// accepted reaction from the app (CONNECTED) does.
static std::atomic<bool> awake{false};
static uint32_t connectionNonce = 0;
static std::atomic<uint32_t> latestFaceId{0};
static portMUX_TYPE cardsMux = portMUX_INITIALIZER_UNLOCKED;
static PrivetCards::Receiver cards;

static void requestFace(uint8_t reaction) {
  const uint32_t previous = faceMailbox.load();
  faceMailbox.store(((previous + 256U) & 0xFFFFFF00U) | reaction);
}

// ---- BLE ----
static BLEServer *bleServer = nullptr;
static BLECharacteristic *statusCharacteristic = nullptr;
static SemaphoreHandle_t bleNotifyMutex = nullptr;

static void sendStatus(const uint8_t *data, size_t length) {
  if (!statusCharacteristic) return;
  if (xSemaphoreTake(bleNotifyMutex, portMAX_DELAY) == pdTRUE) {
    statusCharacteristic->setValue(const_cast<uint8_t *>(data), length);
    statusCharacteristic->notify();
    xSemaphoreGive(bleNotifyMutex);
  }
}

static uint32_t u32(const uint8_t *p) {
  return uint32_t(p[0]) | (uint32_t(p[1]) << 8) | (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24);
}

static void printPacket(const char *label, const uint8_t *p, size_t n) {
  Serial.print(label);
  for (size_t i = 0; i < n; ++i) Serial.printf(" %02X", p[i]);
  Serial.println();
}

// Same layout as the big robot. Byte 6 = feature bits: 1 UTF-8 cards,
// 2 Cyrillic, 4 OLED ready (the app needs all three for a valid offer),
// 8 NOD + ON_FIRE, 16 sound (none here).
static void sendCapabilities(uint32_t requestId) {
  uint8_t p[20] = {2, 0x80};
  for (int i = 0; i < 4; i++) {
    p[i + 2] = uint8_t(requestId >> (8 * i));
    p[i + 12] = uint8_t(connectionNonce >> (8 * i));
  }
  p[6] = (oledReady ? 7 : 3) | 8;
  p[7] = 20; p[8] = 96; p[10] = 64; p[11] = 32; p[16] = 0x88; p[17] = 0x13;
  sendStatus(p, 20);
  printPacket("[BLE] caps ->", p, 20);
}

// Exact duplicate requests get the same ACK without running the reaction twice.
static bool haveLast = false;
static uint8_t lastCommand[8], lastAck[8];

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override {
    haveLast = false;
    awake.store(false);
    connectionNonce = esp_random(); if (!connectionNonce) connectionNonce = 1;
    latestFaceId.store(0);
    portENTER_CRITICAL(&cardsMux); cards.connection(connectionNonce); portEXIT_CRITICAL(&cardsMux);
    phoneConnected.store(true);
    restartAdvertising.store(false);
    requestFace(IDLE);  // the app sends CONNECTED (9) itself once subscribed
    Serial.println("[BLE] Phone connected. Waiting for app commands.");
  }
  void onDisconnect(BLEServer *) override {
    haveLast = false;
    awake.store(false);
    phoneConnected.store(false);
    portENTER_CRITICAL(&cardsMux); cards.connection(0); portEXIT_CRITICAL(&cardsMux);
    latestFaceId.store(0);
    requestFace(IDLE);
    restartAdvertising.store(true);
    Serial.println("[BLE] Disconnected.");
  }
};

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    const size_t length = c->getLength();
    if (length < 2) return;
    uint8_t packet[20] = {};
    memcpy(packet, c->getData(), length > 20 ? 20 : length);
    printPacket("[BLE] <-", packet, length > 20 ? 20 : length);

    // Learning cards (protocol 2), same receiver as the big robot.
    if (packet[0] == 2) {
      portENTER_CRITICAL(&cardsMux);
      const auto reply = cards.receive(packet, length, millis(), oledReady);
      portEXIT_CRITICAL(&cardsMux);
      if (reply.send) { sendStatus(reply.bytes, 8); printPacket("[CARD] ack ->", reply.bytes, 8); }
      return;
    }

    if (length != 8 || packet[0] != 1 || packet[1] != 1) return;
    const uint32_t requestId = u32(packet + 2);
    if (!requestId) return;

    if (haveLast && u32(lastCommand + 2) == requestId) {
      if (memcmp(packet, lastCommand, 8)) return;
      sendStatus(lastAck, 8);
      if (packet[6] == CAPABILITIES && lastAck[7] == 0) sendCapabilities(requestId);
      return;
    }

    const uint8_t cmd = packet[6], arg = packet[7];
    uint8_t result;
    if (cmd < 1 || cmd > ON_FIRE) result = 1;            // includes SET_VOLUME
    else if (arg != 0 && cmd != ON_FIRE) result = 2;
    else result = 0;

    uint8_t ack[8];
    memcpy(ack, packet, 8); ack[1] = 2; ack[7] = result;

    if (!result && cmd != CAPABILITIES) {
      if (cmd == ON_FIRE) fireCombo.store(arg);
      portENTER_CRITICAL(&cardsMux); cards.face(requestId); portEXIT_CRITICAL(&cardsMux);
      latestFaceId.store(requestId);
      requestFace(cmd);
      awake.store(true);  // after the mailbox, so the first awake frame sees it
    }

    memcpy(lastCommand, packet, 8); memcpy(lastAck, ack, 8); haveLast = true;
    sendStatus(ack, 8);
    printPacket("[BLE] ack ->", ack, 8);
    if (!result && cmd == CAPABILITIES) sendCapabilities(requestId);
  }
};

static void setupBLE() {
  bleNotifyMutex = xSemaphoreCreateMutex();
  BLEDevice::init(BLE_NAME);
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());
  BLEService *service = bleServer->createService(SERVICE_UUID);
  statusCharacteristic = service->createCharacteristic(STATUS_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  statusCharacteristic->addDescriptor(new BLE2902());
  BLECharacteristic *command = service->createCharacteristic(COMMAND_UUID, BLECharacteristic::PROPERTY_WRITE);
  command->setCallbacks(new CommandCallbacks());
  service->start();
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  adv->start();
  Serial.printf("[BLE] Advertising as %s. Connect from the app.\n", BLE_NAME);
}

// Both buttons held: drop the phone (tap Connect in the app to reconnect;
// the app never reconnects by itself) or restart advertising.
static void restartBLE() {
  if (phoneConnected.load() && bleServer) {
    Serial.println("[BLE] Dropping the phone; tap Connect in the app to reconnect.");
    bleServer->disconnect(bleServer->getConnId());
  } else {
    BLEDevice::stopAdvertising();
    restartAdvertising.store(true);
  }
}

// ---- I2C bus: one Wire for the OLED and the MPU6050 ----
static uint8_t oledAddress = 0, motionAddress = 0;  // 0: not found

static void setupI2C() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, 400000);
  Wire.setTimeOut(5);  // a stuck bus never stalls loop() for long
  Serial.print("[I2C] Devices:");
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() != 0) continue;
    Serial.printf(" 0x%02X", a);
    if ((a == 0x3C || a == 0x3D) && !oledAddress) oledAddress = a;
    if ((a == 0x68 || a == 0x69) && !motionAddress) motionAddress = a;
  }
  Serial.println();
}

// ---- OLED ----
// splash: the "Privet Mini" start-up screen, left out when waking from deep sleep.
static void setupOLED(bool splash) {
  if (!oledAddress) {
    Serial.println("[OLED] Nothing at 0x3C/0x3D. Check SDA->D4, SCL->D5, VCC->3V3. BLE still runs.");
    return;
  }
  oled.setI2CAddress(oledAddress << 1);
  oled.setBusClock(400000);
  oledReady = oled.begin();  // reuses the bus started in setupI2C()
  oled.enableUTF8Print();
  Serial.printf("[OLED] %s at 0x%02X\n", oledReady ? "OK" : "begin() failed", oledAddress);
  if (!oledReady) return;
  oled.setContrast(CONTRAST_BRIGHT);
  if (!splash) return;

  oled.clearBuffer();
  oled.setFont(u8g2_font_helvB12_tr);
  oled.drawStr(18, 28, "Privet Mini");
  oled.setFont(u8g2_font_5x8_tr);
  oled.drawStr(26, 46, "screen OK - BLE...");
  oled.sendBuffer();
  delay(1200);
}

// ---- MPU6050 (raw registers, as in PrivetBLE_S3_v5) ----
static MiniMotion::Detector motion(MOTION_SCREEN_SIGN);

static bool mpuWrite(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(motionAddress);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

static uint8_t mpuRead(uint8_t reg) {
  Wire.beginTransmission(motionAddress);
  Wire.write(reg);
  Wire.endTransmission(false);
  return Wire.requestFrom(int(motionAddress), 1) == 1 ? uint8_t(Wire.read()) : 0;
}

// Without the sensor everything else works, without motion reactions.
static void setupMotion() {
  if (!motionAddress) {
    Serial.println("[MOTION] No MPU6050 at 0x68/0x69 (check 3V3, SDA D4, SCL D5); motion disabled.");
    return;
  }
  const uint8_t who = mpuRead(0x75);
  // Wake up on the internal clock with the gyro in standby (only the
  // accelerometer is used; this saves about 3.5 mA), ~44 Hz low-pass,
  // accelerometer +-4 g with the 5 Hz high-pass for motion detection only
  // (the data registers are not filtered). INT: active high, push-pull,
  // latched until any register read (the 20 ms sample clears it), on motion only.
  if (!mpuWrite(0x6B, 0x00) || !mpuWrite(0x6C, 0x07) || !mpuWrite(0x1A, 0x03) || !mpuWrite(0x1C, 0x09) ||
      !mpuWrite(0x1F, MPU_MOTION_THRESHOLD) || !mpuWrite(0x20, MPU_MOTION_DURATION_MS) ||
      !mpuWrite(0x37, 0x30) || !mpuWrite(0x38, 0x40)) {
    motionAddress = 0;
    Serial.println("[MOTION] MPU6050 did not accept its settings; motion disabled.");
    return;
  }
  Serial.printf("[MOTION] MPU6050 at 0x%02X (WHO_AM_I 0x%02X).\n", motionAddress, who);
  float up[3];
  if (prefs.getBytes("up", up, sizeof up) == sizeof up) {
    motion.setUp({up[0], up[1], up[2]});
    Serial.printf("[MOTION] Using the saved \"up\" (%.2f, %.2f, %.2f). Holding it upright and still in the next 10 s relearns it.\n", up[0], up[1], up[2]);
  } else {
    Serial.println("[MOTION] No saved \"up\" yet: hold it upright (screen facing you) and still for a moment.");
  }
}

// ---- Input task: buttons and motion, sampled on a steady clock ----
// The only code that touches the detector and the button reader. It hands
// events to loop() through inputQueue; loop() does all printing and drawing.
enum InputEvent : uint8_t {
  // 1..3: MiniMotion::Event (SHAKEN, TOSSED, LEARNED_UP)
  IN_INT_SEEN = 9,
  IN_BUTTON = 16,  // + MiniButtons::Event
};
static QueueHandle_t inputQueue = nullptr;
static std::atomic<bool> inputPaused{false};  // set just before deep sleep
static std::atomic<int> lookXMilli{0}, lookYMilli{0};  // MiniMotion look x 1000
static std::atomic<int> learnedUpMilli[3];

static void post(uint8_t event) { xQueueSend(inputQueue, &event, 0); }

static void sampleMotion(uint32_t now) {
  static bool intSeen = false;
  if (!intSeen && digitalRead(MPU_INT_PIN) == HIGH) { intSeen = true; post(IN_INT_SEEN); }
  Wire.beginTransmission(motionAddress);
  Wire.write(0x3B);  // ACCEL_XOUT_H: the accelerometer
  if (Wire.endTransmission(false) != 0 || Wire.requestFrom(int(motionAddress), 6) != 6) return;
  uint8_t raw[6];
  for (uint8_t &b : raw) b = Wire.read();
  const auto value = [&](int i) { return float(int16_t((raw[i] << 8) | raw[i + 1])) / 8192.0f; };  // +-4 g
  const MiniMotion::Event event = motion.update({value(0), value(2), value(4)}, now);
  lookXMilli.store(int(lroundf(motion.lookX() * 1000)));
  lookYMilli.store(int(lroundf(motion.lookY() * 1000)));
  if (event == MiniMotion::LEARNED_UP) {
    const MiniMotion::Vec up = motion.up();
    learnedUpMilli[0].store(int(lroundf(up.x * 1000)));
    learnedUpMilli[1].store(int(lroundf(up.y * 1000)));
    learnedUpMilli[2].store(int(lroundf(up.z * 1000)));
  }
  if (event != MiniMotion::NONE) post(event);
}

static void inputTask(void *) {
  MiniButtons::Reader buttons;
  TickType_t wake = xTaskGetTickCount();
  for (uint32_t tick = 0;; tick++) {
    vTaskDelayUntil(&wake, pdMS_TO_TICKS(INPUT_TICK_MS));
    if (inputPaused.load()) continue;
    const uint32_t now = millis();
    const MiniButtons::Event b = buttons.update(digitalRead(LEFT_BUTTON_PIN) == LOW, digitalRead(RIGHT_BUTTON_PIN) == LOW, now);
    if (b != MiniButtons::NONE) post(uint8_t(IN_BUTTON) + uint8_t(b));
    if (motionAddress && tick % 2 == 0) sampleMotion(now);
  }
}

static void setupInput() {
  // After a wake by a pin, that pin is still routed to the RTC: hand it back.
  rtc_gpio_deinit(gpio_num_t(RIGHT_BUTTON_PIN));
  pinMode(MPU_INT_PIN, INPUT_PULLDOWN);
  pinMode(LEFT_BUTTON_PIN, INPUT_PULLUP);
  pinMode(RIGHT_BUTTON_PIN, INPUT_PULLUP);
  inputQueue = xQueueCreate(16, 1);
  // Above loop() (priority 1) on its core, so frames never delay a sample.
  xTaskCreatePinnedToCore(inputTask, "input", 4096, nullptr, 2, nullptr, ARDUINO_RUNNING_CORE);
}

// ---- Pocket words, kept in flash ----
static PocketWords::Deck deck;

static void loadWords() {
  if (prefs.getBytes("words", &deck, sizeof deck) != sizeof deck || !deck.valid()) deck = PocketWords::Deck();
  if (deck.dedupe()) prefs.putBytes("words", &deck, sizeof deck);  // e.g. "Спасибо!" and "спасибо"
  Serial.printf("[WORDS] %u pocket words saved\n", unsigned(deck.count));
}

static void keepWord(const PrivetCards::Card &card) {
  if (!deck.add(card.mode, card.primary, card.secondary)) return;
  prefs.putBytes("words", &deck, sizeof deck);
  Serial.printf("[WORDS] kept \"%s\" = \"%s\" (%u saved)\n", card.primary, card.secondary, unsigned(deck.count));
}

// ---- Battery ----
static int batteryPercent = -1;  // -1: not measured
static uint32_t batteryMillivolts = 0;

// A LiPo cell at rest: millivolts to percent, interpolated.
static int lipoPercent(uint32_t mv) {
  static const uint16_t curve[][2] = {{3300, 0}, {3500, 5}, {3600, 12}, {3700, 28}, {3800, 45}, {3900, 62}, {4000, 78}, {4100, 90}, {4200, 100}};
  if (mv <= curve[0][0]) return 0;
  for (size_t i = 1; i < sizeof curve / sizeof curve[0]; i++) {
    if (mv > curve[i][0]) continue;
    const uint32_t v0 = curve[i - 1][0], v1 = curve[i][0], p0 = curve[i - 1][1], p1 = curve[i][1];
    return int(p0 + (p1 - p0) * (mv - v0) / (v1 - v0));
  }
  return 100;
}

static void readBattery() {
  if (!BATTERY_DIVIDER_FITTED) return;
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) sum += analogReadMilliVolts(BATTERY_PIN);
  batteryMillivolts = uint32_t(sum / 16 * BATTERY_DIVIDER);
  batteryPercent = lipoPercent(batteryMillivolts);
}

static void updateBattery(uint32_t now) {
  static uint32_t lastRead = 0;
  if (!BATTERY_DIVIDER_FITTED || (lastRead && now - lastRead < BATTERY_READ_MS)) return;
  lastRead = now ? now : 1;
  readBattery();
}

// ---- Faces: the Mini's own set, in MiniFaces.h ----
// Drawn pixel by pixel so the app's 3D figure shows the same pixels.
static auto plot = [](int x, int y, bool on) { oled.setDrawColor(on ? 1 : 0); oled.drawPixel(x, y); };
using OledPen = MiniFaces::Pen<decltype(plot)>;

static void drawFace(uint8_t r, uint32_t age, uint32_t now, bool connected) {
  OledPen pen(plot);
  if (!connected) MiniFaces::sleeping(pen, now);
  else MiniFaces::reaction(pen, r, age, now, fireCombo.load());
  oled.setDrawColor(1);
}

static void drawLocal(uint8_t which, uint32_t t, uint32_t now) {
  OledPen pen(plot);
  MiniFaces::local(pen, which, t, now);
  oled.setDrawColor(1);
}

static void drawLook(int dx, int dy, uint32_t now) {
  OledPen pen(plot);
  MiniFaces::look(pen, dx, dy, now);
  oled.setDrawColor(1);
}

static void drawCentered(int baseline, const char *text) {
  oled.drawStr((128 - int(oled.getStrWidth(text))) / 2, baseline, text);
}

// ---- Learning cards (same layout as the big robot) ----
static CardLayout cardLayout, wordLayout;

static void layoutCard(CardLayout &layout, const PrivetCards::Card &card) {
  if (layout.valid && layout.revision == card.revision) return;
  const auto measure = [](const char *text) { return oled.getUTF8Width(text); };
  oled.setFont(u8g2_font_6x13_t_cyrillic);
  layout.secondary = PrivetLayout::wrap(card.secondary, measure);
  oled.setFont(u8g2_font_9x15_t_cyrillic);
  layout.primary = PrivetLayout::wrap(card.primary, measure);
  layout.compact = !layout.primary.complete || (layout.primary.count == 2 && layout.secondary.count == 2);
  if (layout.compact) { oled.setFont(u8g2_font_6x13_t_cyrillic); layout.primary = PrivetLayout::wrap(card.primary, measure); }
  oled.setFont(layout.compact ? u8g2_font_6x13_t_cyrillic : u8g2_font_9x15_t_cyrillic);
  for (uint8_t i = 0; i < layout.primary.count; i++) layout.primaryX[i] = (128 - int(oled.getUTF8Width(layout.primary.text[i]))) / 2;
  oled.setFont(u8g2_font_6x13_t_cyrillic);
  for (uint8_t i = 0; i < layout.secondary.count; i++) layout.secondaryX[i] = (128 - int(oled.getUTF8Width(layout.secondary.text[i]))) / 2;
  layout.revision = card.revision; layout.valid = true;
}

static void drawCard(CardLayout &layout, const PrivetCards::Card &card) {
  layoutCard(layout, card);
  const PrivetLayout::Frame frame(layout.primary.count, layout.secondary.count, layout.compact);
  oled.setFont(layout.compact ? u8g2_font_6x13_t_cyrillic : u8g2_font_9x15_t_cyrillic);
  for (uint8_t i = 0; i < layout.primary.count; i++) oled.drawUTF8(layout.primaryX[i], frame.primaryBaseline(i), layout.primary.text[i]);
  oled.setFont(u8g2_font_6x13_t_cyrillic);
  for (uint8_t i = 0; i < layout.secondary.count; i++) oled.drawUTF8(layout.secondaryX[i], frame.secondaryBaseline(i), layout.secondary.text[i]);
}

// How long the face shows before its card replaces it (the app's timings).
static uint32_t cardDelay(uint8_t face, uint8_t previous) {
  switch (face) {
    case IDLE: return 0;
    // Back to the same question (after speech, a hint, a pair...): no flash.
    case THINKING: return previous == LISTENING || previous == HINT || previous == NOD || previous == THINKING ? 0 : 700;
    case LISTENING: return 500;
    default: return reactionDuration(face);
  }
}

// Hint card: 2 s once visible. Home status card (with IDLE): 4 s. Others: 30 s.
static bool cardExpired(const PrivetCards::Card &card, uint8_t face, uint32_t now,
                        uint32_t receivedAt, bool visible, uint32_t shownAt) {
  if (card.mode == 4) return visible && now - shownAt >= 2000;
  if (card.mode == 1 && face == IDLE) return visible && now - shownAt >= 4000;
  return now - receivedAt >= 30000;
}

// ---- Power, owned by loop() ----
static MiniPower::Idle power;
static bool dimmed = false;
static bool ignoreRightUntilUp = false;  // the press that woke it is not a press

// Deep sleep: screen and MPU6050 off, the chip woken only by the right
// button going low (D9). Waking starts the sketch again from setup(), which
// also wakes the MPU6050.
static void enterDeepSleep() {
  Serial.println("[POWER] no use for a while and no phone: deep sleep. Press the right button to wake.");
  inputPaused.store(true);
  delay(3 * INPUT_TICK_MS);  // let a sample in progress finish
  if (oledReady) oled.setPowerSave(1);
  digitalWrite(LED_PIN, HIGH);  // off
  if (motionAddress) mpuWrite(0x6B, 0x40);  // PWR_MGMT_1 SLEEP: a few microamps
  esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_PERIPH, ESP_PD_OPTION_ON);  // keeps the pull-up below
  esp_sleep_enable_ext0_wakeup(gpio_num_t(RIGHT_BUTTON_PIN), 0);
  rtc_gpio_pullup_en(gpio_num_t(RIGHT_BUTTON_PIN));
  rtc_gpio_pulldown_dis(gpio_num_t(RIGHT_BUTTON_PIN));
  Serial.flush();
  esp_deep_sleep_start();
}

// Dims the screen after a minute of no use and sleeps after 5 minutes
// untouched without a phone (MiniPower.h decides).
static void updatePower(uint32_t now) {
  static bool wasLinked = false;
  const bool linked = phoneConnected.load();
  if (linked != wasLinked) { wasLinked = linked; power.touch(now); }
  const MiniPower::Stage stage = power.update(now, linked);
  if (stage == MiniPower::SLEEP) enterDeepSleep();
  const bool dim = stage == MiniPower::DIM;
  if (dim == dimmed) return;
  dimmed = dim;
  if (oledReady) oled.setContrast(dim ? CONTRAST_DIM : CONTRAST_BRIGHT);
  Serial.println(dim ? "[POWER] no use for a minute: screen dimmed" : "[POWER] in use: screen bright");
}

// ---- Local state, owned by loop() ----
static uint8_t localFace = 0;  // MiniFaces::Local, 0 = none
static uint32_t localAt = 0, lastStirAt = 0;
static bool stirred = false;
static bool statusShown = false, reconnectShown = false;
static uint32_t statusAt = 0, reconnectAt = 0;
enum WordsView : uint8_t { WORDS_CLOSED, WORDS_FRONT, WORDS_BACK, WORDS_EMPTY };
static uint8_t wordsView = WORDS_CLOSED, wordsIndex = 0, wordsSeen = 0;
static uint32_t wordsAt = 0, wordsRevision = 0;

static void startLocal(uint8_t face, uint32_t now) { localFace = face; localAt = now; }

static uint32_t localDuration(uint8_t face) {
  switch (face) {
    case MiniFaces::STIR: return MiniFaces::STIR_MS;
    case MiniFaces::WHEE: return MiniFaces::WHEE_MS;
    case MiniFaces::DIZZY: return MiniFaces::DIZZY_MS;
    case MiniFaces::GIGGLE: return MiniFaces::GIGGLE_MS;
    case MiniFaces::PROUD: return MiniFaces::PROUD_MS;
    default: return 0;  // HUG: until the left button is released
  }
}

// Asleep: a drowsy stir, at most once per STIR_GAP_MS.
static void stir(uint32_t now, const char *source) {
  if (stirred && now - lastStirAt < STIR_GAP_MS) { Serial.printf("[%s] asleep: no stir (one per %u s)\n", source, unsigned(STIR_GAP_MS / 1000)); return; }
  stirred = true; lastStirAt = now;
  startLocal(MiniFaces::STIR, now);
  Serial.printf("[%s] asleep: stir\n", source);
}

static void showWord(uint8_t index, uint32_t now) {
  wordsIndex = index; wordsView = WORDS_FRONT; wordsAt = now; wordsRevision++;
  Serial.printf("[WORDS] %u/%u: %s\n", unsigned(index + 1), unsigned(deck.count), deck.words[index].russian);
}

// proud: a reward face after WORDS_PROUD_AFTER meanings (not when an app
// command closed the words).
static void closeWords(uint32_t now, const char *why, bool proud) {
  if (wordsView == WORDS_CLOSED) return;
  Serial.printf("[WORDS] closed (%s), %u meanings seen\n", why, unsigned(wordsSeen));
  if (proud && wordsSeen >= WORDS_PROUD_AFTER) startLocal(MiniFaces::PROUD, now);
  wordsView = WORDS_CLOSED; wordsSeen = 0;
}

// Right button: open, flip to the meaning, next word.
static void wordsButton(uint32_t now, bool allowed) {
  switch (wordsView) {
    case WORDS_CLOSED:
      if (!allowed) { Serial.println("[WORDS] not now: a question, hint or reaction is on"); return; }
      localFace = 0; wordsSeen = 0;
      if (deck.count) showWord(0, now);
      else { wordsView = WORDS_EMPTY; wordsAt = now; Serial.println("[WORDS] none saved yet"); }
      break;
    case WORDS_FRONT:
      wordsView = WORDS_BACK; wordsAt = now; wordsRevision++;
      if (wordsSeen < 255) wordsSeen++;
      Serial.printf("[WORDS] meaning: %s\n", deck.words[wordsIndex].meaning);
      break;
    case WORDS_BACK: showWord(uint8_t((wordsIndex + 1) % deck.count), now); break;
    default: closeWords(now, "right", false); break;
  }
}

static void handleInput(uint8_t event, uint32_t now, bool connected, bool resting, bool wordsAllowed) {
  using namespace MiniMotion;
  if (event == IN_INT_SEEN) { Serial.println("[MOTION] INT on D8 went high: the motion interrupt is wired"); return; }

  if (event >= IN_BUTTON) {
    switch (event - IN_BUTTON) {
      case MiniButtons::RIGHT_SHORT:
        Serial.println("[BUTTON] right short");
        wordsButton(now, wordsAllowed);
        break;
      case MiniButtons::LEFT_SHORT:
        Serial.println("[BUTTON] left short");
        if (wordsView != WORDS_CLOSED) closeWords(now, "left", true);
        else if (!connected) stir(now, "BUTTON");
        else if (resting) { startLocal(MiniFaces::GIGGLE, now); Serial.println("[BUTTON] pat: giggle"); }
        else Serial.println("[BUTTON] pat ignored: a reaction is playing");
        break;
      case MiniButtons::LEFT_HOLD:
        Serial.println("[BUTTON] left hold");
        if (wordsView != WORDS_CLOSED) break;
        if (!connected) stir(now, "BUTTON");
        else if (resting) { startLocal(MiniFaces::HUG, now); Serial.println("[BUTTON] hug"); }
        else Serial.println("[BUTTON] hug ignored: a reaction is playing");
        break;
      case MiniButtons::LEFT_RELEASE:
        Serial.println("[BUTTON] left released");
        if (localFace == MiniFaces::HUG) localFace = 0;
        break;
      case MiniButtons::RIGHT_HOLD:
        readBattery();
        statusShown = true; statusAt = now;
        Serial.printf("[BUTTON] right hold: status (%s, %u words", phoneConnected.load() ? "connected" : "waiting for app", unsigned(deck.count));
        if (batteryPercent >= 0) Serial.printf(", battery %u mV, %d%%", unsigned(batteryMillivolts), batteryPercent);
        else Serial.print(", battery not fitted");
        Serial.println(")");
        break;
      case MiniButtons::RIGHT_RELEASE:
        break;
      case MiniButtons::BOTH_HELD:
        Serial.println("[BUTTON] both held: restarting BLE");
        if (localFace == MiniFaces::HUG) localFace = 0;
        statusShown = false;
        reconnectShown = true; reconnectAt = now;
        restartBLE();
        break;
    }
    return;
  }

  switch (event) {
    case LEARNED_UP: {
      const float up[3] = {learnedUpMilli[0].load() / 1000.0f, learnedUpMilli[1].load() / 1000.0f, learnedUpMilli[2].load() / 1000.0f};
      prefs.putBytes("up", up, sizeof up);
      Serial.printf("[MOTION] learned \"up\" (%.2f, %.2f, %.2f) and saved it\n", up[0], up[1], up[2]);
      break;
    }
    case SHAKEN:
      if (wordsView == WORDS_FRONT || wordsView == WORDS_BACK) {
        Serial.println("[MOTION] shaken: a random word");
        if (deck.count > 1) showWord(uint8_t((wordsIndex + 1 + esp_random() % (deck.count - 1)) % deck.count), now);
      } else if (!connected) { Serial.println("[MOTION] shaken"); stir(now, "MOTION"); }
      else if (resting && localFace != MiniFaces::HUG) { startLocal(MiniFaces::DIZZY, now); Serial.println("[MOTION] shaken: dizzy"); }
      else Serial.println("[MOTION] shaken (ignored: a reaction is playing)");
      break;
    case TOSSED:
      if (wordsView != WORDS_CLOSED) Serial.println("[MOTION] tossed (ignored: pocket words open)");
      else if (!connected) { Serial.println("[MOTION] tossed"); stir(now, "MOTION"); }
      else if (resting && localFace != MiniFaces::HUG) { startLocal(MiniFaces::WHEE, now); Serial.println("[MOTION] tossed: whee"); }
      else Serial.println("[MOTION] tossed (ignored: a reaction is playing)");
      break;
  }
}

// Hold right: name, link, words saved and (once fitted) battery. Not a face.
static void drawStatusScreen() {
  oled.setFont(u8g2_font_helvB12_tr);
  drawCentered(14, "Privet Mini");
  oled.setFont(u8g2_font_6x13_tr);
  drawCentered(32, phoneConnected.load() ? "connected" : "waiting for app");
  char line[24];
  snprintf(line, sizeof line, "%u word%s saved", unsigned(deck.count), deck.count == 1 ? "" : "s");
  drawCentered(46, line);
  if (batteryPercent >= 0) {
    snprintf(line, sizeof line, "battery %d%%", batteryPercent);
    drawCentered(60, line);
  }
}

static void drawReconnectScreen() {
  oled.setFont(u8g2_font_helvB12_tr);
  drawCentered(38, "Reconnect...");
}

// A pocket word: the Russian on the front; the meaning added on the back.
// Same layout as the app's cards, and "3/12" in the top right corner.
static void drawWords() {
  if (wordsView == WORDS_EMPTY) {
    oled.setFont(u8g2_font_6x13_tr);
    drawCentered(28, "No words yet");
    drawCentered(46, "Learn in the app");
    return;
  }
  const PocketWords::Word &w = deck.words[wordsIndex];
  PrivetCards::Card card;
  card.revision = wordsRevision;
  strcpy(card.primary, w.russian);
  if (wordsView == WORDS_BACK) strcpy(card.secondary, w.meaning);
  drawCard(wordLayout, card);
  char where[8];
  snprintf(where, sizeof where, "%u/%u", unsigned(wordsIndex + 1), unsigned(deck.count));
  oled.setFont(u8g2_font_4x6_tr);
  oled.drawStr(127 - int(oled.getStrWidth(where)), 5, where);
}

static void updateOLED(uint32_t now) {
  static uint32_t seenRevision = 0xFFFFFFFF, started = 0, lastFrame = 0, lastCommandAt = 0;
  static uint8_t current = IDLE, transitionFace = IDLE, transitionFrom = IDLE;
  static PrivetCards::Card shownCard;
  static uint32_t cardAt = 0, cardShownAt = 0;
  static bool cardVisible = false, wasConnected = false;
  static MiniMotion::Spring lookX, lookY;
  static int8_t tiltZone = 0;

  // Read the wake flag before the mailbox: the callback publishes the face first.
  const bool connected = phoneConnected.load() && awake.load();
  const uint32_t mail = faceMailbox.load();
  if (mail != seenRevision) {
    seenRevision = mail;
    transitionFrom = current;
    current = transitionFace = uint8_t(mail & 0xFF);
    started = lastCommandAt = now;
    // An app command always wins over local faces, the status screen and the words.
    closeWords(now, "app command", false);
    localFace = 0; statusShown = false;
    power.touch(now);
    Serial.printf("[FACE] %s\n", reactionName(current));
  }
  // Waking up or falling asleep ends a local face (a stir, or an awake reaction).
  if (connected != wasConnected) { wasConnected = connected; localFace = 0; }

  PrivetCards::Card incoming;
  portENTER_CRITICAL(&cardsMux); incoming = cards.completed; portEXIT_CRITICAL(&cardsMux);
  if (incoming.revision != shownCard.revision) {
    shownCard = incoming; cardAt = now; cardVisible = false;
    if (shownCard.mode) keepWord(shownCard);
  }

  const uint32_t duration = reactionDuration(current);
  uint32_t age = now - started;
  if (duration && age >= duration) {
    // HINT and NOD return to THINKING (the question is still open); others to IDLE.
    current = current == NOD || current == HINT ? THINKING : IDLE; started = now; age = 0;
  }

  const bool validCard = connected && shownCard.mode && shownCard.face == latestFaceId.load();
  const bool resting = current == IDLE || current == THINKING;
  // Never while a question may be open: the app's last command was THINKING,
  // HINT, LISTENING, NOD or ENCOURAGE (a wrong answer falls back to IDLE but
  // the question stays open until the retry), or a question/hint card is on.
  const bool questionOpen = transitionFace == THINKING || transitionFace == HINT || transitionFace == LISTENING ||
                            transitionFace == NOD || transitionFace == ENCOURAGE || current == THINKING;
  const bool wordsAllowed = !connected || (current == IDLE && !questionOpen && !(validCard && (shownCard.mode == 2 || shownCard.mode == 4)));
  uint8_t event;
  while (xQueueReceive(inputQueue, &event, 0) == pdTRUE) {
    if (event != IN_INT_SEEN && event != MiniMotion::LEARNED_UP) power.touch(now);
    if (ignoreRightUntilUp && event >= IN_BUTTON) {
      const uint8_t b = event - IN_BUTTON;
      if (b == MiniButtons::RIGHT_SHORT || b == MiniButtons::RIGHT_RELEASE) { ignoreRightUntilUp = false; continue; }
      if (b == MiniButtons::RIGHT_HOLD) continue;
    }
    handleInput(event, now, connected, resting, wordsAllowed);
  }
  if (localFace && localDuration(localFace) && now - localAt >= localDuration(localFace)) localFace = 0;
  if (statusShown && now - statusAt >= STATUS_SHOW_MS) statusShown = false;
  if (reconnectShown && now - reconnectAt >= RECONNECT_SHOW_MS) reconnectShown = false;
  if (wordsView != WORDS_CLOSED && now - wordsAt >= WORDS_CLOSE_MS) closeWords(now, "untouched for 30 s", false);

  if (!oledReady || now - lastFrame < (dimmed ? FRAME_DIM_MS : FRAME_MS)) return;
  const float dt = (now - lastFrame) / 1000.0f;
  lastFrame = now;

  // The eyes follow the tilt with a little spring; the log says which way.
  const float tx = lookXMilli.load() / 1000.0f, ty = lookYMilli.load() / 1000.0f;
  if (connected) power.look(tx, ty, now);  // the eyes follow the tilt only while connected
  lookX.step(tx * LOOK_MAX_X_PX, dt);
  lookY.step(ty * LOOK_MAX_UP_PX, dt);
  const int8_t zone = ty < -0.6f ? 3 : tx > 0.5f ? 1 : tx < -0.5f ? 2 : 0;
  if (zone != tiltZone) {
    tiltZone = zone;
    static const char *const names[] = {"level: eyes centred", "tilted right: eyes look right", "tilted left: eyes look left", "lying back: eyes look up"};
    Serial.printf("[MOTION] %s\n", names[zone]);
  }

  oled.clearBuffer();
  oled.setDrawColor(1);

  bool showCard = false;
  if (validCard && cardExpired(shownCard, current, now, cardAt, cardVisible, cardShownAt)) {
    current = (shownCard.mode == 2 || shownCard.mode == 4) ? THINKING : IDLE;
    shownCard.mode = 0; started = now; age = 0;
  } else if (validCard && now - lastCommandAt >= cardDelay(transitionFace, transitionFrom)) {
    showCard = true;
  }

  const int dx = int(lroundf(lookX.pos)), dy = int(lroundf(lookY.pos));
  if (reconnectShown) drawReconnectScreen();
  else if (statusShown) drawStatusScreen();
  else if (wordsView != WORDS_CLOSED) drawWords();
  else if (localFace) drawLocal(localFace, now - localAt, now);
  else if (showCard) {
    if (!cardVisible) { cardVisible = true; cardShownAt = now; }
    drawCard(cardLayout, shownCard);
  } else if (connected && current == IDLE && (dx || dy)) {
    // Tilted: the eyes look down the slope (and up when lying back), plus
    // the idle glance during the first minute after a command.
    const int glance = now - lastCommandAt < MiniFaces::AMBIENT_WINDOW_MS ? MiniFaces::glance(age) : 0;
    drawLook(dx + glance, dy < -LOOK_MAX_UP_PX ? -LOOK_MAX_UP_PX : dy > 2 ? 2 : dy, now);
  } else {
    // Like v5: a minute after the last command, IDLE rests without glancing.
    const uint32_t faceAge = current == IDLE && now - lastCommandAt >= MiniFaces::AMBIENT_WINDOW_MS ? MiniFaces::AMBIENT_WINDOW_MS : age;
    drawFace(current, faceAge, now, connected);
  }
  oled.sendBuffer();
}

void setup() {
  Serial.begin(115200);
  delay(300);
  setCpuFrequencyMhz(CPU_MHZ);
  const esp_sleep_wakeup_cause_t woke = esp_sleep_get_wakeup_cause();
  const bool wokeByButton = woke == ESP_SLEEP_WAKEUP_EXT0;
  Serial.println("\nPrivet Mini v0.6: OLED + BLE + motion + buttons + pocket words + power");
  Serial.printf("[POWER] %s, CPU %u MHz\n", wokeByButton ? "woken by the right button" : "power on or reset", unsigned(getCpuFrequencyMhz()));
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);  // off
  prefs.begin("privet-mini", false);
  loadWords();
  setupI2C();
  setupOLED(!wokeByButton);
  setupMotion();
  readBattery();
  if (BATTERY_DIVIDER_FITTED) Serial.printf("[BATTERY] %u mV, %d%%\n", unsigned(batteryMillivolts), batteryPercent);
  else Serial.println("[BATTERY] divider not fitted (BATTERY_DIVIDER_FITTED = false)");
  setupInput();
  power.begin(millis());
  if (wokeByButton && digitalRead(RIGHT_BUTTON_PIN) == LOW) ignoreRightUntilUp = true;
  if (wokeByButton) stir(millis(), "POWER");
  setupBLE();
}

void loop() {
  const uint32_t now = millis();
  if (restartAdvertising.exchange(false)) {
    delay(200);
    BLEDevice::startAdvertising();
    Serial.println("[BLE] Advertising again.");
  }
  portENTER_CRITICAL(&cardsMux);
  const auto expired = cards.expire(millis());
  portEXIT_CRITICAL(&cardsMux);
  if (expired.send && phoneConnected.load()) sendStatus(expired.bytes, 8);

  digitalWrite(LED_PIN, phoneConnected.load() ? LOW : HIGH);
  updateBattery(now);
  updateOLED(now);
  updatePower(now);
  delay(5);
}
