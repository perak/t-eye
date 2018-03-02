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


### Debug mode

If you pass `--debug` switch, then you can navigate your browser to t-eye's address:port and you'll get minimal UI for testing your configuration file.


## Configuration file

Example **config.json**

```json
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
- Argument `type` is one of the types returned by `typeOf()` 


Example **request from client**:

```json
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

```html
<!doctype html>
<html>
  <body>

    <textarea id="message" style="width: 100%; height: 200px;">{
      "command": "",
      "args": {
      }
    }
    </textarea>

    <br />

    <button type="button" onclick="sendMessage()">Send</button>

    <br />

    <div id="console" style="background: black; color: lime; font-family: Courier New, Courier, monospace; height: 500px; overflow: auto;"></div>

    <script>
      var ws = new WebSocket('ws://localhost:1234', 'echo-protocol');
      function sendMessage() {
        var message = document.getElementById('message').value;
        ws.send(message);
      }
      ws.addEventListener("message", function(e) {
        var msg = JSON.parse(e.data);
        var consoleDiv = document.getElementById('console');
        var color = "inherit";
        if(msg.status == "error") color = "red";
        consoleDiv.innerHTML += '<br /><span style="color: ' + color + ';">' + msg.msg + '</span>';
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
      });
    </script>
  </body>
</html>
```


## Full config file format

In the root of the config object you can add special key named `terminal_eye` with additional settings:

```json
{
  "terminal_eye": {
    "port": 1234,
    "ssl": false,
    "ssl_key": "/path/to/privkey.pem",
    "ssl_cert": "/path/to/fullchain.pem",
    "default_force_uid": 0,
    "default_force_gid": 0
  },

  ...

}
```

- `port` integer, default `1234`. Override default port. Note: port given via command line `--port` switch have precedence over this one.

- `ssl` bool, default `false`. If t-eye is exposed directly to host port (not behind reverse proxy e.g. nginx) then you still can run it via SSL.

- `ssl_key` if `ssl: true` this is full path to file containing private key issued by SSL CA (for example: `/etc/letsencrypt/live/example.com/privkey.pem`).

- `ssl_cert` if `ssl: true` this is full path to file containing SSL certificate  (for example: `/etc/letsencrypt/live/example.com/fullchain.pem`).

- `default_force_uid` try running commands as specified user id.

- `default_force_gid` try running commands as specified group id.



That's it.
Enjoy! :)
