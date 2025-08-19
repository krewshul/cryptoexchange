var Util = require('util');
var EventEmitter = require('events').EventEmitter;

var Server = require('./ExpressServer.js');
var Wallet = require('./Wallet.js');
var Orderbook = require('./Orderbook.js');
var sqlite3 = require('sqlite3').verbose();

var config = require('/root/lol/config.json');
var db_config = config.db;

var db = new sqlite3.Database(db_config.database);

db.query = function(sql, params, cb) {
    var stmt = sql.trim().split(' ')[0].toUpperCase();
    if (stmt === 'SELECT') this.all(sql, params, cb);
    else this.run(sql, params, function(err){ cb(err, this); });
};

Exchange = function() {
	EventEmitter.call(this);
	this.init();
}

Util.inherits(Exchange, EventEmitter);

Exchange.prototype.init = function() {
	var exchange = this;
	this.server = Server(this);
	this.server.on('listening', function() {
		exchange.emit('ready');
	});
	this.wallet = new Wallet();
	this.orderbook = new Orderbook();
	this.orderbook.on('new order', function(pair) {
		// orderbook has changed, check for matching orders
		db.query('SELECT * FROM orderbook WHERE pair = ? AND type = ? ORDER BY price ASC, id ASC', [pair, 'ask'], function(err, rows) {
			var ASKS = rows;
			db.query('SELECT * FROM orderbook WHERE pair = ? AND type = ? ORDER BY price DESC, id ASC', [pair, 'bid'], function(err, rows) {
				var BIDS = rows;
				ASKS.forEach(function(askOrder) {
					var askPrice = askOrder.price;
					for (var b = 0; b < BIDS.length; b++) {
						var bidOrder = BIDS[b];
						if (bidOrder.price > askPrice) {
							// fill ask order with a (maybe partially) matching bid order
							exchange.orderbook.fill(pair, askOrder, bidOrder, function(err, status) {
								
							});
						}
					}
				});
			});
		});
	});
}

Exchange.prototype.createAccount = function(username, email, password, callback) {
	var exchange = this;
	password = require('crypto').createHash('md5').update(password).digest("hex");
	db.query('INSERT INTO accounts (username, email, password, status) VALUES (?, ?, ?, ?)', [username, email, password, 1], function(err, info) {
		if (err) { callback(err); return; }
		var AID = info.insertId;
		db.query('INSERT INTO balances (account) VALUES (?)', [AID], function(err, info) {
			if (err) { callback(err); return; }
			var numCoins = Object.keys(exchange.wallet.daemons).length;
			var okCoins = 0;
			for (var coin in exchange.wallet.daemons) {
				if(exchange.wallet.daemons.hasOwnProperty(coin)) {
					(function(coin){
						console.log('calling ' + coin + ' daemon');
						exchange.wallet.daemons[coin].getNewAddress(AID.toString(), function(err, address) {
							if (err) { callback(err); return; }
							db.query('INSERT INTO addresses (account, currency, created_on, address) VALUES (?, ?, NOW(), ?)', [AID, coin, address], function(err, info) {
								if (err) { callback(err); return; }
								if(++okCoins == numCoins) {
									callback(null, AID);
								}
							});
						});
					})(coin);
				}
			}
		});
	});
}

Exchange.prototype.login = function(username, password, callback) {
	var exchange = this;
	password = require('crypto').createHash('md5').update(password).digest("hex");
	db.query('SELECT * FROM accounts WHERE username = ? AND password = ?', [username, password], function(err, rows) {
		if (err) { callback(err); return; }
		if (!rows || !rows.length) { callback('User not found'); return; }
		var user = rows[0];
		console.log(user);
		callback(null, user);
	});
}

module.exports = Exchange;