# MeshVPN Android

Аналог Radmin VPN для Android. Приватные комнаты с ключами доступа, чат, список участников, подключение к бесплатным VPN-серверам.

## Стек

- **Kotlin** + **Jetpack Compose** (Material 3)
- **VPN Gate API** — бесплатные серверы от Университета Цукуба (Япония)
- **VpnService API** — нативный VPN-туннель Android
- **Navigation Compose** — навигация между экранами
- **Coroutines** — асинхронные операции

## Функционал

- Создание приватных комнат (8-символьный ключ)
- Вход по ключу
- Чат в реальном времени внутри комнаты
- Список участников с виртуальными IP
- Список 5000+ бесплатных VPN-серверов (VPN Gate)
- VPN-подключение через VpnService

## Структура

```
app/src/main/java/com/meshvpn/app/
├── MainActivity.kt
├── data/
│   ├── VpnServer.kt        — модели данных
│   ├── VpnGateApi.kt       — клиент API VPN Gate
│   └── RoomManager.kt      — управление комнатами
├── vpn/
│   └── MeshVpnService.kt   — VPN-сервис Android
└── ui/
    ├── MeshVpnApp.kt        — навигация
    ├── theme/Theme.kt       — тёмная тема
    └── screens/
        ├── HomeScreen.kt
        ├── ServersScreen.kt
        ├── CreateRoomScreen.kt
        ├── JoinRoomScreen.kt
        └── RoomScreen.kt    — чат + участники
```

## Сборка

1. Открыть в Android Studio (Hedgehog+)
2. Sync Gradle
3. Run на устройстве/эмуляторе

## Серверы

Используются бесплатные публичные серверы **VPN Gate** (vpngate.net) — проект Университета Цукуба, Япония. 5000+ серверов по всему миру, поддержка OpenVPN/L2TP.

API: `https://www.vpngate.net/api/iphone/`
