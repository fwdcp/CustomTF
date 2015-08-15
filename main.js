var app = require('app');
var BrowserWindow = require('browser-window');
var dialog = require('dialog');
var path = require('path');

var config = require('nconf');
config.file({file: path.join(app.getPath('userData'), 'config.json')});
global.config = config;

var searchPaths = require('./searchPaths');

var mainWindow = null;

app.on('ready', function() {
    mainWindow = new BrowserWindow({});

    mainWindow.loadUrl('file://' + __dirname + '/index.html');

    if (!config.get('mainDir')) {
        var directories = dialog.showOpenDialog(mainWindow, {title: 'TF2 directory', properties: ['openDirectory']});

        if (!directories) {
            app.quit();
            return;
        }

        config.set('mainDir', directories[0]);
        config.save();
    }

    searchPaths.load(config.get('mainDir'));
});
