#!/usr/bin/env node

'use strict';
var fs = require('fs');
var path = require('path');
var readline = require('readline');

var fstream = require('fstream');
var fstreamIgnore = require('fstream-ignore');

var tar = require('tar');
var zlib = require('zlib');

var bpm = {};
bpm.util = require('./bpm_util').util;

var formData = require('form-data');
var http = require('http');
var crypto = require('crypto');

var exec = require('child_process').exec;

bpm.readPkgJson = function (cb) {
    var pkgjson_src = path.resolve(process.cwd() + '/package.json');
    fs.exists(pkgjson_src, function (exists) {
        if (!exists) {
            console.log('package.json not exists.');
            return cb && cb('', {});
        }
        fs.readFile(pkgjson_src, 'utf8', function (err, data) {
            var pkgjson, pkgjson_str;
            if (err) throw err;
            try {
                pkgjson = JSON.parse(data);
                pkgjson_str = data;
                // console.log(pkgjson);
            }
            catch (e) {
                return console.log('package.json format illegal.');
            }

            cb && cb(pkgjson_str, pkgjson);
        });

    });
};

// [Example]
// {
//   "name": "npm-init",
//   "version": "0.0.0",
//   "description": "This is npm-init",
//   "main": "index.js",
//   "author": "haiyang5210"
// }
bpm.pkgjson = {
    init: function () {
        var me = this;
        me.pkgjson_src = path.resolve(process.cwd() + '/package.json');
        me.pkgjson = [
            'name', path.basename(path.dirname(me.pkgjson_src)),
            'version', '0.0.1',
            'description', 'This module is used to build "#{name}".',
            'main', '#{name}.js',
            // 'test', 'echo "Error: no test specified" && exit 1',
            // 'repository', 'git|http://github.com/' + basename,
            // 'keywords', 'javascript|node',
            // 'license', 'ISC',
            'dependencies', {
                'hui': '*'
                //,'hui_control': '*'
            },
            'author', 'haiyang5210'
        ];
        me.pkgdata = {};
        for (var i = 0, len = me.pkgjson.length; i < len; i += 2) {
            me.pkgdata[me.pkgjson[i]] = me.pkgjson[i + 1];
        }

        me.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        me.promptPkgjson.index = 0;
    },

    readPkgJson: function () {
        var me = this;
        bpm.readPkgJson(function (pkgjson_str, pkgjson) {
            for (var i in pkgjson) {
                me.pkgdata[i] = pkgjson[i];
            }
            console.log(pkgjson);

            console.log([
                'This utility will walk you through creating a package.json file.',
                'It only covers the most common items, and tries to guess sane defaults.',
                '',
                'See `npm help json` for definitive documentation on these fields',
                'and exactly what they do.',
                '',
                'Use `npm install <pkg> --save` afterwards to install a package and',
                'save it as a dependency in the package.json file.',
                '',
                'Press ^C at any time to quit.'
            ].join('\n'));


            me.promptPkgjson.index = 0;
            me.promptPkgjson();

        });
    },

    promptPkgjson: function () {
        var me = this;
        var k = me.pkgjson[me.promptPkgjson.index],
            v = me.pkgdata[k];
        if (k === 'description') {
            v = bpm.util.format(v, {
                name: me.pkgdata['name']
            });
        }
        if (k === 'dependencies') {
            v = JSON.stringify(me.pkgdata['dependencies']);
        }
        else if (k === 'main') {
            v = bpm.util.format(v, {
                name: String(me.pkgdata['name']).toLowerCase()
            });
        }
        me.rl.question(k + ': ' + (!!v ? '(' + v + ') ' : ''), function (answer) {
            me.pkgdata[me.pkgjson[me.promptPkgjson.index]] = answer || v;

            me.promptPkgjson.index += 2;
            if (me.promptPkgjson.index >= me.pkgjson.length) {
                me.finishPrompt();
            }
            else {
                me.promptPkgjson();
            }
        });
    },

    getTplMain: function () {
        var init_main = [
            '\'use strict\';',
            '\/**',
            ' * @name #{Name}',
            ' * @public',
            ' * @author #{author}',
            ' * @date #{date}',
            ' *\/',
            'hui.define(\'#{name}\', [], function () {',
            '    ',
            '});'
            // 'hui.define.autoload = true;',
            // 'hui.define(\'#{name}\', [\'hui_control\'], function () {',
            // '',
            // '    hui.#{Name} = function (options, pending) {',
            // '        hui.#{Name}.superClass.call(this, options, \'pending\');',
            // '        this.type = \'#{name}\';',
            // '        // 进入控件处理主流程!',
            // '        if (pending != \'pending\') {',
            // '            this.enterControl();',
            // '        }',
            // '    };',
            // '    hui.#{Name}.prototype = {',
            // '        render: function (options) {',
            // '            hui.#{Name}.superClass.prototype.render.call(this);',
            // '            var me = this;',
            // '            //hui.Control.init(me.getMain());',
            // '            me.getMain().innerHTML = \'#{name} ok.\';',
            // '        }',
            // '    };',
            // '',
            // '    // hui.#{Name} 继承了 hui.Control ',
            // '    hui.inherits(hui.#{Name}, hui.Control);',
            // '});'
        ].join('\n');
        return init_main;
    },
    getTplDemo: function () {
        var init_demo = [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '<meta charset="UTF-8">',
            '<title>Demo - #{Name}</title>',
            '<script src="http://bpmjs.org/api/combo"></script>',
            '<script src="#{name}.js"></script>',
            '</head>',
            '<body>',
            // '    <div ui="type:\'#{Name}\'" id="a"></div>',
            '    <div id="a"></div>',
            '',
            '    <script type="text/javascript">',
            '        hui.require([\'#{name}\'], function () {',
            '            // init ',
            '            document.getElementById(\'a\').innerHTML = \'#{Name} ok\';',
            //'            hui.Control.create(a);',
            '        });',
            '    </script>',
            '</body>',
            '</html>'
        ].join('\n');
        return init_demo;
    },
    getGitIgnoreDemo: function () {
        var init_demo = [
            '/hui_modules/',
            '.gitignore'
        ].join('\r\n');
        return init_demo;
    },
    finishPrompt: function () {
        var me = this;
        me.pkgdata.dependencies =
            typeof me.pkgdata.dependencies === 'string' ?
            JSON.parse(me.pkgdata.dependencies) :
            me.pkgdata.dependencies;
        var pkgjson = JSON.stringify(me.pkgdata, null, 4) + '\n';
        console.log('About to write to %s:\n\n%s\n', me.pkgjson_src, pkgjson);
        me.rl.question('Is this ok? (yes)', function (ok) {
            me.rl.close();

            ok = String(ok).toLowerCase().trim();
            if (ok && ok.charAt(0) !== 'y') {
                console.log('Aborted.');
            }
            else {
                fs.writeFile(me.pkgjson_src, pkgjson, 'utf8', function (er) {
                    if (er) throw er;
                    console.log('ok');
                });
                if (args[1] === '--demo') {
                    bpm.pkgjson.start();
                }
            }
        });
    },
    start: function () {
        var me = this;
        var main_js = me.pkgdata.main;
        if (main_js) {
            var init_main = me.getTplMain();
            var main_src = path.resolve(process.cwd() + '/' + main_js);
            fs.writeFile(main_src, bpm.util.format(init_main, {
                Name: me.pkgdata.name,
                name: String(me.pkgdata.name).toLowerCase(),
                author: me.pkgdata.author,
                date: bpm.util.formatDate(new Date())
            }), 'utf8', function (er) {
                if (er) throw er;
                console.log(main_js + ' ok');
            });

            var init_demo = me.getTplDemo();
            fs.writeFile(path.resolve(process.cwd() + '/demo.html'), bpm.util.format(init_demo, {
                Name: me.pkgdata.name,
                name: String(me.pkgdata.name).toLowerCase()
            }), 'utf8', function (er) {
                if (er) throw er;
                console.log('demo.html ok');
            });

            var init_ignore = me.getGitIgnoreDemo();
            fs.writeFile(path.resolve(process.cwd() + '/.gitignore'), init_ignore, 'utf8', function (er) {
                if (er) throw er;
                console.log('.gitignore ok');
            });

            bpm.install();
        }
    }
};

