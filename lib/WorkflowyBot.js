
'use strict'

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3');
var Bot = require('slackbots');
var request = require('request');
var cheerio = require('cheerio');

var WorkflowyBot = function Constructor(settings) {
  this.settings = settings;
  this.settings.name = this.settings.name || 'workflowy_bot';
  this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'workflowybot.db');

  this.user = null;
  this.db = null;
};

// Inherit from slackbots Constructor
util.inherits(WorkflowyBot, Bot);
module.exports = WorkflowyBot;

WorkflowyBot.prototype.run = function () {
  WorkflowyBot.super_.call(this, this.settings);

  console.log('Running...')

  this.on('start', this._onStart);
  this.on('message', this._onMessage);
};

WorkflowyBot.prototype._onStart = function () {
  this._loadBotUser();
  this._connectDb();
  this._firstRunCheck();
};

WorkflowyBot.prototype._loadBotUser = function () {
  /**
  * Finds and loads the bot user from slack
  */
  var self = this;
  console.log(self.name)
  this.user = this.users.filter(function (user) {
    return user.name === self.name;
  })[0];
  console.log(this.user)
};

WorkflowyBot.prototype._connectDb = function () {
  /**
  * Attempts to create a connection to teh SQLite DB
  */
  if (!fs.existsSync(this.dbPath)) {
    console.error('Database path ' + '"' + this.dbPath + '" does not exist.')
    process.exit(1)
  }

  this.db = new SQLite.Database(this.dbPath);
};

WorkflowyBot.prototype._firstRunCheck = function () {
  /**
  * Checks to see if this is the first time the bot has run, and if so, display
  * a welcome message, and set the lastrun time. If this is not the first run,
  * the lastrun time is simply updated.
  */
  var self = this;
  self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function (err, record) {
    if (err) {
      return console.error('DATABASE ERROR:', err);
    }

    var currentTime = (new Date()).toJSON();

    // This is our first run
    if (!record) {
      self._welcomeMessage();
      return self.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?)', currentTime);
    }

    // If this is not the first run, update with the current running time
    self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
  });
};

WorkflowyBot.prototype._welcomeMessage = function () {
  /**
  * Displays a friendly welcome message the first the bot is fired up
  */
  this.postMessageToChannel(this.channels[0].name, 'Greetings! I am a bot ' +
      'whose sole purpose in life is to keep this channel updated with any ' +
      'changes to the WTFConf Workflowy.', {as_user: true});
};

WorkflowyBot.prototype._onMessage = function (message) {
  console.log('Message recieved: ' + message.text)
  if (this._isChatMessage(message) &&
      this._isChannelConversation(message) &&
      !this._isFromWorkflowyBot(message)
    ) {
      this._replyWithSchedule(message);
    }
};

WorkflowyBot.prototype._isChatMessage = function (message) {
  return message.type == 'message' && Boolean(message.text);
};

WorkflowyBot.prototype._isChannelConversation = function (message) {
  console.log('Channel: ' + message.channel)
  return typeof message.channel === 'string' &&
      message.channel[0] === 'C';
};

WorkflowyBot.prototype._isFromWorkflowyBot = function (message) {
  console.log('User ID: ' + this.user)
  return message.user === this.user.id;
};

WorkflowyBot.prototype._replyWithSchedule = function (originalMessage) {
  var self = this;
  self._scrape(originalMessage)
};

WorkflowyBot.prototype._getChannelById = function (channelId) {
  return this.channels.filter(function (item) {
    return item.id === channelId;
  })[0];
};

WorkflowyBot.prototype._sendMessage = function (originalMessage, text) {
  var self = this;
  var channel = self._getChannelById(originalMessage.channel);
  self.postMessageToChannel(channel.name, text, {as_user: true});
}

WorkflowyBot.prototype._scrape = function (originalMessage) {
  // TODO: Hardcoded URL for now, this should be dynamic
  var url = 'https://workflowy.com/s/KPkbNascH7'

  var self = this;

  return request(url, function(error, response, html) {
    console.log('making request...');
    if (!error) {
      console.log('No errors loading page...');
      var $ = cheerio.load(html);
    }

    var title;

    title = $('head title').text();
    console.log('Got title: ' + title);
    self._sendMessage(originalMessage, title);
  });
}
