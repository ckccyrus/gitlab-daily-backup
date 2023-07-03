const appRoot = require('app-root-path');

const GitBackupController = require(`${appRoot}/src/controller/gitBackup`);
const Messenger = require(`${appRoot}/src/utils/messenger`);


function getArgvValue($argv) {
    let _index = process.argv.indexOf($argv);
    return (_index === -1) ? null : process.argv[_index + 1];
}

function checkArgv() {
    let _git_path = getArgvValue('GIT_PATH'),
        _git_username = getArgvValue('GIT_USERNAME'),
        _git_token = getArgvValue('GIT_TOKEN'),
        _curDate = getArgvValue('CURDATE');

    if (!_git_path || !_git_username || !_git_token || !_curDate) {
        throw (`Missing required argument:`);
    }

    process.env.GIT_PATH = _git_path;
    process.env.GIT_USERNAME = _git_username;
    process.env.GIT_TOKEN = _git_token;
    process.env.CURDATE = _curDate;
}

async function main() {
    // console.log('DEBUG: process.env', process.env);
    Messenger.openClose('MAIN')

    try {
        checkArgv();
        let _gitBackupController = new GitBackupController();
        await _gitBackupController.init();
        await _gitBackupController.startBackup();
        await _gitBackupController.postBackupAction();
    } catch (e) {
        process.exitCode = 1;
        throw new Error(e);
    }


    Messenger.openClose('/MAIN')
}

main();
