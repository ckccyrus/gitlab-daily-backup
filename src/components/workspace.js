const fs = require('fs');
const path = require('path');
const appRoot = require('app-root-path');
const simpleGit = require("simple-git");
const archiver = require('archiver');

const CONFIG = require(`${appRoot}/src/config/config`);
const Messenger = require(`${appRoot}/src/utils/messenger`);

class Workspace {
    _CONST = {
        'GIT_TOKEN': process.env.GIT_TOKEN,
        'GIT_USERNAME': process.env.GIT_USERNAME
    };
    _gitAuth = {
        username: undefined,
        token: undefined
    }
    _git;
    _allGitProjects;
    _backupResult;

    constructor() {
        let _self = this;
        if (!_self._CONST.GIT_TOKEN) throw new Error('process.env.GIT_TOKEN is undefined!');
        if (!_self._CONST.GIT_USERNAME) throw new Error('process.env.GIT_USERNAME is undefined!');
    }

    async init() {
        let _self = this;
        _self.setGitAuth();
        await _self.initGit();
        await _self.setupWorkspace();
        await _self.setDistFolder();
    }

    setGitAuth = () => {
        let _self = this;
        _self._gitAuth.username = _self._CONST.GIT_USERNAME;
        _self._gitAuth.token = encodeURIComponent(_self._CONST.GIT_TOKEN);
    }

    initGit = async () => {
        let _self = this;
        _self._git = simpleGit({
            progress({ method, stage, progress }) {
                Messenger.print(`GIT: ${method} ${stage} stage ${progress}% complete`, true);
            }
        });
    }

    setupWorkspace = async () => {
        Messenger.openClose('SETUP WORK SPACE');
        let _self = this,
            _workspaceLoc = CONFIG.DIRECTORY.WORKSPACE,
            _isWorkspaceExist = fs.existsSync(_workspaceLoc);

        if (_isWorkspaceExist) {
            await clearWorkspace();
        }
        await fs.promises.mkdir(_workspaceLoc);

        Messenger.openClose('/SETUP WORK SPACE');

        async function clearWorkspace() {
            let _workspaceFolderStat = await fs.promises.lstat(_workspaceLoc),
                _isDirectory = _workspaceFolderStat.isDirectory();
            if (_isDirectory) {
                try {
                    await fs.promises.rm(_workspaceLoc, { recursive: true });
                } catch ($err) {
                    Messenger.error('[CLEAR_WORKSPACE_FAIL]');
                }
            }
        }
    }

    setDistFolder = async () => {
        Messenger.openClose('SETUP DIST FOLDER');
        let _self = this,
            _workspaceLoc = CONFIG.DIRECTORY.WORKSPACE,
            _isWorkspaceExist = fs.existsSync(_workspaceLoc),
            _distFolderLoc = CONFIG.DIRECTORY.DIST;

        if (_isWorkspaceExist) {
            await fs.promises.mkdir(_distFolderLoc);
        } else {
            throw new Error('[SETUP_DIST_FOLDER_FAIL]');
        }

        Messenger.openClose('/SETUP DIST FOLDER');
    }

    async createFolder($allGitProjects) {
        let _self = this;
        _self._allGitProjects = $allGitProjects;

        for (let i = 0; i < _self._allGitProjects.length; i++) {
            const _repo = _self._allGitProjects[i];
            await fs.promises.mkdir(path.join(CONFIG.DIRECTORY.DIST, _repo.name));
        }
    }

    async cloneAll() {
        Messenger.openClose('CLONE ALL REPO');
        let _self = this;
        for (let i = 0; i < _self._allGitProjects.length; i++) {
            const _repo = _self._allGitProjects[i];
            await _self.cloneRepo(_repo);
        }
        Messenger.openClose('/CLONE ALL REPO');
    }

    cloneRepo = async ($repoObj) => {
        let _self = this,
            _repoName = $repoObj.name,
            _repoPathWithoutHttps = removeHttpsPrefix($repoObj.path),
            _repoUsername = _self._gitAuth.username,
            _repoToken = _self._gitAuth.token,
            _cloneLocation = path.join(CONFIG.DIRECTORY.DIST, _repoName),
            _encodedGitUri = `https://${_repoUsername}:${_repoToken}@${_repoPathWithoutHttps}`;

        try {
            Messenger.print(`START CLONING ${_repoName}...`);
            await _self._git.clone(_encodedGitUri, _cloneLocation, { '--mirror': null });
            Messenger.print(`FINISH CLONING ${_repoName}...`);
        } catch ($err) {
            // can't clone the git, maybe deleted or no access right
            Messenger.error(`[CLONE_REPO_FAIL] REPO: ${_repoName} ERROR: ${$err}`, $err);
            let _cloneFolderStat = await fs.promises.lstat(_cloneLocation),
                _isDirectory = _cloneFolderStat.isDirectory();
            if (_isDirectory) fs.promises.rmdir(_cloneLocation, { recursive: true });
            throw new Error($err);
        }

        function removeHttpsPrefix($url) {
            return $url.replace('https://', '');
        }
    }

