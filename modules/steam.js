const axios = require('axios');

module.exports = (client, config) => {
  async function getAppNews(appId = 1938090, count = 5) {
    try {
      const res = await axios.get(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/`, {
        params: {
          appid: appId,
          count: count,
          maxlength: 300, // optional, trims content
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
      console.error('Error fetching Steam news:', err);
      return [];
    }
  }

  // Example: send news to a specific Discord channel every time the bot starts
  client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const channel = client.channels.cache.get(config.newsChannelId); // set your channel ID in config.json
    if (!channel) return console.warn('News channel not found');

    const news = await getAppNews();
    for (const item of news) {
      channel.send(`**${item.title}**\nBy: ${item.author}\n${item.date}\n${item.url}`);
    }
  });

  // Optional: expose function for commands
  client.getSteamNews = getAppNews;
};
