// modules/steam.js
const fs = require('fs');
const path = require('path');
const fetch = global.fetch ?? require('node-fetch');
const crypto = require('crypto');

module.exports = (client, config) => {
  const steamCfg = (config && config.steam) || {};
  const apiKey = steamCfg.apiKey || process.env.STEAM_API_KEY;
  const pollInterval = steamCfg.pollIntervalMs || 60000;
  const statePath = path.join(__dirname, '..', 'data', 'steam-state.json');

  if (!apiKey) {
    console.warn('[steam] No Steam API key set.');
    return;
  }

  if (!fs.existsSync(path.dirname(statePath))) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
  }

  let state = { apps: {}, docsHash: null };
  try {
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
  } catch (e) {
    console.error('[steam] load state', e);
  }

  const stripHtml = s =>
    s ? s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';

  async function fetchLatestNews(appid, count = 1) {
    const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=${count}&maxlength=0&format=json&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    return j?.appnews?.newsitems?.[0] || null;
  }

  async function checkNewsOnce() {
    for (const map of steamCfg.mappings || []) {
      const appid = map.appid;
      try {
        const latest = await fetchLatestNews(appid, 1);
        if (!latest) continue;

        const gid = String(latest.gid);
        state.apps[appid] = state.apps[appid] || { posted: [] };

        // Skip if already posted
        if (state.apps[appid].posted.includes(gid)) {
          console.log(`[steam] No new news for app ${appid}`);
          continue;
        }

        const channel = await client.channels
          .fetch(map.channelId)
          .catch(() => null);

        const contents = stripHtml(latest.contents || '');
        const embed = {
          title: latest.title || `Steam news ${appid}`,
          url: latest.url,
          description:
            contents.length > 350
              ? contents.slice(0, 347) + '...'
              : contents,
          timestamp: new Date((latest.date || 0) * 1000).toISOString(),
          footer: { text: `Steam — App ${appid}` },
        };

        if (channel) {
          await channel
            .send({ embeds: [embed] })
            .then(() =>
              console.log(`[steam] Posted new news for app ${appid}: ${gid}`)
            )
            .catch(err => console.error('[steam] send error', err));
        }

        // Remember posted gid
        state.apps[appid].posted.push(gid);
        if (state.apps[appid].posted.length > 50) {
          state.apps[appid].posted = state.apps[appid].posted.slice(-50);
        }
      } catch (e) {
        console.error(`[steam] checkNews error for app ${appid}`, e);
      }
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }

  async function fetchDevPage() {
    const url = 'https://steamcommunity.com/dev';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  async function checkDocsOnce() {
    if (!steamCfg.enableDocsCheck) return;
    try {
      const text = await fetchDevPage();
      const hash = crypto.createHash('sha256').update(text).digest('hex');
      if (hash !== state.docsHash) {
        state.docsHash = hash;
        const notifyChannel = steamCfg.docsChannelId
          ? await client.channels.fetch(steamCfg.docsChannelId).catch(() => null)
          : null;
        const msg = `Steam Web API docs updated → <https://steamcommunity.com/dev>`;
        if (notifyChannel) {
          await notifyChannel
            .send(msg)
            .then(() => console.log('[steam] Posted docs update'))
            .catch(() => console.log('[steam] docs notify failed'));
        }
      } else {
        console.log('[steam] No docs changes');
      }
    } catch (e) {
      console.error('[steam] checkDocs error', e);
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }

  client.once('ready', () => {
    console.log('[steam] Module initialized, starting checks...');
    checkNewsOnce();
    checkDocsOnce();
    setInterval(checkNewsOnce, steamCfg.pollIntervalMs || pollInterval);
    setInterval(checkDocsOnce, steamCfg.docsPollIntervalMs || pollInterval * 10);
  });

  client.on('messageCreate', async msg => {
    if (!steamCfg.adminRoleId) return;
    if (msg.author.bot) return;
    if (!msg.member || !msg.member.roles) return;
    if (!msg.member.roles.cache.has(steamCfg.adminRoleId)) return;
    if (msg.content === '!steamcheck') {
      await checkNewsOnce();
      await checkDocsOnce();
      msg.reply('Steam check done.');
    }
  });
};
