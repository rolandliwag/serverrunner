var forever = require('forever-monitor'),
    path = require('path'),
    watchr = require('watchr');

/**
 * @public
 * @cfg {Number} workers Number of workers to create.
 * @cfg {String} server Path to server file.
 * @cfg {Number} port Port number to start serving from.
 * @cfg {String} [watch] Directory to watch for changes. Workers will restart if
 * any files in this directory change.
 */
module.exports = function (config) {
    var workers = [],
        numWorkers = config.workers,
        serverFile = config.server,
        startPort = config.port,
        watchDir = config.watch,
        cowboyWorker = path.resolve(__dirname, 'lib/worker.js'),
        worker,
        index;

    function restartWorkers() {
        console.log('Restarting workers.');
        workers.forEach(function (worker) {
            worker.restart();
        });
    }

    function shutdownWorkers() {
        console.log('Shutting down workers.');
        workers.forEach(function (worker) {
            worker.stop();
        });
    }

    for (index = 0; index < numWorkers; index += 1) {
        worker = new forever.Monitor(cowboyWorker, {
            silent: false,
            killTree: true,
            options: ['--port', startPort + index, '--server', serverFile],
        });

        workers.push(worker);
        worker.start();
    }

    if (watchDir !== undefined) {
        watchr.watch({
            path: watchDir,
            listener: function(event, filename) {
                console.log(filename + ' changed.');
                restartWorkers();
            }
        });
    }

    process.on('SIGINT', function () {
        shutdownWorkers();
        process.exit();
    });
};