bpm.unpublish = function (mod_name) {
    if (!mod_name) {
        bpm.readPkgJson(function (str, data) {
            cb(data.name + '@' + data.version);
        });
    }
    else {
        cb(mod_name);
    }
    var cb = function (mod_name) {
        var options = {
            host: 'bpmjs.org',
            port: 80,
            'path': '/api/unpublish?mod_name=' + mod_name
        };

        http.get(options, function (res) {
            if (res && String(res.statusCode) === '200' && res.headers && res.headers.hui_mod === 'success') {
                console.log('unpublish ' + mod_name + ' success.');
            }
            else {
                console.log(res.headers.hui_mod);
            }

            res.resume();
        });
    };
};

bpm.publish = function () {
    bpm.pack(function () {
        bpm.upload();
    });
};
bpm.pack = function (cb) {
    bpm.readPkgJson(function (pkgjson_str, pkgjson) {
        var md5 = crypto.createHash('md5');
        md5.update(pkgjson_str, 'utf8');
        var filePath = path.resolve(process.cwd() + '/' + pkgjson.name + '_' + md5.digest('hex') + '.tar.gz');

        fstreamIgnore({
            'path': process.cwd(),
            'type': 'Directory',
            ignoreFiles: ['.gitignore']
        })
            .pipe(tar.Pack())
            .pipe(zlib.Gzip())
            .pipe(fstream.Writer({
                'path': filePath
            }))
            .on('close', function () {
                // console.log(filePath + ' gzip done');
                console.log('.');
                cb && cb();
            });
    });
};

