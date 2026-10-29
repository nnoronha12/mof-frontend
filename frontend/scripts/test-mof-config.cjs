const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {loadPortalConfig}=require('../config/portalConfig.cjs');
const before={...process.env};
try {
 for(const key of Object.keys(process.env))if(key.startsWith('MOF_'))delete process.env[key];
 const config=loadPortalConfig();
 assert.equal(config.apiBaseUrl,'http://172.26.129.185/webhook');
 assert.equal(config.websocketUrl,'http://172.26.129.186/socket.io');
 const js=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/constants/chatConstants.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};new Function('exports','__MOF_PORTAL_CONFIG__',js)(exports,config);
 assert.equal(exports.GENERAL_CHAT_WEBHOOK_URL,config.apiBaseUrl+'/'+config.generalChatRoute);
 assert.equal(exports.apiRouteUrl('rfp/report'),config.apiBaseUrl+'/rfp/report');
 assert.equal(exports.apiRouteUrl('/translate/start','https://gateway.example/ai'),'https://gateway.example/ai/translate/start');
 process.env.MOF_ALLOW_HTTP='false';assert.throws(loadPortalConfig,/HTTP requires/);
 process.env.MOF_API_BASE_URL='https://gateway.example/webhook';process.env.MOF_WEBSOCKET_URL='https://gateway.example/socket.io/';assert.doesNotThrow(loadPortalConfig);
 process.env.MOF_API_BASE_URL='https://gateway.example';assert.throws(loadPortalConfig,/must end/);
 console.log('PASS: MOF defaults, webhook/API URL composition and explicit HTTP permission.');
} finally {for(const key of Object.keys(process.env))if(key.startsWith('MOF_'))delete process.env[key];Object.assign(process.env,before);}
