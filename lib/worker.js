var argv = require('optimist').argv,
    serverFile = argv.server,
    port = argv.port,
    app = require(serverFile),
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
        server.close(function () {
            process.exit();
        });
    }
});

process.on('SIGINT', function () {
    // Ignore SIGINT
});