bpm.upload = function () {
    var form;
    bpm.readPkgJson(function (pkgjson_str, pkgjson) {
        var md5 = crypto.createHash('md5');
        md5.update(String(pkgjson_str), 'utf8');
        var filePath = path.resolve(process.cwd() + '/' + pkgjson.name + '_' + md5.digest('hex') + '.tar.gz');

        form = new formData();
        form.append('package_json', pkgjson_str);
        form.append('tarball', fs.createReadStream(filePath));

        form.submit({
            host: 'bpmjs.org',
            port: '80',
            path: '/api/publish'
        }, function (err, res) {
            // console.log(res.statusCode);
            // console.log(res.headers.hui_mod);
            if (err) {
                return console.error('upload failed:', err);
            }
            var fileData = '';
            res.on('data', function (data) {
                fileData += data;
            }).on('end', function () {
                console.log(fileData);
                fs.unlink(filePath);
            });
            // res – response object (http.IncomingMessage)  //
            res.resume(); // for node-0.10.x
        });
    });
};

bpm.install = function (mod_name, cb) {
    mod_name = !mod_name ? '' : String(mod_name).trim();
    if (!mod_name) {
        bpm.readPkgJson(function (pkgjson_str, pkgjson) {
            if (pkgjson && pkgjson.dependencies && JSON.stringify(pkgjson.dependencies) !== '{}') {
                bpm.getModDepend(JSON.stringify(pkgjson.dependencies), function (result) {
                    result = JSON.parse(result);
                    var list = [];
                    for (var i in result) {
                        list.push(result[i].name + '@' + result[i].version);
                    }

                    var callback = function () {
                        if (list.length) {
                            var m = list.pop();
                            bpm.download(m, function () {
                                setTimeout(function () {
                                    bpm.unpack(m, callback);
                                }, 100);
                            });
                        }
                    };
                    callback();
                });
            }
        });
    }
    else {
        bpm.download(mod_name, function () {
            bpm.readPkgJson(function (pkgjson_str, pkgjson) {
                pkgjson.dependencies = pkgjson.dependencies || {};
                var str = mod_name.split('@');
                pkgjson.dependencies[str[0]] = str[1] || '*';

                fs.writeFile(
                    path.resolve(process.cwd() + '/package.json'),
                    JSON.stringify(pkgjson, null, 4), 'utf8',
                    function (er) {
                        if (er) throw er;

                        bpm.unpack(mod_name, function () {
                            cb && cb();
                        });
                    });
            });
        });
    }
};
bpm.uninstall = function (mod_name, cb) {
    mod_name = !mod_name ? '' : String(mod_name).trim();
    if (mod_name) {
        bpm.readPkgJson(function (pkgjson_str, pkgjson) {
            pkgjson.dependencies = pkgjson.dependencies || {};
            var str = mod_name.split('@');
            delete pkgjson.dependencies[str[0]];

            fs.writeFile(
                path.resolve(process.cwd() + '/package.json'),
                JSON.stringify(pkgjson, null, 4), 'utf8',
                function (er) {
                    if (er) throw er;

                    exec('cd ' + process.cwd(), function (err, out) {
                        exec('rm -rf ' + path.resolve(process.cwd() + '/hui_modules/' + mod_name.split('@')[0]), function (err, out) {
                            console.log(mod_name + ' uninstall success.');
                        });
                    });
                }
            );
        });
    }
};

