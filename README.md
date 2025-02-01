# Discord Backup Bot

## 📌 Description
Discord Backup Bot is a bot designed to manage MySQL database backups directly from a Discord server. It allows both manual and automated backup creation and scheduling.Discord Backup Bot to bot do zarządzania kopiami zapasowymi baz danych MySQL bezpośrednio z poziomu serwera Discord. Pozwala na ręczne i automatyczne tworzenie backupów oraz zarządzanie harmonogramem zaplanowanych kopii.

## 🔧 Requirements
- Node.js (zalecana wersja LTS)
- MySQL
- Discord Developer Bot Token

## 🚀 Installation

**To ensure the bot functions smoothly without issues, it is recommended to host it on the same machine where the MySQL database is running. This will enable faster communication and minimize potential network-related errors.**
### 1. **Cloning the repository**
```bash
git clone https://github.com/BVVS77/zerogravity-databot
cd zerogravity-databot
```

### 2. **Installing dependencies**
```bash
npm install discord.js mysql2 node-schedule fs zlib
```

### 3. **Configuring the `config.json` file**
Create a `config.json` file in the root directory and fill it with the appropriate values:
```json
{
  "TOKEN": "your-token",
  "CLIENT_ID": "your-client-id",
  "GUILD_ID": "your-guild-id",
  "BCK_CHANNEL_ID": "backup-channel-id",
  "DM_USER_ID": "your-user-id"
}
```

### 4. **Running the bot**
```bash
node bot.js
```

To keep the bot running in the background, use `pm2`:
```bash
npm install -g pm2
pm2 start bot.js --name "BackupBot"
```

## 🛠️ Available Commands
| Command | Description |
|---------|------|
| `/forcebck` | Forces an immediate backup |
| `/setbck` | Scheduling a backup |
| `/cancelbck` | Cancels a scheduled copy |
| `/listbck` | Displays a list of scheduled backups |
| `/cancellall` | Cancels all scheduled backups |
| `/updatebck` | Updates scheduled backup |
| `/history` | Shows backup history |
| `/stats` | Displays bot statistics |
| `/setsql` | Writes connection data to MySQL |

## 📜 License
This project is released under the MIT license.

---
If you have any questions or suggestions, feel free to open an issue on GitHub!

