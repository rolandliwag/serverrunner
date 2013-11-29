var argv = require('optimist').argv,
    serverFile = argv.server,
    port = argv.port,
    app = require(serverFile);

var server = app.listen(port);
console.log('Worker started on port ' + port);

process.on('SIGINT', function () {
    server.close(function () {
        process.exit();
    });
});
