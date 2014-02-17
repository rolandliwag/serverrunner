var path = require('path'),
    argv = require('optimist').argv,
    port = argv.port,
    allowForcedExit = argv.allowForcedExit === 'true',
    app = require(argv.server)(JSON.parse(argv.config)),
    numActiveConnections = 0,
    serverShuttingDown = false,
    server;

server = app.listen(port, function () {
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

process.on('SIGTERM', function () {
    serverShuttingDown = true;

    if (numActiveConnections === 0) {
        process.exit();
    } else {
        console.log(numActiveConnections + ' connection(s) still active.');
        if (allowForcedExit) {
            console.log('CTRL-C to force exit.');
        }
        server.close(function () {
            process.exit();
        });
    }
});

process.on('SIGINT', function () {
    // Ignore SIGINT until SIGTERM sent
    if (allowForcedExit && serverShuttingDown) {
        process.exit();
    }
});
