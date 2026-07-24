// storage.js - Gerenciamento de armazenamento local (IndexedDB via Dexie e LocalStorage)

const StorageService = {
    db: null,

    init: function() {
        // Inicializa o Dexie.js para o banco local
        this.db = new Dexie("DashBuilderDB");
        this.db.version(1).stores({
            environments: 'id, name, lastUpdatedAt',
            trelloData: 'environmentId, cards, lists, members, labels, customFields, checklists, lastSyncAt',
            dashboards: 'id, environmentId, name, widgets'
        });
    },

    // --- LocalStorage (Preferências Leves) ---
    getPref: function(key, defaultValue = null) {
        const val = localStorage.getItem(`dashbuilder_${key}`);
        return val ? JSON.parse(val) : defaultValue;
    },

    setPref: function(key, value) {
        localStorage.setItem(`dashbuilder_${key}`, JSON.stringify(value));
    },

    // --- IndexedDB (Ambientes) ---
    getEnvironments: async function() {
        return await this.db.environments.toArray();
    },

    getEnvironment: async function(id) {
        return await this.db.environments.get(id);
    },

    saveEnvironment: async function(env) {
        if (!env.id) env.id = Utils.generateId();
        env.lastUpdatedAt = new Date().toISOString();
        await this.db.environments.put(env);
        return env;
    },

    deleteEnvironment: async function(id) {
        await this.db.environments.delete(id);
        await this.db.trelloData.delete(id);
        // Excluir dashboards atrelados a este environment
        await this.db.dashboards.where({environmentId: id}).delete();
    },

    // --- IndexedDB (Dados do Trello) ---
    saveTrelloData: async function(environmentId, data) {
        const record = {
            environmentId: environmentId,
            ...data,
            lastSyncAt: new Date().toISOString()
        };
        await this.db.trelloData.put(record);
    },

    getTrelloData: async function(environmentId) {
        return await this.db.trelloData.get(environmentId);
    }
};

// Inicializa no carregamento
document.addEventListener('DOMContentLoaded', () => {
    StorageService.init();
});
