# Fire Weather Alert Discord Bot

A Discord bot that automatically sends notifications for fire weather alerts anywhere in the United States.

**Monitors these alert types:**
- Red Flag Warning (critical fire weather conditions)
- Fire Weather Watch (conditions may develop)
- Fire Warning (active fire)
- Extreme Fire Danger

The bot checks the National Weather Service every 60 seconds and posts alerts to your Discord channel with details about the alert type, affected area, severity, and expiration time.

---

## Setup Guide (No Coding Experience Required)

### Step 1: Install Node.js

Node.js is required to run this bot.

1. Go to https://nodejs.org/
2. Download the **LTS** version (the big green button on the left)
3. Run the installer and click "Next" through all the steps
4. Restart your computer after installation

**To verify it installed correctly:**
- Open Command Prompt (Windows) or Terminal (Mac)
- Type `node --version` and press Enter
- You should see a version number like `v20.11.0`

---

### Step 2: Create a Discord Bot

1. Go to the **Discord Developer Portal**: https://discord.com/developers/applications

2. Click the **"New Application"** button (top right)

3. Give your bot a name (e.g., "Fire Weather Bot") and click **Create**

4. In the left sidebar, click **"Bot"**

5. Click **"Reset Token"** and then **"Yes, do it!"**

6. Click **"Copy"** to copy your bot token
   - **IMPORTANT:** Save this somewhere safe! You'll need it later.
   - **Never share this token with anyone!**

7. Scroll down and enable these settings under "Privileged Gateway Intents":
   - You don't need any privileged intents for this bot, so leave them off

8. In the left sidebar, click **"OAuth2"** then **"URL Generator"**

9. Under "Scopes", check:
    - `bot`
    - `applications.commands` (this enables slash commands)

10. Under "Bot Permissions", check:
    - `Send Messages`
    - `Embed Links`
    - `Use Slash Commands`

11. Copy the **Generated URL** at the bottom

12. Paste the URL in your browser and select the server you want to add the bot to

---

### Step 3: Get Your Channel ID

1. Open Discord

2. Go to **User Settings** (gear icon at bottom left)

3. Go to **Advanced** and enable **"Developer Mode"**

4. Close settings

5. Right-click on the channel where you want fire weather alerts

6. Click **"Copy Channel ID"**

---

### Step 4: Download and Set Up the Bot

1. Download this bot's files to a folder on your computer

2. Open the folder and find the file called `.env.example`

3. Make a copy of this file and rename it to just `.env` (remove the `.example` part)

4. Open the `.env` file with Notepad (Windows) or TextEdit (Mac)

5. Replace the placeholder values:
   ```
   DISCORD_TOKEN=paste_your_bot_token_here
   DISCORD_CHANNEL_ID=paste_your_channel_id_here
   ```

6. Save the file

---

### Step 5: Install Dependencies

1. Open Command Prompt (Windows) or Terminal (Mac)

2. Navigate to the bot folder. For example:
   ```
   cd C:\Users\YourName\Downloads\ffw-bot
   ```
   Or on Mac:
   ```
   cd ~/Downloads/ffw-bot
   ```

3. Run this command:
   ```
   npm install
   ```
   Wait for it to finish (you'll see some text scrolling by)

---

### Step 6: Start the Bot

In the same Command Prompt/Terminal window, run:
```
npm start
```

You should see:
```
Logged in as YourBotName#1234
Monitoring for Fire Weather Warnings...
```

The bot will also send a message to your Discord channel confirming it's online.

**Keep this window open!** The bot stops when you close it.

---

## Commands

The bot has slash commands you can use in Discord. Type `/` in any channel to see them:

| Command | Description |
|---------|-------------|
| `/test` | Send a fake test alert to verify the bot is working |
| `/status` | Show bot uptime, alerts sent, and last check time |
| `/check` | Manually trigger a check for new alerts |
| `/active` | Show how many Fire Weather Warnings are currently active |

**Note:** Slash commands may take up to an hour to appear after first starting the bot. This is normal Discord behavior.

---

## Keeping the Bot Running

The bot only runs while your computer is on and the Command Prompt/Terminal is open.

### Option A: Keep Your Computer On
Just leave Command Prompt/Terminal open. The bot will run until you close it or restart your computer.

### Option B: Run on Startup (Windows)

1. Press `Win + R`, type `shell:startup`, press Enter
2. Create a new file called `start-ffw-bot.bat`
3. Add these lines (adjust the path to your bot folder):
   ```bat
   cd C:\Users\YourName\ffw-bot
   npm start
   ```
4. Save the file

The bot will now start automatically when you log in.

### Option C: Run 24/7 (Advanced)

For 24/7 operation, you'll need to host the bot on a server or cloud service. Some options:
- **Railway** (https://railway.app) - Easy, has free tier
- **Render** (https://render.com) - Has free tier
- **DigitalOcean** (https://digitalocean.com) - $5/month droplet

---

## Troubleshooting

### "DISCORD_TOKEN is not set"
- Make sure you renamed `.env.example` to `.env`
- Make sure you pasted your bot token in the `.env` file
- Make sure there are no spaces around the `=` sign

### "Could not find channel"
- Make sure you copied the correct channel ID
- Make sure the bot has been added to that server
- Make sure the bot has permission to view and send messages in that channel

### "node is not recognized"
- Node.js isn't installed correctly
- Try reinstalling Node.js and restart your computer

### Bot goes offline after closing terminal
- This is normal! See "Keeping the Bot Running" section above.

### No alerts appearing
- The bot only sends NEW alerts after it starts
- It won't send alerts that were already active before the bot started
- Fire Weather Warnings aren't always active - check https://alerts.weather.gov to see if any are currently issued

---

## How It Works

- The bot checks the National Weather Service API every 60 seconds
- Monitors for: Red Flag Warning, Fire Weather Watch, Fire Warning, Extreme Fire Danger
- When a new alert is issued anywhere in the US, it sends a notification
- Each alert is only sent once (the bot remembers which alerts it has already sent)
- Alerts include: alert type, affected area, severity, urgency, description, and expiration time

---

## Support

If you have issues or questions, check:
- NWS Alerts Status: https://alerts.weather.gov
- Discord.js Guide: https://discordjs.guide/

---

## License

MIT - Do whatever you want with it!
