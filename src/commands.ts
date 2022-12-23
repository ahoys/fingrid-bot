import superagent from 'superagent';
import os from 'os-utils';
import { REST } from '@discordjs/rest';
import { Interaction, Routes, SlashCommandBuilder } from 'discord.js';
import { p, lp } from 'logscribe';

interface ICommand {
  name: string;
  description: string;
  subCommand?: {
    name: string;
    description: string;
  };
  attachment?: {
    name: string;
    description: string;
    required: boolean;
  };
}

const commands: ICommand[] = [
  {
    name: 'health',
    description: 'Returns status of the server.',
  },
  {
    name: 'list',
    description: 'Lists the current servers and possibilities.',
  },
  {
    name: 'start',
    description: 'Starts a server.',
    subCommand: {
      name: 'server',
      description: 'Select the target server',
    },
  },
  {
    name: 'stop',
    description: "Stops a server. You don't need to stop servers to update.",
    subCommand: {
      name: 'server',
      description: 'Select the target server',
    },
  },
  {
    name: 'restart',
    description:
      'Restarts a server. Useful if the server is no longer functioning.',
    subCommand: {
      name: 'server',
      description: 'Select the target server',
    },
  },
  {
    name: 'update',
    description:
      'Updates a server if necessary. Will automatically close ' +
      'the current instance only if required.',
    subCommand: {
      name: 'server',
      description: 'Select the target server',
    },
  },
  {
    name: 'send',
    description: 'Used to send files to the server.',
    subCommand: {
      name: 'server',
      description: 'Select the target server',
    },
    attachment: {
      name: 'file',
      description: 'Attachment file to be sent.',
      required: true,
    },
  },
];

/**
 * Keeps all the commands up-to-date and registered with the
 * Discord-backend.
 */
export const initCommands = async (
  APP_ID: string,
  APP_TOKEN: string,
  LINUXGSMM_PORTS: string[],
  LINUXGSMM_NAMES: string[]
) => {
  const rest = new REST({ version: '10' }).setToken(APP_TOKEN);
  try {
    p('Started refreshing application (/) commands.');
    const commandsToRegister = [];
    for (const command of commands) {
      if (command.subCommand && command.attachment) {
        const data = new SlashCommandBuilder()
          .setName(command.name)
          .setDescription(command.description)
          .addStringOption((option) =>
            option
              .setName(command.subCommand?.name ?? '')
              .setDescription(command.subCommand?.description ?? '')
              .setRequired(true)
              .addChoices(
                ...LINUXGSMM_PORTS.map((port, i) => ({
                  name: String(LINUXGSMM_NAMES[i]),
                  value: String(port),
                }))
              )
          )
          .addAttachmentOption((option) =>
            option
              .setName(command.attachment?.name ?? '')
              .setDescription(command.attachment?.description ?? '')
              .setRequired(command.attachment?.required ?? true)
          );
        commandsToRegister.push(data.toJSON());
      } else if (command.subCommand) {
        const data = new SlashCommandBuilder()
          .setName(command.name)
          .setDescription(command.description)
          .addStringOption((subCommand) =>
            subCommand
              .setName(command.subCommand?.name ?? '')
              .setDescription(command.subCommand?.description ?? '')
              .setRequired(true)
              .addChoices(
                ...LINUXGSMM_PORTS.map((port, i) => ({
                  name: String(LINUXGSMM_NAMES[i]),
                  value: String(port),
                }))
              )
          );
        commandsToRegister.push(data.toJSON());
      } else {
        const data = new SlashCommandBuilder()
          .setName(command.name)
          .setDescription(command.description);
        commandsToRegister.push(data.toJSON());
      }
    }
    await rest.put(Routes.applicationCommands(APP_ID), {
      body: commandsToRegister,
    });
    p('Successfully reloaded application (/) commands.');
  } catch (error) {
    lp(error);
  }
};

/**
 * Returns index for a port. This can be used to find a name.
 */
