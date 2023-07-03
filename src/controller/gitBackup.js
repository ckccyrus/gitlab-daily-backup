const fs = require('fs');
const appRoot = require('app-root-path');

const CONFIG = require(`${appRoot}/src/config/config`);
const Messenger = require(`${appRoot}/src/utils/messenger`);
const Workspace = require(`${appRoot}/src/components/workspace`);
const GitlabApiService = require(`${appRoot}/src/services/gitlab-api`);

class GitBackupController {
    _gitlabApiService;
    _gitService;
    _allGitProjects;

    constructor() { }

    async init() {
        let _self = this;
        await _self.initGitlabService();
        await _self.initWorkspace();
    }

    initGitlabService = async () => {
        Messenger.openClose('GITLAB API SERVICE CREATE');
        let _self = this;
        _self._gitlabApiService = new GitlabApiService();
        await _self._gitlabApiService.init();
        _self._allGitProjects = _self._gitlabApiService.getAllGitProjects();
        Messenger.openClose('/GITLAB API SERVICE CREATE');
    }

    initWorkspace = async () => {
        Messenger.openClose('INIT WORKSPACE');
        let _self = this;
        _self._workspace = new Workspace();
        await _self._workspace.init();
        Messenger.openClose('/INIT WORKSPACE');
    }

    async startBackup() {
        Messenger.openClose('START BACKUP');
        let _self = this;
        await _self._workspace.createEachSourceFolder(_self._allGitProjects);
        await _self._workspace.cloneAll();
        Messenger.openClose('/START BACKUP');
    }

    async postBackupAction() {
        Messenger.openClose('POST BACKUP ACTION');
        let _self = this;
        await _self._workspace.zipAll();
        await _self._workspace.updateAllRepoTag();
        // await _self._workspace.removeAllClonedFolder();
        let _codeBackupResultStr = JSON.stringify(_self._workspace.getBackupResult());
        await fs.promises.writeFile(`${CONFIG.DIRECTORY.DIST}/${process.env.CURDATE}/${CONFIG.DIRECTORY.SOURCE}/result.json`, _codeBackupResultStr)
        Messenger.openClose('/POST BACKUP ACTION');
    }
}

module.exports = GitBackupController;