// Discord Bot Permission Calculator
// Run this to get the correct permission integer for your music bot

const permissions = {
  // Basic permissions
  'SEND_MESSAGES': 2048,
  'EMBED_LINKS': 16384,
  'ATTACH_FILES': 32768,
  'READ_MESSAGE_HISTORY': 65536,
  'MENTION_EVERYONE': 131072,
  'USE_EXTERNAL_EMOJIS': 262144,
  'ADD_REACTIONS': 64,
  'USE_SLASH_COMMANDS': 8,
  
  // Voice permissions
  'CONNECT': 1024,
  'SPEAK': 2097152,
  'MUTE_MEMBERS': 268435456,
  'DEAFEN_MEMBERS': 536870912,
  'MOVE_MEMBERS': 16777216,
  'USE_VAD': 33554432,
  
  // Channel permissions
  'MANAGE_CHANNELS': 16,
  'MANAGE_MESSAGES': 8192,
  'MANAGE_ROLES': 268435456,
  
  // Server permissions
  'MANAGE_GUILD': 32,
  'ADMINISTRATOR': 8,
  
  // Additional useful permissions
  'CHANGE_NICKNAME': 67108864,
  'MANAGE_NICKNAMES': 134217728,
  'KICK_MEMBERS': 2,
  'BAN_MEMBERS': 4,
  'VIEW_AUDIT_LOG': 128,
  'PRIORITY_SPEAKER': 256,
  'STREAM': 512,
  'VIEW_CHANNEL': 1024,
  'SEND_TTS_MESSAGES': 4096,
  'MANAGE_WEBHOOKS': 536870912,
  'MANAGE_EMOJIS_AND_STICKERS': 1073741824,
  'USE_APPLICATION_COMMANDS': 8,
  'REQUEST_TO_SPEAK': 4194304,
  'MANAGE_EVENTS': 8589934592,
  'MANAGE_THREADS': 17179869184,
  'CREATE_PUBLIC_THREADS': 34359738368,
  'CREATE_PRIVATE_THREADS': 68719476736,
  'USE_EXTERNAL_STICKERS': 137438953472,
  'SEND_MESSAGES_IN_THREADS': 274877906944,
  'USE_EMBEDDED_ACTIVITIES': 549755813888,
  'MODERATE_MEMBERS': 1099511627776
};

// Calculate permissions for different bot types
const musicBotPermissions = [
  'SEND_MESSAGES',
  'EMBED_LINKS',
  'ATTACH_FILES',
  'READ_MESSAGE_HISTORY',
  'ADD_REACTIONS',
  'USE_SLASH_COMMANDS',
  'CONNECT',
  'SPEAK',
  'MANAGE_MESSAGES'
];

const adminBotPermissions = [
  'SEND_MESSAGES',
  'EMBED_LINKS',
  'ATTACH_FILES',
  'READ_MESSAGE_HISTORY',
  'ADD_REACTIONS',
  'USE_SLASH_COMMANDS',
  'CONNECT',
  'SPEAK',
  'MANAGE_MESSAGES',
  'MANAGE_CHANNELS',
  'MANAGE_ROLES',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'MANAGE_GUILD',
  'VIEW_AUDIT_LOG'
];

function calculatePermissions(permissionList) {
  let total = 0;
  for (const perm of permissionList) {
    if (permissions[perm]) {
      total += permissions[perm];
      console.log(`${perm}: ${permissions[perm]}`);
    } else {
      console.log(`❌ Unknown permission: ${perm}`);
    }
  }
  return total;
}

console.log('🎵 MUSIC BOT PERMISSIONS:');
console.log('========================');
const musicBotTotal = calculatePermissions(musicBotPermissions);
console.log(`\nTotal Permission Integer: ${musicBotTotal}`);
console.log(`Permission URL: https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=${musicBotTotal}&scope=bot%20applications.commands`);

console.log('\n\n🔧 ADMIN BOT PERMISSIONS:');
console.log('========================');
const adminBotTotal = calculatePermissions(adminBotPermissions);
console.log(`\nTotal Permission Integer: ${adminBotTotal}`);
console.log(`Permission URL: https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=${adminBotTotal}&scope=bot%20applications.commands`);

console.log('\n\n📋 ALL PERMISSIONS (ADMINISTRATOR):');
console.log('==================================');
console.log(`Administrator Permission Integer: ${permissions.ADMINISTRATOR}`);
console.log(`All Permissions Integer: 2147483647`);
console.log(`Permission URL: https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=8&scope=bot%20applications.commands`);

// Export for use in other files
module.exports = {
  permissions,
  musicBotPermissions: musicBotTotal,
  adminBotPermissions: adminBotTotal,
  administrator: permissions.ADMINISTRATOR
};