const findIndexOfPort = (port: string, LINUXGSMM_PORTS: string[]) =>
  LINUXGSMM_PORTS.findIndex((p) => p === port);

/**
 * Known error codes and explanations that are returned to users.
 */
const knownErrorsMapping: { [key: string]: string } = {
  ECONNREFUSED: 'The server is unreachable (ECONNREFUSED). Try again later.',
};

/**
 * Cute messages thanking of stopping the server.
 */
const successStopString = [
  'Thank you for preserving power.',
  'You just saved some €€€, thanks!',
  "You're so green. Ty!",
  'Lead the scene and keep it green.',
  'Keep green and keep our planet clean.',
  'Take a stand for the love of green.',
  "Don't be mean, just go green.",
  'Welcome to the green team.',
  'I hope you had fun!',
  'Thank you come again!',
];

let runningProcesses: string[] = [];

/**
 * Runs a linuxgsmm command.
 * Sends a signal to the service that attempts to
 * run the command.
 */
const runLinuxGSMM = async (
  interaction: Interaction,
  port: string,
  ip: string,
  command: string,
  LINUXGSMM_NAMES: string[],
  LINUXGSMM_PORTS: string[]
) => {
  if (!interaction.isChatInputCommand()) return;
  const name = LINUXGSMM_NAMES[findIndexOfPort(String(port), LINUXGSMM_PORTS)];
  await interaction.deferReply();
  if (runningProcesses.includes(port)) {
    await interaction.editReply(
      'The previous command for ' +
        name +
        ' has not finished. Please wait for it to finish.'
    );
  } else {
    runningProcesses.push(port);
  }
  superagent
    .post(`http://${ip}:` + port + '/api/exec')
    .set('Content-Type', 'application/json')
    .send({ command })
    .then(async (res) => {
      const { stdout, stderr } = res?.body || {};
      let msg = '';
      if (stderr?.trim() !== '') {
        msg = stderr;
      } else if (stdout.includes('LinuxGSM is already running')) {
        msg = `${name} is already running.`;
      } else if (
        command !== 'restart' &&
        stdout.includes('LinuxGSM is already stopped')
      ) {
        msg = `${name} is already stopped.`;
      } else {
        msg = `Succeeded to ${command} ${name}.`;
        if (command === 'stop') {
          msg +=
            ' ' +
            successStopString[
              Math.floor(Math.random() * successStopString.length)
            ];
        }
      }
      await interaction.editReply(msg);
    })
    .catch(async (err) => {
      lp(err.code, err?.message || err);
      let prefix = `Failed to ${command} ${name}.`;
      const errFix = knownErrorsMapping[err.code || ''];
      await interaction.editReply(errFix ? prefix + ' ' + errFix : prefix);
    })
    .finally(() => {
      const index = runningProcesses.findIndex((p) => p === port);
      if (index !== -1) {
        runningProcesses.splice(index, 1);
      }
    });
};

/**
 * Sends a file url to LinuxGSM Master.
 */
const sendFile = async (
  interaction: Interaction,
  port: string,
  ip: string,
  ATTACHMENTS_SUPPORTED_SEND: string[],
  ATTACHMENTS_MAX_SIZE_IN_KB: string[]
) => {
  if (!interaction.isChatInputCommand()) return;
  if (!ATTACHMENTS_SUPPORTED_SEND.includes(port)) {
    await interaction.reply('Attachments not supported for this server.');
    return;
  }
  const att = interaction.options.getAttachment('file', true);
  const size = att.size;
  const index = ATTACHMENTS_SUPPORTED_SEND.findIndex((a) => a === port);
  if (
    index === -1 ||
    !ATTACHMENTS_MAX_SIZE_IN_KB[index] ||
    !size ||
    size / 1024 > Number(ATTACHMENTS_MAX_SIZE_IN_KB[index])
  ) {
    await interaction.reply('Invalid size for the attachment.');
    return;
  }
  await interaction.deferReply();
  superagent
    .post(`http://${ip}:` + port + '/api/attachment')
    .set('Content-Type', 'application/json')
    .send({
      url: att.url,
      name: att.name,
      size: att.size,
      contentType: att.contentType,
    })
    .then(async () => {
      await interaction.editReply('Attachment sent.');
    })
    .catch(async (err) => {
      lp(err);
      await interaction.editReply('Failed to send the attachment.');
    });
};

