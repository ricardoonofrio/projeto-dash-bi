// state.js - Gerenciamento de Estado Global e UI da Tela Inicial

const State = {
    currentEnv: null,
    currentTrelloData: null,
    
    views: ['home', 'trello', 'modeler', 'kpi', 'dashboard', 'config'],
    
    init: async function() {
        const lastEnvId = StorageService.getPref('lastEnvId');
        if (lastEnvId) {
            await this.loadEnvironment(lastEnvId);
        } else {
            this.renderHome();
        }

        this.bindEvents();
    },

    bindEvents: function() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.getAttribute('data-view');
                if (view) this.navigate(view);
            });
        });

        document.getElementById('btn-theme-toggle').addEventListener('click', () => {
            const isDark = document.body.classList.contains('theme-dark');
            if (isDark) {
                document.body.classList.remove('theme-dark');
                document.body.classList.add('theme-light');
                StorageService.setPref('theme', 'light');
            } else {
                document.body.classList.remove('theme-light');
                document.body.classList.add('theme-dark');
                StorageService.setPref('theme', 'dark');
            }
            if (typeof ChartRenderer !== 'undefined') ChartRenderer.resizeAll();
        });

        const savedTheme = StorageService.getPref('theme', 'light');
        document.body.classList.add(`theme-${savedTheme}`);

        const btnNew = document.getElementById('btn-new-env');
        if(btnNew) {
            btnNew.addEventListener('click', () => this.createNewEnvironment());
        }

        const btnImportJson = document.getElementById('btn-import-env-json');
        if (btnImportJson) {
            btnImportJson.addEventListener('click', () => this.importEnvironmentJson());
        }
    },

    navigate: function(viewId) {
        if (!this.currentEnv && viewId !== 'home') {
            Utils.showToast('Selecione ou crie um ambiente primeiro.', 'warning');
            return;
        }

        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (navItem) navItem.classList.add('active');

        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        const viewEl = document.getElementById(`view-${viewId}`);
        if (viewEl) viewEl.classList.add('active');

        // Atualiza títulos do Topbar
        const titlesMap = {
            home: 'Início / Ambientes',
            trello: 'Conexão Trello',
            modeler: 'Modelagem de Dados',
            kpi: 'Criar KPIs',
            dashboard: 'Dashboard Builder',
            config: 'Exportação e Backup'
        };
        const titleEl = document.getElementById('topbar-title');
        if (titleEl) titleEl.innerText = titlesMap[viewId] || 'DashBuilder';

        document.dispatchEvent(new CustomEvent(`view:${viewId}:loaded`));
    },

    loadEnvironment: async function(id) {
        const env = await StorageService.getEnvironment(id);
        if (env) {
            this.currentEnv = env;
            StorageService.setPref('lastEnvId', id);
            
            document.getElementById('topbar-env').innerText = `${env.acronym} - ${env.name}`;
            document.getElementById('btn-sync').disabled = false;
            document.getElementById('btn-presentation').disabled = false;
            
            this.currentTrelloData = await StorageService.getTrelloData(id) || null;
            
            this.navigate('dashboard');
            Utils.showToast(`Ambiente "${env.name}" carregado.`, 'success');
        } else {
            StorageService.setPref('lastEnvId', null);
            this.renderHome();
        }
    },

    createNewEnvironment: function() {
        const formHtml = `
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
                <div>
                    <label style="font-size:0.8rem; font-weight:600;">Nome do Ambiente / Núcleo</label>
                    <input type="text" id="env-name-input" placeholder="Ex: Núcleo de Operações" style="width:100%; margin-top:0.25rem;">
                </div>
                <div>
                    <label style="font-size:0.8rem; font-weight:600;">Sigla ou Identificador</label>
                    <input type="text" id="env-acronym-input" placeholder="Ex: NOP" style="width:100%; margin-top:0.25rem;">
                </div>
            </div>
        `;

        Utils.showModal({
            title: "Criar Novo Ambiente Local",
            content: formHtml,
            buttons: [
                { text: "Cancelar", class: "btn-outline" },
                {
                    text: "Criar Ambiente",
                    class: "btn-primary",
                    onClick: async () => {
                        const name = document.getElementById('env-name-input').value.trim();
                        const acronym = document.getElementById('env-acronym-input').value.trim();

                        if (!name) {
                            Utils.showToast("Informe o nome do ambiente.", "error");
                            return false;
                        }

                        const newEnv = {
                            id: Utils.generateId(),
                            name: name,
                            acronym: acronym || name.substring(0,3).toUpperCase(),
                            trelloConnection: { boardId: '', saveTokenLocally: false },
                            dataGroups: [],
                            kpis: [],
                            dashboards: [{ id: 'default', name: 'Principal', widgets: [] }]
                        };
                        
                        const savedEnv = await StorageService.saveEnvironment(newEnv);
                        await this.loadEnvironment(savedEnv.id);
                        this.renderHome();
                        Utils.showToast(`Ambiente ${savedEnv.name} criado com sucesso!`, 'success');
                    }
                }
            ]
        });
    },

    importEnvironmentJson: function() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const importedEnv = JSON.parse(evt.target.result);
                    if (!importedEnv.name) throw new Error("JSON inválido");
                    importedEnv.id = Utils.generateId();
                    const savedEnv = await StorageService.saveEnvironment(importedEnv);
                    await this.loadEnvironment(savedEnv.id);
                    Utils.showToast(`Ambiente ${savedEnv.name} importado com sucesso!`, 'success');
                } catch (err) {
                    Utils.showToast("Erro ao importar JSON: " + err.message, "error");
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    },

    renderHome: async function() {
        this.navigate('home');
        const envs = await StorageService.getEnvironments();
        const listEl = document.getElementById('env-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        if (envs.length === 0) {
            listEl.innerHTML = `
                <div class="card" style="text-align: center; padding: 2.5rem 1.5rem;">
                    <h3>Nenhum ambiente encontrado</h3>
                    <p class="mt-1">Crie um novo ambiente local para começar a conectar seus quadros do Trello.</p>
                    <button class="btn btn-primary mt-2" onclick="State.createNewEnvironment()">+ Criar Novo Ambiente</button>
                </div>
            `;
            return;
        }

        envs.forEach(env => {
            const card = document.createElement('div');
            card.className = 'card mt-2';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            card.innerHTML = `
                <div>
                    <strong style="font-size:1.05rem;"><span class="badge" style="margin-right:8px">${env.acronym}</span> ${env.name}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top:0.3rem;">Última atualização: ${Utils.formatDate(env.lastUpdatedAt)}</div>
                </div>
                <div style="display:flex; gap:0.5rem">
                    <button class="btn btn-primary btn-load-env" data-id="${env.id}">Abrir Painel</button>
                    <button class="btn btn-outline btn-delete-env" data-id="${env.id}" style="color: var(--danger)">Excluir</button>
                </div>
            `;
            listEl.appendChild(card);
        });

        document.querySelectorAll('.btn-load-env').forEach(btn => {
            btn.addEventListener('click', (e) => this.loadEnvironment(e.currentTarget.getAttribute('data-id')));
        });
        
        document.querySelectorAll('.btn-delete-env').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                Utils.confirm({
                    title: "Excluir Ambiente Local",
                    message: "Tem certeza que deseja excluir este ambiente? Todos os dashboards e mapeamentos salvos localmente serão permanentemente excluídos.",
                    onConfirm: async () => {
                        await StorageService.deleteEnvironment(id);
                        if (this.currentEnv && this.currentEnv.id === id) {
                            this.currentEnv = null;
                            this.currentTrelloData = null;
                            StorageService.setPref('lastEnvId', null);
                            document.getElementById('topbar-env').innerText = 'Sem ambiente selecionado';
                        }
                        this.renderHome();
                        Utils.showToast("Ambiente removido.", "info");
                    }
                });
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        State.init();
    }, 100);
});

