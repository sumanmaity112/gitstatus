var cron = require('cron').CronJob;
var dbLib = require('./database.js').dbLib;
var lib = require('./takeImportantDetails.js').lib;

module.exports = function (userNames, client,readDatabase) {
    var updateTableData = updateTable(client);
    var job = new cron({
        cronTime: '00 00 24 * * *',
        onTick: function () {
            updateDatabase(userNames, client,updateTableData);
            setTimeout(readDatabase,600000);
        },
        start: false,
        timeZone: "Asia/Kolkata"
    });
    job.start();

};


var updateDatabase = function (userNames, client,updateTableData) {
    userNames.forEach(function (userName) {
        var tableName = userName.id.replace('-', '_');
        dbLib.runQuery(client, "TRUNCATE TABLE " + tableName + ";");
        lib.findDetails(userName, updateTableData, undefined);
    })
};
var updateTable = function (client) {
    return function (response, userName) {
        var tableName = userName.id.replace('-', '_');
        var result = {};
        if (response.code === 200) {
            result = lib.createRepoDetails(response.body);
            for (var repoName in result) {
                var repoDetails = result[repoName];
                var repoLink = 'https://github.com/' + userName.id + '/' + repoName;
                var insertedValue = [repoName, repoDetails.created_at, repoDetails.pushed_at, repoDetails.language, repoLink, new Date().getTime()];
                var insertQuery = dbLib.makeSubTableInsertQuery(tableName, ['repoName', 'created_At', 'push_At', 'language', 'repoLink', 'dbupdated_at'], insertedValue);
                dbLib.runQuery(client, insertQuery);
            }
        }
    };
};
