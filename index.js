const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    REST, 
    Routes, 
    PermissionsBitField, 
    SlashCommandBuilder, 
    EmbedBuilder,
    AttachmentBuilder
  } = require('discord.js');
  const schedule = require('node-schedule');
  const fs = require('fs');
  const config = require('./config.json');
  
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.commands = new Collection();
  
  // Define slash commands
  const commands = [
    // /forcebck: Force an immediate backup (uses saved SQL config if available)
    new SlashCommandBuilder()
      .setName('forcebck')
      .setDescription('Force a database backup'),
    
    // /setbck: Schedule a backup using separate time fields and connection details
    new SlashCommandBuilder()
      .setName('setbck')
      .setDescription('Schedule a database backup')
      .addStringOption(option =>
        option.setName('sec')
          .setDescription('Seconds (e.g., 0 or *)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('min')
          .setDescription('Minutes (e.g., 0, 5 or */5)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('h')
          .setDescription('Hours (e.g., 0, 1 or *)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('days')
          .setDescription('Day of month (e.g., 15 or *)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('ip')
          .setDescription('Database IP address')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('username')
          .setDescription('Database username')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('dbname')
          .setDescription('Database name')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('password')
          .setDescription('Database password')
          .setRequired(true)
      ),
    
    // /cancelbck: Cancel a scheduled backup by its ID
    new SlashCommandBuilder()
      .setName('cancelbck')
      .setDescription('Cancel a scheduled backup')
      .addIntegerOption(option =>
        option.setName('id')
          .setDescription('Backup ID')
          .setRequired(true)
      ),
    
    // /checkconnect: Check the bot’s Discord connection status
    new SlashCommandBuilder()
      .setName('checkconnect')
      .setDescription('Check bot connection status'),
    
    // /aboutus: Information about the bot creators
    new SlashCommandBuilder()
      .setName('aboutus')
      .setDescription('Information about the creators'),
    
    // /listbck: List all scheduled backups
    new SlashCommandBuilder()
      .setName('listbck')
      .setDescription('List scheduled backups'),
    
    // /cancelall: Cancel all scheduled backups
    new SlashCommandBuilder()
      .setName('cancelall')
      .setDescription('Cancel all scheduled backups'),
    
    // /ping: Show bot latency
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Check bot latency'),
    
    // /updatebck: Update an existing scheduled backup
    new SlashCommandBuilder()
      .setName('updatebck')
      .setDescription('Update a scheduled backup')
      .addIntegerOption(option =>
        option.setName('id')
          .setDescription('Backup ID to update')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('sec')
          .setDescription('New seconds (e.g., 0 or *)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('min')
          .setDescription('New minutes (e.g., 0, 5 or */5)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('h')
          .setDescription('New hours (e.g., 0, 1 or *)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('days')
          .setDescription('New day of month (e.g., 15 or *)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('ip')
          .setDescription('New database IP address')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('username')
          .setDescription('New database username')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('dbname')
          .setDescription('New database name')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('password')
          .setDescription('New database password')
          .setRequired(false)
      ),
    
    // /history: Show backup history
    new SlashCommandBuilder()
      .setName('history')
      .setDescription('Show backup history'),
    
    // /backupquote: Show an inspirational backup quote
    new SlashCommandBuilder()
      .setName('backupquote')
      .setDescription('Show an inspirational backup quote'),
    
    // /stats: Show bot statistics
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Show bot statistics'),
    
    // /setsql: Save database connection details to sqlconfig.json
    new SlashCommandBuilder()
      .setName('setsql')
      .setDescription('Set database connection details and save to sqlconfig.json')
      .addStringOption(option =>
        option.setName('ip')
          .setDescription('Database IP address')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('port')
          .setDescription('Database port (e.g., 3306)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('username')
          .setDescription('Database username')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('dbname')
          .setDescription('Database name')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('password')
          .setDescription('Database password')
          .setRequired(true)
      )
  ].map(command => command.toJSON());
  
  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(config.TOKEN);
  client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    (async () => {
      try {
        console.log('Registering commands...');
        await rest.put(
          Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
          { body: commands }
        );
        console.log('Commands registered.');
      } catch (error) {
        console.error(error);
      }
    })();
  });
  
  // Persistent storage variables
  // scheduledBackups format: { backupId: { job, cronExpression, connection } }
  let scheduledBackups = {};
  // backupHistory is an array of entries: { timestamp, message }
  let backupHistory = [];
  let backupIdCounter = 1;
  let totalBackupsExecuted = 0;
  
  // Save scheduled backups to "scheduledBackups.json"
  function saveScheduledBackups() {
    const backupsToSave = [];
    for (const id in scheduledBackups) {
      backupsToSave.push({
        backupId: id,
        cronExpression: scheduledBackups[id].cronExpression,
        connection: scheduledBackups[id].connection
      });
    }
    fs.writeFileSync('scheduledBackups.json', JSON.stringify(backupsToSave, null, 2));
  }
  
  // Load scheduled backups from "scheduledBackups.json" and reschedule them
  function loadScheduledBackups() {
    if (fs.existsSync('scheduledBackups.json')) {
      try {
        const data = fs.readFileSync('scheduledBackups.json', 'utf8');
        const backups = JSON.parse(data);
        backups.forEach(backup => {
          const job = schedule.scheduleJob(backup.cronExpression, function() {
            runBackup(backup.connection);
          });
          scheduledBackups[backup.backupId] = {
            job: job,
            cronExpression: backup.cronExpression,
            connection: backup.connection
          };
          const idNum = parseInt(backup.backupId);
          if (idNum >= backupIdCounter) {
            backupIdCounter = idNum + 1;
          }
        });
        console.log('Loaded scheduled backups from file.');
      } catch (error) {
        console.error('Error loading scheduled backups:', error);
      }
    }
  }
  
  // Save backup history to "backupHistory.json"
  function saveBackupHistory() {
    fs.writeFileSync('backupHistory.json', JSON.stringify(backupHistory, null, 2));
  }
  
  // Load backup history from "backupHistory.json"
  function loadBackupHistory() {
    if (fs.existsSync('backupHistory.json')) {
      try {
        const data = fs.readFileSync('backupHistory.json', 'utf8');
        backupHistory = JSON.parse(data);
        totalBackupsExecuted = backupHistory.length;
        console.log('Loaded backup history from file.');
      } catch (error) {
        console.error('Error loading backup history:', error);
      }
    }
  }
  
  // Load persistent data on startup
  loadScheduledBackups();
  loadBackupHistory();
  
  // Helper function to send an embed message without pinging the user
  async function sendEmbedResponse(interaction, embed) {
    try {
      await interaction.deferReply({ ephemeral: true });
      await interaction.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      await interaction.deleteReply();
    } catch (err) {
      console.error('Error sending embed:', err);
    }
  }
  
  // Function to perform the backup
  async function runBackup(connection) {
    const timestamp = new Date();
    // Generate simulated SQL backup content
    const backupContent = `
  -- SQL Backup for database: ${connection.dbname}
  -- Created at: ${timestamp.toLocaleString()}
  -- Connection details:
  -- Host: ${connection.ip}
  -- User: ${connection.username}
  -- Password: ${connection.password}
  -- This is a simulated backup file.
  
  CREATE TABLE example (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data VARCHAR(255)
  );
  
  INSERT INTO example (data) VALUES ('sample data 1'), ('sample data 2');
  `;
    // Create an attachment from the backup content (without saving to disk)
    const fileName = `backup-${timestamp.getTime()}.sql`;
    const attachment = new AttachmentBuilder(Buffer.from(backupContent, 'utf8'), { name: fileName });
    
    totalBackupsExecuted++;
    const historyEntry = { timestamp: timestamp.toISOString(), message: `Backup file: ${fileName}` };
    backupHistory.push(historyEntry);
    saveBackupHistory();
    console.log(`Backup file ${fileName} generated for database ${connection.dbname}`);
  
    // Create an embed for the backup result
    const embed = new EmbedBuilder()
      .setTitle('Backup Completed')
      .setDescription(`Backup for database **${connection.dbname}** (user: ${connection.username}, IP: ${connection.ip}) completed at ${timestamp.toLocaleString()}.`)
      .setColor(0x00FF00)
      .setTimestamp();
  
    // Send the backup file to the designated channel if configured
    if (config.BCK_CHANNEL && config.BCK_CHANNEL_ID) {
      try {
        const channel = await client.channels.fetch(config.BCK_CHANNEL_ID);
        if (channel) {
          channel.send({ 
            content: `Backup completed at ${timestamp.toLocaleString()}`, 
            files: [attachment],
            allowedMentions: { parse: [] } 
          });
        }
      } catch (err) {
        console.error('Error sending backup to channel:', err);
      }
    }
    // Send the backup file as a DM if configured
    if (config.DM_BACKUP && config.DM_USER_ID) {
      try {
        const user = await client.users.fetch(config.DM_USER_ID);
        if (user) {
          user.send({ 
            content: `Backup completed at ${timestamp.toLocaleString()}`, 
            files: [attachment],
            allowedMentions: { parse: [] } 
          });
        }
      } catch (err) {
        console.error('Error sending backup as DM:', err);
      }
    }
  }
  
  // Helper function to check if the user has administrator permissions
  function isAdmin(interaction) {
    return interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator);
  }
  
  // Handle slash command interactions
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    if (!isAdmin(interaction)) {
      const noPermEmbed = new EmbedBuilder()
        .setTitle('No Permission')
        .setDescription('You do not have permission to use this command.')
        .setColor(0xFF0000)
        .setTimestamp();
      return sendEmbedResponse(interaction, noPermEmbed);
    }
    
    if (interaction.commandName === 'forcebck') {
      // Attempt to read saved SQL configuration from file
      let connection;
      if (fs.existsSync('sqlconfig.json')) {
        try {
          connection = JSON.parse(fs.readFileSync('sqlconfig.json', 'utf8'));
        } catch (err) {
          console.error('Error reading sqlconfig.json:', err);
        }
      }
      if (!connection) {
        connection = { ip: '127.0.0.1', username: 'default', dbname: 'default_db', password: 'default' };
      }
      const embed = new EmbedBuilder()
        .setTitle('Forced Backup')
        .setDescription('Starting forced backup...')
        .setColor(0x00FF00)
        .setTimestamp();
      sendEmbedResponse(interaction, embed);
      runBackup(connection);
    }
    else if (interaction.commandName === 'setbck') {
      // Retrieve time fields and build a cron expression: sec min h day * *
      const sec = interaction.options.getString('sec');
      const min = interaction.options.getString('min');
      const h = interaction.options.getString('h');
      const days = interaction.options.getString('days');
      const cronExpression = `${sec} ${min} ${h} ${days} * *`;
      
      // Retrieve database connection details
      const ip = interaction.options.getString('ip');
      const username = interaction.options.getString('username');
      const dbname = interaction.options.getString('dbname');
      const password = interaction.options.getString('password');
  
      let job;
      try {
        job = schedule.scheduleJob(cronExpression, function() {
          runBackup({ ip, username, dbname, password });
        });
      } catch (err) {
        console.error('Error scheduling backup:', err);
        const errorEmbed = new EmbedBuilder()
          .setTitle('Error')
          .setDescription('Failed to schedule backup. Check the provided values.')
          .setColor(0xFF0000)
          .setTimestamp();
        return sendEmbedResponse(interaction, errorEmbed);
      }
      
      if (job) {
        const backupId = backupIdCounter++;
        scheduledBackups[backupId] = {
          job,
          cronExpression,
          connection: { ip, username, dbname, password }
        };
        saveScheduledBackups();
        const successEmbed = new EmbedBuilder()
          .setTitle('Backup Scheduled')
          .setDescription(`Backup scheduled successfully.\n**Backup ID:** ${backupId}\n**Cron:** \`${cronExpression}\`\n**Database:** ${dbname}\n**User:** ${username}\n**IP:** ${ip}`)
          .setColor(0x00FF00)
          .setTimestamp();
        return sendEmbedResponse(interaction, successEmbed);
      } else {
        const errorEmbed = new EmbedBuilder()
          .setTitle('Error')
          .setDescription('Failed to schedule backup.')
          .setColor(0xFF0000)
          .setTimestamp();
        return sendEmbedResponse(interaction, errorEmbed);
      }
    }
    else if (interaction.commandName === 'cancelbck') {
      const id = interaction.options.getInteger('id');
      if (scheduledBackups[id]) {
        scheduledBackups[id].job.cancel();
        delete scheduledBackups[id];
        saveScheduledBackups();
        const embed = new EmbedBuilder()
          .setTitle('Backup Canceled')
          .setDescription(`Scheduled backup with ID ${id} has been canceled.`)
          .setColor(0xFFA500)
          .setTimestamp();
        return sendEmbedResponse(interaction, embed);
      } else {
        const embed = new EmbedBuilder()
          .setTitle('Error')
          .setDescription(`No scheduled backup found with ID ${id}.`)
          .setColor(0xFF0000)
          .setTimestamp();
        return sendEmbedResponse(interaction, embed);
      }
    }
    else if (interaction.commandName === 'checkconnect') {
      const wsStatus = client.ws.status;
      let statusMessage;
      switch (wsStatus) {
        case 0:
          statusMessage = 'Connecting...';
          break;
        case 1:
          statusMessage = 'Connected';
          break;
        case 2:
          statusMessage = 'Disconnecting...';
          break;
        case 3:
          statusMessage = 'Disconnected';
          break;
        default:
          statusMessage = 'Unknown status';
      }
      const embed = new EmbedBuilder()
        .setTitle('Connection Status')
        .setDescription(`Bot connection status: **${statusMessage}**`)
        .setColor(0x00FFFF)
        .setTimestamp();
      return sendEmbedResponse(interaction, embed);
    }
    else if (interaction.commandName === 'aboutus') {
      const embed = new EmbedBuilder()
        .setTitle('About Us')
        .setDescription('ZeroGravity BVVS DataBase BackupBot\nCreators: ZeroGravity BVVS\nVersion: 1.0.0')
        .setColor(0x800080)
        .setTimestamp();
      return sendEmbedResponse(interaction, embed);
    }
    else if (interaction.commandName === 'listbck') {
      const keys = Object.keys(scheduledBackups);
      if (keys.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('Scheduled Backups')
          .setDescription('No backups scheduled.')
          .setColor(0xFFFF00)
          .setTimestamp();
        return sendEmbedResponse(interaction, embed);
      }
      const embed = new EmbedBuilder()
        .setTitle('Scheduled Backups')
        .setColor(0xFFFF00)
        .setTimestamp();
      keys.forEach(id => {
        const { cronExpression, connection } = scheduledBackups[id];
        embed.addFields({
          name: `Backup ID: ${id}`,
          value: `Cron: \`${cronExpression}\`\nDatabase: ${connection.dbname}\nUser: ${connection.username}\nIP: ${connection.ip}`,
          inline: false
        });
      });
      return sendEmbedResponse(interaction, embed);
    }
    else if (interaction.commandName === 'cancelall') {
      const keys = Object.keys(scheduledBackups);
      if (keys.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('Cancel All Backups')
          .setDescription('No backups scheduled.')
          .setColor(0xFF0000)
          .setTimestamp();
        return sendEmbedResponse(interaction, embed);
      }
      keys.forEach(id => {
        scheduledBackups[id].job.cancel();
        delete scheduledBackups[id];
      });
      saveScheduledBackups();
      const embed = new EmbedBuilder()
        .setTitle('All Backups Canceled')
        .setDescription('All scheduled backups have been canceled.')
        .setColor(0xFFA500)
        .setTimestamp();
      return sendEmbedResponse(interaction, embed);
    }
    else if (interaction.commandName === 'ping') {
      const latency = client.ws.ping;
      const embed = new EmbedBuilder()
        .setTitle('Bot Ping')
        .setDescription(`Latency: **${latency}ms**`)
        .setColor(0x00FF00)
        .setTimestamp();
      return sendEmbedResponse(interaction, embed);
    }
    else if (interaction.commandName === 'updatebck') {
      const id = interaction.options.getInteger('id');
      const sec = interaction.options.getString('sec');
      const min = interaction.options.getString('min');
      const h = interaction.options.getString('h');
      const days = interaction.options.getString('days');
      const newCron = `${sec} ${min} ${h} ${days} * *`;
      const newIp = interaction.options.getString('ip');
      const newUsername = interaction.options.getString('username');
      const newDbname = interaction.options.getString('dbname');
      const newPassword = interaction.options.getString('password');
  
      if (scheduledBackups[id]) {
        scheduledBackups[id].job.cancel();
        const currentConnection = scheduledBackups[id].connection;
        const connection = {
          ip: newIp || currentConnection.ip,
          username: newUsername || currentConnection.username,
          dbname: newDbname || currentConnection.dbname,
          password: newPassword || currentConnection.password
        };
        let job;
        try {
          job = schedule.scheduleJob(newCron, function() {
            runBackup(connection);
          });
        } catch (err) {
          console.error('Error updating backup:', err);
          const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setDescription('Failed to update backup. Check the cron expression.')
            .setColor(0xFF0000)
            .setTimestamp();
          return sendEmbedResponse(interaction, errorEmbed);
        }
        scheduledBackups[id] = { job, cronExpression: newCron, connection };
        saveScheduledBackups();
        const embed = new EmbedBuilder()
          .setTitle('Backup Updated')
          .setDescription(`Backup with ID ${id} has been updated.\n**New Cron:** \`${newCron}\`\nDatabase: ${connection.dbname}\nUser: ${connection.username}\nIP: ${connection.ip}`)
          .setColor(0x00FF00)
          .setTimestamp();
        return sendEmbedResponse(interaction, embed);
      } else {
        const embed = new EmbedBuilder()
          .setTitle('Error')
          .setDescription(`No scheduled backup found with ID ${id}.`)
          .setColor(0xFF0000)
          .setTimestamp();
        return sendEmbedResponse(interaction, embed);
      }
    }
    else if (interaction.commandName === 'history') {
      if (backupHistory.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('Backup History')
          .setDescription('No backup history available.')
          .setColor(0xAAAAAA)
          .setTimestamp();
        return sendEmbedResponse(interaction, embed);
      }
      const recentHistory = backupHistory.slice(-10);
      const embed = new EmbedBuilder()
        .setTitle('Backup History')
        .setColor(0xAAAAAA)
        .setTimestamp();
      recentHistory.forEach(record => {
        embed.addFields({
          name: new Date(record.timestamp).toLocaleString(),
          value: record.message,
          inline: false
        });
      });
      return sendEmbedResponse(interaction, embed);
    }
    else if (interaction.commandName === 'backupquote') {
      const quotes = [
        '“Backup is the best insurance against disaster.”',
        '“Never trust randomness – make a backup!”',
        '“Backup is like insurance – better to have it and not need it than need it and not have it.”',
        '“Regular backups are the key to peace of mind.”',
        '“Make a backup before you lose what matters most.”'
      ];
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      const embed = new EmbedBuilder()
        .setTitle('Backup Inspiration')
        .setDescription(randomQuote)
        .setColor(0x00BFFF)
        .setTimestamp();
      return sendEmbedResponse(interaction, embed);
    }
    else if (interaction.commandName === 'stats') {
      const uptime = client.uptime;
      const scheduledCount = Object.keys(scheduledBackups).length;
      const embed = new EmbedBuilder()
        .setTitle('Bot Statistics')
        .addFields(
          { name: 'Total Backups Executed', value: `${totalBackupsExecuted}`, inline: true },
          { name: 'Scheduled Backups', value: `${scheduledCount}`, inline: true },
          { name: 'Uptime', value: `${Math.floor(uptime / 1000)} seconds`, inline: true }
        )
        .setColor(0x32CD32)
        .setTimestamp();
      return sendEmbedResponse(interaction, embed);
    }
    else if (interaction.commandName === 'setsql') {
      const ip = interaction.options.getString('ip');
      const port = interaction.options.getInteger('port');
      const username = interaction.options.getString('username');
      const dbname = interaction.options.getString('dbname');
      const password = interaction.options.getString('password');
      
      const sqlConfig = { ip, port, username, dbname, password };
      
      try {
        fs.writeFileSync('sqlconfig.json', JSON.stringify(sqlConfig, null, 2));
        const embed = new EmbedBuilder()
          .setTitle('SQL Configuration Saved')
          .setDescription('Database connection details have been saved to `sqlconfig.json`.')
          .addFields(
            { name: 'IP', value: ip, inline: true },
            { name: 'Port', value: `${port}`, inline: true },
            { name: 'Username', value: username, inline: true },
            { name: 'DB Name', value: dbname, inline: true }
          )
          .setColor(0x00FF00)
          .setTimestamp();
        return sendEmbedResponse(interaction, embed);
      } catch (err) {
        console.error('Error saving sqlconfig.json:', err);
        const embed = new EmbedBuilder()
          .setTitle('Error')
          .setDescription('Failed to save SQL configuration.')
          .setColor(0xFF0000)
          .setTimestamp();
        return sendEmbedResponse(interaction, embed);
      }
    }
  });
  
  client.login(config.TOKEN);
  