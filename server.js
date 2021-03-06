// =======================
// Initialization ========
// =======================
var express		= require('express');
var app			= express();
var bodyParser	= require('body-parser');
var morgan		= require('morgan');
var mongoose	= require('mongoose');

var jwt			= require('jsonwebtoken'); // used to create, sign, and verify tokens
var config		= require('./config'); // get our config file
var Payment		= require('./app/models/Payment'); // get our mongoose model
var amqp 		= require('amqplib/callback_api');
var apiRoutes	= express.Router(); 

// =======================
// configuration =========
// =======================
var port 		= 2221; // used to create, sign, and verify tokens
mongoose.connect(config.database); // connect to database

amqp.connect('amqp://localhost', function(err, conn) {}); //connect message broker

app.set('superSecret', config.secret); // secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));


// =======================
// middleware ============
// =======================
// route middleware to verify a token
apiRoutes.use(function(req, res, next) {

	// check header or url parameters or post parameters for token
	var token = req.body.token || req.query.token || req.headers['x-access-token'];

	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, app.get('superSecret'), function(err, decoded) {      
			if (err) {
				return res.json({ success: false, message: 'Failed to authenticate token.' });    
			} 
			else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				next();
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.status(403).send({ 
			success: false, 
			message: 'No token provided.' 
		});
	}
});

// =======================
// routes ================
// =======================
app.get('/', function(req, res) { // basic route
	res.send('Hello! The API is at http://localhost:' + port + '/api');
});

// API ROUTES -------------------

// route to show a random message (GET http://localhost:2222/api/)
apiRoutes.get('/', function(req, res) {
  res.json({ message: 'Welcome to the coolest API on earth!' });
});

// route to return all Payments (GET http://localhost:2222/api/Payments)
apiRoutes.get('/payments', function(req, res) {
	Payment.find({}, function(err, Payments) {
		res.json(Payments);
	});
});

app.post('/payments', function(req, res) {
	var tlab = new Payment({ 
		date: req.param('date'), 
		amount: req.param('amount'),
		refnumber: req.param('refnumber'),
		method: req.param('method')
	});

	// save the sample Payment
	tlab.save(function(err) {
		if (err) throw err;

		console.log('Payment saved successfully');
		res.json({ success: true });
	});

	amqp.connect('amqp://localhost', function(err, conn) { //create a channel, which is where most of the API for getting things done resides
		conn.createChannel(function(err, ch) {});
	});

	amqp.connect('amqp://localhost', function(err, conn) {
		conn.createChannel(function(err, ch) {
			var ex 		= 'topic_logs';
			var args 	= process.argv.slice(2);
			var key 	= 'tlab.payment.accepted';
			var msg 	= '{"date": "'+req.param('date')+'","amount": "'+req.param('amount')+'"}';

			ch.assertExchange(ex, 'topic', {durable: false});
			ch.publish(ex, key, new Buffer(msg));
			console.log(" [x] Sent %s:'%s'", key, msg);
		});
	});
});

// apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);

// start the server ======
// =======================
app.listen(port);
console.log('Thunder Payment happens at http://localhost:' + port);