bpm.getModDepend = function (mod_dep, cb) {
    var options = {
        host: 'bpmjs.org',
        port: 80,
        'path': '/api/get_dep??' + mod_dep
    };

    http.get(options, function (res) {
        var fileData = '';
        res.on('data', function (data) {
            fileData += data;
        }).on('end', function () {
            cb && cb(fileData);
        });

        res.resume();
    });
};

bpm.download = function (mod_name, cb) {
    var options = {
        host: 'bpmjs.org',
        port: 80,
        'path': '/api/download?mod_name=' + mod_name
    };

    http.get(options, function (res) {
        if (res && String(res.statusCode) !== '404' && res.headers && res.headers.hui_mod === 'exists') {
            var filePath = path.resolve(process.cwd() + '/' + mod_name + '.tar.gz');
            var file = fstream.Writer({
                'path': filePath
            });
            res.on('data', function (data) {
                file.write(data);
            }).on('end', function () {
                file.end();
                console.log(mod_name + '.tar.gz download success.');

                cb && cb(mod_name);
                res.resume();
            });
        }
        else {
            var fileData = '';
            res.on('data', function (data) {
                fileData += data;
            }).on('end', function () {
                console.log(fileData);
            });
        }

        res.resume();
    });

};
bpm.unpack = function (mod_name, cb) {
    mod_name = String(mod_name).toLowerCase();
    var filePath = path.resolve(process.cwd() + '/' + mod_name + '.tar.gz');
    fstream.Reader(filePath)
        .on('error', function (err) {
            console.log(err);
        })
        .pipe(zlib.Gunzip())
        .pipe(tar.Extract({
            path: path.resolve(process.cwd() + '/hui_modules/' + mod_name.split('@')[0]),
            strip: 1
        }))
        .on('end', function () {
            console.log(mod_name + ' install success.\n');
            fs.unlink(filePath);

            cb && cb();
        });
};

bpm.cmd = function () {
    rl.question('bpm>', function (answer) {
        var str = answer.split(' ');
        if (bpm[str[0]]) {
            bpm[str[0]](str[1]);
            setTimeout(bpm.cmd, 2000);
        }
        else {
            console.log('invalidate command.\n');
            bpm.cmd();
        }
    });
};

var args = process.argv.splice(2);
if (args[0] === 'init') {
    bpm.pkgjson.init();
    bpm.pkgjson.readPkgJson();
}
else if (args[0] === 'unpublish') {
    bpm.unpublish(args[1]);
}
else if (args[0] === 'publish') {
    bpm.publish();
}
else if (args[0] === 'pack') {
    bpm.pack();
}
else if (args[0] === 'upload') {
    bpm.upload();
}
else if (args[0] === 'download') {
    bpm.download(args[1]);
}
else if (args[0] === 'unpack') {
    bpm.unpack(args[1]);
}
else if (args[0] === 'install') {
    bpm.install(args[1]);
}
else if (args[0] === 'uninstall') {
    bpm.uninstall(args[1]);
}
else if (args[0] === 'cmd') {
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    bpm.cmd();
}
else {
    console.log(args);
    //bpm.pkgjson.rl.close();
}