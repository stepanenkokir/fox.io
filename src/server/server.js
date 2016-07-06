/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var SAT = require('sat');

var STARTTIMER = 0;
var gameTimer = 0;
var indexWorkingFox = -1;

// Import game settings.
var c = require('../../config.json');

// Import utilities.
var util = require('./lib/util');

// Import quadtree.
var quadtree = require('simple-quadtree');

var tree = quadtree(0, 0, c.gameWidth, c.gameHeight);

var users = [];

var trees = [];
var foxes = [];

var sockets = {};

var leaderboard = [];
var leaderboardChanged = false;

var V = SAT.Vector;
var C = SAT.Circle;

app.use(express.static(__dirname + '/../client'));

function addFox(toAdd) {
    var radius = {x:15, y:15};
    while (toAdd--) {        
        var position = util.randomPositionNonColl2(trees,foxes,radius,2);                           
        foxes.push({
            // Make IDs unique.
            id: foxes.length,
            x: position.x,
            y: position.y,
            radius: 15,            
            hue: (foxes.length*360/c.maxFoxes)
        });
      //  console.log("Fox "+foxes.length +" Pos = "+position.x+":"+position.y);
    }
    console.log("Add  "+ foxes.length+" foxes!!");
    STARTTIMER = new Date().getTime();
    console.log("GAME TIMER START NOW!");
    gameTimer = 0;
}

function addTrees(toAdd) {
    while (toAdd--) {              
        var radius = util.randomRadius(c.minRadius, c.maxRadius);        
        var position = util.randomPositionNonColl(trees,radius,1.1);        
        trees.push({
            id: trees.length,
            x: position.x,
            y: position.y,
            radiusX: radius.x,
            radiusY: radius.y,           
            fill: Math.round(Math.random() * 360),
            stroke:  Math.round(Math.random() * 360),
            strokeWidth: Math.round(Math.random() * 10)
        });
    }
    console.log("Add Trees = "+trees.length);
}

function findFoxes(player)
{
    for (var i=0;i<foxes.length;i++)
    { 
        var RES = Math.sqrt(Math.pow((player.x - foxes[i].x),2) + Math.pow((player.y - foxes[i].y),2));        
        
          if ((RES<((i==indexWorkingFox)?50:25))&&(player.findFox[i]===0))
        {            
            player.findFox[i]=  (new Date().getTime() - player.startTime)/1000;
            console.log("Fox N "+i+" finds " + player.name+" at "+player.findFox[i]);  
            return i;                
        }        
    }
    return -1;
}

function testWIN(player)
{
    var res = true;
     for (var i=0;i<foxes.length;i++)
    { 
        if (player.findFox[i]===0)
            return false;
    }    
    return true;
}

