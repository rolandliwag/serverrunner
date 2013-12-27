var path = require('path'),
    child = require('child_process'),
    watchr = require('watchr'),
    _ = require('underscore'),
    oconf = require('oconf');

/**
 * @public
 * @param {options} Mixed Either a configFile path or config options.
 * @param {Number} [options.workers] Number of workers to create.
 * @param {String} [options.server] Path to server file.
 * @param {Number} [options.port] Port number to start serving from.
 * @param {String} [options.watch] Directory to watch for changes. Workers will restart if
 * any files in this directory change.
 */
module.exports = function (options) {
    var workers = [],
        serverWorker = path.resolve(__dirname, 'lib/worker.js'),
        config,
        numWorkers,
        serverFile,
        startPort,
        watchDir;

    if (typeof options === 'string') {
        console.log('Loading config from ' + options);
        config = oconf.load(options);
        console.log(path.resolve(path.dirname(options), config.server));
        config.server = path.resolve(path.dirname(options), config.server);
    } else {
        config = options;
    }

    numWorkers = config.workers;
    serverFile = config.server;
    startPort = config.port;
    watchDir = config.watch;

    /**
     * Start the workers
     */
    function startWorkers() {
        _.range(0, numWorkers).forEach(function (index) {
            workers.push(startWorker(startPort + index));
        });
    }

    /**
     * Start a worker on a specific port
     * @private
     */
    function startWorker(port) {
        var worker = child.fork(serverWorker, ['--port', port, '--server', serverFile, '--config', JSON.stringify(options)]);

        worker.on('exit', createWorkerExitHandler(port));
        return worker;
    }

    /**
     * Shut down all workers
     * @private
     * @param {Function} cb
     */
    var shutdownWorkers = (function () {
        var alreadyShuttingDown = false;

        return function (cb) {
            if (alreadyShuttingDown) {
                return;
            }

            alreadyShuttingDown = true;

            function exitWhenAllWorkersExit() {
                var allWorkersExited = workers.every(function (worker) {
                    return worker === null;
                });

                if (allWorkersExited) {
                    console.log('All workers exited.');
                    workers = [];
                    alreadyShuttingDown = false;
                    cb();
                }
            }

            console.log("\nShutting down workers...");

            workers.forEach(function (worker, index) {
                if (worker === null) {
                    exitWhenAllWorkersExit();
                } else {
                    worker.on('exit', function () {
                        exitWhenAllWorkersExit();
                    });

                    worker.kill('SIGTERM');
                }
            });
        };
    }());

    function shutdownMaster() {
        shuttingDown = true;
        shutdownWorkers(function () {
            process.exit();
        });
    }

    /**
     * Restart all workers
     * @private
     */
    function restartWorkers() {
        shutdownWorkers(startWorkers);
    }

    /**
     * Create a listener function to handle a premature exit event from a worker
     * @private
     * @param {Number} port The port number of the worker.
     * @returns {Function}
     */
    function createWorkerExitHandler(port) {
        return function (code, signal) {
            workers[port - startPort] = null;
            if (code !== 0 || code === null) {
                console.log('Worker exited with code: ' + code);

                if (!shuttingDown) {
                    // Start worker again after 1 sec
                    setTimeout(function () {
                        workers[port - startPort] = startWorker(port);
                    }, 1000);
                }
            }
        };
    }

    var shuttingDown = false;
    startWorkers();

    // Graceful shutdown when SIGINT received
    process.on('SIGINT', shutdownMaster);

    // Restart workers if watchDir contents change
    if (watchDir !== undefined) {
        watchr.watch({
            path: watchDir,
            ignoreHiddenFiles: true,
            duplicateDelay: 100,
            listener: function(event, filename) {
                console.log(filename + ' changed.');
                restartWorkers();
            }
        });
    }
};
