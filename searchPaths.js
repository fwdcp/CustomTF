var es6 = require('es6-shim');
var fs = require('fs');
var glob = require('glob');
var KeyValues = require('keyvalues-valve');
var path = require('path');
var VPK = require('vpk');

var searchPaths = [];

function walk(dir) {
    var results = [];

    var list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        }
        else {
            results.push(file);
        }
    });

    return results;
}

function loadPathsInfo(pathsInfo, options) {
    options = options || {};
    options.wildcard = options.hasOwnProperty('wildcard') ? options.wildcard : true;
    options.lowViolence = options.hasOwnProperty('lowViolence') ? options.lowViolence : false;
    options.highDefinition = options.hasOwnProperty('highDefinition') ? options.highDefinition : false;
    options.tempcontent = options.hasOwnProperty('tempcontent') ? options.tempcontent : false;
    options.language = options.hasOwnProperty('language') ? options.language : null;
    options.skipFileList = options.hasOwnProperty('skipFileList') ? options.skipFileList : false;

    for (var i = 0; i < pathsInfo.length; ) {
        var pathInfo = pathsInfo[i];

        pathInfo.pathIDs.map(function(pathID) {
            return pathID.toLowerCase();
        });

        if (options.wildcard) {
            if (pathInfo.fullLocationPath.indexOf('*') !== -1 || pathInfo.fullLocationPath.indexOf('?') !== -1) {
                pathInfo.type = 'wildcard';
                pathInfo.valid = true;

                var subPaths = glob.sync(pathInfo.fullLocationPath.replace('\\', '/'), {
                    dot: true
                });

                subPaths = subPaths.map(function(subPath) {
                    return path.resolve(subPath);
                }).filter(function(subPath) {
                    if (subPath.toLowerCase().indexOf('.vpk') !== -1) {
                        return true;
                    }

                    var fileStats = fs.statSync(subPath);

                    return fileStats.isDirectory();
                });

                // NOTE: this is a bit wonky, but it should work in most situations
                subPaths.sort(function(a, b) {
                    var aNormalized = path.basename(a).toLowerCase();
                    while (aNormalized.indexOf('.') === 0) {
                        aNormalized = aNormalized.slice(1);
                    }

                    var bNormalized = path.basename(b).toLowerCase();
                    while (bNormalized.indexOf('.') === 0) {
                        bNormalized = bNormalized.slice(1);
                    }

                    return (aNormalized < bNormalized) ? -1 : ((aNormalized > bNormalized) ? 1 : 0);
                });

                var vpkDirs = subPaths.filter(function(subPath) {
                    return subPath.toLowerCase().indexOf('_dir.vpk') !== -1;
                });

                vpkDirs.forEach(function(vpkDir) {
                    var opening = vpkDir.slice(0, vpkDir.toLowerCase().indexOf('_dir.vpk'));

                    subPaths = subPaths.filter(function(subPath) {
                        return subPath.indexOf(opening) === -1 || subPath === vpkDir;
                    });
                });

                pathInfo.subPaths = subPaths.map(function(subPath) {
                    return {
                        pathIDs: pathInfo.pathIDs,
                        fullLocationPath: subPath
                    }
                });

                pathInfo.subPaths.forEach(function(subPath) {
                    var baseName = path.basename(subPath.fullLocationPath).toLowerCase();

                    if (baseName === 'materials' || baseName === 'maps' || baseName === 'resource' || baseName === 'scripts' || baseName === 'sound' || baseName === 'models') {
                        subPath.warning = true;
                    }
                });

                var newOptions = Object.assign({}, options, {wildcard: false});

                loadPathsInfo(pathInfo.subPaths, newOptions);

                i++;
                continue;
            }
        }

        if (pathInfo.pathIDs.indexOf('game_lv') !== -1) {
            if (options.lowViolence) {
                pathInfo.pathIDs[pathInfo.pathIDs.indexOf('game_lv')] = 'game';
            }
            else {
                pathsInfo.splice(i, 1);
                continue;
            }
        }

        if (pathInfo.pathIDs.indexOf('game_hd') !== -1) {
            if (options.highDefinition) {
                pathInfo.pathIDs[pathInfo.pathIDs.indexOf('game_hd')] = 'game';
            }
            else {
                pathsInfo.splice(i, 1);
                continue;
            }
        }

        if (pathInfo.fullLocationPath.toLowerCase().indexOf('.vpk') === -1 && pathInfo.pathIDs.indexOf('game') !== -1) {
            if (options.tempcontent) {
                tempcontentPathInfo = Object.assign({}, pathInfo);
                tempcontentPathInfo.pathIDs = ['game'];
                tempcontentPathInfo.fullLocationPath = pathInfo.fullLocationPath + '_tempcontent';

                var tempcontentProcessing = [tempcontentPathInfo];
                var newOptions = Object.assign({}, options, {tempcontent: false});

                loadPathsInfo(tempcontentProcessing, newOptions);

                pathsInfo.splice(i, 0, tempcontentProcessing[0]);
                i++;
            }
        }

        if (options.language && options.language.toLowerCase() !== 'english' && pathInfo.fullLocationPath.indexOf('_english') !== 0) {
            languagePathInfo = Object.assign({}, pathInfo);
            languagePathInfo.fullLocationPath = languagePathInfo.fullLocationPath.replace(/_english/g, '_' + options.language.toLowerCase());

            var languageProcessing = [languagePathInfo];
            var newOptions = Object.assign({}, options, {tempcontent: false, language: null});

            loadPathsInfo(languageProcessing, newOptions);

            pathsInfo.splice(i, 0, languageProcessing[0]);
            i++;
        }

        try {
            var stats = fs.statSync(pathInfo.fullLocationPath);

            if (stats.isDirectory()) {
                pathInfo.type = 'directory';
                pathInfo.valid = true;
            }
            else {
                var vpk = new VPK(pathInfo.fullLocationPath);

                if (vpk.isValid()) {
                    pathInfo.type = 'vpk';
                    pathInfo.valid = true;
                    pathInfo.vpk = vpk;
                }
                else {
                    pathInfo.valid = false;
                }
            }
        }
        catch (err) {
            if (pathInfo.fullLocationPath.slice(-4) === '.vpk') {
                var directoryPath = pathInfo.fullLocationPath.slice(0, -4) + '_dir.vpk';

                try {
                    var vpk = new VPK(directoryPath);

                    if (vpk.isValid()) {
                        pathInfo.type = 'vpk';
                        pathInfo.valid = true;
                        pathInfo.vpk = vpk;
                    }
                    else {
                        pathInfo.valid = false;
                    }
                }
                catch (err) {
                    pathInfo.valid = false;
                }
            }
            else {
                pathInfo.valid = false;
            }
        }

        if (!options.skipFileList && pathInfo.valid) {
            if (pathInfo.type === 'vpk') {
                pathInfo.vpk.load();
                pathInfo.fileList = pathInfo.vpk.files;
            }
            else if (pathInfo.type === 'directory') {
                pathInfo.fileList = walk(pathInfo.fullLocationPath);
            }
        }

        i++;
    }

    return pathsInfo;
}

