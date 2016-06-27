var dbLib = {};

dbLib.createTable = function (client, gitId, attributes) {
    var tableName = gitId.replace('-', '_');
    var query = "create table if not exists " + tableName + " ( " + attributes.join() + ');';
    this.runQuery(client, query);
};
dbLib.makeUpdateQuery = function (tableName, attributes, values, condition) {
    var query = 'update ' + tableName + ' set ';
    var value = [];
    attributes.forEach(function (attribute, index) {
        value.push(attribute + "='" + values[index] + "'");
    });
    query += value.join();
    return query + ' where ' + condition;
};

dbLib.makeInsertQuery = function (tableName, attributes, values) {
    return "insert into " + tableName + " (" + attributes.join(",") + ") select '" + values.join("','") + "' where (select not exists(select id from " + tableName + " where id='" + values[1] + "'));";
};

dbLib.makeSubTableInsertQuery = function (tableName, attributes, values) {
    return "insert into " + tableName + " (" + attributes.join(",") + ") select '" + values.join("','") + "' where (select not exists(select repoName from " + tableName + " where repoName='" + values[0] + "'));";
};

dbLib.makeMoveQuery = function(soureceTableName,destTableName,condition,moveableAttributes){
    return "INSERT INTO " + destTableName + " (" + moveableAttributes.join(", ") + ") SELECT "+moveableAttributes.join(", ") +" FROM " + soureceTableName + " WHERE " + "(select not exists(select repoName from " + soureceTableName + " where " + condition + " ))" + " ; DELETE FROM " + soureceTableName + " WHERE " + condition + " ;";
};

dbLib.runQuery = function (client, query) {
    client.query(query, function (err, result) {
        if (err)
            console.log(err, '----', query);
    });
};
exports.dbLib = dbLib;