# xandminerd

> Xandeum pNode Daemon - Backend service for managing Xandeum storage nodes

[![Version](https://img.shields.io/badge/version-v0.5.0-blue.svg)](https://github.com/Xandeum/xandminerd)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)

## Overview

xandminerd is the daemon (background service) that runs on Xandeum pNode servers. It provides a REST API for:

- **Storage Management** - Monitor disk space, dedicate storage to Xandeum network
- **pNode Registration** - Register pNodes on Xandeum DevNet blockchain
- **Keypair Management** - Generate and manage pNode identity keypairs
- **System Information** - Network speed tests, server info, software versions
- **Pod Management** - Install and manage the Xandeum pod software
- **Stats Reporting** - Optional reporting to network dashboards (XANDSCOPE)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    pNode Server                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────┐         ┌─────────────┐              │
│   │  xandminer  │  HTTP   │ xandminerd  │              │
│   │   (GUI)     │ ──────▶ │  (daemon)   │              │
│   │  :3000      │         │  :4000      │              │
│   └─────────────┘         └──────┬──────┘              │
│                                  │                      │
│                      ┌───────────┴───────────┐         │
│                      │                       │         │
│                      ▼                       ▼         │
│               ┌──────────┐           ┌──────────┐      │
│               │  Local   │           │ Xandeum  │      │
│               │  Disk    │           │  DevNet  │      │
│               └──────────┘           └──────────┘      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Requirements

- **Node.js** >= 16.x
- **Linux** (Ubuntu/Debian recommended) or macOS
- **PM2** (installed automatically via postinstall)
- **Root access** for storage operations

## Installation

```bash
# Clone the repository
git clone https://github.com/Xandeum/xandminerd.git
cd xandminerd

# Install dependencies (also installs PM2 globally)
npm install

# Start the daemon
npm start
```

The daemon will run on `http://127.0.0.1:4000` (localhost only for security).

## Configuration

### Constants

Located in `src/CONSTS.js`:

```javascript
const SYMLINKPATH = '/var/run/xandeum-pod';  // Symlink for pod storage
const XANDMINERD_VERSION = 'v0.5.0';         // Current version
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `XANDSCOPE_STATS_URL` | `https://stats.xandscope.io/api/report` | Stats service endpoint (optional) |

## API Reference

### Storage Endpoints

#### Get Disk Information

```http
POST /drives
```

Returns information about all available drives (Linux: uses `lsblk`, macOS: uses `diskutil`).

**Response:**
```json
{
  "data": {
    "drives": [
      {
        "name": "sda1",
        "used": 45097156608,
        "available": 423849582592,
        "capacity": 499963174912,
        "type": "part",
        "mount": ["/"],
        "percentage": "10%",
        "dedicated": 107374182400
      }
    ]
  }
}
```

#### Dedicate Storage

```http
POST /drive/dedicate
Content-Type: application/json

{
  "space": 100,
  "path": "/"
}
```

Dedicates storage space (in GB) to the Xandeum network. Creates a file at `{path}/xandeum-pages` and symlinks it to `/var/run/xandeum-pod`.

**Response (success):**
```json
{
  "data": {
    "ok": true,
    "path": "/xandeum-pages",
    "symlink": "/var/run/xandeum-pod"
  }
}
```

### pNode Endpoints

#### Check Registration Status

```http
GET /pnode
```

**Response (registered):**
```json
{
  "ok": true,
  "data": {
    "ok": true,
    "isRegistered": true
  }
}
```

**Response (not registered):**
```json
{
  "ok": false,
  "isRegistered": false
}
```

#### Register pNode

```http
POST /pnode
Content-Type: application/json

{
  "pubKey": "WalletPublicKeyBase58..."
}
```

Registers the pNode on Xandeum DevNet using the owner's wallet public key.

**Response:**
```json
{
  "ok": true,
  "tx": "TransactionSignature..."
}
```

### Keypair Endpoints

#### Get Public Key

```http
GET /keypair
```

**Response (exists):**
```json
{
  "message": "Public key retrieved successfully.",
  "publicKey": "Base58PublicKey..."
}
```

**Response (not found):**
```json
{
  "error": "Keypair file does not exist."
}
```

#### Generate Keypair

```http
POST /keypair/generate
```

Generates a new Ed25519 keypair for pNode identity. Stored in `./keypairs/pnode-keypair.json`.

**Response (success):**
```json
{
  "message": "Keypair generated and saved successfully.",
  "publicKey": "NewBase58PublicKey..."
}
```

**Response (already exists):**
```json
{
  "error": "Keypair file already exists."
}
```

### System Endpoints

#### Get Server Info

```http
GET /server-ip
```

Returns hostname and public IP address (via ipify.org).

**Response:**
```json
{
  "ok": true,
  "data": {
    "hostname": "pnode-server-01",
    "ip": "203.0.113.42"
  }
}
```

#### Get Software Versions

```http
GET /versions
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "xandminerd": "v0.5.0",
    "pod": "v1.2.3"
  }
}
```

#### Test Network Speed

```http
GET /network
```

Runs a network speed test using `speedtest-cli` (auto-installed if missing).

**Response:**
```json
{
  "ping": "12.34 ms",
  "latency": "5.67 ms",
  "download": "945.23 Mbps",
  "upload": "892.45 Mbps",
  "server": "Speedtest Server (Location, Country)"
}
```

### Management Endpoints

#### Install Pod

```http
POST /pods/install
```

Initiates pod installation. Returns a session ID for WebSocket progress tracking.

**Response:**
```json
{
  "sessionId": "uuid-v4-string",
  "message": "Command execution started"
}
```

#### Upgrade Software

```http
POST /api/upgrade
```

Upgrades xandminerd, pod, and xandminer to latest versions.

**Response:**
```json
{
  "sessionId": "uuid-v4-string",
  "message": "Upgrade process started"
}
```

#### Restart xandminer

```http
POST /api/restart-xandminer
```

Restarts the xandminer GUI service via systemctl.

**Response:**
```json
{
  "message": "Xandminer restart initiated"
}
```

### Stats Reporting Endpoints (XANDSCOPE)

Optional endpoints for reporting pNode stats to network dashboards.

#### Enable Stats Reporting

```http
POST /stats/enable
```

**Response:**
```json
{
  "ok": true,
  "enabled": true,
  "message": "Stats reporting enabled. Your pNode will now appear on XANDSCOPE."
}
```

#### Disable Stats Reporting

```http
POST /stats/disable
```

**Response:**
```json
{
  "ok": true,
  "enabled": false,
  "message": "Stats reporting disabled."
}
```

#### Get Stats Status

```http
GET /stats/status
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "enabled": false,
    "registered": true,
    "publicKey": "ABC123...",
    "lastReport": "2025-12-04T12:00:00Z",
    "lastStatus": "success",
    "endpoint": "https://stats.xandscope.io/api/report"
  }
}
```

#### Trigger Immediate Report

```http
POST /stats/report-now
```

**Response:**
```json
{
  "ok": true,
  "message": "Report sent",
  "lastReport": "2025-12-04T12:00:00Z",
  "lastStatus": "success"
}
```

## WebSocket Events

xandminerd uses Socket.IO for real-time progress during installations/upgrades:

```javascript
import { io } from 'socket.io-client';

// Connect
const socket = io('http://localhost:4000');

// Start upgrade (after calling POST /api/upgrade)
socket.emit('start-command', { sessionId: 'xxx' });

// Receive progress
socket.on('command-output', (data) => {
  // data.sessionId - Session identifier
  // data.type - 'stdout' | 'stderr' | 'error' | 'complete'
  // data.data - Output text
  // data.status - 'success' | 'error' | 'cancelled' (on complete)
  console.log(data.type, data.data);
});

// Cancel upgrade
socket.emit('cancel-command', { sessionId: 'xxx' });
```

## File Structure

```
xandminerd/
├── src/
│   ├── index.js          # Express server, routes, Socket.IO
│   ├── helpers.js        # Disk, network, storage utilities
│   ├── transactions.js   # Blockchain transactions (register pNode)
│   ├── keypairHelpers.js # Keypair utilities (unused currently)
│   ├── CONSTS.js         # Version and path constants
│   ├── statsReporter.js  # XANDSCOPE stats collection & reporting
│   ├── statsRoutes.js    # Stats API routes
│   └── scripts/
│       ├── upgrade-xandminer.sh
│       └── upgrade-xandminerd.sh
├── keypairs/             # Generated keypairs (created at runtime)
│   └── pnode-keypair.json
├── config/               # Configuration files (created at runtime)
│   └── xandscope-stats.json
├── package.json
├── LICENSE
└── README.md
```

## Blockchain Integration

xandminerd connects to **Xandeum DevNet**:

| Resource | Value |
|----------|-------|
| **RPC Endpoint** | `https://api.devnet.xandeum.com:8899` |
| **pNode Program** | `6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL` |
| **Index Account** | `GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs` |

### Registration Flow

1. Generate keypair (`POST /keypair/generate`)
2. User purchases pNode credits on xandeum.network
3. Connect wallet in xandminer GUI
4. Register pNode (`POST /pnode` with wallet pubkey)
5. Transaction creates registry PDA on-chain

### PDA Seeds

| PDA | Seeds |
|-----|-------|
| Registry | `["registry", pnodePublicKey]` |
| Global | `["global"]` |
| Manager | `["manager", ownerPublicKey]` |

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.21.2 | HTTP server |
| socket.io | ^4.8.1 | Real-time communication |
| @solana/web3.js | ^1.98.0 | Blockchain interactions |
| cors | ^2.8.5 | Cross-origin requests |
| axios | ^1.13.2 | HTTP client |
| pm2 | ^6.0.8 | Process manager |

## Security Notes

- **Localhost only:** Server binds to `127.0.0.1:4000` - cannot be accessed externally
- **No auth required:** Designed to be accessed only from local xandminer GUI
- **Keypairs:** Private keys stored locally in `./keypairs/` directory
- **Root required:** Storage operations require root/sudo permissions
- **Stats privacy:** IP/hostname are SHA-256 hashed before sending (raw values never transmitted)

## Related Projects

- [xandminer](https://github.com/Xandeum/xandminer) - GUI dashboard for pNode operators
- [Xandeum](https://xandeum.network) - Main network website
- [Xandeum Docs](https://docs.xandeum.network) - Documentation

## Version History

| Version | Codename | Notes |
|---------|----------|-------|
| v0.5.0 | Ingolstadt | Current release, stats reporting |
| v0.4.x | Herrenberg | Previous release |
| v0.3.x | Munich | Legacy |

## License

ISC License - See [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Xandeum Labs** - Building the future of decentralized storage
