// ====== SmartBottle ESP32 – WiFi + HX711 + Reed Switch ======
// Envia consumo de agua diretamente para a API via WiFi
//
// FUNCIONAMENTO:
// 1. Tampa FECHA -> guarda peso_antes
// 2. Tampa ABRE -> (utilizador bebe)
// 3. Tampa FECHA -> guarda peso_depois
// 4. Consumo = peso_antes - peso_depois (se > 20ml, envia para API)

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "HX711.h"
#include "config.h"  // Ficheiro com credenciais (nao commitado ao Git)

// ==================== CONFIGURACAO ====================
// IMPORTANTE: Todas as credenciais estao agora no ficheiro "config.h"
// Para configurar:
//   1. Abrir o ficheiro "config.h"
//   2. Alterar WIFI_SSID, WIFI_PASSWORD, API_URL, USER_ID
//   3. Guardar (o ficheiro config.h NAO sera commitado ao Git)

// ==================== PINOS ====================
#define HX711_DOUT 19
#define HX711_SCK  18
#define REED_PIN   14   // Liga entre este pino e GND

// ==================== CALIBRACAO HX711 ====================
// IMPORTANTE: Ajusta este valor apos calibrar!
// Para calibrar: coloca um peso conhecido e ajusta ate o valor ser correto
float CAL_FACTOR = 420.0f;  // Ajustar conforme a tua celula de carga

// Peso minimo para considerar consumo (em gramas)
// Evita enviar consumos muito pequenos por ruido
const float MIN_CONSUMO_G = 20.0f;

// ==================== VARIAVEIS GLOBAIS ====================
HX711 scale;

// Estados da tampa: 0 = aberta, 1 = fechada
volatile uint8_t lidState = 0;
volatile uint8_t lastLidState = 0;

// Pesos para calculo de consumo
float weightWhenClosed = 0.0f;    // Peso quando a tampa fechou
float weightBeforeDrink = 0.0f;   // Peso antes de beber (quando abriu)
bool waitingForConsumption = false;

// Para suavizar leituras
float smoothedWeight = 0.0f;

// Timing
unsigned long lastWeightRead = 0;
unsigned long lastWifiCheck = 0;
const unsigned long WEIGHT_INTERVAL = 100;    // Ler peso a cada 100ms
const unsigned long WIFI_CHECK_INTERVAL = 30000; // Verificar WiFi a cada 30s

// LED para feedback (usa o LED interno do ESP32)
#define LED_PIN 2

// ==================== FUNCOES ====================

// Suaviza leituras de peso para reduzir ruido
float smoothWeight(float newWeight) {
    smoothedWeight = 0.8f * smoothedWeight + 0.2f * newWeight;
    return smoothedWeight;
}

// Le o peso atual em gramas
float readWeight() {
    if (!scale.is_ready()) {
        return smoothedWeight; // Retorna ultimo valor se nao estiver pronto
    }

    long raw = scale.read_average(3);
    float grams = (raw - scale.get_offset()) / CAL_FACTOR;

    // Nao permitir valores negativos
    if (grams < 0) grams = 0;

    return smoothWeight(grams);
}

// Le o estado da tampa (com debounce)
uint8_t readLidState() {
    // INPUT_PULLUP: pino HIGH quando aberto, LOW quando fechado (ligado ao GND)
    // Invertemos: 1 = fechada, 0 = aberta
    static uint8_t lastReading = 0;
    static unsigned long lastDebounceTime = 0;
    const unsigned long DEBOUNCE_DELAY = 50;

    uint8_t reading = digitalRead(REED_PIN);  // Removido ! para inverter lógica

    if (reading != lastReading) {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > DEBOUNCE_DELAY) {
        if (reading != lidState) {
            lidState = reading;
        }
    }

    lastReading = reading;
    return lidState;
}

// Conecta ao WiFi
void connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;

    Serial.print("[WiFi] A conectar a ");
    Serial.println(WIFI_SSID);

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        digitalWrite(LED_PIN, !digitalRead(LED_PIN)); // Pisca LED
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.print("[WiFi] Conectado! IP: ");
        Serial.println(WiFi.localIP());
        digitalWrite(LED_PIN, HIGH); // LED ligado = conectado
    } else {
        Serial.println();
        Serial.println("[WiFi] ERRO: Nao foi possivel conectar!");
        digitalWrite(LED_PIN, LOW);
    }
}

// Envia consumo para a API
bool sendConsumption(int quantidadeMl) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[API] Erro: WiFi nao conectado");
        return false;
    }

    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);

    // Criar JSON
    String jsonPayload = "{";
    jsonPayload += "\"userId\":" + String(USER_ID) + ",";
    jsonPayload += "\"quantidadeMl\":" + String(quantidadeMl) + ",";
    jsonPayload += "\"tipoBebida\":\"" + String(TIPO_BEBIDA) + "\"";
    jsonPayload += "}";

    Serial.print("[API] A enviar: ");
    Serial.println(jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.print("[API] Resposta (");
        Serial.print(httpResponseCode);
        Serial.print("): ");
        Serial.println(response);

        // Pisca LED 3x para confirmar envio
        for (int i = 0; i < 3; i++) {
            digitalWrite(LED_PIN, LOW);
            delay(100);
            digitalWrite(LED_PIN, HIGH);
            delay(100);
        }

        http.end();
        return httpResponseCode == 201;
    } else {
        Serial.print("[API] Erro HTTP: ");
        Serial.println(httpResponseCode);
        http.end();
        return false;
    }
}

