const META_TOOLS = {
    backend_info: {
        name: 'backend_info',
        description: 'Get backend metadata (ID, ports, status)',
        sync: true,
        parameters: {},
        returns: {
            backend_id: 'string',
            status: 'string',
            ports: 'object'
        }
    },

    backend_state: {
        name: 'backend_state',
        description: 'Get backend processing state (IDLE/BUSY)',
        sync: true,
        parameters: {},
        returns: {
            state: 'string'
        }
    },

    tools_list: {
        name: 'tools_list',
        description: 'List all available MCP tools',
        sync: true,
        parameters: {},
        returns: {
            tools: 'array'
        }
    }
};

const FILE_PROCESSING_TOOLS = {
    get_file_info: {
        name: 'get_file_info',
        description: 'Extract file info with OCR/document parsing (supports images, PDFs, documents)',
        sync: false,
        parameters: {
            file_path: {
                type: 'string',
                required: true,
                description: 'Path to the file to analyze'
            },
            use_cache: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Use cached results if available'
            },
            include_pixel_matrix: {
                type: 'boolean',
                required: false,
                default: false,
                description: 'Include pixel matrix data for images'
            },
            ocr_model_type: {
                type: 'string',
                required: false,
                default: 'general',
                description: 'OCR model type to use (general, dense, etc.)'
            },
            num_colors: {
                type: 'number',
                required: false,
                default: 10,
                description: 'Number of dominant colors to extract from images'
            },
            extract_images: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Extract images from documents (PDF, DOCX, etc.)'
            },
            extract_tables: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Extract tables from documents'
            },
            extract_hyperlinks: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Extract hyperlinks from documents'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            file_path: 'string',
            file_type: 'string',
            ocr_text: 'string',
            color_analysis: 'object',
            document_metadata: 'object',
            images: 'array',
            tables: 'array',
            hyperlinks: 'array'
        }
    },

    generate_placeholder_image: {
        name: 'generate_placeholder_image',
        description: 'Generate placeholder image with OCR',
        sync: true,
        parameters: {
            original_image_path: {
                type: 'string',
                required: true,
                description: 'Path to original image'
            },
            output_path: {
                type: 'string',
                required: true,
                description: 'Output path for placeholder image'
            },
            placeholder_text: {
                type: 'string',
                required: false,
                description: 'Custom text to display on placeholder'
            },
            background_color: {
                type: 'string',
                required: false,
                default: '#CCCCCC',
                description: 'Background color (hex format)'
            },
            text_color: {
                type: 'string',
                required: false,
                default: '#333333',
                description: 'Text color (hex format)'
            },
            font_size: {
                type: 'number',
                required: false,
                default: 20,
                description: 'Font size in pixels'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            output_path: 'string'
        }
    },

    query_file_processing_history: {
        name: 'query_file_processing_history',
        description: 'Query file processing history',
        sync: true,
        parameters: {
            file_type: {
                type: 'string',
                required: false,
                description: 'Filter by file type'
            },
            date_from: {
                type: 'string',
                required: false,
                description: 'Filter by start date (ISO format)'
            },
            date_to: {
                type: 'string',
                required: false,
                description: 'Filter by end date (ISO format)'
            },
            limit: {
                type: 'number',
                required: false,
                default: 100,
                description: 'Maximum number of results'
            },
            offset: {
                type: 'number',
                required: false,
                default: 0,
                description: 'Offset for pagination'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            history: 'array',
            total: 'number'
        }
    },

    clear_file_cache: {
        name: 'clear_file_cache',
        description: 'Clear file processing cache',
        sync: true,
        parameters: {
            file_path: {
                type: 'string',
                required: false,
                description: 'Specific file path to clear (if not provided, clears all)'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            cleared_count: 'number'
        }
    }
};

const DATABASE_TOOLS = {
    database_namespace_negotiation: {
        name: 'database_namespace_negotiation',
        description: 'Database namespace negotiation - create and negotiate database namespace for client isolation',
        sync: true,
        parameters: {
            client_identifier: {
                type: 'string',
                required: false,
                default: 'default_client',
                description: 'Client identifier for namespace isolation'
            },
            custom_namespace: {
                type: 'string',
                required: false,
                description: 'Custom namespace (if not provided, auto-generated)'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            namespace: 'string'
        }
    },

    database_register_and_connect: {
        name: 'database_register_and_connect',
        description: 'Register and connect to database',
        sync: true,
        parameters: {
            namespace: {
                type: 'string',
                required: true,
                description: 'Database namespace'
            },
            database_name: {
                type: 'string',
                required: true,
                description: 'Database name'
            },
            connection_string: {
                type: 'string',
                required: true,
                description: 'Database connection string'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            connection_id: 'string'
        }
    },

    database_execute_query: {
        name: 'database_execute_query',
        description: 'Execute database query with safety checks',
        sync: true,
        parameters: {
            namespace: {
                type: 'string',
                required: true,
                description: 'Database namespace'
            },
            database_name: {
                type: 'string',
                required: true,
                description: 'Database name'
            },
            query: {
                type: 'string',
                required: true,
                description: 'SQL query to execute'
            },
            params: {
                type: 'object',
                required: false,
                description: 'Query parameters for parameterized queries'
            },
            max_rows: {
                type: 'number',
                required: false,
                default: 1000,
                description: 'Maximum number of rows to return'
            },
            timeout_seconds: {
                type: 'number',
                required: false,
                default: 30,
                description: 'Query timeout in seconds'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            rows: 'array',
            row_count: 'number',
            columns: 'array'
        }
    },

    database_batch_operations: {
        name: 'database_batch_operations',
        description: 'Database batch operations (INSERT, UPDATE, DELETE)',
        sync: true,
        parameters: {
            namespace: {
                type: 'string',
                required: true,
                description: 'Database namespace'
            },
            database_name: {
                type: 'string',
                required: true,
                description: 'Database name'
            },
            operation_type: {
                type: 'string',
                required: true,
                description: 'Operation type (INSERT, UPDATE, DELETE)'
            },
            table_name: {
                type: 'string',
                required: true,
                description: 'Target table name'
            },
            data: {
                type: 'array',
                required: true,
                description: 'Array of data objects for batch operation'
            },
            batch_size: {
                type: 'number',
                required: false,
                default: 100,
                description: 'Batch size for processing'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            affected_rows: 'number'
        }
    },

    database_schema_inspection: {
        name: 'database_schema_inspection',
        description: 'Database schema inspection - get table structures, columns, indexes',
        sync: true,
        parameters: {
            namespace: {
                type: 'string',
                required: true,
                description: 'Database namespace'
            },
            database_name: {
                type: 'string',
                required: true,
                description: 'Database name'
            },
            table_pattern: {
                type: 'string',
                required: false,
                description: 'Filter tables by pattern (supports wildcards)'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            tables: 'array',
            schema: 'object'
        }
    },

    database_get_statistics: {
        name: 'database_get_statistics',
        description: 'Get database statistics (size, table counts, row counts)',
        sync: true,
        parameters: {
            namespace: {
                type: 'string',
                required: true,
                description: 'Database namespace'
            },
            database_name: {
                type: 'string',
                required: true,
                description: 'Database name'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            statistics: 'object',
            table_count: 'number',
            total_rows: 'number',
            database_size: 'string'
        }
    },

    database_health_check: {
        name: 'database_health_check',
        description: 'Database health check',
        sync: true,
        parameters: {},
        returns: {
            success: 'boolean',
            backend_id: 'string',
            status: 'string',
            connected_databases: 'number'
        }
    }
};

const CODEBASE_TOOLS = {
    codebase_get_directory_tree: {
        name: 'codebase_get_directory_tree',
        description: 'Get codebase directory tree with multiple output formats',
        sync: true,
        parameters: {
            target_path: {
                type: 'string',
                required: false,
                description: 'Target directory path (defaults to current working directory)'
            },
            max_depth: {
                type: 'number',
                required: false,
                default: 5,
                description: 'Maximum depth to traverse'
            },
            include_files: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Include files in the tree'
            },
            include_hidden: {
                type: 'boolean',
                required: false,
                default: false,
                description: 'Include hidden files and directories'
            },
            output_format: {
                type: 'string',
                required: false,
                default: 'both',
                description: 'Output format (tree, json, both)'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            tree_text: 'string',
            tree_json: 'object'
        }
    },

    codebase_find_files_by_pattern: {
        name: 'codebase_find_files_by_pattern',
        description: 'Find files by filename pattern',
        sync: true,
        parameters: {
            filename_pattern: {
                type: 'string',
                required: true,
                description: 'Filename pattern to search for'
            },
            search_path: {
                type: 'string',
                required: false,
                description: 'Search path (defaults to current working directory)'
            },
            exact_match: {
                type: 'boolean',
                required: false,
                default: false,
                description: 'Exact match or pattern matching'
            },
            case_sensitive: {
                type: 'boolean',
                required: false,
                default: false,
                description: 'Case sensitive search'
            },
            max_results: {
                type: 'number',
                required: false,
                default: 100,
                description: 'Maximum number of results'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            files: 'array',
            count: 'number'
        }
    },

    codebase_search_content: {
        name: 'codebase_search_content',
        description: 'Search content in codebase files',
        sync: true,
        parameters: {
            search_text: {
                type: 'string',
                required: true,
                description: 'Text to search for'
            },
            search_path: {
                type: 'string',
                required: false,
                description: 'Search path (defaults to current working directory)'
            },
            file_pattern: {
                type: 'string',
                required: false,
                description: 'Filter by file pattern (e.g., "*.js", "*.py")'
            },
            case_sensitive: {
                type: 'boolean',
                required: false,
                default: false,
                description: 'Case sensitive search'
            },
            context_lines: {
                type: 'number',
                required: false,
                default: 0,
                description: 'Number of context lines to include'
            },
            max_results: {
                type: 'number',
                required: false,
                default: 100,
                description: 'Maximum number of results'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            matches: 'array',
            count: 'number'
        }
    },

    codebase_get_file_content: {
        name: 'codebase_get_file_content',
        description: 'Get file content with comprehensive analysis (supports text, images, documents)',
        sync: true,
        parameters: {
            file_path: {
                type: 'string',
                required: true,
                description: 'Path to the file'
            },
            max_chars: {
                type: 'number',
                required: false,
                default: 16000,
                description: 'Maximum characters to return'
            },
            include_ocr: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Include OCR analysis for images'
            },
            include_color_analysis: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Include color analysis for images'
            },
            include_document_metadata: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Include document metadata'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            file_path: 'string',
            content: 'string',
            file_type: 'string',
            size: 'number',
            ocr_text: 'string',
            color_analysis: 'object',
            metadata: 'object'
        }
    },

    codebase_analyze_statistics: {
        name: 'codebase_analyze_statistics',
        description: 'Analyze codebase statistics (file counts, sizes, languages)',
        sync: true,
        parameters: {
            target_path: {
                type: 'string',
                required: false,
                description: 'Target directory path (defaults to current working directory)'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            statistics: 'object',
            file_count: 'number',
            total_size: 'number',
            languages: 'object'
        }
    },

    codebase_describe_directory: {
        name: 'codebase_describe_directory',
        description: 'Describe directory structure with summary statistics',
        sync: true,
        parameters: {
            directory_path: {
                type: 'string',
                required: true,
                description: 'Directory path to describe'
            },
            include_file_count: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Include file count statistics'
            },
            include_size_stats: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Include size statistics'
            },
            include_type_distribution: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Include file type distribution'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            description: 'string',
            file_count: 'number',
            size_stats: 'object',
            type_distribution: 'object'
        }
    },

    codebase_scan_framework_apps: {
        name: 'codebase_scan_framework_apps',
        description: 'Scan for framework applications (Node.js, Laravel, Flutter, etc.)',
        sync: true,
        parameters: {
            scan_path: {
                type: 'string',
                required: false,
                description: 'Path to scan (defaults to current working directory)'
            }
        },
        returns: {
            success: 'boolean',
            backend_id: 'string',
            applications: 'array',
            count: 'number'
        }
    },

    codebase_health_check: {
        name: 'codebase_health_check',
        description: 'Codebase health check',
        sync: true,
        parameters: {},
        returns: {
            success: 'boolean',
            backend_id: 'string',
            status: 'string'
        }
    }
};

const ALL_TOOLS = {
    ...META_TOOLS,
    ...FILE_PROCESSING_TOOLS,
    ...DATABASE_TOOLS,
    ...CODEBASE_TOOLS
};

const TOOL_CATEGORIES = {
    meta: Object.keys(META_TOOLS),
    file_processing: Object.keys(FILE_PROCESSING_TOOLS),
    database: Object.keys(DATABASE_TOOLS),
    codebase: Object.keys(CODEBASE_TOOLS)
};

module.exports = {
    META_TOOLS,
    FILE_PROCESSING_TOOLS,
    DATABASE_TOOLS,
    CODEBASE_TOOLS,
    ALL_TOOLS,
    TOOL_CATEGORIES
};
