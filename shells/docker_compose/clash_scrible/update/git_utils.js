const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function runSubprocessCommand(command, cwd = null) {
    return new Promise((resolve, reject) => {
        const options = cwd ? { cwd } : {};
        let output = '';
        let errorOutput = '';

        const childProcess = exec(command, options);

        childProcess.stdout.on('data', (data) => {
            console.log(`Command output: ${data.trim()}`);
            output += data;
        });

        childProcess.stderr.on('data', (data) => {
            console.error(`Command error: ${data.trim()}`);
            errorOutput += data;
        });

        childProcess.on('close', (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                console.error(`Command exited with code ${code}`);
                reject(errorOutput.trim());
            }
        });
    });
}

async function runGitCommand(args, repoPath = null) {
    const commandStr = ['git', ...args].join(' ');
    if (repoPath) {
        console.log(`Running command in directory '${repoPath}': ${commandStr}`);
        
        // Add the directory to safe.directory if necessary
        try {
            await runSubprocessCommand(`git config --global --add safe.directory "${repoPath}"`, repoPath);
            console.log(`Added ${repoPath} to safe.directory`);
        } catch (error) {
            console.warn(`Failed to add ${repoPath} to safe.directory: ${error}`);
            // Continue execution even if this fails
        }
    } else {
        console.log(`Running command: ${commandStr}`);
    }
    return await runSubprocessCommand(commandStr, repoPath);
}

async function initializeGitAndCommit(dirPath) {
    try {
        const gitDir = path.join(dirPath, '.git');
        let isGitInitialized = fs.existsSync(gitDir) && fs.readdirSync(gitDir).length > 0;

        if (!isGitInitialized) {
            if (fs.existsSync(gitDir)) {
                fs.rmdirSync(gitDir, { recursive: true });
            }
            console.log(`Initializing git repository in ${dirPath}...`);
            await runGitCommand(['init'], dirPath);
        }

        // Check if there are any changes to commit
        const status = await runGitCommand(['status', '--porcelain'], dirPath);
        if (status.trim() !== '') {
            await runGitCommand(['add', '.'], dirPath);
            try {
                await runGitCommand(['commit', '-m', 'Initial commit'], dirPath);
                console.log(`Changes committed in ${dirPath}`);
            } catch (commitError) {
                console.log(`No changes to commit in ${dirPath}`);
            }
        } else {
            console.log(`No changes to commit in ${dirPath}`);
        }

        const lastCommitTime = await getLastCommitTime(dirPath);
        console.log(`Last commit time for ${dirPath}: ${lastCommitTime}`);

        return lastCommitTime || new Date(0); // Return epoch time if no commits
    } catch (error) {
        console.error(`Error initializing git and committing in ${dirPath}:`, error);
        return new Date(0); // Return epoch time on error
    }
}

async function getLastCommitTime(repoPath) {
    try {
        const hasCommits = await runGitCommand(['rev-parse', '--verify', 'HEAD'], repoPath)
            .then(() => true)
            .catch(() => false);

        if (!hasCommits) {
            console.log(`No commits found in ${repoPath}`);
            return null;
        }

        const result = await runGitCommand(['log', '-1', '--format=%cd'], repoPath);
        return new Date(result.trim());
    } catch (error) {
        console.error('Error getting last commit time:', error);
        return null;
    }
}

async function compareDirectories(dir1, dir2) {
    try {
        const time1 = await initializeGitAndCommit(dir1);
        const time2 = await initializeGitAndCommit(dir2);

        const timeDiff = time1 - time2;

        if (timeDiff > 0) {
            return { newerDir: dir1, olderDir: dir2, timeDifference: timeDiff };
        } else if (timeDiff < 0) {
            return { newerDir: dir2, olderDir: dir1, timeDifference: -timeDiff };
        } else {
            return { newerDir: null, olderDir: null, timeDifference: 0 };
        }
    } catch (error) {
        console.error('Error comparing directories:', error);
        throw error;
    }
}

