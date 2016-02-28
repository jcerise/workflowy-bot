
'use strict';

var WorkflowyBot = require('../lib/workflowybot');

var token = 'xoxb-23359279281-w3AVYUaJHF09hWobeZyG4L2g';
var dbPath = process.env.BOT_DB_PATH;
var name = process.env.BOT_NAME;

var workflowybot = new WorkflowyBot({
  token: token,
  dbPath: dbPath,
  name: name
});

workflowybot.run();
