// OAuth flow for Google Sheets API (Desktop client).
// Usage: node scripts/google-auth.js
//
// Reads .secrets/google-client.json, starts a local HTTP server,
// opens the browser for user consent, exchanges the code for tokens,
// and saves them to .secrets/google-token.json.

const fs = require('fs');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');
const { CLIENT_PATH, TOKEN_PATH } = require('./_google-auth-helper');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function loadClient() {
  if (!fs.existsSync(CLIENT_PATH)) {
    throw new Error(`Client JSON not found at ${CLIENT_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(CLIENT_PATH, 'utf8'));
  const cfg = raw.installed || raw.web;
  if (!cfg) throw new Error('Invalid client JSON: expected `installed` or `web` key');
  return cfg;
}

function openBrowser(targetUrl) {
  const platform = process.platform;
  const { spawn } = require('child_process');
  if (platform === 'win32') {
    const chromeCandidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ];
    const chromePath = chromeCandidates.find((p) => fs.existsSync(p));
    if (chromePath) {
      spawn(chromePath, [targetUrl], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('cmd', ['/c', 'start', '', targetUrl], { detached: true, stdio: 'ignore' }).unref();
    }
  } else if (platform === 'darwin') {
    spawn('open', ['-a', 'Google Chrome', targetUrl], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('google-chrome', [targetUrl], { detached: true, stdio: 'ignore' }).unref();
  }
}

async function main() {
  const cfg = loadClient();

  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}`;

  const oAuth2Client = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, redirectUri);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\nAbrindo o navegador para autorizar o acesso à Google Sheets API...');
  console.log('Se o navegador não abrir, acesse manualmente:');
  console.log(authUrl);
  console.log('');

  const codePromise = new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      const parsed = url.parse(req.url, true);
      if (parsed.query.error) {
        res.end(`Erro: ${parsed.query.error}`);
        server.close();
        reject(new Error(parsed.query.error));
        return;
      }
      if (parsed.query.code) {
        res.end('Autorização concluída. Pode fechar esta aba e voltar ao terminal.');
        server.close();
        resolve(parsed.query.code);
      }
    });
  });

  openBrowser(authUrl);

  const code = await codePromise;
  const { tokens } = await oAuth2Client.getToken(code);

  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`\nTokens salvos em: ${TOKEN_PATH}`);
  console.log('Refresh token presente:', Boolean(tokens.refresh_token));
}

main().catch((err) => {
  console.error('Falha na autorização:', err);
  process.exit(1);
});
