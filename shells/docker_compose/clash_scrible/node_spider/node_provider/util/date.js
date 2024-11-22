
'use strict';

class Date_ {
    randomMillisecond(x = 0, y = 1500) {
        return Math.floor(Math.random() * (y - x + 1)) + x;
    }

}

Date_.toString = () => '[class Date]';
module.exports = new Date_();