    async zipAll() {
        Messenger.openClose('ZIP ALL REPO');
        let _self = this;
        for (let i = 0; i < _self._allGitProjects.length; i++) {
            let _repo = _self._allGitProjects[i],
                _repoWorkspacePath = path.join(CONFIG.DIRECTORY.DIST, _repo.name),
                _repoWorkspaceFolder

            try {
                _repoWorkspaceFolder = await fs.promises.readdir(_repoWorkspacePath)
            } catch ($err) {
                Messenger.error('ZIP_ALL_REPO_FAIL');
                return;
            }
            if (!_repoWorkspaceFolder) return;
            await _self.createZip(CONFIG.DIRECTORY.DIST, _repo.name);
        }
        Messenger.openClose('/ZIP ALL REPO');
    }

    createZip = async ($srcDir, $folder) => {
        let myPromise = new Promise(async (resolve, reject) => {
            let _curPath = path.join($srcDir, $folder);
            Messenger.print(`CREATING ZIP ... (${_curPath})`);
            // let _totalSize = await _self.getFolderTotalSize(_curPath);
            // let _compressedSize = 0
            // let _progressTrackerInterval;
            // Messenger.print(`TOTAL SIZE: ${_totalSize}`);

            let _ws = fs.createWriteStream(_curPath + '.zip');
            let _archive = archiver('zip');

            _ws.on('close', function () {
                Messenger.print[`FINISHED ZIP: (${_curPath})`];
                // clearInterval(_progressTrackerInterval);
                resolve();
            });

            _archive.pipe(_ws);
            _archive.directory(_curPath, false);
            _archive.finalize();

            // _progressTrackerInterval = setInterval(progressTracker, 1000);

            // function progressTracker() {
            //     let _processed = _archive.pointer();
            //     Messenger.print(`ZIP PROGRESS (${_curPath}): ${(_processed / _totalSize * 100)}%`, true);
            // }
        });
        return myPromise;
    }

    async updateAllRepoTag() {
        Messenger.openClose('UPDATE ALL REPO TAG');
        let _self = this,
            _result = JSON.parse(JSON.stringify(_self._allGitProjects));

        for (let i = 0; i < _self._allGitProjects.length; i++) {
            let _repoObj = _self._allGitProjects[i],
                _repoName = _repoObj.name,
                _maxNumOfTags = CONFIG.MAX_NUM_OF_TAGS,
                _isZipCreated = checkZipCreated(_repoName);

            if (!_isZipCreated) continue;

            let _distPath = getDistLocation(_repoName),
                _allTagHashStr = await simpleGit(_distPath).raw('rev-list', '--tags', `--max-count=${_maxNumOfTags}`),
                _allTagHashArr = _allTagHashStr.split('\n').filter(($el) => $el !== ''),
                _allTagArr = await getAllTagByHashArr(_allTagHashArr, _repoName);
            _result[i].tags = _allTagArr;
        }
        _self._backupResult = _result;

        Messenger.print(JSON.stringify(_result, null, 4))
        Messenger.openClose('/UPDATE ALL REPO TAG');

        async function getAllTagByHashArr($allTagHashArr, $repoName) {
            let _allTagArr = [];
            for (let i = 0; i < $allTagHashArr.length; i++) {
                let _tagHash = $allTagHashArr[i],
                    _distPath = getDistLocation($repoName),
                    _tagName = '';
                try {
                    _tagName = await simpleGit(_distPath).raw('describe', '--tags', `${_tagHash}`);
                    _allTagArr[i] = _tagName.replace("\n", "");
                } catch ($e) {
                    // cannot retrieve the tag, if the repo only contains < CONFIG.MAX_NUM_OF_TAGS (e.g. only contains 1 tag), the _allTagHashStr array will contain commit hash that is not a tag, error will catch here 
                    continue;
                }
            }
            return _allTagArr;
        }

        function getDistLocation($repoName) {
            return path.join(CONFIG.DIRECTORY.DIST, $repoName);
        }

        async function checkZipCreated($repoName) {
            const _workspaceLocation = getDistLocation($repoName);
            let _isCreated = false;
            try {
                await fs.promises.readdir(_workspaceLocation)
                _isCreated = true;
            } catch ($err) {
                Messenger.error(`ZIP IS NOT YET CREATED FOR ${$repoName}, TAG CREATION ABORTED`);
            }
            return _isCreated;
        }
    }

    async removeAllClonedFolder() {
        Messenger.openClose('REMOVE ALL CLONE FOLDER');
        let _self = this;
        for (let i = 0; i < _self._allGitProjects.length; i++) {
            let _repo = _self._allGitProjects[i],
                _repoName = _repo.name,
                _repoWorkspacePath = path.join(CONFIG.DIRECTORY.DIST, _repoName),
                _repoWorkspaceFolder;

            try {
                _repoWorkspaceFolder = await fs.promises.readdir(_repoWorkspacePath)
            } catch ($err) {
                Messenger.error('ZIP_ALL_REPO_FAIL');
                return;
            }

            if (!_repoWorkspaceFolder) return;
            await fs.promises.rm(_repoWorkspacePath, { recursive: true, force: true });
        }

        Messenger.openClose('/REMOVE ALL CLONE FOLDER');
    }

    getBackupResult() {
        let _self = this;
        return _self._backupResult;
    }
}

module.exports = Workspace;
