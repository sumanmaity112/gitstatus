var fs = require('fs');
var lodash = require('lodash');
var unirest = require('unirest');
var EventEmitter=require('events').EventEmitter;
var result={},temp={};
var emitter = new EventEmitter();
var findDetails = function(userName){
	temp={};
	var url = 'https://api.github.com/users/'+userName.id+'/repos';
	unirest.get(url)
	.header('User-Agent','AppleWebKit/531.21.10')
	.header("Accept", "application/json")
	.header('Authorization','token '+process.env.gitToken)
	.end(function(response){
		if(response.code==200){
			temp={};
			var data = response.body;
			Object.keys(data).forEach(function(repoName){
				var repos = data[repoName];
				temp[repos.name]={created_at:new Date(repos.created_at).toLocaleString(),pushed_at:new Date(repos.pushed_at).toLocaleString(),language:repos.language};	
			});
			result[userName.name]=temp;
			result[userName.name].total_repo = Object.keys(temp).length;
			result[userName.name].id=userName.id;
			emitter.emit('end_response');
		}
		else{
			var note = 'Status code is '+ response.code + ' on '+ new Date().toLocaleString();
			fs.appendFile('./data/update.log',note,function(){});
			process.exit(1);
		}
	});
};
var countResponse = function(maxCount){
	var count = 0;
	return function(){
		count++;
		if(count==maxCount)
			emitter.emit('writeToFile',result);
	}
};
var writeToFile = function(data){
	data = JSON.stringify(data);
	fs.writeFileSync('result.JSON',data);
	var note = 'Details updated.............. on '+ new Date().toLocaleString();
	fs.appendFile('./data/update.log',note,function(){});
};;
var createResultForAnalysis = function(){
	emitter.addListener('writeToFile',writeToFile);
	if(!fs.existsSync('users.JSON')){
		var userNamesAsText = fs.readFileSync('gitHubId.csv','utf8');
		var userNames = userNamesAsText.split('\r\n').map(function(userName){
			return {name:userName.split(',')[0].toLowerCase(),id:userName.split(',')[1]};
		});
		fs.writeFileSync('users.JSON',JSON.stringify(userNames));
	}
	var users = JSON.parse(fs.readFileSync('users.JSON','utf8'));
	emitter.addListener('end_response',countResponse(users.length));
	users.forEach(function(userName){
		findDetails(userName);
	});
};

module.exports = createResultForAnalysis;
