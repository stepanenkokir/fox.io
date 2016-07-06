/* jslint node: true */

'use strict';

var cfg = require('../../../config.json');

exports.validNick = function(nickname) {
    var regex = /^\w*$/;
    return regex.exec(nickname) !== null;
};

// determine mass from radius of circle
exports.massToRadius = function (mass) {
    return 4 + Math.sqrt(mass) * 6;
};


// overwrite Math.log function
exports.log = (function () {
    var log = Math.log;
    return function (n, base) {
        return log(n) / (base ? log(base) : 1);
    };
})();

// get the Euclidean distance between the edges of two shapes
exports.getDistance = function (p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) - p1.radius - p2.radius;
};

exports.randomInRange = function (from, to) {
    return Math.floor(Math.random() * (to - from)) + from;
};

// generate a random position within the field of play
exports.randomPosition = function (radius) {
    return {
        x: exports.randomInRange(radius, cfg.gameWidth - radius),
        y: exports.randomInRange(radius, cfg.gameHeight - radius)
    };
};

exports.randomRadius = function (a,b) {
    return {
        x: exports.randomInRange(a, b),
        y: exports.randomInRange(a, b)
    };
};

exports.randomPositionXY = function (radius) {
    return {
        x: exports.randomInRange(radius.x, cfg.gameWidth - radius.x),
        y: exports.randomInRange(radius.y, cfg.gameHeight - radius.y)
    };
};

exports.randomPositionNonColl = function (bArr, radius, delta) {
    var myPoint = { x:0, y:0 };
    for (;;)
    {
        myPoint.x = exports.randomInRange(radius.x, cfg.gameWidth - radius.x);
        myPoint.y = exports.randomInRange(radius.y, cfg.gameHeight - radius.y); 
        
        var col = exports.collision(bArr, myPoint, delta);
        if (Math.sqrt(Math.pow((myPoint.x -  cfg.startPositions.x),2) + Math.pow((myPoint.y - cfg.startPositions.y),2))<(cfg.maxRadius*2))
            col = true;
                 
        if (!col)
            return myPoint;
    }
};

exports.randomPositionNonColl2 = function (bArr1, bArr2, radius, delta) {
    var myPoint = { x:0, y:0 };
    for (;;)
    {
        myPoint.x = exports.randomInRange(radius.x, cfg.gameWidth - radius.x);
        myPoint.y = exports.randomInRange(radius.y, cfg.gameHeight - radius.y); 
        var col1 = exports.collision(bArr1, myPoint, delta);
            
        if (Math.sqrt(Math.pow((myPoint.x -  cfg.startPositions.x),2) + Math.pow((myPoint.y - cfg.startPositions.y),2))<2000)
            col1 = true;
        var col2 = false;
        for (var i=0;i<bArr2.length;i++)
        {        
            var RES = Math.sqrt(Math.pow((myPoint.x - bArr2[i].x),2) + Math.pow((myPoint.y - bArr2[i].y),2));
            if (RES<2000)        
                col2=true;
        }            
        if ((!col1)&&(!col2))
            return myPoint;
    }
};


exports.startPosition = function () {
    return {
        x: cfg.startPositions.x,
        y: cfg.startPositions.y
    };
};

exports.uniformPosition = function(points, radius) {
    var bestCandidate, maxDistance = 0;
    var numberOfCandidates = 10;

    if (points.length === 0) {
        return exports.randomPosition(radius);
    }

    // Generate the cadidates
    for (var ci = 0; ci < numberOfCandidates; ci++) {
        var minDistance = Infinity;
        var candidate = exports.randomPosition(radius);
        candidate.radius = radius;

        for (var pi = 0; pi < points.length; pi++) {
            var distance = exports.getDistance(candidate, points[pi]);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }

        if (minDistance > maxDistance) {
            bestCandidate = candidate;
            maxDistance = minDistance;
        } else {
            return exports.randomPosition(radius);
        }
    }

    return bestCandidate;
};

exports.collision = function(bArr, testPoint, delta)
{
    for (var i=0;i<bArr.length;i++)
    {        
        var RES = (Math.pow((testPoint.x - bArr[i].x),2) / Math.pow((bArr[i].radiusX),2)) + 
                  (Math.pow((testPoint.y - bArr[i].y),2) / Math.pow((bArr[i].radiusY),2));
        if (RES<delta)        
            return true;
    }    
    return false;
};

exports.findIndex = function(arr, id) {
    var len = arr.length;

    while (len--) {
        if (arr[len].id === id) {
            return len;
        }
    }

    return -1;
};

exports.randomColor = function() {
    var color = '#' + ('00000' + (Math.random() * (1 << 24) | 0).toString(16)).slice(-6);
    var c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    var r = (parseInt(c[1], 16) - 32) > 0 ? (parseInt(c[1], 16) - 32) : 0;
    var g = (parseInt(c[2], 16) - 32) > 0 ? (parseInt(c[2], 16) - 32) : 0;
    var b = (parseInt(c[3], 16) - 32) > 0 ? (parseInt(c[3], 16) - 32) : 0;

    return {
        fill: color,
        border: '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
    };
};