exports.load = function(mainDir, options) {
    options = options || {};
    options.lowViolence = options.hasOwnProperty('lowViolence') ? options.lowViolence : false;
    options.highDefinition = options.hasOwnProperty('highDefinition') ? options.highDefinition : false;
    options.tempcontent = options.hasOwnProperty('tempcontent') ? options.tempcontent : false;
    options.language = options.hasOwnProperty('language') ? options.language : null;
    options.skipFileList = options.hasOwnProperty('skipFileList') ? options.skipFileList : false;

    var gameinfo = new KeyValues('GameInfo');
    gameinfo.load(fs.readFileSync(path.join(mainDir, 'tf', 'gameinfo.txt'), 'UTF-8'));

    var searchPathsKV = gameinfo.findKey('FileSystem').findKey('SearchPaths');
    searchPathsKV.value.forEach(function(searchPathKV) {
        var searchPath = {};

        searchPath.pathIDs = searchPathKV.key.split('+');

        if (searchPathKV.value.indexOf('|all_source_engine_paths|') === 0) {
            searchPath.fullLocationPath = path.join(mainDir, path.normalize(searchPathKV.value.slice(25)));
        }
        else if (searchPathKV.value.indexOf('|gameinfo_path|') === 0) {
            searchPath.fullLocationPath = path.join(mainDir, 'tf', path.normalize(searchPathKV.value.slice(15)));
        }
        else {
            searchPath.fullLocationPath = path.join(mainDir, path.normalize(searchPathKV.value));
        }

        searchPaths.push(searchPath);
    });

    return loadPathsInfo(searchPaths, options);
}
