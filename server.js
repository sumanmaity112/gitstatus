var http = require('http');
const PORT = process.env.PORT || 4040;
var app = require('express')();
var fs = require('fs');
var lodash = require('lodash');
var updateDetails = require('./takeImportantDetails.js');
var users={};

var readFile = function(){
	users = JSON.parse(fs.readFileSync('./result.JSON','utf8'));
};
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
server.listen(PORT,function(){
	setInterval(updateDetails,10800000);
	updateDetails();
	readFile();
});
