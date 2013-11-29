serverrunner
============

serverrunner starts node servers and then keeps them running. Allows for graceful shutdowns.

Usage:

    var serverrunner = require('serverrunner');

    cowboy({
        workers: 2,
        port: 3000,
        // This file will be require()'d by serverrunner's worker and should return an http.Server instance such as an express app.
        server: './app.js'),
        watch: './'
    });


Next Features
-------------
  * Graceful restart
  * Multiple servers and ports
  * Selective shutdown/restart of workers

