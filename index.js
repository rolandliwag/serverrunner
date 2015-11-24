var path = require('path'),
    child = require('child_process'),
    watch = require('watch'),
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
        watchDir,
        workerTitle,
        masterTitle;

    if (typeof options === 'string') {
        console.log('Loading config from ' + options);
        config = oconf.load(options);
        config.server = path.resolve(path.dirname(options), config.server);
    } else {
        config = options;
    }

    numWorkers = config.workers;
    serverFile = path.resolve(path.dirname(require.main.filename), config.server);
    startPort = config.port;
    allowForcedExit = config.allowForcedExit || false;
    disgraceful = config.disgraceful || false;
    watchDir = config.watch ? path.resolve(path.dirname(require.main.filename), config.watch) : null;
    workerTitle = config.workerTitle || 'server-worker';

    process.title = config.serverTitle || 'server-master';

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
        var worker = child.fork(serverWorker, [
            '--port', port,
            '--server', serverFile,
            '--allowForcedExit', allowForcedExit,
            '--config', JSON.stringify(config.app || {}),
            '--title', workerTitle
        ]);

        worker.on('exit', createWorkerExitHandler(port));
        return worker;
    }

    /**
     * Shut down all workers
     * @private
     * @param {Boolean} nonGraceful Set to true to avoid waiting for connections
     * to close.
     * @param {Function} cb
     */
    var shutdownWorkers = (function () {
        var alreadyShuttingDown = false;

        return function (nonGraceful, cb) {
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
                        delete workers[startPort + index];
                        exitWhenAllWorkersExit();
                    });

                    if (nonGraceful) {
                        worker.kill('SIGKILL');
                    } else {
                        worker.kill('SIGTERM');
                    }
                }
            });
        };
    }());

    function shutdownMaster() {
        shuttingDown = true;
        shutdownWorkers(disgraceful, function () {
            process.exit();
        });
    }

    /**
     * Restart all workers
     * @private
     * @param {Boolean} [nonGraceful] Set to true to avoid waiting for connections
     * to close.
     */
    function restartWorkers(nonGraceful) {
        shutdownWorkers(nonGraceful, startWorkers);
    }

    /**
     * Create a listener function to handle a premature exit event from a worker
     * @private
     * @param {Number} port The port number of the worker.
     * @returns {Function}
     */
    function createWorkerExitHandler(port) {
        return function (code, signal) {
            var workerIndex = port - startPort;

            workers[workerIndex] = null;

            if (code !== 0 || code === null) {
                console.log('Worker exited with code: ' + code);

                if (!shuttingDown) {
                    // Start worker again after 1 sec
                    setTimeout(function () {
                        if (!workers[workerIndex]) {
                            workers[workerIndex] = startWorker(port);
                        }
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
    if (watchDir) {
        watch.watchTree(watchDir, function(filename, prev, curr) {
            if (typeof filename == "object" && prev === null && curr === null) {
                console.log('Watching ' + watchDir + ' for changes');
            } else {
                console.log(filename + ' changed.');
                restartWorkers(disgraceful);
            }
        });
    }
};
