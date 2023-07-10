const fs = require('fs');
const path = require('path');
const appRoot = require('app-root-path');
const simpleGit = require("simple-git");
const archiver = require('archiver');

const CONFIG = require(`${appRoot}/src/config/config`);
const Messenger = require(`${appRoot}/src/utils/messenger`);

class Workspace {
    _gitAuth = {
        username: undefined,
        token: undefined
    }
    _git;
    _allGitProjects;
    _backupResult;

    constructor() {
        let _self = this;
        if (!process.env.GIT_TOKEN) throw new Error('process.env.GIT_TOKEN is undefined!');
        if (!process.env.GIT_USERNAME) throw new Error('process.env.GIT_USERNAME is undefined!');
    }

    async init() {
        let _self = this;
        _self._git = {};
        _self._allGitProjects = [];
        _self._backupResult = {};
    }

    setGitAuth() {
        let _self = this;
        _self._gitAuth.username = process.env.GIT_USERNAME;
        _self._gitAuth.token = encodeURIComponent(process.env.GIT_TOKEN);
    }

    async initGit() {
        let _self = this;
        _self._git = simpleGit({
            progress({ method, stage, progress }) {
                Messenger.print(`GIT: ${method} ${stage} stage ${progress}% complete`, true);
            }
        });
    }

    async setupWorkspace() {
        Messenger.openClose('WORKSPACE:SETUP WORK SPACE');
        let _self = this,
            _workspaceLoc = CONFIG.DIRECTORY.WORKSPACE,
            _isWorkspaceExist = fs.existsSync(_workspaceLoc);

        if (_isWorkspaceExist) {
            await clearWorkspace();
        }
        await fs.promises.mkdir(_workspaceLoc);

        Messenger.openClose('/WORKSPACE:SETUP WORK SPACE');

        async function clearWorkspace() {
            let _workspaceFolderStat = await fs.promises.lstat(_workspaceLoc),
                _isDirectory = _workspaceFolderStat.isDirectory();
            if (_isDirectory) {
                try {
                    await fs.promises.rm(_workspaceLoc, { recursive: true });
                } catch ($err) {
                    Messenger.error('WORKSPACE:[CLEAR_WORKSPACE_FAIL]');
                }
            }
        }
    }

    async createDistFolder() {
        Messenger.openClose('WORKSPACE:SETUP DIST FOLDER');
        let _self = this,
            _workspaceLoc = CONFIG.DIRECTORY.WORKSPACE,
            _isWorkspaceExist = fs.existsSync(_workspaceLoc),
            _distFolderLoc = path.join(CONFIG.DIRECTORY.DIST, process.env.CURDATE),
            _sourceFolderLoc = path.join(_distFolderLoc, CONFIG.DIRECTORY.SOURCE),
            _zipFolderLoc = path.join(_distFolderLoc, CONFIG.DIRECTORY.ZIP);

        if (_isWorkspaceExist) {
            await fs.promises.mkdir(_distFolderLoc);
            await fs.promises.mkdir(_sourceFolderLoc);
            await fs.promises.mkdir(_zipFolderLoc);
        } else {
            throw new Error('WORKSPACE:[SETUP_DIST_FOLDER_FAIL]');
        }

        Messenger.openClose('/WORKSPACE:SETUP DIST FOLDER');
    }

    //---------------------------------------------------------------
    //------------------------------Start backup---------------------------------

    async createEachSourceFolder($allGitProjects) {
        let _self = this;
        _self._allGitProjects = $allGitProjects;

        for (let i = 0; i < _self._allGitProjects.length; i++) {
            const _repo = _self._allGitProjects[i];
            await fs.promises.mkdir(path.join(CONFIG.DIRECTORY.DIST, process.env.CURDATE, CONFIG.DIRECTORY.SOURCE, _repo.name));
        }
    }

    async cloneAll() {
        Messenger.openClose('WORKSPACE:CLONE ALL REPO');
        let _self = this;
        for (let i = 0; i < _self._allGitProjects.length; i++) {
            const _repo = _self._allGitProjects[i];
            await _self.cloneRepo(_repo);
        }
        Messenger.openClose('/WORKSPACE:CLONE ALL REPO');
    }

    cloneRepo = async ($repoObj) => {
        let _self = this,
            _repoName = $repoObj.name,
            _repoPathWithoutHttps = removeHttpsPrefix($repoObj.path),
            _repoUsername = _self._gitAuth.username,
            _repoToken = _self._gitAuth.token,
            _cloneLocation = path.join(CONFIG.DIRECTORY.DIST, process.env.CURDATE, CONFIG.DIRECTORY.SOURCE,_repoName),
            _encodedGitUri = `https://${_repoUsername}:${_repoToken}@${_repoPathWithoutHttps}`;

        try {
            Messenger.print(`START CLONING ${_repoName}...`);
            await _self._git.clone(_encodedGitUri, _cloneLocation, { '--mirror': null, '--shared': null });
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

    //---------------------------------------------------------------
    //------------------------------Post backup action---------------------------------

    async zipAll() {
        Messenger.openClose('WORKSPACE:ZIP ALL REPO');
        let _self = this;
        for (let i = 0; i < _self._allGitProjects.length; i++) {
            let _repo = _self._allGitProjects[i],
                _repoWorkspacePath = path.join(CONFIG.DIRECTORY.DIST, process.env.CURDATE, CONFIG.DIRECTORY.SOURCE, _repo.name),
                _repoWorkspaceFolder

            try {
                _repoWorkspaceFolder = await fs.promises.readdir(_repoWorkspacePath)
            } catch ($err) {
                Messenger.error('ZIP_ALL_REPO_FAIL');
                return;
            }
            if (!_repoWorkspaceFolder) return;
            await _self.createZip(path.join(CONFIG.DIRECTORY.DIST, process.env.CURDATE, CONFIG.DIRECTORY.SOURCE), _repo.name);
        }
        Messenger.openClose('/WORKSPACE:ZIP ALL REPO');
    }

    createZip = async ($srcDir, $folder) => {
        let _curPath = path.join($srcDir, $folder),
            _zipPath = path.join(CONFIG.DIRECTORY.DIST, process.env.CURDATE, CONFIG.DIRECTORY.ZIP, $folder);

        return new Promise((resolve, reject) => {
            Messenger.print(`CREATING ZIP ... (${_curPath})`);

            let _output = fs.createWriteStream(_zipPath + '.zip');
            let _archive = archiver('zip', {
                zlib: { level: 9 } // set compression level
            });

            _output.on('close', () => {
                console.log(`${_archive.pointer()} total bytes`);
                Messenger.print[`WORKSPACE:FINISH ZIP: (${_curPath})`];
                resolve();
            });

            _archive.on('warning', (err) => {
                if (err.code === 'ENOENT') {
                    console.warn(err);
                } else {
                    reject(err);
                }
            });

            _archive.on('error', (err) => {
                Messenger.print(`WORKSPACE:[FAIL_TO_ZIP]`);
                reject(err);
            });

            _archive.pipe(_output);
            _archive.directory(_curPath, false);
            _archive.finalize();
        })
    }

    async updateAllRepoTag() {
        Messenger.openClose('WORKSPACE:UPDATE ALL REPO TAG');
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
        Messenger.openClose('/WORKSPACE:UPDATE ALL REPO TAG');

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
            return path.join(CONFIG.DIRECTORY.DIST, process.env.CURDATE, CONFIG.DIRECTORY.SOURCE, $repoName);
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

    getBackupResult() {
        let _self = this;
        return _self._backupResult;
    }
}

module.exports = Workspace;
