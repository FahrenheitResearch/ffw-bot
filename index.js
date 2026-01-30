const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

// Config file path (same directory as exe)
const CONFIG_PATH = path.join(process.cwd(), 'config.json');

// Load or create config
async function getConfig() {
  // Try to load existing config
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (config.DISCORD_TOKEN && config.DISCORD_CHANNEL_ID) {
        return config;
      }
    } catch (e) {
      // Invalid config, will prompt for new one
    }
  }

  // Also check .env file
  try {
    require('dotenv').config();
    if (process.env.DISCORD_TOKEN && process.env.DISCORD_CHANNEL_ID) {
      return {
        DISCORD_TOKEN: process.env.DISCORD_TOKEN,
        DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID
      };
    }
  } catch (e) {
    // dotenv not available or .env missing
  }

  // Prompt user for config
  console.log('');
  console.log('========================================');
  console.log('  Fire Weather Alert Bot - First Run');
  console.log('========================================');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('You need a Discord Bot Token.');
  console.log('Get one at: https://discord.com/developers/applications');
  console.log('(Create app > Bot > Reset Token > Copy)');
  console.log('');
  const token = await question('Paste your Discord Bot Token: ');

  console.log('');
  console.log('You need a Discord Channel ID.');
  console.log('(Enable Developer Mode in Discord, right-click channel > Copy ID)');
  console.log('');
  const channelId = await question('Paste your Channel ID: ');

  rl.close();

  const config = {
    DISCORD_TOKEN: token.trim(),
    DISCORD_CHANNEL_ID: channelId.trim()
  };

  // Save config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('');
  console.log('Config saved to config.json');
  console.log('');

  return config;
}

