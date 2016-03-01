
'use strict'

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3');
var Bot = require('slackbots');
var request = require('request');

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
      !this._isFromWorkflowyBot(message) &&
      this._isToWorkflowyBot(message)
    ) {
      this._replyWithSchedule(message);
    }
};

WorkflowyBot.prototype._isChatMessage = function (message) {
  console.log(message);
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

WorkflowyBot.prototype._isToWorkflowyBot = function (message) {
  console.log(this.user.id);
  return message.text.indexOf(this.user.id) > -1;
}

WorkflowyBot.prototype._replyWithSchedule = function (originalMessage) {
  var self = this;
  self._parseWorkflowyJSON(originalMessage);
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

WorkflowyBot.prototype._parseWorkflowyJSON = function (originalMessage) {
  /**
  * Grabs workflowy JSON for the specified workflowy, and parses it out.
  * This method is currently very, very reliant on a specific structure
  * present within the workflowy document. The parsed JSON is then relayed as a
  * slack message from the bot.
  */

  var self = this;
  var url =   'https://workflowy.com/get_initialization_data?shared_projectid=KPkbNascH7'
  var query = originalMessage.text;

  request ({
    url: url,
    json: "true",
  }, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      var children = body.projectTreeData.mainProjectTreeInfo.rootProjectChildren;
      var day_child = null;

      for (var day in children) {
        if (query.toLowerCase().indexOf(children[day].nm.toLowerCase()) > -1) {
          day_child = children[day];
          break;
        }
      }

      var message = '';
      if (day_child === null) {
        message = "I'm sorry, I couldn't find anything on the schedule for " + query;
      } else {
        message += 'Schedule for ' + day_child.nm + ': \n';
        for (var child in day_child.ch) {
          message += '*' + day_child.ch[child].nm.replace(/<(?:.|\n)*?>/gm, '') + '*\n';
          var detail_child = day_child.ch[child].ch;
          if (detail_child !== 'undefined') {
            for (var sub_child in detail_child) {
              message +=  '    -' + detail_child[sub_child].nm.replace(/<(?:.|\n)*?>/gm, '') + '\n';
            }
          }
        }
      }

      self._sendMessage(originalMessage, message);
    }
  });
}
