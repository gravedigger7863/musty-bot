const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Word list
const WORDS = [
  'apple','grape','house','plant','table','light','music','dream','snake','coins',
  'chair','bread','fruit','water','shirt','pants','glove','beach','river','stone',
  'heart','flame','ocean','cloud','storm','laugh','smile','angel','brain','crane',
  'witch','ghost','paint','brick','grass','clock','knife','queen','tiger','eagle',
  'zebra','lemon','peach','melon','berry','candy','pizza','spoon','brush','paper',
  'couch','flute','viola','piano','drums','sword','shield','lance','arrow','frost',
  'ember','metal','glass','sleep','think','learn','write','read','study','build',
  'forge','shiny','windy','crazy','happy','angry','joker','magic','power','pride',
  'glory','faith','truth','honor','grace','peace','dance','spark','bison','mango',
  'vivid','fresh','storm','blaze','track','unity','alien','karma','flair','vapor',
  'druid','eager','fjord','giddy','haunt','ivory','jelly','knock','lunar','mirth'
];



const games = new Map(); // active games per user
const lastPlayed = new Map(); // track daily plays per user

function getRandomWord() {
  // Shuffle the array and pick the first word
  const shuffled = WORDS.sort(() => Math.random() - 0.5);
  return shuffled[0].toLowerCase();
}


function colorizeGuess(guess, word) {
  const result = [];
  const wordArr = word.split('');
  const guessArr = guess.split('');

  const green = guessArr.map((l, i) => l === wordArr[i]);

  guessArr.forEach((letter, i) => {
    if (green[i]) result.push('🟩');
    else if (wordArr.includes(letter)) result.push('🟨');
    else result.push('⬜');
  });

  return result.join('');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wordle')
    .setDescription('Play a Wordle-like game!'),

  async execute(interaction) {
    const now = Date.now();
    const last = lastPlayed.get(interaction.user.id) || 0;

    // 24h cooldown check
    if (now - last < 24 * 60 * 60 * 1000) {
      const remaining = 24 * 60 * 60 * 1000 - (now - last);
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      return interaction.reply({ content: `❌ You can only play once daily. Try again in ${hours}h ${minutes}m.`, flags: 64 });
    }

    await interaction.deferReply();

    if (games.has(interaction.user.id)) {
      return interaction.editReply('❌ You already have a Wordle game in progress!');
    }

    const hiddenWord = getRandomWord();
    const attempts = [];
    const maxTries = 6;
    games.set(interaction.user.id, { hiddenWord, attempts, maxTries });

    const embed = new EmbedBuilder()
      .setTitle('🎮 Wordly Game')
      .setDescription('Guess the 5-letter word in 6 tries!\nType your guess here in chat.')
      .setColor('Random');

    await interaction.editReply({ embeds: [embed] });

    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 600000 });

    collector.on('collect', m => {
      const game = games.get(interaction.user.id);
      const guess = m.content.toLowerCase();

      if (guess.length !== 5) return m.reply('❌ Your guess must be a 5-letter word.');

      game.attempts.push(guess);
      const board = game.attempts.map(g => colorizeGuess(g, game.hiddenWord)).join('\n');

      if (guess === game.hiddenWord) {
        const winEmbed = new EmbedBuilder()
          .setTitle('🎉 You Won!')
          .setDescription(`The word was **${game.hiddenWord.toUpperCase()}**\n\n${board}`)
          .setColor('Green');

        m.reply({ embeds: [winEmbed] });
        collector.stop();
        games.delete(interaction.user.id);
        lastPlayed.set(interaction.user.id, Date.now()); // record play
        return;
      }

      if (game.attempts.length >= maxTries) {
        const loseEmbed = new EmbedBuilder()
          .setTitle('💀 Game Over')
          .setDescription(`The word was **${game.hiddenWord.toUpperCase()}**\n\n${board}`)
          .setColor('Red');

        m.reply({ embeds: [loseEmbed] });
        collector.stop();
        games.delete(interaction.user.id);
        lastPlayed.set(interaction.user.id, Date.now()); // record play
        return;
      }

      const embedUpdate = new EmbedBuilder()
        .setTitle('🎮 Wordly Game')
        .setDescription(`${board}\n\nGuess #${game.attempts.length + 1}/${maxTries}`)
        .setColor('Random');

      m.reply({ embeds: [embedUpdate] });
    });

    collector.on('end', () => {
      games.delete(interaction.user.id);
    });
  },
};
