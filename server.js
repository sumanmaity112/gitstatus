var http = require('http');
var express = require('express');
var app = express();
var fs = require('fs');
var lodash = require('lodash');
var moment = require('moment-timezone');
var urlParse = require('url-parse');
var bodyParser = require('body-parser');
var dbLib = require('./database.js').dbLib;
var lib = require('./takeImportantDetails.js').lib;
var updateDatabase = require("./updateDatabase.js");
var Scheduler = require('job_scheduler');
var utf8 = require('utf8');
var pg = require('pg');
var userNames = JSON.parse(fs.readFileSync('users.JSON', 'utf8'));
if (!process.env.OPENSHIFT_POSTGRESQL_DB_USERNAME)
    var conString = 'pg://postgres:sumanmaity@localhost:5432/postgres'
else
    var conString = 'pg://' + process.env.OPENSHIFT_POSTGRESQL_DB_USERNAME + ':' + process.env.OPENSHIFT_POSTGRESQL_DB_PASSWORD + '@' + process.env.OPENSHIFT_POSTGRESQL_DB_HOST + ':' + process.env.OPENSHIFT_POSTGRESQL_DB_PORT + '/gitstatus';
// var conString = 'postgresql://$OPENSHIFT_POSTGRESQL_DB_HOST:$OPENSHIFT_POSTGRESQL_DB_PORT';
var client = new pg.Client(conString);
client.connect();
var updateDetails = lib.createResultForAnalysis;
var users = {};

var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: "http://gitstatus-projectsm.rhcloud.com/auth/facebook/callback",
        profileFields: ['id', 'email', 'gender', 'name']
    },
    function (accessToken, refreshToken, profile, done) {
        var profileData = JSON.parse(profile._raw);
        profileData.email = utf8.decode(profileData.email);
        fs.appendFile('./data/usersLog.log', JSON.stringify(profileData) + '  ' + moment(new Date().toISOString()).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mma') + '\n', function () {
        });
        done(null, profile._raw);
    }
));


var scheduler = new Scheduler();
scheduler.addLimit(4990, 1000);
scheduler.start();

var updateDBForEach = function (user, repos, gitId) {
    repos.forEach(function (repoName) {
        var tableName = gitId.replace('-', '_');
        var repoDetails = user[repoName];
        updateDatabase.modify(repoDetails,repoName,gitId,client,tableName);
    });
};
var regularDatabaseUpdate = function (user, name) {
    name = name || null;
    var gitId = user.id;
    var gitHubLink = 'https://github.com/' + gitId;
    var query = dbLib.makeInsertQuery('gitdetails', ['name', 'id', 'gitHubLink'], [name, gitId, gitHubLink]);
    dbLib.runQuery(client, query);
    dbLib.createTable(client, gitId, SUB_TABLE_ATTRIBUTES);
    dbLib.createTable(client, gitId+"_erase", BACKUP_TABLE_ATTRIBUTES_WITH_TYPE); //It will create a new table for store the deleted repo if table not exists

    var callBack = function (response) {
        if (response.code == 200) {
            var user = lib.createRepoDetails(response.body);
            var repos = Object.keys(user);
            updateDBForEach(user, repos, gitId);
        }
    };
    lib.findDetails(user, callBack);
};


const SUB_TABLE_ATTRIBUTES = ['repoName varchar(200) primary key', 'created_At varchar(25)', 'push_At varchar(25)', 'language varchar(25)', 'repoLink varchar(350)', 'dbupdated_at numeric(20)'];
const BACKUP_TABLE_ATTRIBUTES_WITH_TYPE = ['repoName varchar(200) primary key', 'created_At varchar(25)', 'push_At varchar(25)', 'language varchar(25)', 'dbupdated_at numeric(20)'];
const BACKUP_TABLE_ATTRIBUTES = ['reponame','created_At','push_At','language','dbupdated_at'];
var gitAttributes = ['name varchar(200)', 'id varchar(100) primary key', 'gitHubLink varchar(250)'];
var tables = [{tableName: 'gitdetails', gitAttributes: gitAttributes}];
tables.forEach(function (element) {
    dbLib.createTable(client, element.tableName, element.gitAttributes);
});


