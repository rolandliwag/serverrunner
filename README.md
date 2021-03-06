serverrunner
============

serverrunner starts node servers and then keeps them running. Allows for graceful shutdowns.


Installation
------------

    npm install serverrunner


Usage
-----

    var serverrunner = require('serverrunner');

In the simplest case, serverrunner can be called with an options parameter with
the following properties:

    serverrunner({
        workers: 4,
        port: 80,
        server: "../server/app.js",
        watch: "../",
        disgraceful: false,
        allowForcedExit: false,
        app: {
            // Application config
        }
    });

  - `workers`
  The number of worker processes to create. A reasonable value is the number of
  processor cores on the server.

  - `port`
  The starting port number for worker processes to listen in on. Each subsequent
  worker will listen on the next port number. eg: if `workers` is set to 4 and
  `port` is set to 80, then the 4 workers will listen on 80, 81, 82, and 83
  respectively.

  - `server`
  The path to the file which will ultimately be require()'d by the worker
  processes. The path should be relative to the current working directory of the
  entry script. An absolute path works too. This file is expected to export a
  function that accepts a config parameter (the contents of `app`) and should
  return an express object.

  - `watch`
  This path will be watched for file changes and will trigger a server restart.

  - `disgraceful`
  Helpful during development so that the server can be restarted or shut down
  instantly.

  - `allowForcedExit`
  Waits for open connections to finish before shutting down or restarting but
  gives the option not to wait.

  - `app`
  Config options that will be passed to the app server.

Another way to use serverrunner is to pass a path to a .cjson file which
contains a config as given above.

    serverrunner('config/development.cjson');