// Processa mudanca de estado da tampa
void processLidChange() {
    float currentWeight = readWeight();

    if (lidState == 1 && lastLidState == 0) {
        // Tampa FECHOU
        Serial.println("========================================");
        Serial.println("[TAMPA] FECHOU");
        Serial.print("[PESO] Atual: ");
        Serial.print(currentWeight);
        Serial.println(" g");

        if (waitingForConsumption && weightBeforeDrink > 0) {
            // Calcular consumo
            float consumoG = weightBeforeDrink - currentWeight;
            int consumoMl = (int)consumoG; // 1g agua = 1ml

            Serial.print("[CONSUMO] Peso antes: ");
            Serial.print(weightBeforeDrink);
            Serial.print(" g, Peso depois: ");
            Serial.print(currentWeight);
            Serial.print(" g, Diferenca: ");
            Serial.print(consumoG);
            Serial.println(" g");

            if (consumoMl >= MIN_CONSUMO_G) {
                Serial.print("[CONSUMO] Detetado consumo de ");
                Serial.print(consumoMl);
                Serial.println(" ml - A enviar para API...");

                if (sendConsumption(consumoMl)) {
                    Serial.println("[CONSUMO] Enviado com sucesso!");
                } else {
                    Serial.println("[CONSUMO] ERRO ao enviar!");
                }
            } else if (consumoG > 0) {
                Serial.println("[CONSUMO] Consumo muito pequeno, ignorado.");
            } else if (consumoG < -MIN_CONSUMO_G) {
                Serial.println("[INFO] Agua adicionada (reabastecimento)");
            }
        }

        // Guardar peso atual para proxima vez
        weightWhenClosed = currentWeight;
        waitingForConsumption = false;
        Serial.println("========================================");
    }
    else if (lidState == 0 && lastLidState == 1) {
        // Tampa ABRIU
        Serial.println("========================================");
        Serial.println("[TAMPA] ABRIU");
        Serial.print("[PESO] Antes de beber: ");
        Serial.print(weightWhenClosed);
        Serial.println(" g");

        // Guardar peso de referencia (quando fechou pela ultima vez)
        weightBeforeDrink = weightWhenClosed;
        waitingForConsumption = true;
        Serial.println("[INFO] A aguardar que a tampa feche...");
        Serial.println("========================================");
    }

    lastLidState = lidState;
}

// ==================== SETUP ====================
void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println();
    Serial.println("╔════════════════════════════════════════╗");
    Serial.println("║     SmartBottle ESP32 - WiFi Mode      ║");
    Serial.println("╚════════════════════════════════════════╝");
    Serial.println();

    // LED
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    // Reed Switch
    pinMode(REED_PIN, INPUT_PULLUP);
    lidState = digitalRead(REED_PIN);  // Removido ! para inverter lógica
    lastLidState = lidState;
    Serial.print("[REED] Estado inicial: ");
    Serial.println(lidState ? "FECHADA" : "ABERTA");

    // HX711
    Serial.println("[HX711] A inicializar...");
    scale.begin(HX711_DOUT, HX711_SCK);

    int hx711_attempts = 0;
    while (!scale.is_ready() && hx711_attempts < 50) {
        delay(100);
        hx711_attempts++;
    }

    if (scale.is_ready()) {
        scale.set_gain(128);
        Serial.println("[HX711] A fazer tara (nao mexer na garrafa)...");
        delay(1000);
        scale.set_offset(scale.read_average(20));
        Serial.println("[HX711] Tara concluida!");
        Serial.print("[HX711] CAL_FACTOR: ");
        Serial.println(CAL_FACTOR);
    } else {
        Serial.println("[HX711] ERRO: Sensor nao encontrado!");
    }

    // WiFi
    WiFi.mode(WIFI_STA);
    connectWiFi();

    // Ler peso inicial
    if (lidState == 1) {
        delay(500);
        weightWhenClosed = readWeight();
        Serial.print("[PESO] Inicial: ");
        Serial.print(weightWhenClosed);
        Serial.println(" g");
    }

    Serial.println();
    Serial.println("[PRONTO] SmartBottle a funcionar!");
    Serial.println("[INFO] Abre e fecha a tampa para registar consumo");
    Serial.println();
}

// ==================== LOOP ====================
void loop() {
    unsigned long now = millis();

    // Verificar WiFi periodicamente
    if (now - lastWifiCheck >= WIFI_CHECK_INTERVAL) {
        lastWifiCheck = now;
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[WiFi] Conexao perdida, a reconectar...");
            connectWiFi();
        }
    }

    // Ler peso periodicamente
    if (now - lastWeightRead >= WEIGHT_INTERVAL) {
        lastWeightRead = now;
        float weight = readWeight();

        // Mostrar peso no Serial (para debug)
        static unsigned long lastPrint = 0;
        if (now - lastPrint >= 2000) { // A cada 2 segundos
            lastPrint = now;
            Serial.print("[PESO] ");
            Serial.print(weight, 1);
            Serial.print(" g | Tampa: ");
            Serial.println(lidState ? "FECHADA" : "ABERTA");
        }
    }

    // Verificar estado da tampa
    uint8_t currentLid = readLidState();
    if (currentLid != lastLidState) {
        processLidChange();
    }

    delay(10);
}
