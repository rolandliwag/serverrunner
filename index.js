var path = require('path'),
    child = require('child_process'),
    watchr = require('watchr'),
    _ = require('underscore'),
    oconf = require('oconf');

/**
 * @public
 * @cfg {Number} workers Number of workers to create.
 * @cfg {String} server Path to server file.
 * @cfg {Number} port Port number to start serving from.
 * @cfg {String} [watch] Directory to watch for changes. Workers will restart if
 * any files in this directory change.
 */
module.exports = function (options) {
    var workers = [],
        numWorkers = options.workers,
        serverFile = options.server,
        startPort = options.port,
        watchDir = options.watch,
        serverWorker = path.resolve(__dirname, 'lib/worker.js'),
        config,
        index;

    if (options.configFile) {
        config = oconf.load(options.configFile);
        console.log('Config loaded from ' + options.configFile);
    }

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
        var worker = child.fork(serverWorker, ['--port', port, '--server', serverFile, '--config', JSON.stringify(config)]);

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

                // Start worker again after 1 sec
                setTimeout(function () {
                    workers[port - startPort] = startWorker(port);
                }, 1000);
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
            ignoreHiddenFiles: true,
            duplicateDelay: 100,
            listener: function(event, filename) {
                console.log(filename + ' changed.');
                restartWorkers();
            }
        });
    }
};
