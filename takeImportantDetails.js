var fs = require('fs');
var lodash = require('lodash');
var unirest = require('unirest');
var moment = require('moment-timezone');
var EventEmitter=require('events').EventEmitter;
var result={},temp={};
var emitter = new EventEmitter();
var lib={};

lib.createRepoDetails = function(data){
	var temp = {};
	Object.keys(data).forEach(function(repoName){
		var repos = data[repoName];
		temp[repos.name]={created_at:moment(repos.created_at).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mma'),pushed_at:moment(repos.pushed_at).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mma'),language:repos.language};
	});
	return temp;
};

var updateResult=function(response,userName){
	temp={};
	if(response.code==200){
		temp = lib.createRepoDetails(response.body);
		result[userName.name]=temp;
		result[userName.name].total_repo = Object.keys(temp).length;
		result[userName.name].id=userName.id;
	}
	else{
		var note = 'Status code is '+ response.code + ' on '+ moment(new Date().toISOString()).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mma')+'\n';
		fs.appendFile('./data/update.log',note,function(){});
		process.exit(1);
	}
};

lib.findDetails = function(userName,callBack,res){
	var url = 'https://api.github.com/users/'+userName.id+'/repos';
	unirest.get(url)
	.header('User-Agent','AppleWebKit/531.21.10')
	.header("Accept", "application/json")
	.header('Authorization','token '+process.env.gitToken)
	.end(function(response){
		callBack(response,userName,res);
	});
};

lib.createResultForAnalysis = function(userName){
	lib.findDetails(userName,updateResult);
};

exports.lib=lib;