function movePlayer(player) {
    var x =0,y =0;
    
    var target = {
        x: player.target.x,
        y: player.target.y,  
        x1: player.target.x1,
        y1: player.target.y1    
    };   
    var newPlayer = {x:0, y:0};  

    var dist = Math.sqrt(Math.pow(target.y, 2) + Math.pow(target.x, 2));
    var deg = Math.atan2(target.y, target.x);
    if (deg<0)
            deg+=2*Math.PI;
    
    var deg1 = Math.atan2((foxes[indexWorkingFox].y - player.y), (foxes[indexWorkingFox].x - player.x));
    var dist1 = Math.sqrt(Math.pow((foxes[indexWorkingFox].y - player.y),2)+ Math.pow((foxes[indexWorkingFox].x - player.x),2));
    if (deg1<0)
            deg1+=2*Math.PI;
    
    var deg2 = Math.atan2(target.y1, target.x1);
    if (deg2<0)
            deg2+=2*Math.PI;
    var slowDown = 2;    


    var deltaA = Math.abs(deg1 - deg2);
    var deltaInvA =Math.abs(Math.PI - deltaA);
    var AlphaChannel = 0.02;

    if (deltaA<c.minAn)
        AlphaChannel = (c.minAn-deltaA)/c.minAn;
    if (deltaA > 2*Math.PI-c.minAn)
        AlphaChannel =(c.minAn-(2*Math.PI-deltaA))/c.minAn;
    if (deltaInvA<c.minAn)
        AlphaChannel = (c.minAn-deltaInvA)/(c.minAn+2); 
/*
        double delta = fabs(alfa - tecAngle);
        double deltaInv =fabs(M_PI - fabs(alfa - tecAngle));
        double minAn = 0.5;

        colorPie.setAlphaF(0.02);
        if (delta<minAn)
            AlphaChannel = (minAn-delta)/minAn;
        if (delta > 2*M_PI-minAn)
            AlphaChannel =(minAn-(2*M_PI-delta))/minAn;


        if (deltaInv<minAn)
            AlphaChannel = (minAn-deltaInv)/(minAn+2); 
  */  
    var deltaY = player.speed * Math.sin(deg)/ slowDown;
    var deltaX = player.speed * Math.cos(deg)/ slowDown;

    if (dist < (50 + player.radius)) {
        deltaY *= dist / (50 + player.radius);
        deltaX *= dist / (50 + player.radius);
    }
    
    if (!isNaN(deltaY)) {
       newPlayer.y =  player.y + deltaY;
    }
    if (!isNaN(deltaX)) {        
        newPlayer.x =  player.x + deltaX;
    }
    
    var borderCalc = player.radius / 3;
    if (player.x > c.gameWidth - borderCalc) {
        newPlayer.x = c.gameWidth - borderCalc;
    }
    if (player.y > c.gameHeight - borderCalc) {
        newPlayer.y = c.gameHeight - borderCalc;
    }
    if (player.x < borderCalc) {
        newPlayer.x = borderCalc;
    }
    if (player.y < borderCalc) {
        newPlayer.y = borderCalc;
    }
    
    if ((!util.collision(trees,newPlayer,1.02))||(player.godMode))
    {        
        player.x = newPlayer.x;
        player.y = newPlayer.y;
        player.direct = deg2;
        player.alfa = AlphaChannel;
        player.nearZone = (dist1<500);
    }
    
   
        
    
}