/**
 * Executes triggered slash-commands.
 */
export const handleCommands = async (
  interaction: Interaction,
  LINUXGSMM_PORTS: string[],
  LINUXGSMM_IPS: string[],
  LINUXGSMM_NAMES: string[],
  ATTACHMENTS_SUPPORTED_SEND: string[],
  ATTACHMENTS_MAX_SIZE_IN_KB: string[]
) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options } = interaction;
    const port = String(options?.data[0]?.value);
    const portIndex = LINUXGSMM_PORTS.findIndex((p) => p === port);
    const ip = String(portIndex !== -1 ? LINUXGSMM_IPS[portIndex] : 0);
    /**
     * Return information about the server.
     */
    if (commandName === 'health') {
      await interaction.deferReply();
      const freememPercentage = Math.floor(os.freememPercentage() * 100);
      os.cpuUsage(async (cpuUsage) => {
        os.cpuFree(async (cpuFree) => {
          await interaction.editReply(
            `CPU usage: ${Math.round(cpuUsage * 100)}%, CPU free: ${Math.round(
              cpuFree * 100
            )}%, free memory: ${freememPercentage}%.`
          );
        });
      });
    }
    /**
     * List all services that should be available.
     */
    if (commandName === 'list') {
      await interaction.deferReply();
      const available: string[] = [];
      const unavailable: string[] = [];
      let i = 0;
      for (const port of LINUXGSMM_PORTS) {
        const ipx = String(LINUXGSMM_IPS[i]);
        await superagent
          .get(`http://${ipx}:` + port + '/api/ping')
          .then((res) => {
            if (res.status === 200) {
              available.push(LINUXGSMM_NAMES[i]);
            }
          })
          .catch((err) => {
            lp(err);
            unavailable.push(LINUXGSMM_NAMES[i]);
          });
        i += 1;
      }
      await interaction.editReply(
        available.length
          ? 'The following services are available: ' +
              available.join(', ') +
              '.'
          : '' + unavailable.length
          ? available.length
            ? ' And the following are unavailable: ' +
              unavailable.join(', ') +
              '.'
            : 'The following services are unavailable: ' +
              unavailable.join(', ') +
              '.'
          : ''
      );
    }
    /**
     * Start a new service.
     */
    if (commandName === 'start') {
      await runLinuxGSMM(
        interaction,
        port,
        ip,
        'start',
        LINUXGSMM_NAMES,
        LINUXGSMM_PORTS
      );
    }
    /**
     * Stop an existing service.
     */
    if (commandName === 'stop') {
      await runLinuxGSMM(
        interaction,
        port,
        ip,
        'stop',
        LINUXGSMM_NAMES,
        LINUXGSMM_PORTS
      );
    }
    /**
     * Restart a service.
     */
    if (commandName === 'restart') {
      await runLinuxGSMM(
        interaction,
        port,
        ip,
        'restart',
        LINUXGSMM_NAMES,
        LINUXGSMM_PORTS
      );
    }
    /**
     * Update a service.
     */
    if (commandName === 'update') {
      await runLinuxGSMM(
        interaction,
        port,
        ip,
        'update',
        LINUXGSMM_NAMES,
        LINUXGSMM_PORTS
      );
    }
    /**
     * Send an attachment to the server.
     */
    if (commandName === 'send') {
      await sendFile(
        interaction,
        port,
        ip,
        ATTACHMENTS_SUPPORTED_SEND,
        ATTACHMENTS_MAX_SIZE_IN_KB
      );
    }
  } catch (err) {
    lp(err);
  }
};
