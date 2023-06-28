const axios = require('axios');

class GitlabApiService {
    _CONST = {
        'GITLAB_PATH': process.env.GIT_PATH,
        'GITLAB_TOKEN': process.env.GIT_TOKEN,
        'GET_ALL_PROJECT_SUFFIX': "/api/v4/projects"
    };
    _allGitProjectsData;
    _allGitProjects;

    constructor() {
        let _self = this;
        if (!_self._CONST.GITLAB_PATH) throw new Error('process.env.GIT_PATH is undefined!');
        if (!_self._CONST.GITLAB_TOKEN) throw new Error('process.env.GIT_TOKEN is undefined!');
    }

    async init() {
        let _self = this;
        await _self.getAllGitProjectsData();
    }

    getAllGitProjectsData = async () => {
        let _self = this,
            _url = `${_self._CONST.GITLAB_PATH}${_self._CONST.GET_ALL_PROJECT_SUFFIX}`,
            _headers = {
                "PRIVATE-TOKEN": _self._CONST.GITLAB_TOKEN
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