io.on('connection', function (socket) {
    console.log('A user connected!', socket.handshake.query.type);
    var type = socket.handshake.query.type;      
    var radius = 10;
    var position = util.startPosition();
    var speed = 6.25;
    var godMode = false;

    console.log("Add player coordinates:"+position.x+":"+position.y);
  //  console.log("Add player coordinates:"+position.x+":"+position.y);
    
    var timeTotal = 0;
    if(type === 'player') {        
     timeTotal = 10000;
    }

    var currentPlayer = {          
        id: socket.id,
        x: position.x,
        y: position.y, 
        godMode : godMode,
        startTime: new Date().getTime(),
        timeTotal: 10000,
        hue: Math.round(Math.random() * 360),
        type: type,
        direct : 0, 
        alfa:0.02,
        speed: speed,
        nearZone:false,
        findFox: [],
        lastHeartbeat: new Date().getTime(),
        target: {
            x: 0,
            y: 0,
            x1: 0,
            y1: 0
        }
    };

    socket.on('gotit', function (player) {
        console.log('[INFO] Player ' + player.name + ' connecting!');

        if (util.findIndex(users, player.id) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else if (!util.validNick(player.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {
            
            sockets[player.id] = socket;
            player.x = position.x;
            player.y = position.y;
            player.target.x = 0;
            player.target.y = 0;
            player.target.x1 = 0;
            player.target.y1 = 0;
            player.startTime = new Date().getTime(); 
            player.timeTotal = 10000; 
            player.speed = speed; 
            for (var indx=0;indx<foxes.length;indx++)
                player.findFox.push(0);
            player.direct = 0; 
            player.godMode = godMode;
            player.alfa = 0.02;
            player.nearZone = false;
            player.radius =   radius;       
            player.hue = Math.round(Math.random() * 360);
            currentPlayer = player;
            currentPlayer.lastHeartbeat = new Date().getTime();
            users.push(currentPlayer);

            console.log('[INFO] Player ' + player.name + ' connected at '+ player.startTime.toLocaleString()+ '!');
            io.emit('playerJoin', { name: currentPlayer.name });

            socket.emit('gameSetup', {
                gameWidth: c.gameWidth,
                gameHeight: c.gameHeight
            });
            console.log('Total players: ' + users.length);
        }

    });

    /*socket.on('ping', function () {
        socket.emit('pong');
    });
    */
     socket.on('pingg', function () {
        socket.emit('pongg');
    });

    socket.on('windowResized', function (data) {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', function () {
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        socket.emit('welcome', currentPlayer);
        
        console.log('[INFO] Игрок ' + currentPlayer.name + ' начал игру!');
    });

    socket.on('disconnect', function () {
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        console.log('[INFO] Игрок ' + currentPlayer.name + ' потерял связб с сервером!');

        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', function(data) {        
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        if (c.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message.substring(0,35)});
    });

    socket.on('pass', function(data) {
        if (data[0] === c.adminPass) {
            console.log('[ADMIN] ' + currentPlayer.name + ' зашел в систему как администратор!');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' зашел в систему как администратор!');
            currentPlayer.admin = true;
            currentPlayer.godMode = true;
        } else {
            console.log('[ADMIN] ' + currentPlayer.name + ' попытался войти в систему с неверным паролем.');
            socket.emit('serverMSG', 'Неверный пароль администратора. ');
            // TODO: Actually log incorrect passwords.
        }
    });

    socket.on('kick', function(data) {
        if (currentPlayer.admin) {
            var reason = '';
            var worked = false;
            for (var e = 0; e < users.length; e++) {
                if (users[e].name === data[0] && !users[e].admin && !worked) {
                    if (data.length > 1) {
                        for (var f = 1; f < data.length; f++) {
                            if (f === data.length) {
                                reason = reason + data[f];
                            }
                            else {
                                reason = reason + data[f] + ' ';
                            }
                        }
                    }
                    if (reason !== '') {
                       console.log('[ADMIN] Игрок ' + users[e].name + ' отключен успешно администратором ' + currentPlayer.name + ' по причине ' + reason);
                    }
                    else {
                       console.log('[ADMIN] Игрок ' + users[e].name + ' отключен успешно администратором ' + currentPlayer.name);
                    }
                    socket.emit('serverMSG', 'Игрок ' + users[e].name + ' был отключен ' + currentPlayer.name);
                    sockets[users[e].id].emit('kick', reason);
                    sockets[users[e].id].disconnect();
                    users.splice(e, 1);
                    worked = true;
                }
            }
            if (!worked) {
                socket.emit('serverMSG', 'Не найден игрок с таким именем (или он - администратор).');
            }
        } else {
            console.log('[ADMIN] ' + currentPlayer.name + ' пытался удалить другого игрока не имея прав администратора.');
            socket.emit('serverMSG', 'У вас нет привелегий для этой команды.');
        }
    });

    // Heartbeat function, update everytime.
    socket.on('0', function(target) {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
                
    });

    socket.on('1', function() {
        console.log("press socket 1");
        
    });
    socket.on('2', function(virusCell) {
        
    });
});

function tickPlayer(currentPlayer) {
    if(currentPlayer.lastHeartbeat < new Date().getTime() - c.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Сеанс прерван после  ' + Math.floor(c.maxHeartbeatInterval/1000) + ' секунд отсутствия активности.');
        sockets[currentPlayer.id].disconnect();
    }

    movePlayer(currentPlayer);
    var ffox = findFoxes(currentPlayer);    
    if ( ffox!=-1 )
    {
          sockets[currentPlayer.id].emit('serverSendPlayerChatLocal', { sender: currentPlayer.name, message: "Я нашел лису ("+(ffox+1)+")" });     
        if (testWIN(currentPlayer))
        {
            currentPlayer.timeTotal = new Date().getTime() - currentPlayer.startTime;
            sockets[currentPlayer.id].emit('serverSendPlayerChatLocal', { sender: currentPlayer.name, message: "УРА! Я нашел всех лис!" });     
            //WINNER
        }            
    }
       
        
    
    if(typeof(currentPlayer.speed) == "undefined")
            currentPlayer.speed = 6.25;
    
}

function moveloop() {
    for (var i = 0; i < users.length; i++) {
        tickPlayer(users[i]);
    }
    
}

function gameloop() {
    
    gameTimer = Math.floor((new Date().getTime() - STARTTIMER)/1000) * c.coeffTime;
    if (gameTimer>=9000)
        STARTTIMER = 0;
    
  //  var hh=Math.floor((gameTimer/3600))%24;
    var mm=Math.floor((gameTimer/60)%60);
   // var ss=gameTimer%60;

    indexWorkingFox = mm % foxes.length;
    
  //  console.log("Timer = "+gameTimer + " fox = " + indexWorkingFox+ "  "+hh+":"+mm+":"+ss);
    if (users.length > 0) {
        leaderboardChanged = true;
    }
}

function sendUpdates() {
    users.forEach( function(u) {
        // center the view if x/y is undefined, this will happen for spectators
        u.x = u.x || c.gameWidth / 2;
        u.y = u.y || c.gameHeight / 2;

        var visibleTrees = trees
            .map(function(f) {
                if ( f.x+f.radiusX > u.x - u.screenWidth/2 - 20 &&
                    f.x-f.radiusX < u.x + u.screenWidth/2 + 20 &&
                    f.y+f.radiusY > u.y - u.screenHeight/2 - 20 &&
                    f.y-f.radiusY < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter(function(f) { return f; });
            
        var visibleFox = foxes
            .map(function(f) {
                if (( f.x+f.radius > u.x - u.screenWidth/2 - 20 &&
                    f.x-f.radius < u.x + u.screenWidth/2 + 20 &&
                    f.y+f.radius > u.y - u.screenHeight/2 - 20 &&
                    f.y-f.radius < u.y + u.screenHeight/2 + 20)&&
                (u.findFox[f.id]>0)) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleCells  = users
            .map(function(f) {
                if ( f.x+f.radius > u.x - u.screenWidth/2 - 20 &&
                    f.x-f.radius < u.x + u.screenWidth/2 + 20 &&
                    f.y+f.radius > u.y - u.screenHeight/2 - 20 &&
                       f.y-f.radius < u.y + u.screenHeight/2 + 20) {
                    if(f.id !== u.id) {
                        return {
                            id: f.id,
                            x: f.x,
                            y: f.y,
                            direct: f.direct,
                            timeTotal: f.timeTotal,
                            hue: f.hue,
                            name: f.name
                        };
                    } else {
                        return {                            
                            x: f.x,
                            y: f.y,
                            timeTotal: f.timeTotal,
                            direct: f.direct,
                            alfa: f.alfa,
                            hue: f.hue,
                            nearZone: f.nearZone
                        };
                    }
                }                
            })
            .filter(function(f) { return f; });

        sockets[u.id].emit('serverTellPlayerMove', visibleCells, visibleTrees, visibleFox);
        if (leaderboardChanged) {
            var foxUsers = [];

        foxUsers.push({
                    id: 0,
                    name: indexWorkingFox,
                    totalTime: gameTimer%60
                });

        for (var i = 0; i < foxes.length; i++) {            
                foxUsers.push({
                    id: i+1,
                    name: i+1,
                    totalTime: u.findFox[i]
                });
            
        }
        leaderboard = foxUsers;
            
            sockets[u.id].emit('leaderboard', {
                players: users.length,
                leaderboard: leaderboard
            });
        }
    });
    leaderboardChanged = false;
}

setInterval(moveloop, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / c.networkUpdateFactor);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1';
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || c.port;

var treesToAdd = c.maxTrees - trees.length;
if (treesToAdd > 0)
       addTrees(treesToAdd);    
addFox(c.maxFoxes);

if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
    http.listen( serverport, ipaddress, function() {
        console.log('[DEBUG] Listening on *:' + serverport);
    });
} else {
    http.listen( serverport, function() {
        console.log('[DEBUG] Listening on *:' + c.port);
    });
}
