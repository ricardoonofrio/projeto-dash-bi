// dataModeler.js - Modelagem Semântica, Card Inspector e Live Transformation Preview (De-Para)

const DataModeler = {
    activeTab: 'depara',

    initView: function() {
        this.initTabs();
        this.renderGroups();
        this.renderLiveDeParaPreview();
        this.renderCardInspector();
        this.renderDataDictionary();

        const btnAdd = document.getElementById('btn-add-group');
        if (btnAdd) {
            const newBtn = btnAdd.cloneNode(true);
            btnAdd.parentNode.replaceChild(newBtn, btnAdd);
            newBtn.addEventListener('click', () => this.createNewGroup());
        }

        const btnAutoMap = document.getElementById('btn-auto-map');
        if (btnAutoMap) {
            const newAutoBtn = btnAutoMap.cloneNode(true);
            btnAutoMap.parentNode.replaceChild(newAutoBtn, btnAutoMap);
            newAutoBtn.addEventListener('click', () => this.smartAutoMap());
        }


        // Live Search Listeners
        const searchDePara = document.getElementById('depara-search');
        if (searchDePara) {
            searchDePara.addEventListener('input', Utils.debounce((e) => {
                this.renderLiveDeParaPreview(e.target.value.trim());
            }, 150));
        }

        const searchInspector = document.getElementById('inspector-search');
        if (searchInspector) {
            searchInspector.addEventListener('input', Utils.debounce((e) => {
                this.renderCardInspector(e.target.value.trim());
            }, 150));
        }
    },

    initTabs: function() {
        document.querySelectorAll('.modeler-tab').forEach(tabBtn => {
            tabBtn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.getAttribute('data-tab');
                this.activeTab = targetTab;

                document.querySelectorAll('.modeler-tab').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                const targetContent = document.getElementById(`modeler-tab-${targetTab}`);
                if (targetContent) targetContent.style.display = 'block';
            });
        });
    },

    // -----------------------------------------
    // ABA 1: Live Preview de Transformação (De-Para)
    // -----------------------------------------
    renderLiveDeParaPreview: function(searchQuery = '') {
        const tbody = document.getElementById('depara-preview-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!State.currentTrelloData?.cards || State.currentTrelloData.cards.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center;">Nenhum dado do Trello sincronizado. Conecte um quadro primeiro.</td></tr>';
            return;
        }

        const groups = State.currentEnv?.dataGroups || [];
        const processedCards = KPIEngine.processCards(State.currentTrelloData.cards, groups);

        let filtered = processedCards;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(c => c.name.toLowerCase().includes(q));
        }

        if (groups.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center;">Nenhum agrupamento semântico criado ainda. Clique em "+ Novo Agrupamento Semântico" acima.</td></tr>';
            return;
        }

        filtered.slice(0, 100).forEach(c => {
            groups.forEach(g => {
                const tr = document.createElement('tr');
                const resultVal = c._groups[g.name] || 'Não Categorizado';
                const isMapped = resultVal !== 'Não Categorizado';

                let rawVal = c._groups[g.type === 'list' ? 'Lista Original' : 'Etiqueta Original'];

                tr.innerHTML = `
                    <td style="font-weight:600; color:var(--text-main);">${c.name}</td>
                    <td><span class="tag-badge tag-info">${rawVal}</span></td>
                    <td style="font-weight:600;">${g.name} (${g.type === 'list' ? 'Coluna' : 'Etiqueta'})</td>
                    <td>
                        <span class="${isMapped ? 'depara-result-badge' : 'tag-badge tag-warning'}">
                            ${isMapped ? '➔ ' + resultVal : '⚠️ Não Categorizado'}
                        </span>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        });
    },

    // -----------------------------------------
    // ABA 2: Card Inspector (Explorador Amostral)
    // -----------------------------------------
    renderCardInspector: function(searchQuery = '') {
        const tbody = document.getElementById('inspector-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!State.currentTrelloData?.cards || State.currentTrelloData.cards.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center;">Nenhum cartão para inspecionar.</td></tr>';
            return;
        }

        const groups = State.currentEnv?.dataGroups || [];
        const processedCards = KPIEngine.processCards(State.currentTrelloData.cards, groups);

        let filtered = processedCards;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c._groups["Etiqueta Original"].toLowerCase().includes(q));
        }

        const labelsMap = {};
        (State.currentTrelloData?.labels || []).forEach(l => labelsMap[l.id] = l);

        filtered.slice(0, 100).forEach(c => {
            const tr = document.createElement('tr');

            // Formata etiquetas coloridas Trello
            let labelsHtml = (c.idLabels || []).map(lId => {
                const labelObj = labelsMap[lId];
                if (!labelObj || !labelObj.name) return '';
                const colorHex = this.getTrelloLabelColorHex(labelObj.color);
                return `<span class="trello-label-pill" style="background-color:${colorHex}">${labelObj.name}</span>`;
            }).join('') || '<span class="text-muted" style="font-size:0.75rem;">Sem Etiqueta</span>';

            // Formata campos customizados
            let customFieldsList = [];
            Object.keys(c._groups).forEach(k => {
                if (k.startsWith('Campo: ')) {
                    customFieldsList.push(`<strong>${k.replace('Campo: ', '')}:</strong> ${c._groups[k]}`);
                }
            });
            let cfHtml = customFieldsList.join(' | ') || '<span class="text-muted" style="font-size:0.75rem;">Nenhum</span>';

            tr.innerHTML = `
                <td style="font-weight:600; color:var(--text-main);">${c.name}</td>
                <td><span class="tag-badge tag-info">${c._groups["Lista Original"]}</span></td>
                <td>${labelsHtml}</td>
                <td>${c._groups["Membro Responsável"]}</td>
                <td>${c._groups["Data de Criação"]}</td>
                <td style="font-size:0.8rem">${cfHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    // -----------------------------------------
    // ABA 3: Dicionário de Frequência & Saúde dos Dados
    // -----------------------------------------
    renderDataDictionary: function() {
        const listFreqEl = document.getElementById('dict-lists-freq');
        const labelFreqEl = document.getElementById('dict-labels-freq');
        const healthEl = document.getElementById('data-health-stats');

        if (!listFreqEl || !labelFreqEl || !healthEl) return;

        listFreqEl.innerHTML = '';
        labelFreqEl.innerHTML = '';
        healthEl.innerHTML = '';

        if (!State.currentTrelloData?.cards) {
            healthEl.innerHTML = '<p class="text-muted">Nenhum dado sincronizado.</p>';
            return;
        }

        const cards = State.currentTrelloData.cards;
        const totalCards = cards.length;
        const groups = State.currentEnv?.dataGroups || [];
        const processed = KPIEngine.processCards(cards, groups);

        // Frequência de Listas
        const listCounts = {};
        cards.forEach(c => {
            const listName = (State.currentTrelloData.lists || []).find(l => l.id === c.idList)?.name || "Desconhecida";
            listCounts[listName] = (listCounts[listName] || 0) + 1;
        });

        Object.keys(listCounts).forEach(lName => {
            const count = listCounts[lName];
            const pct = Math.round((count / totalCards) * 100);
            const li = document.createElement('li');
            li.style.padding = '0.3rem 0';
            li.style.borderBottom = '1px solid var(--border-color)';
            li.innerHTML = `<strong>${lName}:</strong> ${count} cartões <span class="text-muted">(${pct}%)</span>`;
            listFreqEl.appendChild(li);
        });

        // Frequência de Etiquetas
        const labelCounts = {};
        cards.forEach(c => {
            (c.idLabels || []).forEach(lId => {
                const labelObj = (State.currentTrelloData.labels || []).find(l => l.id === lId);
                if (labelObj && labelObj.name) {
                    labelCounts[labelObj.name] = (labelCounts[labelObj.name] || 0) + 1;
                }
            });
        });

        Object.keys(labelCounts).forEach(labelName => {
            const count = labelCounts[labelName];
            const pct = Math.round((count / totalCards) * 100);
            const li = document.createElement('li');
            li.style.padding = '0.3rem 0';
            li.style.borderBottom = '1px solid var(--border-color)';
            li.innerHTML = `<strong>${labelName}:</strong> ${count} cartões <span class="text-muted">(${pct}%)</span>`;
            labelFreqEl.appendChild(li);
        });

        // Saúde e Cobertura da Modelagem
        let mappedCount = 0;
        if (groups.length > 0) {
            const mainGroup = groups[0];
            mappedCount = processed.filter(c => c._groups[mainGroup.name] && c._groups[mainGroup.name] !== 'Não Categorizado').length;
        }

        const coveragePct = totalCards > 0 ? Math.round((mappedCount / totalCards) * 100) : 0;

        healthEl.innerHTML = `
            <div style="font-size:2rem; font-weight:800; color:var(--primary)">${coveragePct}%</div>
            <div style="font-size:0.85rem; font-weight:600; margin-bottom:0.25rem;">Índice de Cobertura Semântica</div>
            <p style="font-size:0.8rem; color:var(--text-muted)">${mappedCount} de ${totalCards} cartões foram mapeados em categorias semânticas.</p>
            
            <div class="health-progress-bar">
                <div class="health-progress-fill" style="width: ${coveragePct}%;"></div>
            </div>

            <div style="margin-top: 1.25rem; font-size:0.825rem; display:flex; flex-direction:column; gap:0.5rem;">
                <div>📦 <strong>Total de Cartões:</strong> ${totalCards}</div>
                <div>🏷️ <strong>Etiquetas Únicas Encontradas:</strong> ${Object.keys(labelCounts).length}</div>
                <div>📋 <strong>Colunas do Quadro:</strong> ${(State.currentTrelloData.lists || []).length}</div>
            </div>
        `;
    },

    // Auxiliar de cores do Trello
    getTrelloLabelColorHex: function(colorName) {
        const palette = {
            green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444',
            purple: '#a855f7', blue: '#3b82f6', sky: '#06b6d4', lime: '#84cc16',
            pink: '#ec4899', black: '#475569'
        };
        return palette[colorName] || '#0284c7';
    },

    renderGroups: function() {
        const container = document.getElementById('modeler-groups');
        if (!container) return;
        
        container.innerHTML = '';
        const groups = State.currentEnv?.dataGroups || [];
        
        if (groups.length === 0) {
            container.innerHTML = `
                <div class="card" style="width: 100%; text-align: center; padding: 2rem;">
                    <h3>Nenhum Agrupamento Semântico</h3>
                    <p class="mt-1">Crie um agrupamento para unificar colunas ou etiquetas em categorias maiores (ex: "Fases do Processo", "Prioridades").</p>
                    <button class="btn btn-primary mt-2" onclick="DataModeler.createNewGroup()">+ Criar Primeiro Agrupamento</button>
                </div>
            `;
            return;
        }

        groups.forEach(group => {
            const groupEl = document.createElement('div');
            groupEl.className = 'card';
            groupEl.style.flex = "1 1 320px";
            groupEl.style.minWidth = "300px";
            
            let optionsHtml = '';
            (group.options || []).forEach(opt => {
                optionsHtml += `
                    <div style="background: var(--bg-main); padding: 0.5rem 0.75rem; margin-top: 0.5rem; border-radius: var(--radius-sm); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <strong style="font-size:0.875rem">${opt.value}</strong>
                        <span class="tag-badge tag-info">${opt.mappedRawIds.length} item(ns)</span>
                    </div>
                `;
            });

            groupEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center">
                    <h3 style="font-size: 1rem;">${group.name} <span class="badge" style="font-size:0.65rem">${group.type === 'list' ? 'Listas' : 'Etiquetas'}</span></h3>
                    <button class="btn btn-icon btn-delete-group" data-id="${group.id}" style="color: var(--danger); font-size: 1.1rem">&times;</button>
                </div>
                <div class="mt-1">
                    ${optionsHtml || '<p class="text-muted" style="font-size:0.8rem">Nenhuma subcategoria configurada.</p>'}
                </div>
                <button class="btn btn-outline mt-2 btn-manage-options" data-id="${group.id}" style="width: 100%; font-size: 0.8rem">Vincular Colunas/Etiquetas</button>
            `;
            container.appendChild(groupEl);
        });

        document.querySelectorAll('.btn-delete-group').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                Utils.confirm({
                    title: "Excluir Agrupamento",
                    message: "Deseja excluir este agrupamento semântico? Os gráficos associados voltarão ao estado não categorizado.",
                    onConfirm: async () => {
                        State.currentEnv.dataGroups = State.currentEnv.dataGroups.filter(g => g.id !== id);
                        await StorageService.saveEnvironment(State.currentEnv);
                        this.renderGroups();
                        this.renderLiveDeParaPreview();
                        this.renderDataDictionary();
                        Utils.showToast("Agrupamento removido.");
                    }
                });
            });
        });

        document.querySelectorAll('.btn-manage-options').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.openGroupManager(id);
            });
        });
    },

    smartAutoMap: async function() {
        if (!State.currentTrelloData) {
            Utils.showToast("Conecte ao Trello e sincronize os dados primeiro.", "error");
            return;
        }

        const lists = State.currentTrelloData.lists || [];
        const labels = State.currentTrelloData.labels || [];

        if (!State.currentEnv.dataGroups) State.currentEnv.dataGroups = [];

        // 1. Grupo Status Gerencial
        let statusGroup = State.currentEnv.dataGroups.find(g => g.name === 'Status Gerencial');
        if (!statusGroup) {
            statusGroup = {
                id: Utils.generateId(),
                name: 'Status Gerencial',
                type: 'list',
                options: [
                    { id: Utils.generateId(), value: 'A Fazer / Pendente', mappedRawIds: [] },
                    { id: Utils.generateId(), value: 'Em Andamento', mappedRawIds: [] },
                    { id: Utils.generateId(), value: 'Concluído', mappedRawIds: [] }
                ]
            };
            State.currentEnv.dataGroups.push(statusGroup);
        }

        lists.forEach(l => {
            const name = l.name.toLowerCase();
            if (name.includes('done') || name.includes('concl') || name.includes('final') || name.includes('pronto')) {
                const opt = statusGroup.options.find(o => o.value === 'Concluído');
                if (opt && !opt.mappedRawIds.includes(l.id)) opt.mappedRawIds.push(l.id);
            } else if (name.includes('progress') || name.includes('andamento') || name.includes('fazer') || name.includes('análise') || name.includes('execução')) {
                const opt = statusGroup.options.find(o => o.value === 'Em Andamento');
                if (opt && !opt.mappedRawIds.includes(l.id)) opt.mappedRawIds.push(l.id);
            } else {
                const opt = statusGroup.options.find(o => o.value === 'A Fazer / Pendente');
                if (opt && !opt.mappedRawIds.includes(l.id)) opt.mappedRawIds.push(l.id);
            }
        });

        // 2. Grupo Prioridade
        const priorityLabels = labels.filter(l => {
            const n = (l.name || '').toLowerCase();
            return n.includes('urg') || n.includes('alta') || n.includes('méd') || n.includes('baix') || n.includes('prio') || n.includes('bug');
        });

        if (priorityLabels.length > 0) {
            let priorityGroup = State.currentEnv.dataGroups.find(g => g.name === 'Nível de Prioridade');
            if (!priorityGroup) {
                priorityGroup = {
                    id: Utils.generateId(),
                    name: 'Nível de Prioridade',
                    type: 'label',
                    options: [
                        { id: Utils.generateId(), value: 'Urgente / Alta', mappedRawIds: [] },
                        { id: Utils.generateId(), value: 'Normal / Média', mappedRawIds: [] },
                        { id: Utils.generateId(), value: 'Baixa', mappedRawIds: [] }
                    ]
                };
                State.currentEnv.dataGroups.push(priorityGroup);
            }

            priorityLabels.forEach(l => {
                const name = (l.name || '').toLowerCase();
                if (name.includes('urg') || name.includes('alta') || name.includes('crit') || name.includes('bug')) {
                    const opt = priorityGroup.options.find(o => o.value === 'Urgente / Alta');
                    if (opt && !opt.mappedRawIds.includes(l.id)) opt.mappedRawIds.push(l.id);
                } else if (name.includes('baix')) {
                    const opt = priorityGroup.options.find(o => o.value === 'Baixa');
                    if (opt && !opt.mappedRawIds.includes(l.id)) opt.mappedRawIds.push(l.id);
                } else {
                    const opt = priorityGroup.options.find(o => o.value === 'Normal / Média');
                    if (opt && !opt.mappedRawIds.includes(l.id)) opt.mappedRawIds.push(l.id);
                }
            });
        }

        await StorageService.saveEnvironment(State.currentEnv);
        Utils.showToast("⚡ Mapeamento inteligente concluído com sucesso!", "success");
        this.renderGroups();
        this.renderLiveDeParaPreview();
        this.renderDataDictionary();
    },

    createNewGroup: function() {
        const formHtml = `
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
                <div>
                    <label style="font-size:0.8rem; font-weight:600;">Nome do Agrupamento</label>
                    <input type="text" id="ng-name" style="width:100%; margin-top:0.25rem" placeholder="Ex: Fases do Processo, Prioridades, Setores">
                </div>
                <div>
                    <label style="font-size:0.8rem; font-weight:600;">O que deseja agrupar?</label>
                    <select id="ng-type" style="width:100%; margin-top:0.25rem">
                        <option value="lista">Colunas do Trello (Listas)</option>
                        <option value="etiqueta">Etiquetas do Trello (Labels)</option>
                    </select>
                </div>
            </div>
        `;

        Utils.showModal({
            title: "Novo Agrupamento Semântico",
            content: formHtml,
            buttons: [
                { text: "Cancelar", class: "btn-outline" },
                {
                    text: "Criar Agrupamento",
                    class: "btn-primary",
                    onClick: async () => {
                        const name = document.getElementById('ng-name').value.trim();
                        const type = document.getElementById('ng-type').value;

                        if (!name) {
                            Utils.showToast("Informe o nome do agrupamento.", "error");
                            return false;
                        }

                        const newGroup = {
                            id: Utils.generateId(),
                            name: name,
                            type: type === 'lista' ? 'list' : 'label',
                            options: []
                        };

                        if (!State.currentEnv.dataGroups) State.currentEnv.dataGroups = [];
                        State.currentEnv.dataGroups.push(newGroup);
                        
                        await StorageService.saveEnvironment(State.currentEnv);
                        Utils.showToast(`Agrupamento "${name}" criado com sucesso!`, "success");
                        this.renderGroups();
                        this.renderLiveDeParaPreview();
                    }
                }
            ]
        });
    },


    openGroupManager: function(groupId) {
        const group = State.currentEnv?.dataGroups?.find(g => g.id === groupId);
        if (!group) return;

        const rawItems = group.type === 'list' 
            ? (State.currentTrelloData?.lists || []) 
            : (State.currentTrelloData?.labels || []).filter(l => l.name);

        let optionsEditorHtml = `
            <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
                <input type="text" id="new-opt-name" placeholder="Nome da Categoria BI (ex: Em Andamento)" style="flex:1; padding: 0.4rem;">
                <button class="btn btn-primary" id="btn-add-opt">+ Adicionar Categoria</button>
            </div>
            <div id="opts-container" style="max-height: 380px; overflow-y: auto;">
        `;

        (group.options || []).forEach(opt => {
            let pillsHtml = '';
            rawItems.forEach(raw => {
                const isSelected = opt.mappedRawIds.includes(raw.id);
                const bg = isSelected ? 'var(--primary)' : 'var(--bg-card)';
                const color = isSelected ? 'white' : 'var(--text-color)';
                const border = isSelected ? 'var(--primary)' : 'var(--border-color)';
                
                pillsHtml += `
                    <div class="map-pill" data-opt="${opt.id}" data-raw="${raw.id}" data-selected="${isSelected}"
                         style="display: inline-block; padding: 0.25rem 0.75rem; margin: 0.25rem; border-radius: 20px; font-size: 0.8rem; cursor: pointer; border: 1px solid ${border}; background: ${bg}; color: ${color}; transition: all 0.15s;">
                        ${raw.name}
                    </div>
                `;
            });

            optionsEditorHtml += `
                <div style="background: var(--bg-main); padding: 0.85rem; margin-bottom: 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <strong style="font-size: 1rem; color: var(--primary);">${opt.value}</strong>
                        <button class="btn btn-icon btn-del-opt" data-opt="${opt.id}" style="color: var(--danger); font-size: 0.8rem; padding: 0">&times; Excluir</button>
                    </div>
                    <div>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.4rem;">Clique nas pílulas abaixo para vincular os dados do Trello nesta categoria:</p>
                        ${pillsHtml || '<div style="font-size:0.8rem; color:var(--text-muted)">Sem dados originais carregados</div>'}
                    </div>
                </div>
            `;
        });

        optionsEditorHtml += `</div>`;

        const modalRef = Utils.showModal({
            title: `Mapeamento Semântico: ${group.name}`,
            content: `
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Crie subcategorias e agrupe as informações clicando nelas.</p>
                ${optionsEditorHtml}
            `,
            buttons: [
                { text: "Fechar", class: "btn-outline" },
                {
                    text: "Salvar Vínculos Semânticos",
                    class: "btn-primary",
                    onClick: async (box, overlay) => {
                        (group.options || []).forEach(opt => {
                            opt.mappedRawIds = [];
                            box.querySelectorAll(`.map-pill[data-opt="${opt.id}"]`).forEach(pill => {
                                if (pill.getAttribute('data-selected') === 'true') {
                                    opt.mappedRawIds.push(pill.getAttribute('data-raw'));
                                }
                            });
                        });

                        await StorageService.saveEnvironment(State.currentEnv);
                        Utils.showToast("Vínculos salvos!", "success");
                        this.renderGroups();
                        this.renderLiveDeParaPreview();
                        this.renderDataDictionary();
                    }
                }
            ]
        });

        // Eventos internos do modal
        const box = modalRef.box;
        box.querySelectorAll('.map-pill').forEach(pill => {
            pill.addEventListener('click', function() {
                const isSelected = this.getAttribute('data-selected') === 'true';
                if (isSelected) {
                    this.setAttribute('data-selected', 'false');
                    this.style.background = 'var(--bg-card)';
                    this.style.color = 'var(--text-color)';
                    this.style.borderColor = 'var(--border-color)';
                } else {
                    this.setAttribute('data-selected', 'true');
                    this.style.background = 'var(--primary)';
                    this.style.color = 'white';
                    this.style.borderColor = 'var(--primary)';
                }
            });
        });

        box.querySelector('#btn-add-opt')?.addEventListener('click', () => {
            const val = box.querySelector('#new-opt-name').value.trim();
            if (val) {
                if (!group.options) group.options = [];
                group.options.push({ id: Utils.generateId(), value: val, mappedRawIds: [] });
                modalRef.overlay.remove();
                this.openGroupManager(groupId);
            }
        });

        box.querySelectorAll('.btn-del-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const optId = e.currentTarget.getAttribute('data-opt');
                group.options = group.options.filter(o => o.id !== optId);
                modalRef.overlay.remove();
                this.openGroupManager(groupId);
            });
        });
    }
};

document.addEventListener('view:modeler:loaded', () => {
    DataModeler.initView();
});

