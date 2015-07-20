module.exports = function createApp() {
    return function (req, res, next) {
        res.send('ok');
    };
};
