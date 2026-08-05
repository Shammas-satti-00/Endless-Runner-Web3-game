# 🚆 ShredRunner

> A modern **Three.js + Vite** endless runner featuring Web3 wallet integration,
> procedurally generated railway environments, and a fixed-supply blockchain
> reward system.

![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-yellow)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-black)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Overview

**ShredRunner** is the runtime behind the **Subway Rush** experience.

Built with **Vite** and **Three.js**, it delivers fast arcade gameplay with
procedurally generated environments while offering optional Web3 features such
as wallet connectivity and blockchain-based rewards.

The game is fully playable without connecting a wallet. Wallet integration is
used only for ownership verification and reward claims.

---

## 🎮 Features

### Gameplay

- Three-lane endless runner
- Jump, slide, fast-fall, and momentum mechanics
- Dynamic speed progression
- Energy system
- Skill-based scoring
- Near-miss bonus system
- Lane-safe procedural obstacle generation
- Local mission progression
- Cosmetic loadouts

### Graphics

- Physically-based rendering
- Optimized animated runner (Meshopt + WebP)
- Wet asphalt and railway materials
- Blue-hour city environment
- Tunnel, station, elevated, and surface tracks
- Instanced scenery
- Adaptive rendering resolution
- Multiple graphics presets

### Web3

- Guest mode supported
- MetaMask
- Rabby
- Coinbase Wallet
- Brave Wallet
- WalletConnect
- Ethereum
- Base
- Polygon

### Smart Contracts

- Fixed supply **RUSH** token
- Signed reward claims
- EIP-712 receipts
- Seasonal reward budgets
- Team vesting
- ERC20Votes
- ERC-2612 Permit

---

# 🏗 Tech Stack

| Area | Technology |
|------|------------|
| Frontend | Vite |
| Rendering | Three.js |
| Language | JavaScript (ES2022) |
| Smart Contracts | Solidity |
| Tooling | Hardhat |
| Testing | Mocha + Chai |
| Wallets | EIP-1193 + WalletConnect |
| Deployment | Static Hosting / Netlify |

---

# 📁 Project Structure

```text
contracts/
public/
scripts/
src/
test/
vite.config.js
```

---

# 🏃 Getting Started

## Requirements

- Node.js 22+
- npm
- Modern browser with WebGL support

## Installation

```bash
git clone https://github.com/username/ShredRunner.git

cd ShredRunner

npm install

npm run dev
```

Production build

```bash
npm run build
npm run preview
```

---

# ⚙ Environment

Copy the example environment file.

```bash
cp .env.example .env
```

Important variables:

```env
VITE_WALLETCONNECT_PROJECT_ID=

VITE_BASE_URL=/

SEPOLIA_RPC_URL=

BASE_SEPOLIA_RPC_URL=

DEPLOYER_PRIVATE_KEY=

RUSH_ADMIN=

RUSH_TREASURY=

RUSH_REWARD_SIGNER=
```

> Never expose private keys through `VITE_` variables.

---

# 🎮 Controls

| Action | Keyboard | Touch |
|---------|----------|-------|
| Move Left | A / ← | Swipe Left |
| Move Right | D / → | Swipe Right |
| Jump | W / ↑ / Space | Swipe Up |
| Slide | ↓ | Swipe Down |
| Fast Fall | ↓ (Airborne) | Swipe Down |
| Pause | Esc / P | Pause Button |

---

# 🚄 Gameplay

- Endless procedural railway generation
- Speed increases throughout each run
- Dynamic obstacle placement
- Momentum-based scoring
- Energy management
- Skill bonuses
- Local mission tracking

---

# 🌆 Environment

The world is generated using reusable chunks instead of an infinitely growing
scene.

Included environments:

- Surface Railway
- Underground Tunnels
- Stations
- Elevated Tracks

Rendering includes:

- Wet asphalt
- Rain-darkened concrete
- Reflective rails
- Dense procedural skyline
- Instanced buildings
- Dynamic atmospheric depth

---

# 🔗 Wallet Support

Supported wallets include:

- MetaMask
- Rabby
- Coinbase Wallet
- Brave Wallet
- WalletConnect

Supported networks:

- Ethereum
- Base
- Polygon

Wallet connection is **optional**.

---

# 🪙 RUSH Token

The project includes a fixed-supply ERC-20 token used for gameplay rewards.

Features include:

- Fixed supply
- No minting
- ERC20Votes
- ERC2612 Permit
- Seasonal reward vault
- EIP-712 signatures
- Team vesting

For complete tokenomics see:

```
docs/tokenomics.md
```

---

# 🧪 Available Commands

### Application

```bash
npm run dev

npm run build

npm run preview

npm run validate

npm run audit:prod
```

### Contracts

```bash
npm run contracts:compile

npm run contracts:test

npm run contracts:coverage
```

### Deployment

```bash
npm run contracts:deploy

npm run contracts:season

npm run contracts:sign-receipt
```

---

# ✅ Validation

Automated validation covers:

- JavaScript
- Gameplay generation
- Collision safety
- Rendering
- Smart contracts
- Production builds

Current status:

| Check | Status |
|--------|--------|
| JavaScript | ✅ |
| Gameplay Validation | ✅ |
| Solidity Tests | ✅ |
| Production Build | ✅ |

---

# 📚 Documentation

Additional documentation is available inside the `/docs` folder.

- Architecture
- Tokenomics
- Smart Contracts
- Security
- Deployment
- Validation

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

---

# 📄 License

MIT License

---

# 🙏 Acknowledgements

- Three.js
- Vite
- OpenZeppelin
- Hardhat
- WalletConnect
- Khronos Group
- Kenney Assets

---

**ShredRunner** combines modern WebGL rendering with optional Web3 functionality,
creating an endless runner that remains fully playable for every player while
supporting blockchain-based ownership and reward systems.
