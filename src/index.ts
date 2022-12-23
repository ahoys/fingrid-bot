import axios, { AxiosResponse, ResponseType } from 'axios';
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

const payload = [
  {
    value: 0,
    start_time: '2022-12-23T04:49:00+0000',
    end_time: '2022-12-23T04:49:00+0000',
  },
  {
    value: 1,
    start_time: '2022-12-23T04:52:00+0000',
    end_time: '2022-12-23T04:52:00+0000',
  },
  {
    value: 2,
    start_time: '2022-12-23T04:55:00+0000',
    end_time: '2022-12-23T04:55:00+0000',
  },
  {
    value: 2,
    start_time: '2022-12-23T04:58:00+0000',
    end_time: '2022-12-23T04:58:00+0000',
  },
];

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
  'There is now a 60% risk of power outages in Finland.',
  '@here There is now a 90% risk of power outages in Finland.',
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
              const firstEvent = new Date(interesting[0].start_time);
              const lastEvent = new Date(
                interesting[interesting.length - 1].end_time
              );
              let startStr =
                dangerLevel === 0 ? firstEvent.toLocaleString('fi') : '';
              dangerLevel = newDangerLevel;
              if (channel && messages[newDangerLevel]) {
                channel.send(messages[newDangerLevel]);
                if (startStr) {
                  channel.send(
                    'Starting: ' +
                      startStr +
                      '. Ending: ' +
                      lastEvent.toLocaleString('fi') +
                      '.'
                  );
                }
              } else if (!channel) {
                p('Invalid channel, check the id!');
              } else if (messages[newDangerLevel]) {
                channel.send(
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
});

// Start!
client.login(APP_TOKEN);
