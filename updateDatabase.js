var cron = require('cron').CronJob;
var dbLib = require('./database.js').dbLib;
var lib = require('./takeImportantDetails.js').lib;
var lodash = require('lodash');

var schedule = function (userNames, client, readDatabase,moveableAttributes) {
    var updateTableData = updateTable(client,moveableAttributes);
    var job = new cron({
        cronTime: '00 59 23 * * *',
        onTick: function () {
            updateDatabase(userNames, client, updateTableData);
            setTimeout(readDatabase, 600000);
        },
        start: false,
        timeZone: "Asia/Kolkata"
    });
    job.start();

};


var updateDatabase = function (userNames, client, updateTableData) {
    userNames.forEach(function (userName) {
        lib.findDetails(userName, updateTableData, undefined);
    })
};

var separateRepos = function (client, tableName, latestResult, gitId,moveableAttributes) {
    client.query("select reponame from " + tableName + ";", function (err, result) {
        if (!err) {
            var oldRepoNames = result.rows.map(function (row) {
                return row.reponame
            });
            var deletedRepoNames = lodash.difference(oldRepoNames, Object.keys(latestResult));
            deletedRepoNames.forEach(function(deletedRepoName){
                var condition = "reponame = '" + deletedRepoName + "'";
                var destTableName = tableName + "_erase";
                var query = dbLib.makeMoveQuery(tableName, destTableName, condition,moveableAttributes);
                dbLib.runQuery(client, query);
            });

            for (var repoName in latestResult) {
                modify(latestResult[repoName], repoName, gitId, client, tableName);
            }
        }else {
            console.log("\n Error for ",tableName,"\n",err);
        }
    })
};

var modify = function (repoDetails, repoName, gitId, client, tableName) {
    var repoLink = 'https://github.com/' + gitId + '/' + repoName;
    var insertedValue = [repoName, repoDetails.created_at, repoDetails.pushed_at, repoDetails.language, repoLink, new Date().getTime()];
    var insertQuery = dbLib.makeSubTableInsertQuery(tableName, ['repoName', 'created_At', 'push_At', 'language', 'repoLink', 'dbupdated_at'], insertedValue);
    dbLib.runQuery(client, insertQuery);
    var updatedValue = [repoDetails.pushed_at, repoDetails.language, new Date().getTime()];
    var updateAttributes = ['push_At', 'language', 'dbupdated_at'];
    var updateQuery = dbLib.makeUpdateQuery(tableName, updateAttributes, updatedValue, "repoName='" + repoName + "';");
    dbLib.runQuery(client, updateQuery);
};

var updateTable = function (client,moveableAttributes) {
    return function (response, userName) {
        var tableName = userName.id.replace('-', '_');
        var latestResult = {};
        if (response.code === 200) {
            latestResult = lib.createRepoDetails(response.body);
            separateRepos(client, tableName, latestResult, userName.id,moveableAttributes);
        }
    };
};

module.exports = {modify: modify, schedule: schedule};