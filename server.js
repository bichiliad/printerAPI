var express = require('express')
  , app = express();

var https = require('https')
  , request = require('superagent')
  , cheerio = require('cheerio');

var url = "https://clusters.andrew.cmu.edu/printerstats/"
var cache = {};
var cache_ttl = 30*1000; // 30 seconds

// Utility function that downloads a URL and invokes
// callback with the data.
function download(url, callback) {
  if(cache[url] 
        && cache[url].timestamp 
        && (Date.now() - cache[url].timestamp) <= cache_ttl) {
    console.log("Cache hit");
    callback(cache[url].body);
  }

  else {
    https.get(url, function(res) {
      var data = "";
      res.on('data', function (chunk) {
        data += chunk;
      });
      res.on("end", function() {

        // We have the data, stick it in the cache and run callback.
        console.log("Populating cache");
        cache[url] = {
          timestamp : Date.now(),
          body : data
        }
        callback(data);

      });
    }).on("error", function() {
      callback(null);
    });
  }

}

// Returns a JSON representation of a given table row. 
//    @$   - Cheerio selector
//    @row - the row to parse.
function toJson($, row) {
  var t = {};
  t.name        = $($(row).find("td")[0]).html();
  t.icon        = $($(row).find("td")[1]).find("img").attr("src");
  t.message     = $($(row).find("td")[2]).html();
  t.status      = $($(row).find("td")[3]).html();
  t.timestring  = $($(row).find("td")[5]).html();
  t.trays       = $($(row).find("td")[4]).find("font").map(function(i,e){
    return $(e).html();
  });

  return t;
}

function parse(data) {
  if (data) {
    // Load data
    var $ = cheerio.load(data);

    // Find all the rows with data in them
    var t = $(".epi-rowEven, .epi-rowOdd").map(function(i,e){
      // Extract data from rows.
      return toJson($, e);
    });
    return t;
  }
  else console.log("error");  
  return null;
}

// Test
app.get('/printers', function(req, res){

  download(url, function(data){
    var response = parse(data);
    if(response) 
      res.send(response);
    else
      res.send(500, "The request failed. You should probably let Salem know.");
  });

});


app.listen(3000);
console.log('Listening on port 3000');