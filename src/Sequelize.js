require(__dirname + "/SequelizeHelper")
require(__dirname + "/SequelizeTable")

Sequelize = function(database, username, password) {
  this.config = {
    database: database,
    username: username,
    password: password
  }
  this.tables = {}
}

var classMethods = {
  STRING: 'VARCHAR(255)',
  TEXT: 'VARCHAR(4000)',
  INTEGER: 'INT',
  DATE: 'DATETIME',
  sqlQueryFor: function(command, values) {
    var query = null
    switch(command) {
      case 'create':
        query = "CREATE TABLE IF NOT EXISTS %{table} (%{fields})"
        break
      case 'drop':
        query = "DROP TABLE IF EXISTS %{table}"
        break
      case 'select':
        values.fields = values.fields || "*"
        query = "SELECT %{fields} FROM %{table}"
        if(values.where) query += " WHERE %{where}"
        if(values.order) query += " ORDER BY %{order}"
        if(values.group) query += " GROUP BY %{group}"
        if(values.limit) {
          if(values.offset) query += " LIMIT %{offset}, %{limit}"
          else query += " LIMIT %{limit}"
        }
        break
      case 'insert':
        query = "INSERT INTO %{table} (%{fields}) VALUES (%{values})"
        break
      case 'update':
        query = "UPDATE %{table} SET %{values} WHERE id = %{id}"
        break
      case 'delete':
        query = "DELETE FROM %{table} WHERE id = %{id} LIMIT 1"
        break
    }
    
    return SequelizeHelper.evaluateTemplate(query, values)
  }
}

Sequelize.prototype = {
  get tableNames() {
    var result = []
    SequelizeHelper.Hash.keys(this.tables).forEach(function(tableName) {
      result.push(SequelizeHelper.SQL.asTableName(tableName))
    })
    return result
  },
  
  define: function(name, attributes) {
    attributes.createdAt = 'DATETIME NOT NULL'
    attributes.updatedAt = 'DATETIME NOT NULL'
    
    var table = new SequelizeTable(this, SequelizeHelper.SQL.asTableName(name), attributes)
    table.attributes = attributes

    this.tables[name] = {constructor: table, attributes: attributes}

    table.sequelize = this
    return table
  },
  
  query: function(queryString, callback) {
    var fields = []
    var values = []
    var self = this
    var connection = require(__dirname+"/../lib/nodejs-mysql-native/client").createTCPClient()
    
    connection.auto_prepare = true
    connection
      .auth(this.config.database, this.config.username, this.config.password)
      .addListener('authorized', function() {
        SequelizeHelper.log("Executing the query: " + queryString)
        connection
          .execute(queryString)
          .addListener('row', function(r){ values.push(r) })
          .addListener('field', function(f){ fields.push(f)})
          .addListener('end', function() {
            if(callback) {
              var result = []
              values.forEach(function(valueArray) {
                var mapping = {}
                for(var i = 0; i < fields.length; i++)
                  mapping[fields[i].name] = valueArray[i]
                result.push(mapping)
              })
              callback(result)
            }
          })
        connection.close()
      })
  }
}

SequelizeHelper.Hash.forEach(classMethods, function(method, methodName) {
  Sequelize[methodName] = method
})