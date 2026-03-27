# xandminerd Stats Reporter Patch

This patch adds optional stats reporting to xandminerd, allowing pNode operators to share their storage statistics with the XANDSCOPE network dashboard.

## Overview

When enabled, pNodes will report their storage statistics to the XANDSCOPE stats service every 60 seconds. This data is aggregated to show network-wide storage capacity on the XANDSCOPE dashboard.

**Key Features:**
- 🔒 **Opt-in only** - Disabled by default, operators must explicitly enable
- 🕵️ **Privacy-first** - IP and hostname are SHA-256 hashed (16 chars), raw values never sent
- 🌍 **Future-ready** - Hashed IP enables geo-location features without compromising privacy
- 🎛️ **API controlled** - Enable/disable via REST API (for GUI integration)
- 💾 **Persistent config** - Settings survive restarts

## Files

| File | Purpose |
|------|---------|
| `src/statsReporter.js` | Main stats collection and reporting module |
| `src/statsRoutes.js` | Express routes for API control |

## Installation

### 1. Copy files to xandminerd

```bash
# From xandminerd repo root
cp path/to/patch/src/statsReporter.js src/
cp path/to/patch/src/statsRoutes.js src/
```

### 2. Modify index.js

Add these lines to `xandminerd/src/index.js`:

```javascript
// At the top with other imports
const { setupStatsRoutes, initStatsReporter } = require('./statsRoutes');

// After Express app setup (after app.use() calls)
setupStatsRoutes(app);

// After server starts listening (in the listen callback)
initStatsReporter();
```

### 3. Full index.js diff

```diff
 const express = require('express');
 const cors = require('cors');
 // ... other imports
+const { setupStatsRoutes, initStatsReporter } = require('./statsRoutes');

 const app = express();
 app.use(cors());
 app.use(express.json());

 // ... existing routes ...

+// XANDSCOPE Stats Reporting (opt-in)
+setupStatsRoutes(app);

 app.listen(4000, '127.0.0.1', () => {
   console.log('xandminerd running on port 4000');
+  
+  // Initialize stats reporter
+  initStatsReporter();
 });
```

## API Endpoints

### Enable Stats Reporting

```bash
POST http://localhost:4000/stats/enable
```

**Response:**
```json
{
  "ok": true,
  "enabled": true,
  "message": "Stats reporting enabled. Your pNode will now appear on XANDSCOPE."
}
```

### Disable Stats Reporting

```bash
POST http://localhost:4000/stats/disable
```

**Response:**
```json
{
  "ok": true,
  "enabled": false,
  "message": "Stats reporting disabled."
}
```

### Get Status

```bash
GET http://localhost:4000/stats/status
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "enabled": true,
    "registered": true,
    "publicKey": "ABC123...",
    "lastReport": "2025-12-04T12:00:00Z",
    "lastStatus": "success",
    "endpoint": "https://stats.xandscope.io/api/report"
  }
}
```

### Trigger Immediate Report (Testing)

```bash
POST http://localhost:4000/stats/report-now
```

## Configuration

Settings are stored in `config/xandscope-stats.json`:

```json
{
  "enabled": true,
  "lastModified": "2025-12-04T12:00:00Z"
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `XANDSCOPE_STATS_URL` | `https://stats.xandscope.io/api/report` | Stats service endpoint |

## Data Sent

Each report contains:

```json
{
  "timestamp": "2025-12-04T12:00:00Z",
  "pnode": {
    "publicKey": "ABC123...",
    "isOnline": true,
    "versions": {
      "xandminerd": "v0.5.0",
      "pod": "v1.2.3"
    }
  },
  "storage": {
    "totalCapacity": 500000000000,
    "totalUsed": 100000000000,
    "totalDedicated": 250000000000,
    "drives": [...]
  },
  "network": {
    "hostnameHash": "a1b2c3d4e5f6...",
    "ipHash": "f6e5d4c3b2a1..."
  }
}
```

### Privacy Notes

- ✅ Public key is already on-chain (not sensitive)
- ✅ Storage amounts are aggregated network-wide
- ✅ Hostname is SHA-256 hashed (16 chars) - raw hostname never sent
- ✅ IP is SHA-256 hashed (16 chars) - raw IP never sent
- ✅ Hashed IP enables future geo features without compromising privacy

**How hashing works:**
```javascript
hash = SHA256(value).substring(0, 16)
// "192.168.1.1" → "a7b9c2d8e4f1..."
```

## Integration with xandminer GUI

The xandminer GUI should add a toggle component that calls these endpoints:

1. On mount: `GET /stats/status` to check current state
2. On toggle ON: `POST /stats/enable`
3. On toggle OFF: `POST /stats/disable`

See `packages/xandminer-patch/` for the GUI component.

## Testing

```bash
# Check status
curl http://localhost:4000/stats/status

# Enable reporting
curl -X POST http://localhost:4000/stats/enable

# Verify it's working
curl http://localhost:4000/stats/status

# Trigger immediate report
curl -X POST http://localhost:4000/stats/report-now

# Disable
curl -X POST http://localhost:4000/stats/disable
```

## License

Apache-2.0 (same as xandminerd)

## Contributing

This patch is part of the XANDSCOPE project. After testing, it will be submitted as a PR to the official xandminerd repository.



