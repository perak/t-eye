#!/usr/bin/env node

var argv = require("optimist").argv;
var fs = require("fs");
var https = require("https");
var http = require("http");
var ws = require("websocket").server;
var spawn = require("child_process").spawn;
var es = require("event-stream");

var confFile = argv.config || "";

// ---
// Load config file
// ---

if(!confFile) {
  console.log("t-eye configuration file is not specified. Expecting --config command line switch with path to json file.");
  return;
}

var confString = "";
try {
  confString = fs.readFileSync(confFile);
} catch(err) {
  console.log("Error opening t-eye configuration file \"" + confFile + "\".");
  return;
}

// ---
// Parse config file
// ---

var conf = {};
try {
  conf = JSON.parse(confString);
} catch (err) {
  console.log("There has been an error parsing t-eye json configuration file.", err);
  return;
}

// ---
// read arguments and configuration
// ---

var eyeConf = conf.terminal_eye ? conf.terminal_eye : {};

var debugMode = !!argv.debug || !!argv.d;
var port = argv.port || argv.p || eyeConf.port || 1234;

var defaultForceUID = eyeConf.default_force_uid || 0;
var defaultForceGID = eyeConf.default_force_gid || 0;
var httpServer = (eyeConf.ssl) ? https : http;


var processRequest = function(request, response) {
  if(debugMode) {
    response.writeHead(200, {"Content-type": "text/html"});
    var page = "<!doctype html>\n<html>\n<body>\n";
    page = page + "<textarea id=\"message\" style=\"width: 100%; height: 200px;\">{\n\t\"command\": \"\",\n\t\"args\": {\n\t}\n}\n</textarea><br />\n";
    page = page + "<button type=\"button\" onclick=\"sendMessage()\">Send</button><br />\n";
    page = page + "<div id=\"console\" style=\"background: black; color: lime; font-family: Courier New, Courier, monospace; height: 500px; overflow: auto;\"></div>\n";
    page = page + "<script>\n";
    page = page + "  var ws = new WebSocket('ws://" + request.headers.host + "', 'echo-protocol');\n";
    page = page + "  function sendMessage() {\n";
    page = page + "    var message = document.getElementById('message').value;\n";
    page = page + "    ws.send(message);\n";
    page = page + "  }\n";
    page = page + "  ws.addEventListener(\"message\", function(e) {\n";
    page = page + "    var msg = JSON.parse(e.data);\n";
    page = page + "    var consoleDiv = document.getElementById('console');\n";
    page = page + "    var color = \"inherit\";\n";
    page = page + "    if(msg.status == \"error\") color = \"red\";\n";
    page = page + "    consoleDiv.innerHTML += '<br /><span style=\"color: ' + color + ';\">' + msg.msg + '</span>';\n";
    page = page + "    consoleDiv.scrollTop = consoleDiv.scrollHeight;\n";
    page = page + "  });\n";
    page = page + "</script>\n";
    page = page + "</body>\n</html>\n";
    response.end(page);
  } else {
    response.writeHead(200, {"Content-type": "text/plain"});
    response.end("");
  }
};

var server = null;

if(eyeConf.ssl) {
  server = httpServer.createServer({
    key: fs.readFileSync(eyeConf.ssl_key),
    cert: fs.readFileSync(eyeConf.ssl_cert)    
  }, processRequest);
} else {
  server = httpServer.createServer(processRequest);  
}

server.listen(port, function() {
    console.log((new Date()) + " Terminal-Eye is listening on port " + port + (debugMode ? " (in debug mode)" : ""));
});


wsServer = new ws({
    httpServer: server,
    autoAcceptConnections: false
});

wsServer.on("request", function(r) {
    var connection = r.accept("echo-protocol", r.origin);

    var sendMessage = function(connection, status, msg) {
      connection.send(JSON.stringify({
        status: status,
        msg: msg
      }));
    };

    connection.on("message", function(message) {
        var msgString = message.utf8Data;

        var msgObject = {};
        try {
          msgObject = JSON.parse(msgString);
        } catch(e) {
          sendMessage(connection, "error", "Invalid arguments received. Valid JSON string expected.");
          return;
        }

        if(!msgObject.command) {
          sendMessage(connection, "error", "Invalid arguments received. Command not specified.");
          return;
        }

        var command = conf[msgObject.command];
        if(!command) {
          sendMessage(connection, "error", "Invalid arguments received. Unknown command \"" + msgObject.command + "\".");
          return;
        }

        var cmd = command.script;
        var forceUID = command.force_uid || defaultForceUID;
        var forceGID = command.force_gid || defaultForceGID;

        var args = [];
        if(command.args && command.args.length) {
          for(var i = 0; i < command.args.length; i++) {
            var argName = command.args[i].name;
            var argType = command.args[i].type;
            var argRequired = command.args[i].required || false;
            var argRegex = command.args[i].regex;

            if(!argName) {
              sendMessage(connection, "error", "Invalid configuration. Argument [" + i + "] must have a name.");
              return;              
            }

            var arg = msgObject.args ? msgObject.args[argName] : null;
            if(arg) {
              if(argType && typeof(arg) != argType) {
                sendMessage(connection, "error", "Invalid type of argument \"" + argName + "\". Expecting \"" + argType + "\" got \"" + typeof(arg) + "\".");
                return;
              }

              if(argRegex) {
                var rex = new RegExp(argRegex);
                if(!rex.test(arg)) {
                  sendMessage(connection, "error", "Invalid argument \"" + argName + "\". RegExp match failed.");
                  return;
                }
              }
              args.push(arg);
            } else {
              if(argRequired) {
                sendMessage(connection, "error", "Required argument \"" + argName + "\" is missing.");
                return;
              }
            }
          }
        }

        var fullCmd = cmd;
        for(var i = 0; i < args.length; i++) {
          fullCmd = fullCmd + " ";
          fullCmd = fullCmd + args[i];
        }
        sendMessage(connection, "running", "Executing: " + msgObject.command);

        var spawnOptions = {};
        if(forceUID) {
          spawnOptions.uid = forceUID;
        }
        if(forceGID) {
          spawnOptions.gid = forceGID;
        }

        var child = null;
        try {
          child = spawn(cmd, args, spawnOptions);
        } catch(err) {
          console.log("Error executing \"" + fullCmd + "\"", err);
          sendMessage(connection, "error", "Error executing \"" + msgObject.command + "\"");
        }

        if(child) {
          child.on("error", function(err) {
            console.log("Error executing \"" + fullCmd + "\"", err);
            sendMessage(connection, "error", "Error executing \"" + msgObject.command + "\"");
          });

          child.on("close", function(code, signal) {
            if(code == 0) {
              sendMessage(connection, "success", "");
            } else {
              console.log("Error executing \"" + fullCmd + "\"");
              sendMessage(connection, "error", "Error executing \"" + msgObject.command + "\". Exit code: " + code);
            }
          });

          child.stdout.pipe(es.split()).pipe(es.mapSync(function(line) {
            if(line) {
              sendMessage(connection, "running", "" + line);
            }
          }));

          child.stderr.pipe(es.split()).pipe(es.mapSync(function(line) {
            if(line) {
              sendMessage(connection, "error", "" + line);
            }
          }));
        }
    });
});
