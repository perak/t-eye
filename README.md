# T-Eye Server

T-Eye (Terminal Eye) Server allows you to execute predefined commands (shell scripts) at remote server via websocket. Output is streamed to client and you can display real time terminal output in the browser.

Client can execute only predefined commands. You can define multiple commands and multiple arguments for each command.

## Install

```
npm install -g t-eye
```


## Usage

Start t-eye server:

```
t-eye --config path/to/config/file.json [--debug] [--port 1234]
```
  
Command line arguments:

- `--config` path to config file where commands are defined.

- `--debug` or `-d` run terminal-eye in debug mode. Navigating browser here will show page where you can manually send commands and see output.

- `--port=1234` or `-p 1234` specify port. Default is 1234.


## Configuration file

Example **config.json**

```
{
  "list_dir": {
    "script": "/root/list.sh",
    "args": [
      {
        "name": "my_arg",
        "type": "string",
        "required": true,
        "regex": "^(.+)/([^/]+)$"
      }
    ]
  }
}
```

In this example:

- `list_dir` is command name (alias).
- `script` is path to script to be executed.
- `args` is array of arguments expected for this command. Argument must have `name`.
- For each argument, you can specify `type`, `required` and `regex` (not mandatory).
- Argument `type` is one of types returned by `typeOf()` 


Example **request from client**:

```
{ 
  "command": "list_dir",
  "args": { 
    "my_arg": "/tmp/"
  }
}

```

Command will execute `/root/list.sh /tmp/`


## Client side

In short: you need to open websocket conection, send command (JSON string) and listen for output.

Example HTML:

```
<!DOCTYPE html>
<html>
<head>
    <title></title>
</head>

<body>
    <textarea id="message"></textarea><br />

    <button onclick="sendMessage()" type="button">Send</button>

    <div id="consoleDiv" style="background: black; color: lime; font-family: Courier New, Courier, monospace; height: 500px; overflow: auto;">
    </div>
    
    <script>
      var ws = new WebSocket('ws://localhost:1234', 'echo-protocol');
      
      ws.addEventListener("message", function(e) {
        var msg = e.data;
        var consoleDiv = document.getElementById('consoleDiv');
        consoleDiv.innerHTML += '<br />' + msg;
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
      });

      function sendMessage() {
        var message = document.getElementById('message').value;
        ws.send(message);
      }
    </script>
</body>
</html>
```

That's it.
Enjoy! :)
