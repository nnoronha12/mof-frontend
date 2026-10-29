/**
 * Deployment settings for the portal frontend, read once at build time by
 * webpack and both Vite builds and compiled in as `__MOF_PORTAL_CONFIG__`.
 *
 * Values come from the environment first, then from the env file named by
 * MOF_CONFIG_FILE (default: config/mof.env). Nothing deployment-specific lives
 * in src/: a new environment only needs its own env file or variables.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, 'mof.env');

const readEnvFile = (file) => {
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !line.trim().startsWith('#')) values[match[1]] = match[2];
  }
  return values;
};

/** `slug=route,slug=route` into an object. */
const parseRoutes = (value) =>
  Object.fromEntries(
    String(value || '')
      .split(',')
      .map((pair) => pair.split('=').map((part) => part.trim()))
      .filter(([slug, route]) => slug && route),
  );

const loadPortalConfig = () => {
  const file = process.env.MOF_CONFIG_FILE
    ? path.resolve(process.cwd(), process.env.MOF_CONFIG_FILE)
    : DEFAULT_FILE;
  const fromFile = readEnvFile(file);
  const get = (key) => String(process.env[key] ?? fromFile[key] ?? '').trim();

  const publicBasePath = get('MOF_PUBLIC_BASE_PATH') || '/';
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(publicBasePath)) throw new Error('MOF_PUBLIC_BASE_PATH must be / or a trailing-slash path');
  const config = {
    publicBasePath,
    apiBaseUrl: get('MOF_API_BASE_URL').replace(/\/+$/, ''),
    websocketUrl: get('MOF_WEBSOCKET_URL').replace(/\/+$/, ''),
    generalChatRoute: get('MOF_GENERAL_CHAT_ROUTE').replace(/^\/+/, ''),
    voiceTranscriptionRoute: get('MOF_VOICE_TRANSCRIPTION_ROUTE').replace(/^\/+/, ''),
    fallbackServiceRoutes: parseRoutes(get('MOF_FALLBACK_SERVICE_ROUTES')),
  };

  const fail = (message) => {
    throw new Error(`${message} (config: ${path.relative(process.cwd(), file)})`);
  };
  let api;
  try {
    api = new URL(config.apiBaseUrl);
  } catch {
    fail('MOF_API_BASE_URL is missing or not a URL');
  }
  const allowHttp = get('MOF_ALLOW_HTTP') === 'true';
  const allowedProtocol = url => url.protocol === 'https:' || (allowHttp && url.protocol === 'http:');
  if (!allowedProtocol(api) || !/\/(ai|webhook)$/.test(api.pathname) || api.search || api.hash || api.username || api.password) {
    fail('MOF_API_BASE_URL must end in /ai or /webhook; HTTP requires MOF_ALLOW_HTTP=true');
  }
  if (config.websocketUrl) {
    let socket;
    try { socket = new URL(config.websocketUrl); } catch { fail('MOF_WEBSOCKET_URL is not a URL'); }
    if (!allowedProtocol(socket) || socket.username || socket.password || socket.search || socket.hash) fail('Invalid WebSocket URL; HTTP requires MOF_ALLOW_HTTP=true');
  }
  if (!config.generalChatRoute) fail('MOF_GENERAL_CHAT_ROUTE is required');
  return config;
};

/** The `define` entry both bundlers inject. */
const portalConfigDefine = () => ({
  __MOF_PORTAL_CONFIG__: JSON.stringify(loadPortalConfig()),
});

module.exports = { loadPortalConfig, portalConfigDefine };
