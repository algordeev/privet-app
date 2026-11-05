/* Privet Mini (keychain) bring-up: 0.96" SSD1306 I2C OLED + BLE link to the Privet app.
 *
 * Board:  Seeed XIAO ESP32-S3, Arduino-ESP32 3.x, built-in BLE library.
 * Wiring: OLED VCC -> 3V3, GND -> GND, SDA -> D4 (GPIO5), SCL -> D5 (GPIO6).
 * Needs:  U8g2 library (same as the big robot).
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
 * which requires the card bits. No sound, servos or motion yet.
 *
 * On screen: a sleeping face until the app's first reaction (CONNECTED) after
 * connecting, then the reaction faces and word cards. The faces are the
 * Mini's own set (MiniFaces.h), not the desk robot's; there is no corner
 * connection dot. Commands and ACKs are printed to Serial only.
 * The orange user LED (GPIO21) is on while a phone is connected.
 */

#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <atomic>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include "LearningCards.h"
#include "LearningLayout.h"
#include "MiniFaces.h"

// ---- Pins ----
static constexpr int OLED_SDA_PIN = 5;  // D4
static constexpr int OLED_SCL_PIN = 6;  // D5
static constexpr int LED_PIN = 21;      // XIAO user LED, LOW = on

// The app finds companions by service UUID; the name tells it which device
// this is (the big robot advertises "Privet-ESP32").
static const char *BLE_NAME = "Privet-Mini";

static const char *SERVICE_UUID = "7b5e0001-6d8a-4f3b-9c2e-1a0d8f6b4c91";
static const char *COMMAND_UUID = "7b5e0002-6d8a-4f3b-9c2e-1a0d8f6b4c91";
static const char *STATUS_UUID  = "7b5e0003-6d8a-4f3b-9c2e-1a0d8f6b4c91";

// If the I2C scan finds the screen but the picture is garbled or shifted,
// swap SSD1306 for SH1106 in this line (some cheap boards use that chip).
static U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE, OLED_SCL_PIN, OLED_SDA_PIN);
static bool oledReady = false;

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
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService *service = server->createService(SERVICE_UUID);
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

// ---- OLED ----
static void setupOLED() {
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  uint8_t found = 0;
  Serial.print("[I2C] Devices:");
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) { Serial.printf(" 0x%02X", a); if (a == 0x3C || a == 0x3D) found = a; }
  }
  Serial.println();
  if (!found) {
    Serial.println("[OLED] Nothing at 0x3C/0x3D. Check SDA->D4, SCL->D5, VCC->3V3. BLE still runs.");
    return;
  }
  oled.setI2CAddress(found << 1);
  oled.setBusClock(400000);
  oledReady = oled.begin();
  oled.enableUTF8Print();
  Serial.printf("[OLED] %s at 0x%02X\n", oledReady ? "OK" : "begin() failed", found);
  if (!oledReady) return;

  oled.clearBuffer();
  oled.setFont(u8g2_font_helvB12_tr);
  oled.drawStr(18, 28, "Privet Mini");
  oled.setFont(u8g2_font_5x8_tr);
  oled.drawStr(26, 46, "screen OK - BLE...");
  oled.sendBuffer();
  delay(1200);
}

// ---- Faces: the Mini's own set, in MiniFaces.h ----
// Drawn pixel by pixel so the app's 3D figure shows the same pixels.
static void drawFace(uint8_t r, uint32_t age, uint32_t now, bool connected) {
  auto plot = [](int x, int y, bool on) { oled.setDrawColor(on ? 1 : 0); oled.drawPixel(x, y); };
  MiniFaces::Pen<decltype(plot)> pen(plot);
  if (!connected) MiniFaces::sleeping(pen, now);
  else MiniFaces::reaction(pen, r, age, now, fireCombo.load());
  oled.setDrawColor(1);
}

// ---- Learning cards (same layout as the big robot) ----
struct CardLayout {
  uint32_t revision = 0; bool valid = false, compact = false;
  PrivetLayout::Lines primary, secondary;
  int primaryX[2] = {}, secondaryX[2] = {};
};
static CardLayout cardLayout;