function fetchUpdates(localRepoPath) {
    console.log("Fetching updates from remote...");
    return runGitCommand(['fetch'], localRepoPath);
}

function getLatestLocalTag(localRepoPath) {
    return runGitCommand(['describe', '--tags', '--abbrev=0'], localRepoPath);
}

function getLatestRemoteTag(gitRepoUrl) {
    return runGitCommand(['ls-remote', '--tags', gitRepoUrl]);
}

function pullUpdates(localRepoPath) {
    console.log("Pulling latest changes...");
    return runGitCommand(['pull'], localRepoPath);
}

function getReleaseList(gitRepoUrl) {
    console.log(`Fetching release list from ${gitRepoUrl}...`);
    return runGitCommand(['ls-remote', '--tags', gitRepoUrl])
        .then(remoteTags => {
            if (remoteTags) {
                return remoteTags.split('\n')
                    .filter(line => line.includes('refs/tags'))
                    .map(line => line.split('/').pop());
            } else {
                console.log("No releases (tags) found in the repository.");
                return [];
            }
        });
}

function fetchRemoteUpdates(localRepoPath) {
    console.log("Fetching remote updates...");
    return runGitCommand(['fetch'], localRepoPath);
}

async function checkForRemoteUpdates(localRepoPath) {
    await fetchRemoteUpdates(localRepoPath);
    const status = await runGitCommand(['status', '-uno'], localRepoPath);
    return status.includes("behind");
}

async function forceUpdateRepo(localRepoPath) {
    const gitCommands = [
        "git stash",
        "git fetch --all",
        "git reset --hard origin/main",
        "git pull --force"
    ];

    for (const command of gitCommands) {
        console.log(`Executing command: ${command}`);
        try {
            const result = await runSubprocessCommand(command, localRepoPath);
            console.log(result);
        } catch (error) {
            console.log(`Failed to execute: ${command}`);
            break;
        }
    }
}

async function cloneRepository(gitRepoUrl, localPath) {
    console.log(`Cloning repository from ${gitRepoUrl} to ${localPath}...`);
    if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
    }
    try {
        await runGitCommand(['clone', gitRepoUrl, '.'], localPath);
        console.log('Repository cloned successfully');
    } catch (error) {
        console.error('Error cloning repository:', error);
        throw error;
    }
}

async function ensureRepositoryCloned(gitRepoUrl, localPath) {
    if (!fs.existsSync(localPath) || fs.readdirSync(localPath).length === 0) {
        console.log(`Cloning repository to ${localPath}`);
        await cloneRepository(gitRepoUrl, localPath);
    } else {
        console.log(`Updating repository at ${localPath}`);
        await fetchRemoteUpdates(localPath);
        await forceUpdateRepo(localPath);
    }
}

module.exports = {
    runSubprocessCommand,
    runGitCommand,
    cloneRepository,  // 添加这个新函数到导出
    fetchUpdates,
    getLatestLocalTag,
    getLatestRemoteTag,
    pullUpdates,
    getReleaseList,
    fetchRemoteUpdates,
    checkForRemoteUpdates,
    forceUpdateRepo,
    getLastCommitTime,
    initializeGitAndCommit,
    compareDirectories,
    ensureRepositoryCloned
};

// Example usage
if (require.main === module) {
    const GIT_REPO_URL = 'http://git.local.12gm.com:5021/adminroot/clash_subscribe.git';
    const LOCAL_REPO_PATH = './clash_subscribe';

    (async () => {
        await cloneRepository(GIT_REPO_URL, LOCAL_REPO_PATH);
        await checkForNewVersion(GIT_REPO_URL, LOCAL_REPO_PATH);
        const releaseList = await getReleaseList(GIT_REPO_URL);
        console.log(`Releases found: ${releaseList}`);
    })();
}