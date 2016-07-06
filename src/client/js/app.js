var io = require('socket.io-client');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');
var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;


var debug = function(args) {
    if (console && console.log) {
        console.log(args);
    }
};

if ( /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) ) {
    global.mobile = true;
}

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0,25);
    global.playerType = type;

    global.screenWidth = window.innerWidth;
    global.screenHeight = window.innerHeight;

    document.getElementById('startMenuList').style.maxHeight = '0px';
    document.getElementById('gameField').style.opacity = 1;
    if (!socket) {
        socket = io({query:"type=" + type});
        setupSocket(socket);
    }
    if (!global.animLoopHandle)
        animloop();
    socket.emit('respawn');
    window.chat.socket = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function() {

    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btnS.onclick = function () {
        startGame('spectate');
    };

    btn.onclick = function () {

        // Checks if the nick is valid.
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame('player');
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');
    var instructions = document.getElementById('instructions');

    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == '300px') {
            settings.style.maxHeight = '0px';
        } else {
            settings.style.maxHeight = '300px';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// TODO: Break out into GameControls.

var playerConfig = {
    border: 3,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screenWidth / 2,
    y: global.screenHeight / 2,
    screenWidth: global.screenWidth,
    screenHeight: global.screenHeight,
    target: {x: global.screenWidth / 2, y: global.screenHeight / 2}
};
global.player = player;

var foxes = [];
var barriers = [];
var users = [];
var leaderboard = [];
var target = {x: player.x, y: player.y, x1: player.x1, y1: player.y1};
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = settings.toggleMass;

var c = window.canvas.cv;
var graph = c.getContext('2d');


$( "#feed" ).click(function() {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$( "#split" ).click(function() {
    socket.emit('2');
    window.canvas.reenviar = false;
});

// socket stuff.
function setupSocket(socket) {
    // Handle ping.
   /* socket.on('pong', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency1: ' + latency + 'ms');
        window.chat.addSystemLine('Ping1: ' + latency + 'ms');
        global.startPingTime = Date.now();
    });
    */
    socket.on('pongg', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
        global.startPingTime = Date.now();
    });

    // Handle error.
    socket.on('connect_failed', function () {
        socket.close();
        global.disconnected = true;
    });

    socket.on('disconnect', function () {
        socket.close();
        global.disconnected = true;
    });

    // Handle connection.
    socket.on('welcome', function (playerSettings) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screenWidth;
        player.screenHeight = global.screenHeight;
        player.target = window.canvas.target;
        global.player = player;
        window.chat.player = player;
        socket.emit('gotit', player);
        global.gameStart = true;
        debug('Начата сессия: ' + global.gameStart);
        window.chat.addSystemLine('Добро пожаловать!');
        window.chat.addSystemLine('Нажать <b>-help</b> для списка доступных команд.');
        if (global.mobile) {
            document.getElementById('gameField').removeChild(document.getElementById('chatbox'));
        }
		c.focus();
    });

    socket.on('gameSetup', function(data) {
        global.gameWidth = data.gameWidth;
        global.gameHeight = data.gameHeight;
        resize();
    });

    socket.on('playerDied', function (data) {
        window.chat.addSystemLine('{Сервер} - <b>' + (data.name.length < 1 ? 'Безымянный' : data.name) + '</b> погиб.');
    });

    socket.on('playerDisconnect', function (data) {
        window.chat.addSystemLine('{Сервер} - <b>' + (data.name.length < 1 ? 'Безымянный' : data.name) + '</b> пропала связь.');
    });

    socket.on('playerJoin', function (data) {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'Безымянный' : data.name) + '</b> подключился.');
    });

    socket.on('leaderboard', function (data) {
        leaderboard = data.leaderboard;
        var status = '<span class="title">ИНФОРМАЦИЯ</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            
            if(i===0)
            {                               
                 status += '<span class="me">Работает </span> <span style="font-size: larger; font-style:italic bold; color: hsl('+leaderboard[i].name*360/(leaderboard.length-1)+',100%,45%)">Лиса №'+ (leaderboard[i].name+1) + '</span> <span class="me">  Осталось ' + (60 - leaderboard[i].totalTime) + " секунд </span>";
                status += '<br />';          
                global.indexFox = leaderboard[i].name;
                global.totalFoxes = leaderboard.length-1;
            }
            else
                if (leaderboard[i].totalTime===0)
                    status += '<span style="font-size: larger; font-style:italic bold; color: hsl('+(i-1)*360/(leaderboard.length-1)+ ',100%,45%)"> Лиса №'+ leaderboard[i].name+ ":</span> Не обнаружена </span>";
                else
                    status += '<span style="font-size: larger; font-style:italic bold; color: hsl('+(i-1)*360/(leaderboard.length-1)+ ',100%,45%)"> Лиса №'+ leaderboard[i].name+ ":</span> обнаружена за "+ leaderboard[i].totalTime+" сек. </span>";

        }
        //status += '<br />Players: ' + data.players;
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });
    
    socket.on('serverSendPlayerChatLocal', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);       
        socket.emit('playerChat', data);        
    });
    

    // Handle movement.
    socket.on('serverTellPlayerMove', function (userData, treesList, foxList) {
        var playerData;
        for(var i =0; i< userData.length; i++) {
            if(typeof(userData[i].id) == "undefined") {
                playerData = userData[i];                
                global.indexID = i;
                i = userData.length;
                global.alfaCh = playerData.alfa;               
               // console.log("User coord = "+playerData.x+":"+playerData.y);
            }
        }
        if(global.playerType == 'player') {
            var xoffset = player.x - playerData.x;
            var yoffset = player.y - playerData.y;

            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.timeTotal = playerData.timeTotal;
            player.xoffset = isNaN(xoffset) ? 0 : xoffset;
            player.yoffset = isNaN(yoffset) ? 0 : yoffset;
        }
        users = userData;
        barriers = treesList;
        foxes = foxList;  
       // console.log("serverTellPlayerMove " + userData.length + " | "+ foxList.length + " | "+treesList.length);
    });

    // Death.
    socket.on('RIP', function () {
        global.gameStart = false;
        global.died = true;
        window.setTimeout(function() {
            document.getElementById('gameField').style.opacity = 0;
            document.getElementById('startMenuList').style.maxHeight = '1000px';
            global.died = false;
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (data) {
        global.gameStart = false;
        reason = data;
        global.kicked = true;
        socket.close();
    });

}

function drawEllipse(centerX, centerY, radiusX, radiusY, sides) {
    var theta = 0;
    var x = 0;
    var y = 0;

    graph.beginPath();

    for (var i = 0; i < sides; i++) {
        theta = i *2* Math.PI / sides;
        x = centerX + radiusX * Math.sin(theta);
        y = centerY + radiusY * Math.cos(theta);
        graph.lineTo(x, y);
    }

    graph.closePath();
    graph.stroke();
    graph.fill();
}

function drawFox(foxes) {
    graph.strokeStyle = 'hsl(' + foxes.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + foxes.hue + ', 100%, 50%)';
    graph.lineWidth = 1;
    drawEllipse(foxes.x - player.x + global.screenWidth / 2 +10,
               foxes.y - player.y + global.screenHeight / 2 +10 ,
               foxes.radius, foxes.radius, 6);
    graph.strokeText(foxes.id+1, foxes.x - player.x + global.screenWidth / 2 , foxes.y - player.y + global.screenHeight / 2 -7);
}

function drawBarriers(barrier) {
    graph.strokeStyle = 'hsla(' + barrier.stroke + ', 100%, 50%, 0.1)';
    graph.fillStyle = 'hsla(' + barrier.fill + ', 100%, 50%, 0.1)'; 
    graph.lineWidth = barrier.strokeWidth;
    drawEllipse(barrier.x - player.x + global.screenWidth / 2 +10,
               barrier.y - player.y + global.screenHeight / 2 + 10,
               barrier.radiusX,barrier.radiusY, 25);    
}

function drawMen(centerX,centerY, peleng, showPeleng)
{    
    var i;
    var theta = 0;
    var x = 0;
    var y = 0;
        
    graph.beginPath();
    for ( i = 0; i < 20; i++) {
        theta = (i / 20) * 2 * Math.PI;
        x = centerX + 1.5 * Math.cos(theta);
        y = centerY + 4 * Math.sin(theta);
        graph.lineTo(x, y);
    }
    graph.closePath();
    graph.stroke();
    graph.fill();
    
   graph.beginPath();
    for ( i = 0; i < 20; i++) {
        theta = (i / 20) * 2 * Math.PI;
        x = centerX + Math.cos(theta);
        y = (centerY-7) +  Math.sin(theta);
        graph.lineTo(x, y);
    }
    graph.closePath();
    graph.stroke();
    graph.fill();
    
    graph.lineWidth = 0.5;
    graph.beginPath();
    graph.moveTo(centerX+2, centerY+3);
    graph.lineTo(centerX+5,centerY+10);
    graph.moveTo(centerX-2, centerY+3);
    graph.lineTo(centerX-5,centerY+10);
    
        graph.moveTo(centerX-2, centerY-1);
        graph.lineTo(centerX+15*Math.cos(peleng),centerY+15*Math.sin(peleng));
        graph.moveTo(centerX+2, centerY-1);
        graph.lineTo(centerX+15*Math.cos(peleng),centerY+15*Math.sin(peleng));
    
    graph.closePath();
    graph.stroke();
    graph.fill();
    
    if (showPeleng>0)
    {
        graph.strokeStyle = 'hsl(' + global.indexFox*360/global.totalFoxes + ', 100%, 45%)';
        graph.fillStyle = 'hsla(' + global.indexFox*360/global.totalFoxes + ', 100%, 50%,'+global.alfaCh+')';
        graph.lineWidth = 0.01;
    
        graph.beginPath();
        graph.moveTo(centerX+15*Math.cos(peleng),centerY+15*Math.sin(peleng));
        if (showPeleng==1)
        {
            graph.lineTo(centerX+2500*Math.cos(peleng-0.01)-5,centerY+2500*Math.sin(peleng-0.01));
            graph.lineTo(centerX+2500*Math.cos(peleng+0.01)-5,centerY+2500*Math.sin(peleng+0.01));
        }
        if (showPeleng==2)
        {
            graph.lineTo(centerX+100*Math.cos(peleng-0.05)-5,centerY+100*Math.sin(peleng-0.05));
            graph.lineTo(centerX+100*Math.cos(peleng+0.05)-5,centerY+100*Math.sin(peleng+0.05));
        }
        graph.lineTo(centerX+15*Math.cos(peleng),centerY+15*Math.sin(peleng));
        graph.closePath();
        graph.stroke();
        graph.fill();
    }

}

function drawPlayers() {
    var start = {
        x: player.x - (global.screenWidth / 2),
        y: player.y - (global.screenHeight / 2)
    };


    for(var z=0; z<users.length; z++)
    {               
        var testMys = 0;
        var userCurrent = users[z];
        var circle = {
            x: userCurrent.x - start.x + 10,
            y: userCurrent.y - start.y + 10
        };
        
        graph.strokeStyle = 'hsl(' + userCurrent.hue + ', 100%, 45%)';
        graph.fillStyle = 'hsl(' + userCurrent.hue + ', 100%, 50%)';
        graph.lineWidth = playerConfig.border;
        
        if (z===global.indexID)
        {
            testMys=1;
            if (userCurrent.nearZone)
                testMys=2;
        }
        
        drawMen(circle.x, circle.y, userCurrent.direct,testMys);      
    }          
}

function drawgrid() {
     graph.lineWidth = 1;
     graph.strokeStyle = global.lineColor;
     graph.globalAlpha = 0.05;
     graph.beginPath();

    for (var x = global.xoffset - player.x; x < global.screenWidth; x += global.screenHeight / 20) {
        graph.moveTo(x, 0);
        graph.lineTo(x, global.screenHeight);
    }

    for (var y = global.yoffset - player.y ; y < global.screenHeight; y += global.screenHeight / 20) {
        graph.moveTo(0, y);
        graph.lineTo(global.screenWidth, y);
    }
    
  
    graph.stroke();
    graph.globalAlpha = 1;
}

function drawborder() {
    graph.lineWidth = 1;
    graph.strokeStyle = playerConfig.borderColor;

    // Left-vertical.
    if (player.x <= global.screenWidth/2) {
        graph.beginPath();
        graph.moveTo(global.screenWidth/2 - player.x, 0 ? player.y > global.screenHeight/2 : global.screenHeight/2 - player.y);
        graph.lineTo(global.screenWidth/2 - player.x, global.gameHeight + global.screenHeight/2 - player.y);
        graph.strokeStyle = global.lineColor;
        graph.stroke();
    }

    // Top-horizontal.
    if (player.y <= global.screenHeight/2) {
        graph.beginPath();
        graph.moveTo(0 ? player.x > global.screenWidth/2 : global.screenWidth/2 - player.x, global.screenHeight/2 - player.y);
        graph.lineTo(global.gameWidth + global.screenWidth/2 - player.x, global.screenHeight/2 - player.y);
        graph.strokeStyle = global.lineColor;
        graph.stroke();
    }

    // Right-vertical.
    if (global.gameWidth - player.x <= global.screenWidth/2) {
        graph.beginPath();
        graph.moveTo(global.gameWidth + global.screenWidth/2 - player.x,
                     global.screenHeight/2 - player.y);
        graph.lineTo(global.gameWidth + global.screenWidth/2 - player.x,
                     global.gameHeight + global.screenHeight/2 - player.y);
        graph.strokeStyle = global.lineColor;
        graph.stroke();
    }

    // Bottom-horizontal.
    if (global.gameHeight - player.y <= global.screenHeight/2) {
        graph.beginPath();
        graph.moveTo(global.gameWidth + global.screenWidth/2 - player.x,
                     global.gameHeight + global.screenHeight/2 - player.y);
        graph.lineTo(global.screenWidth/2 - player.x,
                     global.gameHeight + global.screenHeight/2 - player.y);
        graph.strokeStyle = global.lineColor;
        graph.stroke();
    }
}

window.requestAnimFrame = (function() {
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.msRequestAnimationFrame     ||
            function( callback ) {
                window.setTimeout(callback, 1000 / 60);
            };
})();

window.cancelAnimFrame = (function(handle) {
    return  window.cancelAnimationFrame     ||
            window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (global.died) {
        graph.fillStyle = '#424242';
        graph.fillRect(0, 0, global.screenWidth, global.screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        graph.fillText('Вы погибли!', global.screenWidth / 2, constant.screenHeight / 2);
    }
    else if (!global.disconnected) {
        if (global.gameStart) {
            graph.fillStyle = global.backgroundColor;
            graph.fillRect(0, 0, global.screenWidth, global.screenHeight);

            if (global.resize)
            {               
                global.resize = false;
            }

            drawgrid();            
            foxes.forEach(drawFox);            
            barriers.forEach(drawBarriers);
                        

            if (global.borderDraw) {
                drawborder();
            }

            drawPlayers();
            
            socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".

        } else {
            graph.fillStyle = '#333333';
            graph.fillRect(0, 0, global.screenWidth, global.screenHeight);

            graph.textAlign = 'center';
            graph.fillStyle = '#FFFFFF';
            graph.font = 'bold 30px sans-serif';
            graph.fillText('Game Over!', global.screenWidth / 2, global.screenHeight / 2);
        }
    } else {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, global.screenWidth, global.screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        if (global.kicked) {
            if (reason !== '') {
                graph.fillText('Вы были отключены:', global.screenWidth / 2, global.screenHeight / 2 - 20);
                graph.fillText(reason, global.screenWidth / 2, global.screenHeight / 2 + 20);
            }
            else {
                graph.fillText('Вы были отключены!', global.screenWidth / 2, global.screenHeight / 2);
            }
        }
        else {
              graph.fillText('Обрыв связи!', global.screenWidth / 2, global.screenHeight / 2);
        }
    }
}

window.addEventListener('resize', resize);

function resize() {  
 /* console.log("Resize1 !!! "+window.innerWidth+":"+window.innerHeight);
                 console.log(" || "+player.screenWidth+":"+player.screenHeight);
                 console.log(" || "+c.width+":"+c.height);
                 console.log(" || "+global.screenWidth+":"+global.screenHeight);
                 console.log(" || "+global.gameWidth+":"+global.gameHeight);
  */
    
    player.screenWidth = c.width = global.screenWidth = global.playerType == 'player' ? window.innerWidth : global.gameWidth;
    player.screenHeight = c.height = global.screenHeight = global.playerType == 'player' ? window.innerHeight : global.gameHeight;
    socket.emit('windowResized', { screenWidth: global.screenWidth, screenHeight: global.screenHeight });
    
}
