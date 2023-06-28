const appRoot = require('app-root-path');

let _date = new Date(),
    _curYear = _date.getFullYear(),
    _curMonthIndex = _date.getMonth(),
    _curMonth = _curMonthIndex + 1,
    _curDate = _date.getDate(),
    _curMonthPadWithZero = _curMonth < 10 ? `0${_curMonth}` : _curMonth,
    _curDatePadWithZero = _curDate < 10 ? `0${_curDate}` : _curDate;



const _CONFIG = {
    "DIRECTORY": {
        "ROOT": appRoot,
        "WORKSPACE": `${appRoot}/workspace`,
        "CONFIG": `${appRoot}/config/`,
        "DIST": `${appRoot}/workspace/${_curYear}-${_curMonthPadWithZero}-${_curDatePadWithZero}`,
    },
    "MAX_NUM_OF_TAGS": 10
}

module.exports = _CONFIG;