var addJob = function () {
    userNames.forEach(function (userName) {
        regularDatabaseUpdate(userName, userName.name);
        scheduler.addJob(userName, updateDetails);
    })
};
var readIndividualData = function (row) {
    users[row.name] = {};
    client.query('select * from ' + row.id.replace('-', '_'), function (error, eachResult) {
        if (!error) {
            eachResult.rows.forEach(function (repo) {
                users[row.name][repo.reponame] = {
                    created_at: repo.created_at,
                    pushed_at: repo.push_at,
                    language: repo.language
                }
            });
            users[row.name].total_repo = eachResult.rows.length;
            users[row.name].id = row.id;
        }
    })
};
var readDataBase = function () {
    client.query('select * from gitdetails', function (err, result) {
        result.rows.forEach(function (row) {
            if (row.name)
                readIndividualData(row);
        })
    });
};

addJob();
readDataBase();
setInterval(function () {
    readDataBase();
    addJob();
}, 10800000);

var IP_ADDRESS = process.env.OPENSHIFT_NODEJS_IP;
var PORT = process.env.OPENSHIFT_NODEJS_PORT || 4040;

var searchDetails = function (response, userName, res) {
    var temp = {}, result = {};
    if (response.code == 200) {
        temp = lib.createRepoDetails(response.body);
        result[userName.name] = temp;
        result[userName.name].total_repo = Object.keys(temp).length;
        result[userName.name].id = userName.id;
        res.render('createOneHtml', {user: result});
        scheduler.addUrgentJob(result[Object.keys(result)[0]], regularDatabaseUpdate);
    }
    else {
        res.statusCode = 404;
        res.redirect('/pageNotFound.html');
    }
};

var makeJist = function (users) {
    var basicData = [];
    for (var user in users) {
        var individualData = {name: user, totalCount: users[user].total_repo};
        var user_repos = Object.keys(users[user]);
        individualData.repos = lodash.sampleSize(lodash.take(user_repos, user_repos.length - 2), 2);
        basicData.push(individualData);
    }
    return basicData;
};
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'jade');
app.use(passport.initialize());
passport.serializeUser(function (user, done) {
    done(null, user);
});
app.use(express.static('./HTML'));
app.get('/', function (req, res) {
    // res.redirect('/index.html');
    res.render('index');
});
app.get('/auth/facebook', passport.authenticate('facebook', {scope: 'email'}));
app.get('/auth/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/allInternDetails',
    failureRedirect: '/'
}));
app.get(/\/interns/, function (req, res) {
    var userName = req.url.split('/interns/')[1];
    userName = userName.replace(/%20/g, ' ');

    if (lodash.has(users, userName)) {
        var user = {};
        user[userName] = users[userName];
        res.render('createOneHtml', {user: user});
    }
    else {
        res.statusCode = 404;
        res.redirect('/pageNotFound.html');
    }
});

app.post('/login', function (req, res) {
    fs.appendFile('./data/usersLog.log', req.body.name + '  ' + moment(new Date().toISOString()).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mma') + '\n', function () {
    });
    res.redirect('/allInternDetails');
});
app.get('/allInternDetails', function (req, res) {
    var basicData = makeJist(users);
    res.render('allDetails', {basicData: basicData});
});
app.get('/logout', function (req, res) {
    req.logout();
    // res.render('/index.html');
    res.render('index');
});
app.get('/search', function (req, res) {
    var query = urlParse.qs.parse(req.url);
    var userData = client.query('select * from ' + query.gitId, function (err, result) {
        if (!!err || !result.rows.length || (new Date().getTime() - (+result.rows[0].dbupdated_at)) > 3600000)
            lib.findDetails({id: query.gitId, name: ''}, searchDetails, res);
        else {
            var tempResult = {};
            tempResult[''] = {};
            result.rows.forEach(function (row) {
                tempResult[''][row.reponame] = {
                    created_at: row.created_at,
                    pushed_at: row.push_at,
                    language: row.language
                }
            });
            tempResult[''].id = query.gitId;
            tempResult[''].total_repo = result.rows.length;
            res.render('createOneHtml', {user: tempResult})
        }
    });
});

var server = http.createServer(app);
server.listen(PORT, IP_ADDRESS,function(){
    updateDatabase.schedule(userNames,client,readDataBase,BACKUP_TABLE_ATTRIBUTES); //This update function holds a scheduler which will update all table data (users repo details) everyday midnight
});