// Main function
async function main() {
  const config = await getConfig();
  const DISCORD_TOKEN = config.DISCORD_TOKEN;
  const CHANNEL_ID = config.DISCORD_CHANNEL_ID;

  const POLL_INTERVAL = 60 * 1000;

  const FIRE_ALERT_TYPES = [
    'Red Flag Warning',
    'Fire Weather Watch',
    'Fire Warning',
    'Extreme Fire Danger'
  ];

  const NWS_API_URL = 'https://api.weather.gov/alerts/active';
  const sentAlerts = new Set();

  const stats = {
    startTime: Date.now(),
    alertsSent: 0,
    lastCheck: null,
    lastAlertTime: null
  };

  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  const commands = [
    new SlashCommandBuilder()
      .setName('test')
      .setDescription('Send a test alert to verify the bot is working'),
    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Show bot status and statistics'),
    new SlashCommandBuilder()
      .setName('check')
      .setDescription('Manually check for new fire weather alerts'),
    new SlashCommandBuilder()
      .setName('active')
      .setDescription('Show count of currently active fire weather alerts'),
  ];

  async function fetchFireAlerts() {
    try {
      const response = await fetch(NWS_API_URL, {
        headers: {
          'User-Agent': 'FireWeatherBot/1.0 (Discord Notification Bot)',
          'Accept': 'application/geo+json'
        }
      });

      if (!response.ok) {
        throw new Error(`NWS API returned ${response.status}`);
      }

      const data = await response.json();
      const allAlerts = data.features || [];

      return allAlerts.filter(alert =>
        FIRE_ALERT_TYPES.includes(alert.properties.event)
      );
    } catch (error) {
      console.error('Error fetching alerts:', error.message);
      return [];
    }
  }

  function getAlertColor(eventType, severity) {
    const eventColors = {
      'Red Flag Warning': 0xFF0000,
      'Extreme Fire Danger': 0xFF0000,
      'Fire Warning': 0xFF4500,
      'Fire Weather Watch': 0xFFAA00
    };

    if (eventColors[eventType]) {
      return eventColors[eventType];
    }

    const severityColors = {
      'Extreme': 0xFF0000,
      'Severe': 0xFF6600,
      'Moderate': 0xFFCC00,
      'Minor': 0x00FF00,
      'Unknown': 0x808080
    };
    return severityColors[severity] || severityColors['Unknown'];
  }

  function createAlertEmbed(alert, isTest = false) {
    const props = alert.properties;
    const eventType = props.event || 'Fire Alert';
    const color = getAlertColor(eventType, props.severity);

    let description = props.description || 'No description available';
    if (description.length > 2000) {
      description = description.substring(0, 1997) + '...';
    }

    const title = isTest ? `TEST - ${eventType}` : eventType;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .addFields(
        { name: 'Area', value: props.areaDesc || 'Unknown', inline: false },
        { name: 'Severity', value: props.severity || 'Unknown', inline: true },
        { name: 'Urgency', value: props.urgency || 'Unknown', inline: true },
        { name: 'Certainty', value: props.certainty || 'Unknown', inline: true }
      )
      .setTimestamp(new Date(props.effective || Date.now()))
      .setFooter({ text: isTest ? 'TEST ALERT - Not Real' : 'National Weather Service' });

    if (props.headline) {
      embed.setAuthor({ name: props.headline });
    }

    if (props.expires) {
      const expiresDate = new Date(props.expires);
      embed.addFields({
        name: 'Expires',
        value: expiresDate.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          dateStyle: 'medium',
          timeStyle: 'short'
        }) + ' ET',
        inline: false
      });
    }

    if (props['@id']) {
      embed.setURL(props['@id']);
    }

    return embed;
  }

  async function checkForAlerts(forceChannel = null) {
    const alerts = await fetchFireAlerts();
    const channel = forceChannel || client.channels.cache.get(CHANNEL_ID);

    stats.lastCheck = Date.now();

    if (!channel) {
      console.error('Could not find channel with ID:', CHANNEL_ID);
      return { total: alerts.length, new: 0 };
    }

    let newAlertCount = 0;

    for (const alert of alerts) {
      const alertId = alert.properties.id;

      if (sentAlerts.has(alertId)) {
        continue;
      }

      sentAlerts.add(alertId);
      newAlertCount++;
      stats.alertsSent++;
      stats.lastAlertTime = Date.now();

      try {
        const embed = createAlertEmbed(alert);
        await channel.send({ embeds: [embed] });
        console.log(`Sent alert: ${alert.properties.event} - ${alert.properties.headline || alertId}`);
      } catch (error) {
        console.error('Error sending alert:', error.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (newAlertCount > 0) {
      console.log(`Sent ${newAlertCount} new alert(s)`);
    }

    return { total: alerts.length, new: newAlertCount };
  }

  function cleanupOldAlerts() {
    if (sentAlerts.size > 1000) {
      const alertsArray = Array.from(sentAlerts);
      const toRemove = alertsArray.slice(0, alertsArray.length - 500);
      toRemove.forEach(id => sentAlerts.delete(id));
      console.log(`Cleaned up ${toRemove.length} old alerts from memory`);
    }
  }

  function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'test') {
      const testAlert = {
        properties: {
          id: 'TEST-' + Date.now(),
          event: 'Red Flag Warning',
          headline: 'TEST ALERT - Red Flag Warning',
          description: 'This is a TEST alert to verify the bot is working correctly. This is NOT a real alert.\n\nIf you can see this message, the bot is configured correctly and will send real alerts when fire weather alerts are issued.',
          areaDesc: 'Test County, Test State',
          severity: 'Severe',
          urgency: 'Expected',
          certainty: 'Observed',
          effective: new Date().toISOString(),
          expires: new Date(Date.now() + 3600000).toISOString()
        }
      };

      const embed = createAlertEmbed(testAlert, true);
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'status') {
      const uptime = formatUptime(Date.now() - stats.startTime);
      const lastCheck = stats.lastCheck
        ? `<t:${Math.floor(stats.lastCheck / 1000)}:R>`
        : 'Never';
      const lastAlert = stats.lastAlertTime
        ? `<t:${Math.floor(stats.lastAlertTime / 1000)}:R>`
        : 'None yet';

      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Bot Status')
        .addFields(
          { name: 'Uptime', value: uptime, inline: true },
          { name: 'Alerts Sent', value: stats.alertsSent.toString(), inline: true },
          { name: 'Tracked Alerts', value: sentAlerts.size.toString(), inline: true },
          { name: 'Last Check', value: lastCheck, inline: true },
          { name: 'Last Alert', value: lastAlert, inline: true },
          { name: 'Poll Interval', value: '60 seconds', inline: true },
          { name: 'Monitoring', value: FIRE_ALERT_TYPES.join(', '), inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Fire Weather Alert Bot' });

      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'check') {
      await interaction.deferReply();

      const result = await checkForAlerts();

      const embed = new EmbedBuilder()
        .setColor(result.new > 0 ? 0xFF6600 : 0x00AA00)
        .setTitle('Manual Check Complete')
        .setDescription(result.new > 0
          ? `Found and sent **${result.new}** new alert(s)!`
          : 'No new alerts found.')
        .addFields(
          { name: 'Active Alerts', value: result.total.toString(), inline: true },
          { name: 'New Alerts', value: result.new.toString(), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'active') {
      await interaction.deferReply();

      const alerts = await fetchFireAlerts();

      let description = 'No active fire weather alerts at this time.';
      if (alerts.length > 0) {
        const byType = {};
        for (const a of alerts) {
          const type = a.properties.event;
          if (!byType[type]) byType[type] = [];
          byType[type].push(a);
        }

        const lines = [];
        for (const [type, typeAlerts] of Object.entries(byType)) {
          lines.push(`**${type}** (${typeAlerts.length})`);
          const areas = typeAlerts.slice(0, 3).map(a =>
            `  • ${a.properties.areaDesc || 'Unknown area'}`
          );
          lines.push(...areas);
          if (typeAlerts.length > 3) {
            lines.push(`  *...and ${typeAlerts.length - 3} more*`);
          }
        }
        description = lines.join('\n');

        if (description.length > 4000) {
          description = description.substring(0, 3997) + '...';
        }
      }

      const embed = new EmbedBuilder()
        .setColor(alerts.length > 0 ? 0xFF6600 : 0x00AA00)
        .setTitle(`Active Fire Weather Alerts: ${alerts.length}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: 'Data from National Weather Service' });

      await interaction.editReply({ embeds: [embed] });
    }
  });

  client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    try {
      console.log('Registering slash commands...');
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands.map(cmd => cmd.toJSON()) }
      );
      console.log('Slash commands registered!');
    } catch (error) {
      console.error('Error registering commands:', error);
    }

    console.log(`Monitoring for: ${FIRE_ALERT_TYPES.join(', ')}`);
    console.log(`Notifications will be sent to channel: ${CHANNEL_ID}`);

    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
      const startupEmbed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setTitle('Fire Weather Alert Bot Online')
        .setDescription(`Now monitoring for fire weather alerts across the United States.\n\n**Alert Types Monitored:**\n${FIRE_ALERT_TYPES.map(t => `• ${t}`).join('\n')}\n\n**Commands:**\n\`/test\` - Send a test alert\n\`/status\` - Show bot status\n\`/check\` - Manually check for alerts\n\`/active\` - Show active alerts`)
        .setTimestamp()
        .setFooter({ text: 'Polling every 60 seconds' });

      await channel.send({ embeds: [startupEmbed] });
    }

    await checkForAlerts();

    setInterval(async () => {
      await checkForAlerts();
      cleanupOldAlerts();
    }, POLL_INTERVAL);
  });

  client.on('error', error => {
    console.error('Discord client error:', error);
  });

  process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
  });

  console.log('Starting bot...');
  client.login(DISCORD_TOKEN);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
