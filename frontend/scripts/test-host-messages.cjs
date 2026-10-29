const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname,'../src/services/hostMessages.ts'),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exportsObject={};new Function('exports',compiled)(exportsObject);
const trusted=exportsObject.isTrustedHostMessage, origin='https://portal.example', sender={};
assert.equal(trusted({origin,source:sender},origin,false),true);
assert.equal(trusted({origin:'http://portal.example',source:sender},origin,false),false);
assert.equal(trusted({origin:'https://portal.example.attacker.invalid',source:sender},origin,false),false);
assert.equal(trusted({origin:'https://attacker.invalid',source:sender},origin,true),false);
for(const opaqueOrigin of ['', 'null']) {
  assert.equal(trusted({origin:opaqueOrigin,source:sender},origin,true),false);
  assert.equal(trusted({origin:opaqueOrigin,source:null},origin,false),false);
  assert.equal(trusted({origin:opaqueOrigin,source:null},origin,true),true);
}
assert.equal(trusted({origin:'null',source:sender},'null',false),false);
// Verify the real handler checks trust before parsing/dispatching the response.
const shell=fs.readFileSync(path.join(__dirname,'../src/components/WeaveAiChat.tsx'),'utf8');
const handler=shell.slice(shell.indexOf('const handleMobileMessage ='),shell.indexOf('window.addEventListener("message", handleMobileMessage)'));
assert.ok(handler.indexOf('isTrustedHostMessage')>=0 && handler.indexOf('isTrustedHostMessage')<handler.indexOf('JSON.parse(event.data)'));
console.log('PASS: cross-origin and opaque iframe messages rejected; same-origin and explicit native bridge messages retained.');
