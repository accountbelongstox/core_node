/**
 * Database Viewer - Dashboard section (Laravel debug interface simple HTML only).
 * Centralized API usage, reusable components: table list, schema table, data grid, pagination.
 * For full management UI use poly_apps/laravel_dashboard.
 */

const DbViewerApi = {
    base: ApiClient.PointUrlKey.DB_VIEWER_TABLES.replace(/\/tables$/, ''),
    getTablesUrl() {
        return this.base + '/tables';
    },
    getStructureUrl(table) {
        return this.base + '/tables/' + encodeURIComponent(table) + '/structure';
    },
    getDataUrl(table, page, perPage) {
        const u = this.base + '/tables/' + encodeURIComponent(table) + '/data';
        return u + '?page=' + page + '&per_page=' + (perPage || 20);
    },
    async fetchTables() {
        return apiClientInstance.get(this.getTablesUrl(), { includeAuth: true });
    },
    async fetchStructure(table) {
        return apiClientInstance.get(this.getStructureUrl(table), { includeAuth: true });
    },
    async fetchData(table, page, perPage) {
        return apiClientInstance.get(this.getDataUrl(table, page, perPage), { includeAuth: true });
    }
};

const DbViewerComponents = {
    renderTableList(container, tables, selectedTable, onSelect) {
        if (!container) return;
        container.innerHTML = '';
        tables.forEach(function (name) {
            const li = document.createElement('div');
            li.className = 'db-viewer-table-item px-4 py-2 cursor-pointer border-b border-gray-100 hover:bg-gray-200 transition-colors text-gray-700 truncate' + (name === selectedTable ? ' bg-indigo-100 text-indigo-800' : '');
            li.textContent = name;
            li.title = name;
            li.dataset.table = name;
            li.addEventListener('click', function () { onSelect(name); });
            container.appendChild(li);
        });
    },
    renderSchemaTable(container, columns) {
        if (!container) return;
        if (!columns || columns.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm p-2">No columns</p>';
            return;
        }
        const headers = ['name', 'type', 'nullable', 'key', 'default', 'extra'];
        let html = '<table class="min-w-full text-sm"><thead><tr>';
        headers.forEach(function (h) {
            html += '<th class="px-3 py-2 text-left bg-gray-100 border-b border-gray-200 font-medium text-gray-700">' + DbViewerComponents.escape(h) + '</th>';
        });
        html += '</tr></thead><tbody>';
        columns.forEach(function (col) {
            html += '<tr class="border-b border-gray-100 hover:bg-gray-50">';
            headers.forEach(function (h) {
                const v = col[h] !== undefined && col[h] !== null ? String(col[h]) : '';
                html += '<td class="px-3 py-2 text-gray-700">' + DbViewerComponents.escape(v) + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },
    renderDataGrid(container, columns, rows) {
        if (!container) return;
        if (!columns || columns.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm p-2">No columns</p>';
            return;
        }
        const keys = columns.map(function (c) { return c.name; });
        let html = '<table class="min-w-full text-sm"><thead><tr>';
        keys.forEach(function (k) {
            html += '<th class="px-3 py-2 text-left bg-gray-100 border-b border-gray-200 font-medium text-gray-700">' + DbViewerComponents.escape(k) + '</th>';
        });
        html += '</tr></thead><tbody>';
        if (!rows || rows.length === 0) {
            html += '<tr><td colspan="' + keys.length + '" class="px-3 py-4 text-gray-500 text-center">No rows</td></tr>';
        } else {
            rows.forEach(function (row) {
                html += '<tr class="border-b border-gray-100 hover:bg-gray-50">';
                keys.forEach(function (k) {
                    const v = row[k] !== undefined && row[k] !== null ? String(row[k]) : '';
                    html += '<td class="px-3 py-2 text-gray-700 max-w-xs truncate" title="' + DbViewerComponents.escape(v) + '">' + DbViewerComponents.escape(v) + '</td>';
                });
                html += '</tr>';
            });
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    },
    renderPagination(container, currentPage, lastPage, total, perPage) {
        if (!container) return;
        const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
        const to = Math.min(currentPage * perPage, total);
        let html = '<span class="text-gray-600">' + from + '–' + to + ' of ' + total + ' rows</span>';
        html += '<div class="flex items-center gap-2">';
        if (currentPage > 1) {
            html += '<button type="button" class="db-viewer-prev px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700">Prev</button>';
        }
        html += '<span class="text-gray-600">Page ' + currentPage + ' of ' + (lastPage || 1) + '</span>';
        if (currentPage < lastPage) {
            html += '<button type="button" class="db-viewer-next px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700">Next</button>';
        }
        html += '</div>';
        container.innerHTML = html;
    },
    escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

const DbViewer = {
    tables: [],
    selectedTable: null,
    structure: null,
    currentPage: 1,
    perPage: 20,
    dataMeta: null,

    init() {
        const authEl = document.getElementById('db-viewer-auth-required');
        const appEl = document.getElementById('db-viewer-app');
        DbViewerApi.fetchTables()
            .then(function (res) {
                DbViewer.tables = res.tables || [];
                authEl.classList.add('hidden');
                appEl.classList.remove('hidden');
                DbViewer.renderTableList();
                if (DbViewer.tables.length > 0 && !DbViewer.selectedTable) {
                    DbViewer.selectTable(DbViewer.tables[0]);
                }
            })
            .catch(function (err) {
                if (err.message && (err.message.indexOf('401') !== -1 || err.message.indexOf('Unauthenticated') !== -1)) {
                    authEl.classList.remove('hidden');
                    appEl.classList.add('hidden');
                } else {
                    authEl.classList.remove('hidden');
                    authEl.querySelector('p').textContent = 'Error: ' + (err.message || 'Failed to load tables');
                    appEl.classList.add('hidden');
                }
            });
    },

    renderTableList() {
        const listEl = document.getElementById('db-viewer-table-list');
        DbViewerComponents.renderTableList(listEl, DbViewer.tables, DbViewer.selectedTable, function (name) {
            DbViewer.selectTable(name);
        });
    },

    selectTable(name) {
        DbViewer.selectedTable = name;
        DbViewer.currentPage = 1;
        DbViewer.renderTableList();
        document.getElementById('db-viewer-table-name').textContent = name;
        DbViewer.loadStructure();
        DbViewer.loadData();
    },

    loadStructure() {
        const wrap = document.getElementById('db-viewer-schema-table-wrap');
        wrap.innerHTML = '<p class="text-gray-500 p-2">Loading…</p>';
        DbViewerApi.fetchStructure(DbViewer.selectedTable)
            .then(function (res) {
                DbViewer.structure = res.columns || [];
                DbViewerComponents.renderSchemaTable(wrap, DbViewer.structure);
            })
            .catch(function (err) {
                wrap.innerHTML = '<p class="text-red-600 p-2">' + DbViewerComponents.escape(err.message || 'Failed to load structure') + '</p>';
            });
    },

    loadData() {
        const wrap = document.getElementById('db-viewer-data-table-wrap');
        const pagEl = document.getElementById('db-viewer-pagination');
        wrap.innerHTML = '<p class="text-gray-500 p-2">Loading…</p>';
        pagEl.innerHTML = '';
        DbViewerApi.fetchData(DbViewer.selectedTable, DbViewer.currentPage, DbViewer.perPage)
            .then(function (res) {
                DbViewer.dataMeta = {
                    total: res.total,
                    current_page: res.current_page,
                    last_page: res.last_page,
                    per_page: res.per_page
                };
                const columns = DbViewer.structure || (res.data && res.data[0] ? Object.keys(res.data[0]).map(function (k) { return { name: k }; }) : []);
                DbViewerComponents.renderDataGrid(wrap, columns.length ? columns : [], res.data || []);
                DbViewerComponents.renderPagination(pagEl, res.current_page, res.last_page, res.total, res.per_page);
                DbViewer.attachPaginationHandlers(pagEl);
            })
            .catch(function (err) {
                wrap.innerHTML = '<p class="text-red-600 p-2">' + DbViewerComponents.escape(err.message || 'Failed to load data') + '</p>';
                pagEl.innerHTML = '';
            });
    },

    attachPaginationHandlers(container) {
        if (!container) return;
        const prev = container.querySelector('.db-viewer-prev');
        const next = container.querySelector('.db-viewer-next');
        if (prev) {
            prev.addEventListener('click', function () {
                if (DbViewer.currentPage > 1) {
                    DbViewer.currentPage--;
                    DbViewer.loadData();
                }
            });
        }
        if (next) {
            next.addEventListener('click', function () {
                if (DbViewer.dataMeta && DbViewer.currentPage < DbViewer.dataMeta.last_page) {
                    DbViewer.currentPage++;
                    DbViewer.loadData();
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', function () {
    DbViewer.init();
});
