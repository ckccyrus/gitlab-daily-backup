const axios = require('axios');
const appRoot = require('app-root-path');
const CONFIG = require(`${appRoot}/src/config/config`);

class GitlabApiService {
    _allGitProjectsData;
    _allGitProjects;

    constructor() {
        let _self = this;
        if (!process.env.GIT_PATH) throw new Error('process.env.GIT_PATH is undefined!');
        if (!process.env.GIT_TOKEN) throw new Error('process.env.GIT_TOKEN is undefined!');
    }

    async init() {
        let _self = this;
        await _self.getAllGitProjectsData();
    }

    getAllGitProjectsData = async () => {
        let _self = this,
            _url = `${process.env.GIT_PATH}${CONFIG.GITLAB_ALL_PROJECT_SUFFIX}`,
            _headers = {
                "PRIVATE-TOKEN": process.env.GIT_TOKEN
            },
            _result = await axios.get(_url, { headers: _headers });

        _self._allGitProjectsData = _result.data;
    }

    getAllGitProjects() {
        let _self = this,
            _allGitProjects = _self._allGitProjectsData.map(($project) => ({
                "name": $project.path_with_namespace.replace('/', '__'),
                "path": $project.http_url_to_repo
            }));

        return _allGitProjects;
    }
}

module.exports = GitlabApiService;