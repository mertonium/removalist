var couchapp = require('couchapp')
  , path = require('path')
  ;

ddoc =
  { _id:'_design/removalist'
  , rewrites :
    [ {from:"/", to:'pages/index.html'}
    , {from:"/api/csv", to:'_list/csv/all'}
    , {from:"/api/headers", to:'_list/array/headers', query: {group: true}}
    , {from:"/api/rows", to:'_view/all'}
    , {from:"/api", to:'../../'}
    , {from:"/api/*", to:'../../*'}
    , {from:"/*", to:'*'}
    ]
  }
  ;

ddoc.views = {
  /**
   * A simple map function mocking _all, but allows usage with lists etc.
   */
  all: {
    map: function(doc) {
      emit(doc.id, doc);
    }
  },
  headers: {
    map: function(doc) {
      var keys = [];
      for (var key in doc) {
        emit(key, 1);        
      }
    },
    reduce: "_sum"
  }
};

ddoc.lists = {
  /**
   * Generates a CSV from all the rows in the view.
   *
   * Takes in a url encoded array of headers as an argument. You can
   * generate this by querying /_list/urlencode/headers. Pass it in
   * as the headers get parameter, e.g.: ?headers=%5B%22_id%22%2C%22_rev%5D
   *
   * @author Max Ogden
   */
  csv: function(head, req) {  
    if ('headers' in req.query) {
      var headers = JSON.parse(unescape(req.query.headers));

      var row, sep = '\n', headerSent = false, startedOutput = false;

      start({"headers":{"Content-Type" : "text/csv; charset=utf-8"}});
      send('"' + headers.join('","') + '"\n');
      while (row = getRow()) {
        for (var header in headers) {
          if (row.value[headers[header]]) {
            if (startedOutput) send(",");
            var value = row.value[headers[header]];
            if (typeof(value) == "object") value = JSON.stringify(value);
            if (typeof(value) == "string") value = value.replace(/\"/g, '""');
            send("\"" + value + "\"");
          } else {
            if (startedOutput) send(",");
          } 
          startedOutput = true;
        }
        startedOutput = false;
        send('\n');
      }
    } else {
      send("You must pass in the urlencoded headers you wish to build the CSV from. Query /_list/urlencode/headers?group=true");
    }
  },
  /**
   * Returns an array of the view keys 
   *
   * @author Max Ogden
   */
  array: function(head, req) {
    start({"headers":{"Content-Type" : "application/json"}});
    if ('callback' in req.query) send(req.query['callback'] + "(");

    var headers = [];
    while (row = getRow()) {
      headers.push(row.key);
    }
    send(JSON.stringify(headers));

    if ('callback' in req.query) send(")");
  }
}

ddoc.validate_doc_update = function (newDoc, oldDoc, userCtx) {
  if (newDoc._deleted === true && userCtx.roles.indexOf('_admin') === -1) {
    throw "Only admin can delete documents on this database.";
  }
};

couchapp.loadAttachments(ddoc, path.join(__dirname, 'attachments'));

module.exports = ddoc;