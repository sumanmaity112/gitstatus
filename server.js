var http = require('http');
var express = require('express');
var app = express();
var fs = require('fs');
var lodash = require('lodash');
var moment = require('moment-timezone');
var bodyParser = require('body-parser');
var updateDetails = require('./takeImportantDetails.js');
var users={};

var readFile = function(){
	users = JSON.parse(fs.readFileSync('./result.JSON','utf8'));
};
updateDetails();
setTimeout(readFile,60000);
setInterval(function(){
	updateDetails();
	setTimeout(readFile,600000);
},10800000);

var IP_ADDRESS = process.env.OPENSHIFT_NODEJS_IP;
var PORT = process.env.OPENSHIFT_NODEJS_PORT || 4040;

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine','jade');
app.use(express.static('./HTML'));
app.get('/', function(req, res){
	res.redirect('/index.html');
});

app.get(/\/interns/,function(req,res){
	var userName = req.url.split('/interns/')[1];
	userName = userName.replace(/%20/g,' ');
	
	if(lodash.has(users,userName)){
		var user={};
		user[userName]=users[userName];
		res.render('createOneHtml',{user:user});	
	}
	else{
		res.statusCode=405;
		res.end('Invalid intern name')
	}
})

app.post('/login',function(req,res){
	fs.appendFile('./data/usersLog.log',req.body.name+'  '+moment(new Date().toISOString()).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mma')+'\n',function(){});
	res.render('allDetails',{user:Object.keys(users).sort()});
})

var server = http.createServer(app);
server.listen(PORT,IP_ADDRESS);
