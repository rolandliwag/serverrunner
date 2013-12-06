var path = require('path'),
    child = require('child_process'),
    watchr = require('watchr'),
    _ = require('underscore');

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
        serverWorker = path.resolve(__dirname, 'lib/worker.js'),
        index;

    /**
     * Start the workers
     */
    function startWorkers() {
        _.range(0, numWorkers).forEach(function (index) {
            workers.push(startWorker(startPort + index));
        });
    }

    /**
     * Start the workers
     * @private
     */
    function startWorker(port) {
        var worker = child.fork(serverWorker, ['--port', port, '--server', serverFile]);

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

            var runningWorkers = numWorkers;

            function exitWhenAllWorkersExit() {
                runningWorkers -= 1;
                if (runningWorkers === 0) {
                    console.log('All workers exited.');
                    workers = [];
                    alreadyShuttingDown = false;
                    cb();
                }
            }

            console.log("\nShutting down workers...");

            workers.forEach(function (worker, index) {
                worker.on('exit', function () {
                    exitWhenAllWorkersExit();
                });

                worker.kill('SIGTERM');
            });
        };
    }());

    function shutdownMaster() {
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
            if (code !== 0 || code === null) {
                console.log('Worker exited with code: ' + code);
                workers[port - startPort] = startWorker(port);
            }
        };
    }

    startWorkers();

    // Graceful shutdown when SIGINT received
    process.on('SIGINT', shutdownMaster);

    // Restart workers if watchDir contents change
    if (watchDir !== undefined) {
        watchr.watch({
            path: watchDir,
            ignoreCustomPatterns: /^\./,
            listener: function(event, filename) {
                console.log(filename + ' changed.');
                restartWorkers();
            }
        });
    }
};
