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
var Scheduler = require('./scheduler.js');
var pg = require('pg');
var userNames = JSON.parse(fs.readFileSync('users.JSON','utf8'));
var conString = process.env.conString;
var client = new pg.Client(conString);
client.connect();
var updateDetails = lib.createResultForAnalysis;
var users={};
var scheduler = new Scheduler();
scheduler.addLimit(4990,1000);
scheduler.start();

var updateDBForEach = function(user,repos,gitId){
	repos.forEach(function(repoName){
		var tableName = gitId.replace('-','_');
		var repoDetails = user[repoName];
		var repoLink = 'https://github.com/'+user.id+'/'+repoName;
		var insertedValue = [repoName,repoDetails.created_at,repoDetails.pushed_at,repoDetails.language,repoLink];
		var insertQuery = dbLib.makeSubTableInsertQuery(tableName,['repoName','created_At','push_At','language','repoLink'],insertedValue);
		var updatedValue = [repoDetails.created_at,repoDetails.pushed_at,repoDetails.language,new Date().getTime()];
		dbLib.runQuery(client,insertQuery);
		var updateAttributes = ['created_At','push_At','language','dbupdated_at']
		var updateQuery = dbLib.makeUpdateQuery(tableName,updateAttributes,updatedValue,"repoName='"+repoName+"'");
		dbLib.runQuery(client,updateQuery);
	})
}
var updateDataBase = function(user,name){
	name = name || null;
	var gitId = user.id;
	var gitHubLink = 'https://github.com/'+gitId;
	var query = dbLib.makeInsertQuery('gitdetails',['name','id','gitHubLink'],[name,gitId,gitHubLink]);
	dbLib.runQuery(client,query);
	dbLib.createTable(client,gitId,SUB_TABLE_ATTRIBUTES);
	var callBack = function(response){
		if(response.code==200){
			var user = lib.createRepoDetails(response.body);
			var repos= Object.keys(user);
			updateDBForEach(user,repos,gitId);
		}
	}
	lib.findDetails(user,callBack);	
}


const SUB_TABLE_ATTRIBUTES=['repoName varchar(200) primary key','created_At varchar(25)','push_At varchar(25)','language varchar(25)','repoLink varchar(350)','dbupdated_at numeric(20)'];
var gitAttributes = ['name varchar(200)','id varchar(100) primary key','gitHubLink varchar(250)'];
var tables = [{tableName:'gitdetails',gitAttributes:gitAttributes}];
tables.forEach(function(element){
	dbLib.createTable(client,element.tableName,element.gitAttributes);
});


var addJob = function(){
	userNames.forEach(function(userName){
		updateDataBase(userName,userName.name);
		scheduler.addJob(userName,updateDetails);
	})
};
var readIndividualData = function(row){
	users[row.name]={};
	client.query('select * from '+row.id.replace('-','_'),function(error,eachResult){
		if(!error){
			eachResult.rows.forEach(function(repo){
				users[row.name][repo.reponame]={created_at:repo.created_at,pushed_at:repo.push_at,language:repo.language}
			});
			users[row.name].total_repo=eachResult.rows.length;
			users[row.name].id=row.id;
		}
	})
}
var readDataBase = function(){
	client.query('select * from gitdetails',function(err,result){
		result.rows.forEach(function(row){
			if(row.name)
				readIndividualData(row);
		})
	});
};

addJob();
readDataBase();
setInterval(function(){
	readDataBase();
	addJob();
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
		scheduler.addUrgentJob(result[Object.keys(result)[0]],updateDataBase);
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
	var userData = client.query('select * from '+query.gitId,function(err,result){
		if(!!err || !result.rows.length || (new Date().getTime() - (+result.rows[0].dbupdated_at))>3600000)
			lib.findDetails({id:query.gitId,name:''},searchDetails,res);
		else{
			var tempResult = {};
			tempResult['']={};
			result.rows.forEach(function(row){
				tempResult[''][row.reponame]={created_at:row.created_at,pushed_at:row.push_at,language:row.language}
			});
			tempResult[''].id=query.gitId;
			tempResult[''].total_repo = result.rows.length;
			res.render('createOneHtml',{user:tempResult})
		}
	});
});

var server = http.createServer(app);
server.listen(PORT,IP_ADDRESS);
