require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const POLL_INTERVAL = 60 * 1000; // 60 seconds

// Fire-related alert types to monitor
const FIRE_ALERT_TYPES = [
  'Red Flag Warning',
  'Fire Weather Watch',
  'Fire Warning',
  'Extreme Fire Danger'
];

// NWS API endpoint for all active alerts
const NWS_API_URL = 'https://api.weather.gov/alerts/active';

// Track alerts we've already sent (by alert ID)
const sentAlerts = new Set();

// Stats tracking
const stats = {
  startTime: Date.now(),
  alertsSent: 0,
  lastCheck: null,
  lastAlertTime: null
};

// Create Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Define slash commands
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

// Fetch fire-related alerts from NWS
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

    // Filter for fire-related alerts only
    return allAlerts.filter(alert =>
      FIRE_ALERT_TYPES.includes(alert.properties.event)
    );
  } catch (error) {
    console.error('Error fetching alerts:', error.message);
    return [];
  }
}

// Get color based on alert type
function getAlertColor(eventType, severity) {
  // Color by event type first
  const eventColors = {
    'Red Flag Warning': 0xFF0000,      // Red - most critical
    'Extreme Fire Danger': 0xFF0000,   // Red
    'Fire Warning': 0xFF4500,          // Orange-red
    'Fire Weather Watch': 0xFFAA00     // Orange - less urgent
  };

  if (eventColors[eventType]) {
    return eventColors[eventType];
  }

  // Fallback to severity-based colors
  const severityColors = {
    'Extreme': 0xFF0000,
    'Severe': 0xFF6600,
    'Moderate': 0xFFCC00,
    'Minor': 0x00FF00,
    'Unknown': 0x808080
  };
  return severityColors[severity] || severityColors['Unknown'];
}

// Create a Discord embed for an alert
function createAlertEmbed(alert, isTest = false) {
  const props = alert.properties;
  const eventType = props.event || 'Fire Alert';

  const color = getAlertColor(eventType, props.severity);

  // Truncate description if too long (Discord limit is 4096)
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

  // Add headline if available
  if (props.headline) {
    embed.setAuthor({ name: props.headline });
  }

  // Add expiration time if available
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

  // Add link to full alert
  if (props['@id']) {
    embed.setURL(props['@id']);
  }

  return embed;
}

// Check for new alerts and send notifications
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

    // Skip if we've already sent this alert
    if (sentAlerts.has(alertId)) {
      continue;
    }

    // Mark as sent
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

    // Small delay between messages to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (newAlertCount > 0) {
    console.log(`Sent ${newAlertCount} new alert(s)`);
  }

  return { total: alerts.length, new: newAlertCount };
}

// Clean up old alerts from memory
function cleanupOldAlerts() {
  if (sentAlerts.size > 1000) {
    const alertsArray = Array.from(sentAlerts);
    const toRemove = alertsArray.slice(0, alertsArray.length - 500);
    toRemove.forEach(id => sentAlerts.delete(id));
    console.log(`Cleaned up ${toRemove.length} old alerts from memory`);
  }
}

// Format uptime
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

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'test') {
    // Create a fake test alert
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
      // Group by event type
      const byType = {};
      for (const a of alerts) {
        const type = a.properties.event;
        if (!byType[type]) byType[type] = [];
        byType[type].push(a);
      }

      // Build description
      const lines = [];
      for (const [type, typeAlerts] of Object.entries(byType)) {
        lines.push(`**${type}** (${typeAlerts.length})`);
        // Show first 3 areas for each type
        const areas = typeAlerts.slice(0, 3).map(a =>
          `  • ${a.properties.areaDesc || 'Unknown area'}`
        );
        lines.push(...areas);
        if (typeAlerts.length > 3) {
          lines.push(`  *...and ${typeAlerts.length - 3} more*`);
        }
      }
      description = lines.join('\n');

      // Truncate if too long
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

// Register slash commands when bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash commands
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

  // Send startup message
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

  // Initial check
  await checkForAlerts();

  // Set up polling interval
  setInterval(async () => {
    await checkForAlerts();
    cleanupOldAlerts();
  }, POLL_INTERVAL);
});

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Validate configuration
if (!DISCORD_TOKEN) {
  console.error('ERROR: DISCORD_TOKEN is not set in .env file');
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error('ERROR: DISCORD_CHANNEL_ID is not set in .env file');
  process.exit(1);
}

// Login to Discord
client.login(DISCORD_TOKEN);
