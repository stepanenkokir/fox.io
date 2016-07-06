var global = require('./global');

class ChatClient {
    constructor(params) {
        this.canvas = global.canvas;
        this.socket = global.socket;
        this.mobile = global.mobile;
        this.player = global.player;
        var self = this;
        this.commands = {};
        var input = document.getElementById('chatInput');
        input.addEventListener('keypress', this.sendChat.bind(this));
        input.addEventListener('keyup', function(key) {
            input = document.getElementById('chatInput');
            key = key.which || key.keyCode;
            if (key === global.KEY_ESC) {
                input.value = '';
                self.canvas.cv.focus();
            }
        });
        global.chatClient = this;
    }

    // TODO: Break out many of these GameControls into separate classes.

    registerFunctions() {
        var self = this;
        this.registerCommand('ping', 'Проверка связи с сервером.', function () {
            self.checkLatency();
        });

        this.registerCommand('dark', 'Темный фон.', function () {
            self.toggleDarkMode();
        });

        this.registerCommand('border', 'Отображение границы карты.', function () {
            self.toggleBorder();
        });
        
        this.registerCommand('mass', 'Отображение всех игроков.', function () {
            self.toggleMass();
        });

        this.registerCommand('help', 'Информация о командах в чате.', function () {
            self.printHelp();
        });

        this.registerCommand('login', 'Зайти как администратор.', function (args) {
            self.socket.emit('pass', args);
        });

        this.registerCommand('kick', 'Отключить игрока (только для администратора)', function (args) {
            self.socket.emit('kick', args);
        });
        global.chatClient = this;
    }

    // Chat box implementation for the users.
    addChatLine(name, message, me) {
        if (this.mobile) {
            return;
        }
        var newline = document.createElement('li');

        // Colours the chat input correctly.
        newline.className = (me) ? 'me' : 'friend';
        newline.innerHTML = '<b>' + ((name.length < 1) ? 'Безымянный' : name) + '</b>: ' + message;

        this.appendMessage(newline);
    }

    // Chat box implementation for the system.
    addSystemLine(message) {
        if (this.mobile) {
            return;
        }
        var newline = document.createElement('li');

        // Colours the chat input correctly.
        newline.className = 'system';
        newline.innerHTML = message;

        // Append messages to the logs.
        this.appendMessage(newline);
    }

    // Places the message DOM node into the chat box.
    appendMessage(node) {
        if (this.mobile) {
            return;
        }
        var chatList = document.getElementById('chatList');
        if (chatList.childNodes.length > 10) {
            chatList.removeChild(chatList.childNodes[0]);
        }
        chatList.appendChild(node);
    }

    // Sends a message or executes a command on the click of enter.
    sendChat(key) {
        var commands = this.commands,
            input = document.getElementById('chatInput');

        key = key.which || key.keyCode;

        if (key === global.KEY_ENTER) {
            var text = input.value.replace(/(<([^>]+)>)/ig,'');
            if (text !== '') {

                // Chat command.
                if (text.indexOf('-') === 0) {
                    var args = text.substring(1).split(' ');
                    if (commands[args[0]]) {
                        commands[args[0]].callback(args.slice(1));
                    } else {
                        this.addSystemLine('Неизвестная команда: ' + text + ', Наберите -help для подробной информации.');
                    }

                // Allows for regular messages to be sent to the server.
                } else {
                    this.socket.emit('playerChat', { sender: this.player.name, message: text });
                    this.addChatLine(this.player.name, text, true);
                }

                // Resets input.
                input.value = '';
                this.canvas.cv.focus();
            }
        }
    }

    // Allows for addition of commands.
    registerCommand(name, description, callback) {
        this.commands[name] = {
            description: description,
            callback: callback
        };
    }

    // Allows help to print the list of all the commands and their descriptions.
    printHelp() {
        var commands = this.commands;
        for (var cmd in commands) {
            if (commands.hasOwnProperty(cmd)) {
                this.addSystemLine('-' + cmd + ': ' + commands[cmd].description);
            }
        }
    }

    checkLatency() {
        // Ping.
        global.startPingTime = Date.now();
        this.socket.emit('pingg');
    }

    toggleDarkMode() {
        var LIGHT = '#f2fbff',
            DARK = '#181818';
        var LINELIGHT = '#000000',
            LINEDARK = '#ffffff';

        if (global.backgroundColor === LIGHT) {
            global.backgroundColor = DARK;
            global.lineColor = LINEDARK;
            this.addSystemLine('Включен темный фон.');
        } else {
            global.backgroundColor = LIGHT;
            global.lineColor = LINELIGHT;
            this.addSystemLine('Отключен темный фон.');
        }
    }

    toggleBorder() {
        if (!global.borderDraw) {
            global.borderDraw = true;
            this.addSystemLine('Отображается граница карты.');
        } else {
            global.borderDraw = false;
            this.addSystemLine('Не отображается граница карты.');
        }
    }

    toggleMass() {
        if (global.toggleMassState === 0) {
            global.toggleMassState = 1;
            this.addSystemLine('Просмотр игроков включен.');
        } else {
            global.toggleMassState = 0;
            this.addSystemLine('Просмотр игроков отключен.');
        }
    }

}

module.exports = ChatClient;
