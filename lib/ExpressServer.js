var express = require('express');
var routes = {
        index: require('../routes/index.js'),
        login: require('../routes/login.js'),
        register: require('../routes/register.js'),
        wallet: require('../routes/wallet.js'),
        exchange: require('../routes/exchange.js'),
        order: require('../routes/order.js')
};
var http = require('http');
var path = require('path');
var sqlite3 = require('sqlite3').verbose();
var cookieParser = require('cookie-parser');
var session = require('express-session');

var config = require('/root/lol/config.json');
var db_config = config.db;

var db = new sqlite3.Database(db_config.database);

function Server(exchange) {

        var app = express();

        // all environments
        app.set('port', process.env.PORT || 3000);
        app.set('views', path.join(__dirname, '../views'));
        app.set('view engine', 'pug');
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser('!sword[]fish!'));
        app.use(session({
                secret: '!sword[]fish!',
                resave: false,
                saveUninitialized: true
        }));
        app.use(express.static(path.join(__dirname, '../public')));

        app.all('/', routes.index);
        app.all('/register', routes.register);
        app.all('/login/:logout?', routes.login);
        app.get('/wallet', routes.wallet);
        app.post('/wallet/withdraw/:currency', routes.wallet);
        app.get('/wallet/:ajax', routes.wallet);
        app.get('/wallet/:newaddress?/:coin?', routes.wallet);
        app.get('/exchange/:pair?', routes.exchange);
        app.post('/order', routes.order);

        app.get('/whoami', function(req, res, next) {
                if(!req.session.account) {
                        res.end('Login first maybe?');
                        return;
                }
                res.write('User id: ' + req.session.account + '\n');
                exchange.wallet.getBalance(req.session.account, 'RPC', function(err, balance) {
                        res.write('RPC balance: ' + balance + '\n');
                        exchange.wallet.getUnconfirmedBalance(req.session.account, 'RPC', function(err, balance) {
                                res.write('RPC unconfirmed balance: ' + balance + '\n');
                                res.end();
                        });
                });
        });
        app.get('/getaddress/:currency', function(req, res, next) {
                if(!req.session.account) {
                        res.end('Login first maybe?');
                        return;
                }
                exchange.wallet.getAddress(req.session.account, req.params.currency, function(err, address) {
                        if (err) res.end(err.toString());
                        res.end(address);
                });
        });
        app.get('/getnewaddress/:currency', function(req, res, next) {
                if(!req.session.account) {
                        res.end('Login first maybe?');
                        return;
                }
                exchange.wallet.getNewAddress(req.session.account, req.params.currency, function(err, address) {
                        if (err) res.end(err.toString());
                        res.end(address);
                });
        });
        app.get('/status', function(req, res, next) {
                if(!req.session.account) {
                        res.end('Login first maybe?');
                        return;
                }
                db.all('SELECT * FROM withdraws WHERE account = ? AND status = ?', [req.session.account, 'pending'], function(err, rows) {
                        if (err) throw err;
                        res.end(JSON.stringify(rows));
                });
        });
        app.get('/register/:username/:email/:password', function(req, res, next) {
                if(req.session.account) {
                        res.end('Logout first maybe?');
                        return;
                }
                exchange.createAccount(req.params.username, req.params.email, req.params.password, function(err, id) {
                        res.end(err ? err.toString() : id.toString());
                });
        });

        http.createServer(app).listen(app.get('port'), function() {
          console.log('Express server listening on port ' + app.get('port'));
          setInterval(function() { console.log('Ping-pong...'); }, 30000);
        });

        return app;

}

module.exports = Server;
