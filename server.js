var http = require('http');
var express = require('express');
var app = express();
var fs = require('fs');
var lodash = require('lodash');
var queryString = require('querystring');
var moment = require('moment-timezone');
var urlParse = require('url-parse');
var bodyParser = require('body-parser');
var lib = require('./takeImportantDetails.js').lib;
var updateDetails = lib.createResultForAnalysis;
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


var searchDetails = function(response,userName,res){
	var temp={},result={};
	if(response.code==200){
		temp = lib.createRepoDetails(response.body);
		result[userName.name]=temp;
		result[userName.name].total_repo = Object.keys(temp).length;
		result[userName.name].id=userName.id;
		res.render('createOneHtml',{user:result})
	}
	else{
		res.statusCode=404;
		res.redirect('/pageNotFound.html');
	}
};

var makeJist = function(users){
	var basicData = [];
	for(var user in users){
		var individualData = {name : user, totalCount : users[user].total_repo} ;
		var user_repos = Object.keys(users[user]);
		individualData.repos = lodash.sampleSize(lodash.take(user_repos, user_repos.length-2),2);
		basicData.push(individualData);
	}
	return basicData;
}

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
		res.statusCode=404;
		res.redirect('/pageNotFound.html');
	}
});

app.post('/login',function(req,res){
	fs.appendFile('./data/usersLog.log',req.body.name+'  '+moment(new Date().toISOString()).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mma')+'\n',function(){});
	res.redirect('/allInternDetails');
});
app.get('/allInternDetails',function(req,res){
	var basicData = makeJist(users);
	res.render('allDetails',{basicData:basicData});
});

app.get('/search',function(req,res){
	var query = urlParse.qs.parse(req.url);
	lib.findDetails({id:query.gitId,name:''},searchDetails,res);
});

var server = http.createServer(app);
server.listen(PORT,IP_ADDRESS);
