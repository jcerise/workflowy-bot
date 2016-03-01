# lib/bot.js

'use strict'

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3');
var Bot = require('slackbots');

var WorkflowyBot = function Constructor(settings) {
  this.settings = settings;
  this.settings.name = this.settings.name || 'WorkflowyBot';
  this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'workflowybot.db');

  this.user = null;
  this.db = null;
};

// Inherit from slackbots Constructor
util.inherits(WorkflowyBot, Bot)
