# Fingrid Bot

Informs users about possible electricity delivery issues in Finland.

## How to use

1. Pull repository & `npm i`
2. Add .env, see the example below.
3. `npm run build`
4. Send /build files to the server and run with Node >= 12.
5. (Optional) add a systemctl service for the bot.

### Example .env

```
DISCORD_APP_ID=
DISCORD_APP_TOKEN=
FINGRID_API_KEY=
```

- **DISCORD_APP_ID**: Discord Bot's application id.
- **DISCORD_APP_TOKEN**: Discord Bot's token.
- **FINGRID_API_KEY**: Fingrid API-key. Fetch for free from Fingrid.
