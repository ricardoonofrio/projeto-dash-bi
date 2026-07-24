// trelloService.js - Serviço para comunicação com a API do Trello e parse de JSON

const TrelloService = {
    // Busca dados diretamente da API do Trello
    syncFromAPI: async function(apiKey, token, boardId) {
        if (!apiKey || !token || !boardId) {
            throw new Error("Credenciais incompletas.");
        }

        try {
            // Endpoints principais
            const baseUrl = `https://api.trello.com/1/boards/${boardId}`;
            const auth = `key=${apiKey}&token=${token}`;

            // Promessas de requisição
            const listsReq = fetch(`${baseUrl}/lists?${auth}`);
            const cardsReq = fetch(`${baseUrl}/cards?${auth}&customFieldItems=true`);
            const membersReq = fetch(`${baseUrl}/members?${auth}`);
            const labelsReq = fetch(`${baseUrl}/labels?${auth}`);
            const customFieldsReq = fetch(`${baseUrl}/customFields?${auth}`);
            const checklistsReq = fetch(`${baseUrl}/checklists?${auth}`);

            const responses = await Promise.all([listsReq, cardsReq, membersReq, labelsReq, customFieldsReq, checklistsReq]);

            // Verifica se alguma requisição falhou
            for (let r of responses) {
                if (!r.ok) {
                    throw new Error(`Erro na API do Trello: ${r.statusText}`);
                }
            }

            const [lists, cards, members, labels, customFields, checklists] = await Promise.all(responses.map(r => r.json()));

            return { lists, cards, members, labels, customFields, checklists };

        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    // Processa JSON exportado do Trello
    parseJSONFile: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Extrair apenas o que precisamos
                    const result = {
                        lists: data.lists || [],
                        cards: data.cards || [],
                        members: data.members || [],
                        labels: data.labels || [],
                        customFields: data.customFields || [],
                        checklists: data.checklists || []
                    };
                    
                    resolve(result);
                } catch (err) {
                    reject(new Error("Arquivo JSON inválido."));
                }
            };
            reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
            reader.readAsText(file);
        });
    },

    // UI Bindings
    initView: function() {
        const btnSync = document.getElementById('btn-trello-connect');
        const btnImport = document.getElementById('btn-trello-import-file');

        if (btnSync) {
            btnSync.addEventListener('click', async () => {
                const apiKey = document.getElementById('trello-api-key').value.trim();
                const token = document.getElementById('trello-token').value.trim();
                const boardId = document.getElementById('trello-board-id').value.trim();
                const saveLocal = document.getElementById('trello-save-token').checked;

                if (!apiKey || !token || !boardId) {
                    Utils.showToast("Preencha API Key, Token e Board ID.", "error");
                    return;
                }

                btnSync.disabled = true;
                btnSync.innerText = 'Sincronizando...';

                try {
                    const data = await this.syncFromAPI(apiKey, token, boardId);
                    await this.saveAndShowData(data);
                    
                    // Atualiza configurações se usuário marcou
                    State.currentEnv.trelloConnection = {
                        boardId,
                        saveTokenLocally: saveLocal,
                        lastSyncAt: new Date().toISOString()
                    };
                    
                    if (saveLocal) {
                        State.currentEnv.trelloConnection.apiKey = apiKey;
                        State.currentEnv.trelloConnection.token = token;
                    } else {
                        delete State.currentEnv.trelloConnection.apiKey;
                        delete State.currentEnv.trelloConnection.token;
                    }
                    await StorageService.saveEnvironment(State.currentEnv);

                    Utils.showToast("Sincronização concluída com sucesso!", "success");
                } catch (err) {
                    Utils.showToast("Falha na sincronização: " + err.message, "error");
                } finally {
                    btnSync.disabled = false;
                    btnSync.innerText = 'Conectar e Sincronizar via API';
                }
            });
        }

        if (btnImport) {
            btnImport.addEventListener('click', async () => {
                const fileInput = document.getElementById('trello-json-file');
                if (fileInput.files.length === 0) {
                    Utils.showToast("Selecione um arquivo JSON.", "error");
                    return;
                }

                try {
                    const data = await this.parseJSONFile(fileInput.files[0]);
                    await this.saveAndShowData(data);
                    
                    State.currentEnv.trelloConnection.lastSyncAt = new Date().toISOString();
                    await StorageService.saveEnvironment(State.currentEnv);

                    Utils.showToast("Arquivo importado com sucesso!", "success");
                } catch (err) {
                    Utils.showToast("Erro: " + err.message, "error");
                }
            });
        }
    },

    saveAndShowData: async function(data) {
        if (!State.currentEnv) return;
        await StorageService.saveTrelloData(State.currentEnv.id, data);
        State.currentTrelloData = await StorageService.getTrelloData(State.currentEnv.id);
        this.updateStatusUI();
    },

    updateStatusUI: function() {
        const statusEl = document.getElementById('trello-sync-status');
        if (!statusEl) return;

        if (State.currentTrelloData) {
            const data = State.currentTrelloData;
            statusEl.innerHTML = `
                <ul style="margin-left: 1.5rem;">
                    <li><strong>Cartões:</strong> ${data.cards?.length || 0}</li>
                    <li><strong>Listas:</strong> ${data.lists?.length || 0}</li>
                    <li><strong>Etiquetas:</strong> ${data.labels?.length || 0}</li>
                    <li><strong>Membros:</strong> ${data.members?.length || 0}</li>
                    <li><strong>Última Sincronização:</strong> ${Utils.formatDate(data.lastSyncAt)}</li>
                </ul>
            `;
        } else {
            statusEl.innerText = "Nenhum dado sincronizado ainda.";
        }

        // Fill inputs if saved
        if (State.currentEnv && State.currentEnv.trelloConnection) {
            const conn = State.currentEnv.trelloConnection;
            document.getElementById('trello-board-id').value = conn.boardId || '';
            document.getElementById('trello-save-token').checked = conn.saveTokenLocally || false;
            if (conn.saveTokenLocally) {
                document.getElementById('trello-api-key').value = conn.apiKey || '';
                document.getElementById('trello-token').value = conn.token || '';
            }
        }
    }
};

// Quando a view for carregada
document.addEventListener('view:trello:loaded', () => {
    TrelloService.initView();
    TrelloService.updateStatusUI();
});
