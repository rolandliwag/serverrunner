serverrunner
============

serverrunner starts node servers and then keeps them running. Allows for graceful shutdowns.


Installation
------------

    npm install serverrunner


Usage
-----

    var serverrunner = require('serverrunner');

    serverrunner({
        workers: 2,
        port: 3000,
        // This file will be require()'d by serverrunner's worker and should return
        // an http.Server instance such as an express app.
        server: './app.js',
        watch: './',
        configFile: './config.cjson'
    });


Next Features
-------------

  * Graceful restart
  * Multiple servers and ports
  * Selective shutdown/restart of workers
