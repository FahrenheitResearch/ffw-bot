# Project Roadmap

```
                                    .
                                   /|\
                                  / | \
                                 /  |  \
                                /   |   \
                           .   /    |    \   .
                          /|\ /     |     \ /|\
                         / | X      |      X | \
                        /  |/ \     |     / \|  \
                       /   /   \    |    /   \   \
                  ____/___/_____\___|___/_____\___\____
                 |____________FIRE WATCH______________|
```

---

## Current State

The bot monitors NWS alerts for:
- Red Flag Warnings
- Fire Weather Watches
- Fire Warnings
- Extreme Fire Danger

---

## Phase 1: Active Wildfire Tracking

```
    SATELLITE         GROUND            DISPATCH
        |                |                  |
        v                v                  v
   +---------+     +---------+        +---------+
   |  FIRMS  |     | InciWeb |        |  NIFC   |
   |  (NASA) |     |  (USFS) |        |         |
   +---------+     +---------+        +---------+
        \              |                  /
         \             |                 /
          \            v                /
           +---->  FIRE BOT  <---------+
                     |
                     v
               [ DISCORD ]
```

**Features:**
- Track active wildfires from InciWeb/NIFC
- Fire name, size (acres), containment %
- Daily updates on major fires
- New fire alerts within X miles of a location

**Data Sources:**
- InciWeb (Incident Information System)
- NIFC (National Interagency Fire Center)
- GeoMAC / IRWIN

---

## Phase 2: Satellite Fire Detection

```
          _______________
         /               \
        /    TERRA/AQUA   \
       /     SATELLITES    \
      /_________|__________\
                |
                | infrared
                v
        +---------------+
        |     FIRMS     |
        | Fire Information
        | for Resource
        | Management System
        +---------------+
                |
                v
        [ hotspot detected ]
        [ lat/lon, confidence ]
        [ time, satellite ]
```

**Features:**
- NASA FIRMS integration (near real-time satellite fire detection)
- Thermal anomaly alerts
- Configurable regions to watch
- Confidence level filtering (low/nominal/high)
- Historical hotspot data

---

## Phase 3: Air Quality & Smoke

```
     _____                              _____
    /     \   wind direction --->      /     \
   |  FIRE |   ~~~~~~~~~~~~~~~~~~~~   | CITY  |
   | (src) |   ~ smoke plume ~~~~     |(impact)
    \_____/    ~~~~~~~~~~~~~~~~~~~~    \_____/

         AQI:  0----50----100----150----200----300+
               |     |      |      |      |     |
              GOOD  MOD  UNHEALTHY VERY  HAZ-
                           (sens)  UNHLTH ARDOUS
```

**Features:**
- AirNow API integration
- PM2.5 / AQI monitoring
- Smoke forecast maps (NOAA HMS)
- Health recommendations by AQI level
- Alerts when AQI exceeds threshold

---

## Phase 4: Location-Based Alerts

```
                    +
                   /|\
                  / | \    <-- user location
                 /  |  \
                +---+---+
                |50 mi  |
                |radius |
                +-------+

    [fire detected]  --> distance check --> [notify?]
```

**Features:**
- Users set location (zip code or lat/lon)
- Configurable alert radius
- "Fires near me" command
- Evacuation zone monitoring
- Road closure alerts (CalTrans, state DOTs)

---

## Phase 5: Fire Weather Forecasting

```
    TODAY        +1 DAY       +2 DAY       +3 DAY
   +------+     +------+     +------+     +------+
   |      |     |      |     |      |     |      |
   | LOW  |     | MOD  |     | HIGH |     | VERY |
   |      |     |      |     |      |     | HIGH |
   +------+     +------+     +------+     +------+
       |            |            |            |
       v            v            v            v
     green       yellow        orange        red
```

**Features:**
- Fire danger ratings (low/moderate/high/very high/extreme)
- Forecast Red Flag conditions before they're issued
- Wind/humidity/temperature forecasts
- Dry lightning probability
- Fuel moisture data

---

## Phase 6: Maps & Visualization

```
   +------------------------------------------+
   |                                          |
   |    [fire perimeter]                      |
   |         ****                             |
   |        **  **     [evacuation zone]      |
   |       **    **    +--------------+       |
   |        **  **     |    WARN      |       |
   |         ****      +--------------+       |
   |                                          |
   |    [smoke plume direction --->]          |
   |                                          |
   +------------------------------------------+
         generated map image -> discord embed
```

**Features:**
- Fire perimeter maps
- Evacuation zone overlays
- Smoke dispersion visualization
- Static map image generation for embeds

---

## Data Sources Reference

| Source | Data | Update Freq | API |
|--------|------|-------------|-----|
| NWS | Weather alerts | Real-time | Free |
| FIRMS | Satellite hotspots | 3 hrs | Free |
| InciWeb | Active incidents | Daily | Scrape |
| NIFC | Fire statistics | Daily | Free |
| AirNow | Air quality | Hourly | Free |
| NOAA HMS | Smoke analysis | 2x daily | Free |
| GeoMAC | Fire perimeters | Daily | Free |

---

## Command Ideas

```
/fire <name>          - Get info on a specific fire
/fires                - List major active fires
/nearby <zip>         - Fires within radius of location
/aqi <zip>            - Air quality for location
/smoke                - Current smoke forecast
/danger <state>       - Fire danger rating
/subscribe <zip>      - Get alerts for a location
/unsubscribe          - Stop location alerts
```

---

## Architecture (Full Build)

```
+------------------+     +------------------+
|   Data Ingest    |     |    Discord Bot   |
|                  |     |                  |
| - NWS poller     |     | - slash commands |
| - FIRMS poller   |     | - alert dispatch |
| - InciWeb scraper|---->| - embed builder  |
| - AirNow poller  |     | - user prefs     |
|                  |     |                  |
+--------+---------+     +--------+---------+
         |                        |
         v                        v
+------------------+     +------------------+
|    Database      |     |   Map Service    |
|                  |     |                  |
| - fire records   |     | - perimeter viz  |
| - user locations |     | - static maps    |
| - alert history  |     | - smoke overlay  |
+------------------+     +------------------+
```

---

## Notes

All data sources listed are publicly available US government APIs.
No paid services required for core functionality.
