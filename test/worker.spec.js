var child = require('child_process'),
    pathModule = require('path');

describe('worker', function () {
    var workerPath = pathModule.resolve(__dirname, '../lib/worker'),
        testAppPath = pathModule.resolve(__dirname, 'fixtures/app.js');

    it('should return an error if arguments are missing', function (done) {
        var process = child.fork(workerPath, []);
        
        process.on('exit', function (code, signal) {
            if (code === 0) {
                done('exited without error');
            } else {
                done();
            }
        });
    })
    
    it('should start if correct arguments are passed', function (done) {
        var process = child.fork(workerPath, [
            '--port', '3001',
            '--server', testAppPath,
            '--allowForcedExit', 'true',
            '--config', '{}'
        ]);
        
        process.on('exit', done);
        process.kill('SIGTERM');
    });
});