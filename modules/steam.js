const axios = require('axios');

module.exports = (client, config) => {
  async function getAppNews(appId, count = 5) {
    try {
      const res = await axios.get(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/`, {
        params: {
          appid: appId,
          count: count,
          maxlength: 300
        }
      });

      const newsItems = res.data.appnews.newsitems.map(item => ({
        title: item.title,
        url: item.url,
        author: item.author,
        date: new Date(item.date * 1000).toLocaleString()
      }));

      return newsItems;
    } catch (err) {
      console.error(`Error fetching Steam news for App ID ${appId}:`, err);
      return [];
    }
  }

  // On bot ready, send news for all mapped apps
  client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    for (const mapping of config.steam.mappings) {
      const channel = client.channels.cache.get(mapping.channelId);
      if (!channel) {
        console.warn(`News channel not found for App ID ${mapping.appid}`);
        continue;
      }

      const news = await getAppNews(mapping.appid, mapping.count || config.steam.defaultCount);
      for (const item of news) {
        channel.send(`**${item.title}**\nBy: ${item.author}\n${item.date}\n${item.url}`);
      }
    }
  });

  // Expose function for commands or manual calls
  client.getSteamNews = getAppNews;
};
