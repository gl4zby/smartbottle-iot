# SmartBottle - Sistema de Monitorização de Consumo de Água

## Descrição

Sistema IoT para monitorizar o consumo diário de água usando uma garrafa inteligente com sensores. O projecto foi desenvolvido no âmbito de uma unidade curricular e permite ao utilizador acompanhar quanto bebe ao longo do dia, através de uma aplicação móvel ou website.

## Estrutura do Projeto

- `smartbottle-api/` - API Backend (Node.js/Express)
- `SmartBottleWebsite/` - Website Frontend (HTML/CSS/JS)
- `SmartBottle_ESP32_WiFi/` - Código do microcontrolador (Arduino/C++)
- `smartbottle-app-py/` - Aplicação Android (Python/Kivy)

## Requisitos

- SQL Server 2019+ com SSMS
- Node.js 18+
- Python 3.10+
- Arduino IDE 2.0+

## Instalação

### Base de Dados

1. Abrir SSMS e criar base de dados "smart_bottle"
2. Criar tabelas "utilizadores" e "registos_consumo"
3. Criar user "smartbottle_api_user"

### API

1. `cd smartbottle-api`
2. `npm install`
3. Copiar `.env.example` para `.env` e preencher credenciais
4. `node server.js`

### Website

1. Abrir `SmartBottleWebsite` com Live Server
2. Editar `scripts/config.js` com o IP do servidor

### ESP32

1. Copiar `config.h.example` para `config.h`
2. Preencher SSID, password WiFi e IP da API
3. Upload para ESP32

## Sistema Fisico da Garrafa (Hardware)

### Componentes

| Componente | Modelo | Funcao |
|------------|--------|--------|
| Microcontrolador | ESP32 DevKit | Processamento e WiFi |
| Amplificador | HX711 | Amplifica sinal da celula de carga |
| Sensor de Peso | Celula de carga 5kg | Mede o peso da garrafa |
| Sensor de Tampa | Reed Switch | Deteta abertura/fecho da tampa |

### Ligacoes (Pinout)

| ESP32 GPIO | Componente | Descricao |
|------------|------------|-----------|
| GPIO 19 | HX711 DOUT | Dados do sensor de peso |
| GPIO 18 | HX711 SCK | Clock de sincronizacao |
| GPIO 14 | Reed Switch | Estado da tampa |
| GPIO 2 | LED interno | Feedback visual |
| 3.3V | HX711 VCC | Alimentacao |
| GND | HX711 GND, Reed | Terra comum |

### Funcionamento

1. Tampa fecha: guarda peso atual como referencia
2. Tampa abre: marca inicio do consumo
3. Tampa fecha: calcula diferenca de peso (consumo)
4. Se consumo > 20ml: envia para API via HTTP POST
5. LED pisca 3x para confirmar envio

### Calibracao

Para calibrar a balanca, ajustar `CAL_FACTOR` no codigo:
1. Colocar garrafa vazia na balanca
2. Anotar valor "raw" no Serial Monitor
3. Colocar peso conhecido (ex: 500g)
4. Calcular: `CAL_FACTOR = (raw_com_peso - raw_vazio) / peso_conhecido`

### App Android

1. `cd smartbottle-app-py`
2. `pip install -r requirements.txt`
3. `python main.py`

## Utilização

1. Ligar todos os componentes à mesma rede WiFi
2. Iniciar a API (`node server.js`)
3. Abrir Website ou App
4. O ESP32 detecta automaticamente o consumo de água

## Equipa

- Diogo (Dilex) - Aplicação Android
- Alexandre - Website
- Paulo - Hardware/ESP32
