var http = require('http');
var app = require('express')();
var fs = require('fs');
var lodash = require('lodash');
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


app.set('view engine','jade');
app.get('/', function(req, res){
  res.render('allDetails',{user:Object.keys(users).sort()});
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

var server = http.createServer(app);
server.listen(PORT,IP_ADDRESS);
