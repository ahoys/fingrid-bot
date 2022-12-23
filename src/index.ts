import axios from 'axios';
import {
  Client as DiscordJs,
  GatewayIntentBits,
  TextChannel,
} from 'discord.js';
import { p } from 'logscribe';

// Read and validate all configurations.
const APP_ID = process.env.DISCORD_APP_ID ?? '';
const APP_TOKEN = process.env.DISCORD_APP_TOKEN ?? '';
const API_KEY = process.env.FINGRID_API_KEY ?? '';
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID ?? '';

if (
  APP_ID.trim() === '' ||
  APP_TOKEN.trim() === '' ||
  API_KEY.trim() === '' ||
  CHANNEL_ID.trim() === ''
) {
  throw new Error(
    'Invalid configuration. Please re-read README and build again.'
  );
}

let dangerLevel = 0;

const messages = [
  'The situation has calmed down.',
  'There is now a 60% risk of power outages in Finland. Save any critical work.',
  '@here There is now a 90% risk of power outages in Finland. Unplug non-essential devices and see news outlets for more.',
];

interface IFingridData {
  end_time: string;
  start_time: string;
  value: number;
  variable_id: number;
}

const lookForUpdates = async () => {
  try {
    if (process.env.NODE_ENV === 'development') {
      p('Triggered lookForUpdates().');
    }
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const start_year = today.getFullYear();
    const start_month = today.getMonth() + 1;
    const start_day = today.getDate();
    const end_year = tomorrow.getFullYear();
    const end_month = tomorrow.getMonth() + 1;
    const end_day = tomorrow.getDate();
    const str = `start_time=${start_year}-${start_month}-${start_day}T00%3A00%3A00%2B0000&end_time=${end_year}-${end_month}-${end_day}T00%3A00%3A00%2B0000`;
    axios
      .get<IFingridData[]>(
        `https://api.fingrid.fi/v1/variable/336/events/json?${str}`,
        {
          headers: {
            'x-api-key': API_KEY,
          },
        }
      )
      .then(async (result) => {
        const data = result?.data;
        if (Array.isArray(data)) {
          const interesting = data.filter((d) => d.value > 0);
          const channel = client.channels.cache.get(CHANNEL_ID) as TextChannel;
          if (interesting.length) {
            // There are dangers.
            const values = interesting.map((d) => d.value);
            const newDangerLevel = Math.max(...values);
            if (newDangerLevel >= dangerLevel) {
              // The danger level has risen.
              dangerLevel = newDangerLevel;
              const firstEvent = new Date(interesting[0].start_time);
              const lastEvent = new Date(
                interesting[interesting.length - 1].end_time
              );
              if (channel && messages[newDangerLevel]) {
                await channel.send(messages[newDangerLevel]);
                await channel.send(
                  'Starting: ' +
                    firstEvent.toLocaleString('fi') +
                    '. Ending: ' +
                    lastEvent.toLocaleString('fi') +
                    '.'
                );
                await channel.send(
                  'https://www.fingrid.fi/sahkomarkkinat/sahkojarjestelman-tila/'
                );
              } else if (!channel) {
                p('Invalid channel, check the id!');
              } else if (messages[newDangerLevel]) {
                await channel.send(
                  'There is an elevated risk of power outages in Finland.'
                );
              }
            }
          } else if (dangerLevel) {
            // Dangers have went away.
            dangerLevel = 0;
            channel.send(messages[0]);
          }
        }
      })
      .catch((error) => {
        p('Failed to fetch data from Fingrid.', error);
      });
  } catch (error) {
    p('Error in lookForUpdates().', error);
  }
};

// Create a new Discord client.
const client = new DiscordJs({ intents: [GatewayIntentBits.Guilds] });

// Print out a signal when we are ready to function in Discord.
client.on('ready', () => {
  p(`Logged in as ${client.user?.tag}!`);
  lookForUpdates();
  setInterval(() => {
    lookForUpdates();
  }, 1000 * 60 * 5);
  const channel = client.channels.cache.get(CHANNEL_ID) as TextChannel;
  if (channel) {
    channel.send(`I'm awake.`).catch(() => {
      p(
        'Was unable to post a message. Do I have enough privileges for ' +
          CHANNEL_ID +
          '?'
      );
    });
  }
});

// Start!
client.login(APP_TOKEN);