static void layoutCard(const PrivetCards::Card &card) {
  if (cardLayout.valid && cardLayout.revision == card.revision) return;
  const auto measure = [](const char *text) { return oled.getUTF8Width(text); };
  oled.setFont(u8g2_font_6x13_t_cyrillic);
  cardLayout.secondary = PrivetLayout::wrap(card.secondary, measure);
  oled.setFont(u8g2_font_9x15_t_cyrillic);
  cardLayout.primary = PrivetLayout::wrap(card.primary, measure);
  cardLayout.compact = !cardLayout.primary.complete || (cardLayout.primary.count == 2 && cardLayout.secondary.count == 2);
  if (cardLayout.compact) { oled.setFont(u8g2_font_6x13_t_cyrillic); cardLayout.primary = PrivetLayout::wrap(card.primary, measure); }
  oled.setFont(cardLayout.compact ? u8g2_font_6x13_t_cyrillic : u8g2_font_9x15_t_cyrillic);
  for (uint8_t i = 0; i < cardLayout.primary.count; i++) cardLayout.primaryX[i] = (128 - int(oled.getUTF8Width(cardLayout.primary.text[i]))) / 2;
  oled.setFont(u8g2_font_6x13_t_cyrillic);
  for (uint8_t i = 0; i < cardLayout.secondary.count; i++) cardLayout.secondaryX[i] = (128 - int(oled.getUTF8Width(cardLayout.secondary.text[i]))) / 2;
  cardLayout.revision = card.revision; cardLayout.valid = true;
}

static void drawCard(const PrivetCards::Card &card) {
  layoutCard(card);
  const PrivetLayout::Frame frame(cardLayout.primary.count, cardLayout.secondary.count, cardLayout.compact);
  oled.setFont(cardLayout.compact ? u8g2_font_6x13_t_cyrillic : u8g2_font_9x15_t_cyrillic);
  for (uint8_t i = 0; i < cardLayout.primary.count; i++) oled.drawUTF8(cardLayout.primaryX[i], frame.primaryBaseline(i), cardLayout.primary.text[i]);
  oled.setFont(u8g2_font_6x13_t_cyrillic);
  for (uint8_t i = 0; i < cardLayout.secondary.count; i++) oled.drawUTF8(cardLayout.secondaryX[i], frame.secondaryBaseline(i), cardLayout.secondary.text[i]);
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

static void updateOLED(uint32_t now) {
  static uint32_t seenRevision = 0xFFFFFFFF, started = 0, lastFrame = 0, lastCommandAt = 0;
  static uint8_t current = IDLE, transitionFace = IDLE, transitionFrom = IDLE;
  static PrivetCards::Card shownCard;
  static uint32_t cardAt = 0, cardShownAt = 0;
  static bool cardVisible = false;

  // Read the wake flag before the mailbox: the callback publishes the face first.
  const bool connected = phoneConnected.load() && awake.load();
  const uint32_t mail = faceMailbox.load();
  if (mail != seenRevision) {
    seenRevision = mail;
    transitionFrom = current;
    current = transitionFace = uint8_t(mail & 0xFF);
    started = lastCommandAt = now;
    Serial.printf("[FACE] %s\n", reactionName(current));
  }

  PrivetCards::Card incoming;
  portENTER_CRITICAL(&cardsMux); incoming = cards.completed; portEXIT_CRITICAL(&cardsMux);
  if (incoming.revision != shownCard.revision) { shownCard = incoming; cardAt = now; cardVisible = false; }

  const uint32_t duration = reactionDuration(current);
  uint32_t age = now - started;
  if (duration && age >= duration) {
    // HINT and NOD return to THINKING (the question is still open); others to IDLE.
    current = current == NOD || current == HINT ? THINKING : IDLE; started = now; age = 0;
  }
  if (!oledReady || now - lastFrame < 33) return;  // ~30 fps
  lastFrame = now;

  oled.clearBuffer();
  oled.setDrawColor(1);

  const bool validCard = connected && shownCard.mode && shownCard.face == latestFaceId.load();
  if (validCard && cardExpired(shownCard, current, now, cardAt, cardVisible, cardShownAt)) {
    current = (shownCard.mode == 2 || shownCard.mode == 4) ? THINKING : IDLE;
    shownCard.mode = 0; started = now; age = 0;
  } else if (validCard && now - lastCommandAt >= cardDelay(transitionFace, transitionFrom)) {
    if (!cardVisible) { cardVisible = true; cardShownAt = now; }
    drawCard(shownCard);
    oled.sendBuffer();
    return;
  }

  // Like v5: a minute after the last command, IDLE rests without glancing.
  const uint32_t faceAge = current == IDLE && now - lastCommandAt >= MiniFaces::AMBIENT_WINDOW_MS ? MiniFaces::AMBIENT_WINDOW_MS : age;
  drawFace(current, faceAge, now, connected);
  oled.sendBuffer();
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\nPrivet Mini bring-up: OLED + BLE");
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);  // off
  setupOLED();
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
  updateOLED(now);
  delay(5);
}
