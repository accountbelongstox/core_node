// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const { execCmdResultText, pipeExecCmd } = require('#@commander');
const logger = require('#@logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Development Environments Management Controller
 * Provides API endpoints for managing development environments
 */

// Mock data for development environments
const mockDevEnvironments = [
    {
        id: 'env-node-1',
        name: 'Node.js Development',
        description: 'Node.js 18.x development environment with Express framework',
        type: 'local',
        status: 'running',
        resources: {
            cpu: 15.5,
            memory: 45.2,
            storage: 23.8,
            network: 2.1
        },
        tools: ['code-editor-1', 'debugger-1', 'testing-1'],
        ports: [3000, 8080, 9229],
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        lastAccessed: new Date().toISOString(),
        configuration: {
            language: 'javascript',
            framework: 'express',
            runtime: 'node-18',
            packages: ['express', 'jest', 'nodemon', 'eslint']
        }
    },
    {
        id: 'env-python-1',
        name: 'Python Development',
        description: 'Python 3.11 development environment with Flask framework',
        type: 'container',
        status: 'stopped',
        resources: {
            cpu: 0,
            memory: 0,
            storage: 12.3,
            network: 0
        },
        tools: ['code-editor-1'],
        ports: [5000, 8000],
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        lastAccessed: new Date(Date.now() - 3600000 * 6).toISOString(),
        configuration: {
            language: 'python',
            framework: 'flask',
            runtime: 'python-3.11',
            packages: ['flask', 'pytest', 'black', 'pylint']
        }
    },
    {
        id: 'env-docker-1',
        name: 'Docker Development',
        description: 'Containerized development environment',
        type: 'container',
        status: 'starting',
        resources: {
            cpu: 5.2,
            memory: 12.8,
            storage: 8.5,
            network: 0.5
        },
        tools: ['code-editor-1'],
        ports: [3001, 8081],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        lastAccessed: new Date(Date.now() - 1800000).toISOString(),
        configuration: {
            language: 'multi',
            framework: 'docker',
            runtime: 'docker-20.10',
            packages: ['docker', 'docker-compose']
        }
    }
];

/**
 * Get all development environments
 */
async function getDevEnvironments(req, res) {
    try {
        const { type, status } = req.query;
        let environments = [...mockDevEnvironments];

        // Filter by type
        if (type) {
            environments = environments.filter(env => env.type === type);
        }

        // Filter by status
        if (status) {
            environments = environments.filter(env => env.status === status);
        }

        // Update resource usage with some randomization for demo
        environments.forEach(env => {
            if (env.status === 'running') {
                env.resources.cpu = Math.max(0, env.resources.cpu + (Math.random() - 0.5) * 10);
                env.resources.memory = Math.max(0, env.resources.memory + (Math.random() - 0.5) * 5);
                env.resources.network = Math.max(0, env.resources.network + (Math.random() - 0.5) * 1);
            }
        });

        return {
            success: true,
            data: environments,
            message: 'Development environments retrieved successfully'
        };
    } catch (error) {
        logger.error('Failed to get development environments:', error);
        return {
            success: false,
            error: 'Failed to retrieve development environments',
            message: error.message
        };
    }
}

/**
 * Get development environment by ID
 */
async function getDevEnvironment(req, res) {
    try {
        const { id } = req.params;
        const environment = mockDevEnvironments.find(env => env.id === id);

        if (!environment) {
            return {
                success: false,
                error: 'Environment not found',
                message: `Development environment with ID ${id} not found`
            };
        }

        return {
            success: true,
            data: environment,
            message: 'Development environment retrieved successfully'
        };
    } catch (error) {
        logger.error('Failed to get development environment:', error);
        return {
            success: false,
            error: 'Failed to retrieve development environment',
            message: error.message
        };
    }
}

/**
 * Create new development environment
 */
async function createDevEnvironment(req, res) {
    try {
        const environmentData = req.body;

        // Validate required fields
        if (!environmentData.name || !environmentData.type) {
            return {
                success: false,
                error: 'Missing required fields',
                message: 'Name and type are required fields'
            };
        }

        // Create new environment
        const newEnvironment = {
            id: `env-${Date.now()}`,
            name: environmentData.name,
            description: environmentData.description || '',
            type: environmentData.type,
            status: 'stopped',
            resources: {
                cpu: 0,
                memory: 0,
                storage: 0,
                network: 0
            },
            tools: environmentData.tools || [],
            ports: environmentData.ports || [],
            createdAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            configuration: environmentData.configuration || {
                language: 'javascript',
                framework: 'express',
                runtime: 'node-18',
                packages: []
            }
        };

        // Add to mock data
        mockDevEnvironments.push(newEnvironment);

        logger.info(`Created new development environment: ${newEnvironment.name} (${newEnvironment.id})`);

        return {
            success: true,
            data: newEnvironment,
            message: 'Development environment created successfully'
        };
    } catch (error) {
        logger.error('Failed to create development environment:', error);
        return {
            success: false,
            error: 'Failed to create development environment',
            message: error.message
        };
    }
}

/**
 * Start development environment
 */
async function startDevEnvironment(req, res) {
    try {
        const { id } = req.params;
        const environmentIndex = mockDevEnvironments.findIndex(env => env.id === id);

        if (environmentIndex === -1) {
            return {
                success: false,
                error: 'Environment not found',
                message: `Development environment with ID ${id} not found`
            };
        }

        const environment = mockDevEnvironments[environmentIndex];

        if (environment.status === 'running') {
            return {
                success: false,
                error: 'Environment already running',
                message: 'Development environment is already running'
            };
        }

        // Update environment status
        mockDevEnvironments[environmentIndex].status = 'starting';
        mockDevEnvironments[environmentIndex].lastAccessed = new Date().toISOString();

        // Simulate startup process
        setTimeout(() => {
            const envIndex = mockDevEnvironments.findIndex(env => env.id === id);
            if (envIndex !== -1) {
                mockDevEnvironments[envIndex].status = 'running';
                mockDevEnvironments[envIndex].resources = {
                    cpu: Math.random() * 20 + 5,
                    memory: Math.random() * 30 + 10,
                    storage: Math.random() * 15 + 5,
                    network: Math.random() * 3 + 0.5
                };
            }
        }, 3000);

        logger.info(`Starting development environment: ${environment.name} (${id})`);

        return {
            success: true,
            data: { status: 'starting' },
            message: 'Development environment is starting'
        };
    } catch (error) {
        logger.error('Failed to start development environment:', error);
        return {
            success: false,
            error: 'Failed to start development environment',
            message: error.message
        };
    }
}

/**
 * Stop development environment
 */
async function stopDevEnvironment(req, res) {
    try {
        const { id } = req.params;
        const environmentIndex = mockDevEnvironments.findIndex(env => env.id === id);

        if (environmentIndex === -1) {
            return {
                success: false,
                error: 'Environment not found',
                message: `Development environment with ID ${id} not found`
            };
        }

        const environment = mockDevEnvironments[environmentIndex];

        if (environment.status === 'stopped') {
            return {
                success: false,
                error: 'Environment already stopped',
                message: 'Development environment is already stopped'
            };
        }

        // Update environment status
        mockDevEnvironments[environmentIndex].status = 'stopping';

        // Simulate shutdown process
        setTimeout(() => {
            const envIndex = mockDevEnvironments.findIndex(env => env.id === id);
            if (envIndex !== -1) {
                mockDevEnvironments[envIndex].status = 'stopped';
                mockDevEnvironments[envIndex].resources = {
                    cpu: 0,
                    memory: 0,
                    storage: mockDevEnvironments[envIndex].resources.storage,
                    network: 0
                };
            }
        }, 2000);

        logger.info(`Stopping development environment: ${environment.name} (${id})`);

        return {
            success: true,
            data: { status: 'stopping' },
            message: 'Development environment is stopping'
        };
    } catch (error) {
        logger.error('Failed to stop development environment:', error);
        return {
            success: false,
            error: 'Failed to stop development environment',
            message: error.message
        };
    }
}

/**
 * Delete development environment
 */
async function deleteDevEnvironment(req, res) {
    try {
        const { id } = req.params;
        const environmentIndex = mockDevEnvironments.findIndex(env => env.id === id);

        if (environmentIndex === -1) {
            return {
                success: false,
                error: 'Environment not found',
                message: `Development environment with ID ${id} not found`
            };
        }

        const environment = mockDevEnvironments[environmentIndex];

        // Check if environment is running
        if (environment.status === 'running') {
            return {
                success: false,
                error: 'Environment is running',
                message: 'Cannot delete a running environment. Please stop it first.'
            };
        }

        // Remove environment
        mockDevEnvironments.splice(environmentIndex, 1);

        logger.info(`Deleted development environment: ${environment.name} (${id})`);

        return {
            success: true,
            data: { success: true },
            message: 'Development environment deleted successfully'
        };
    } catch (error) {
        logger.error('Failed to delete development environment:', error);
        return {
            success: false,
            error: 'Failed to delete development environment',
            message: error.message
        };
    }
}

/**
 * Get development environment statistics
 */
async function getDevEnvironmentStats(req, res) {
    try {
        const totalEnvironments = mockDevEnvironments.length;
        const runningEnvironments = mockDevEnvironments.filter(env => env.status === 'running').length;
        const stoppedEnvironments = mockDevEnvironments.filter(env => env.status === 'stopped').length;

        const resourceUsage = mockDevEnvironments
            .filter(env => env.status === 'running')
            .reduce((acc, env) => ({
                cpu: acc.cpu + env.resources.cpu,
                memory: acc.memory + env.resources.memory,
                storage: acc.storage + env.resources.storage,
                network: acc.network + env.resources.network
            }), { cpu: 0, memory: 0, storage: 0, network: 0 });

        return {
            success: true,
            data: {
                totalEnvironments,
                runningEnvironments,
                stoppedEnvironments,
                resourceUsage
            },
            message: 'Development environment statistics retrieved successfully'
        };
    } catch (error) {
        logger.error('Failed to get development environment statistics:', error);
        return {
            success: false,
            error: 'Failed to retrieve statistics',
            message: error.message
        };
    }
}

module.exports = {
    getDevEnvironments,
    getDevEnvironment,
    createDevEnvironment,
    startDevEnvironment,
    stopDevEnvironment,
    deleteDevEnvironment,
    getDevEnvironmentStats
};
