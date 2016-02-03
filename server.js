var http = require('http');
var express = require('express');
var app = express();
var fs = require('fs');
var lodash = require('lodash');
var queryString = require('querystring');
var moment = require('moment-timezone');
var urlParse = require('url-parse');
var bodyParser = require('body-parser');
var dbLib = require('./updateDb.js').dbLib;
var lib = require('./takeImportantDetails.js').lib;
var pg = require('pg');
var conString = process.env.conString;
var client = new pg.Client(conString);
client.connect();

var updateDetails = lib.createResultForAnalysis;
var users={};
const SUB_TABLE_ATTRIBUTES=['repoName varchar(200) primary key','createdAt varchar(25)','pushAt varchar(25)','language varchar(25)','repoLink varchar(350)'];

var readFile = function(){
	users = JSON.parse(fs.readFileSync('./result.JSON','utf8'));
	var gitAttributes = ['name varchar(200)','id varchar(100) primary key','gitHubLink varchar(250)'];
	var tables = [{tableName:'gitdetails',gitAttributes:gitAttributes}];
	tables.forEach(function(element){
		dbLib.createTable(client,element.tableName,element.gitAttributes);
	});

	Object.keys(users).forEach(function(name){
		var gitId = users[name].id;
		var gitHubLink = 'https://github.com/'+gitId;
		var query = dbLib.makeInsertQuery('gitdetails',['name','id','gitHubLink'],[name,gitId,gitHubLink]);
		dbLib.runQuery(client,query);
		dbLib.createTable(client,gitId,SUB_TABLE_ATTRIBUTES);
		var repos= Object.keys(users[name]);
		repos.slice(0,repos.length-2).forEach(function(repoName){
			var tableName = gitId.replace('-','_');
			var repoDetails = users[name][repoName];
			var repoLink = 'https://github.com/'+users[name].id+'/'+repoName;
			var insertedValue = [repoName,repoDetails.created_at,repoDetails.pushed_at,repoDetails.language,repoLink];
			var insertQuery = dbLib.makeSubTableInsertQuery(tableName,['repoName','createdAt','pushAt','language','repoLink'],insertedValue);
			var updatedValue = [repoDetails.created_at,repoDetails.pushed_at,repoDetails.language];
			dbLib.runQuery(client,insertQuery);
			var updateAttributes = ['createdAt','pushAt','language']
			var updateQuery = dbLib.makeUpdateQuery(tableName,updateAttributes,updatedValue,"repoName='"+repoName+"'");
			dbLib.runQuery(client,updateQuery);
		})
	});
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
	res.render('allDetails',{user:Object.keys(users).sort()});
});

app.get('/search',function(req,res){
	var query = urlParse.qs.parse(req.url);
	lib.findDetails({id:query.gitId,name:''},searchDetails,res);
});

var server = http.createServer(app);
server.listen(PORT,IP_ADDRESS);
