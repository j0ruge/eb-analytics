// Shared OAuth helper for Google Sheets scripts.
// Reads credentials from .secrets/ and returns an authenticated OAuth2 client.

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SECRETS_DIR = path.resolve(__dirname, '..', '.secrets');
const CLIENT_PATH = path.join(SECRETS_DIR, 'google-client.json');
const TOKEN_PATH = path.join(SECRETS_DIR, 'google-token.json');

function authClient() {
  if (!fs.existsSync(CLIENT_PATH)) {
    throw new Error(
      `Missing ${CLIENT_PATH}. See .claude/rules/google-sheets-sync.md`,
    );
  }
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(
      `Missing ${TOKEN_PATH}. Run: node scripts/google-auth.js`,
    );
  }

  const raw = JSON.parse(fs.readFileSync(CLIENT_PATH, 'utf8'));
  const cfg = raw.installed || raw.web;
  if (!cfg) throw new Error('Invalid client JSON: expected `installed` or `web` key');

  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

  const oAuth2Client = new google.auth.OAuth2(
    cfg.client_id,
    cfg.client_secret,
    'http://127.0.0.1',
  );
  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

module.exports = { authClient, SECRETS_DIR, CLIENT_PATH, TOKEN_PATH };
