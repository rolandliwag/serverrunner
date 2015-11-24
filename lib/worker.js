var path = require('path'),
    domain = require('domain'),
    express = require('express'),
    serverDomain = domain.create();

var argv = require('optimist').argv,
    port = argv.port,
    allowForcedExit = argv.allowForcedExit === 'true',
    numActiveConnections = 0,
    serverShuttingDown = false,
    server;

/**
 * @private
 * @param {Boolean} withErrorCode Set to true to call process.exit with an error code.
 */
function gracefulShutdown(withErrorCode) {
    serverShuttingDown = true;

    if (numActiveConnections === 0) {
        process.exit(withErrorCode);
    } else {
        console.log(numActiveConnections + ' connection(s) still active.');
        if (allowForcedExit) {
            console.log('CTRL-C to force exit.');
        }
        server.close(function () {
            process.exit(withErrorCode);
        });
    }
}

serverDomain.on('error', function (err) {
    console.log('FATAL ERROR. Shutting down: ' + err);
    serverDomain.dispose();

    gracefulShutdown(1);
});

serverDomain.run(function () {
    var domainApp = express(),
        config,
        app;

    try {
        config = JSON.parse(argv.config);
    } catch (e) {
        throw new Error('--config is invalid');
    }

    app = require(argv.server)(config);

    domainApp.use(function (req, res, next) {
        var requestDomain = domain.create();

        res.on('finish', function () {
            requestDomain.dispose();
        });

        res.on('close', function () {
            requestDomain.dispose();
        });

        requestDomain.on('error', function (err) {
            console.log('Error while handling a request: ' + err);
            requestDomain.dispose();
            next(500);
            serverDomain.emit('error', err);
        });

        requestDomain.run(next);
    });
    domainApp.use(app);

    server = domainApp.listen(port, function () {
        console.log('Worker started on port ' + port);
    });

    server.on('request', function (req, res) {
        numActiveConnections += 1;

        res.on('finish', function () {
            numActiveConnections -= 1;

            if (serverShuttingDown && numActiveConnections === 0) {
                req.connection.end();
            }
        });
    });
});

process.title = argv.title || 'server-worker';

process.on('SIGTERM', gracefulShutdown);

process.on('SIGINT', function () {
    // Ignore SIGINT until SIGTERM sent
    if (allowForcedExit && serverShuttingDown) {
        process.exit();
    }
});
