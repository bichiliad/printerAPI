var express = require('express')
  , app = express();

var https = require('https')
  , cheerio = require('cheerio');

// The cache currently only caches one page, but eventually there 
// may be calls to other CMU resources.
var url = "https://clusters.andrew.cmu.edu/printerstats/"
var cache = {};
var cache_ttl = 10*1000; // 30 seconds

app.configure(function() {
    app.use(allowCrossDomain);
    app.use(handleErrors);
});



// CORS middleware
function allowCrossDomain(req, res, next) {
  res.header('Access-Control-Allow-Origin', "*");
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  next();
}

// Error handling middleware
function handleErrors(err, req, res, next){
  console.error(err.stack);
  res.send(500, 'Something broke! You should let Salem know.');
}

function calculateTTL(timestamp) {
  return cache_ttl - (Date.now() - timestamp);
}

// Utility function that downloads a URL and invokes
// callback with the data. Caches the response with a ttl 
// defined above. 
function download(url, callback) {
  if(cache[url] 
        && cache[url].timestamp 
        && (Date.now() - cache[url].timestamp) <= cache_ttl) {
    console.log("Cache hit");

    callback(cache[url].body, calculateTTL(cache[url].timestamp));
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
        callback(data, calculateTTL(Date.now()));

      });
    }).on("error", function() {
      callback(null, -1);
    });
  }

}

// Returns a JSON representation of a given table row. 
//    @$   - Cheerio selector
//    @row - the row to parse.
function toJson($, row) {
  var t = {};
  t.name        = $($(row).find("td")[0]).text().trim();
  t.icon        = $($(row).find("td")[1]).find("img").attr("src").trim();
  t.message     = $($(row).find("td")[2]).text().trim();
  t.status      = $($(row).find("td")[3]).text().trim();
  t.timestring  = $($(row).find("td")[5]).html().replace("&nbsp;"," ").trim();
  t.trays       = $($(row).find("td")[4]).find("font").map(function(i,e){
    return $(e).text();
  });
  t.ready = readyStatus(t.icon, t.status);
  t.error = (!t.ready ? (t.status === "" ? t.message : t.status) : "");

  return t;
}

// Determines if a printer is ready to print or not.
//    @icon   - the icon displayed on the CMU website
//    @status - the status string of the printer.
function readyStatus(icon, status) {
  return (icon.toLowerCase() === "go.gif")
      || (status.toLowerCase().indexOf("ready to print") != -1);
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
  else console.log("Error parsing data: data was undefined.");  
  return null;
}

// Printer endpoint.
app.get('/printers', function(req, res) {

  download(url, function(data, ttl){
    var response = {};
    var printers =  parse(data);

    // If we got data, add it and the cache ttl to the payload
    if(printers) {
      response.printers = printers
      response.ttl = ttl;
      res.send(response);
    }
    // We have problems, and we best let people know it.
    else {
      res.send(500, {error: "The request failed. You should probably let Salem know."});
    }
  });
});

// Health check
app.get('/ping', function(req, res) {
  res.send("pong");
});

// Start 'er up.
app.listen(3000);
console.log('Listening on port 3000');