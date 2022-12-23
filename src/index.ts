import axios, { AxiosResponse, ResponseType } from 'axios';
import { Client as DiscordJs, GatewayIntentBits } from 'discord.js';
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

let firstRunDone = false;
let previousWarningGiven = 0;
let firstEvent = 0;
let lastEvent = 0;
let dangerLevel = 0;

interface IFingridData {
  end_time: string;
  start_time: string;
  value: number;
  variable_id: number;
}

const lookForUpdates = async () => {
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
    .then((result) => {
      const data = result?.data;
      if (Array.isArray(data)) {
        const interesting = data.filter((d) => d.value > 0);
        if (interesting.length && interesting[0]) {
          firstEvent = new Date(interesting[0].start_time).getTime();
          lastEvent = new Date(
            interesting[interesting.length - 1].end_time
          ).getTime();
          const values = interesting.map((d) => d.value);
          dangerLevel = Math.max(...values);
        }
      }
    })
    .catch((error) => {
      p(error);
    });
};

const informAboutDanger = () => {
  p(dangerLevel);
  if (dangerLevel > 0) {
    p('danger');
  }
};

// Create a new Discord client.
const client = new DiscordJs({ intents: [GatewayIntentBits.Guilds] });

// Print out a signal when we are ready to function in Discord.
client.on('ready', () => {
  p(`Logged in as ${client.user?.tag}!`);
  lookForUpdates();
  setInterval(() => {
    firstRunDone = true;
    lookForUpdates();
  }, 1000 * 60 * 5);
  setInterval(() => {
    informAboutDanger();
  }, 1000);
});

// Start!
client.login(APP_TOKEN);
