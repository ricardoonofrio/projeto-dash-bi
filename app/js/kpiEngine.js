// kpiEngine.js - Motor de métricas, operações numéricas e filtros avançados

const KPIEngine = {
    // -----------------------------------------
    // Lógica Central de Processamento
    // -----------------------------------------
    
    processCards: function(cards, groups) {
        if (!cards) return [];
        
        const listsMap = {};
        (State.currentTrelloData?.lists || []).forEach(l => listsMap[l.id] = l.name);

        const membersMap = {};
        (State.currentTrelloData?.members || []).forEach(m => membersMap[m.id] = m.fullName);

        const labelsMap = {};
        (State.currentTrelloData?.labels || []).forEach(l => labelsMap[l.id] = l.name);

        const customFieldsMap = {};
        (State.currentTrelloData?.customFields || []).forEach(cf => {
            customFieldsMap[cf.id] = { name: cf.name, type: cf.type, options: cf.options };
        });

        const now = new Date();

        return cards.map(card => {
            const processedCard = { ...card, _groups: {}, _numericFields: {} };

            // Data de Criação (Inferida do ID do Trello)
            const createdDate = Utils.getTrelloCreationDate(card.id);
            processedCard._groups["Data de Criação"] = createdDate ? Utils.formatShortDate(createdDate) : "Desconhecida";
            processedCard._groups["Mês de Criação"] = createdDate ? Utils.formatMonthYear(createdDate) : "Desconhecido";

            // Grupos Nativos
            processedCard._groups["Lista Original"] = listsMap[card.idList] || "Desconhecida";
            
            processedCard._groups["Membro Responsável"] = (card.idMembers && card.idMembers.length > 0) 
                ? membersMap[card.idMembers[0]] || "Desconhecido"
                : "Sem Membro";

            processedCard._groups["Etiqueta Original"] = (card.idLabels && card.idLabels.length > 0)
                ? labelsMap[card.idLabels[0]] || "Sem Etiqueta"
                : "Sem Etiqueta";

            // Datas Nativas e Prazos
            processedCard._groups["Data de Vencimento"] = Utils.formatShortDate(card.due);
            processedCard._groups["Mês de Vencimento"] = card.due ? Utils.formatMonthYear(card.due) : "Sem Data";
            processedCard._groups["Data de Início"] = Utils.formatShortDate(card.start);
            processedCard._groups["Última Atividade"] = Utils.formatShortDate(card.dateLastActivity);

            // Métricas de SLA e Lead Time (AN-06 & AN-07: 5 Estados Reais de SLA)
            let slaStatus = "Sem Prazo";
            let leadTimeDays = 0;

            // Identifica se o cartão está concluído via lista/status modelado
            const currentListLower = (listsMap[card.idList] || '').toLowerCase();
            const isCompleted = card.dueComplete || 
                                currentListLower.includes('done') || 
                                currentListLower.includes('concl') || 
                                currentListLower.includes('final') || 
                                currentListLower.includes('entregue');

            if (card.due) {
                const dueDate = new Date(card.due);
                if (isCompleted) {
                    const completionDate = card.dateLastActivity ? new Date(card.dateLastActivity) : now;
                    slaStatus = completionDate <= dueDate ? "Concluído no Prazo" : "Concluído com Atraso";
                } else {
                    slaStatus = dueDate < now ? "Em Andamento Atrasado" : "Em Andamento no Prazo";
                }
            } else {
                slaStatus = "Sem Prazo";
            }
            processedCard._groups["Status de SLA"] = slaStatus;

            // Lead Time (Somente para concluídos) vs Tempo em Aberto (AN-08 & AN-09)
            if (createdDate) {
                const endDate = isCompleted && card.dateLastActivity ? new Date(card.dateLastActivity) : now;
                const diffTime = Math.max(0, endDate - createdDate);
                leadTimeDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            }

            if (isCompleted) {
                processedCard._groups["Lead Time (Dias)"] = `${leadTimeDays} dias`;
                processedCard._numericFields["Lead Time (Dias)"] = leadTimeDays;
            } else {
                processedCard._groups["Tempo em Aberto (Dias)"] = `${leadTimeDays} dias`;
                processedCard._numericFields["Tempo em Aberto (Dias)"] = leadTimeDays;
            }

            // Checklists Count
            let totalChecklistItems = 0;
            let completedChecklistItems = 0;
            (card.idChecklists || []).forEach(clId => {
                const cl = (State.currentTrelloData?.checklists || []).find(c => c.id === clId);
                if (cl && cl.checkItems) {
                    totalChecklistItems += cl.checkItems.length;
                    completedChecklistItems += cl.checkItems.filter(i => i.state === 'complete').length;
                }
            });
            processedCard._numericFields["Itens de Checklist"] = totalChecklistItems;
            processedCard._numericFields["Itens de Checklist Concluídos"] = completedChecklistItems;

            // Processa Campos Personalizados
            (card.customFieldItems || []).forEach(item => {
                const cfDef = customFieldsMap[item.idCustomField];
                if (cfDef) {
                    const groupName = `Campo: ${cfDef.name}`;
                    let val = "Vazio";

                    if (item.value) {
                        val = item.value.text || item.value.number || item.value.date || (item.value.checked ? "Sim" : "Não");
                        if (item.value.number !== undefined) {
                            const parsedNum = parseFloat(item.value.number);
                            if (!isNaN(parsedNum)) {
                                processedCard._numericFields[groupName] = parsedNum;
                            }
                        }
                    } else if (item.idValue && cfDef.options) {
                        const opt = cfDef.options.find(o => o.id === item.idValue);
                        if (opt) val = opt.value?.text || "Desconhecido";
                    }

                    processedCard._groups[groupName] = val;
                }
            });

            // Grupos Modelados
            (groups || []).forEach(group => {
                let matchedOption = "Não Categorizado";

                if (group.type === 'list') {
                    const opt = group.options.find(o => o.mappedRawIds.includes(card.idList));
                    if (opt) matchedOption = opt.value;
                } else if (group.type === 'label') {
                    const cardLabelIds = card.idLabels || [];
                    const opt = group.options.find(o => o.mappedRawIds.some(id => cardLabelIds.includes(id)));
                    if (opt) matchedOption = opt.value;
                }

                processedCard._groups[group.name] = matchedOption;
            });

            return processedCard;
        });
    },

    // Agrupamento com Tratamento Rigoroso de Valores Ausentes (AN-03)
    groupBy: function(processedCards, groupName, operation = 'count', targetNumericField = null) {
        const groupsMap = {};

        processedCards.forEach(card => {
            const key = card._groups[groupName] || "Desconhecido";
            if (!groupsMap[key]) {
                groupsMap[key] = { count: 0, validValues: [] };
            }

            groupsMap[key].count += 1;

            if (targetNumericField && card._numericFields[targetNumericField] !== undefined) {
                const val = Number(card._numericFields[targetNumericField]);
                if (!isNaN(val)) {
                    groupsMap[key].validValues.push(val);
                }
            }
        });

        return Object.keys(groupsMap).map(key => {
            const item = groupsMap[key];
            const validCount = item.validValues.length;
            const sumVal = item.validValues.reduce((acc, v) => acc + v, 0);

            let finalValue = item.count;

            if (operation === 'sum') {
                finalValue = Math.round(sumVal * 100) / 100;
            } else if (operation === 'avg') {
                // AN-03: Média divide APENAS pela quantidade de valores VÁLIDOS, nunca pelo total bruto
                finalValue = validCount > 0 ? Math.round((sumVal / validCount) * 100) / 100 : 0;
            } else if (operation === 'min') {
                finalValue = validCount > 0 ? Math.min(...item.validValues) : 0;
            } else if (operation === 'max') {
                finalValue = validCount > 0 ? Math.max(...item.validValues) : 0;
            }

            return {
                name: key,
                value: finalValue,
                count: item.count,
                validCount: validCount,
                ignoredCount: item.count - validCount
            };
        });
    },


    // Filtros com Operadores Expandidos
    filterCards: function(processedCards, filters = []) {
        if (!filters || filters.length === 0) return processedCards;
        
        return processedCards.filter(card => {
            return filters.every(f => {
                const val = String(card._groups[f.groupName] || '').toLowerCase();
                const targetVal = String(f.value || '').toLowerCase();

                if (f.operator === 'equals') return val === targetVal;
                if (f.operator === 'not_equals') return val !== targetVal;
                if (f.operator === 'contains') return val.includes(targetVal);
                if (f.operator === 'greater_than') return (parseFloat(val) || 0) > (parseFloat(targetVal) || 0);
                if (f.operator === 'less_than') return (parseFloat(val) || 0) < (parseFloat(targetVal) || 0);
                if (f.operator === 'is_empty') return val === '' || val === 'vazio' || val === 'desconhecido';
                if (f.operator === 'is_not_empty') return val !== '' && val !== 'vazio' && val !== 'desconhecido';

                return true;
            });
        });
    },

    // Aplicação de Filtros Globais do Dashboard
    applyGlobalFilters: function(cards, globalFilters = {}) {
        let result = cards;

        // Filtro de Pesquisa Textual (Título)
        if (globalFilters.searchQuery) {
            const q = globalFilters.searchQuery.toLowerCase();
            result = result.filter(c => c.name.toLowerCase().includes(q));
        }

        // Filtro de Membro
        if (globalFilters.member && globalFilters.member !== 'all') {
            result = result.filter(c => c._groups["Membro Responsável"] === globalFilters.member);
        }

        // Filtro de Período (Mês de Vencimento ou Criação)
        if (globalFilters.period && globalFilters.period !== 'all') {
            result = result.filter(c => c._groups["Mês de Criação"] === globalFilters.period || c._groups["Mês de Vencimento"] === globalFilters.period);
        }

        return result;
    },

    // UI e Gerenciamento
    initView: function() {
        this.renderKPIList();

        document.getElementById('btn-add-kpi').addEventListener('click', () => this.openEditor());
        document.getElementById('btn-cancel-kpi').addEventListener('click', () => this.closeEditor());
        document.getElementById('btn-save-kpi').addEventListener('click', () => this.saveKPI());
        document.getElementById('btn-add-kpi-filter').addEventListener('click', () => this.addFilterRow());
    },

    renderKPIList: function() {
        const listEl = document.getElementById('kpi-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        const kpis = State.currentEnv?.kpis || [];
        if (kpis.length === 0) {
            listEl.innerHTML = '<li class="text-muted" style="font-size: 0.8rem">Nenhum KPI criado.</li>';
            return;
        }

        kpis.forEach(kpi => {
            const li = document.createElement('li');
            li.style.padding = '0.5rem 0';
            li.style.borderBottom = '1px solid var(--border-color)';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            const naturalSentence = this.generateNaturalLanguageSentence(kpi);
            li.innerHTML = `
                <div>
                    <strong style="font-size: 0.9rem; color:var(--text-main);">${kpi.name}</strong>
                    <div style="font-size:0.75rem; color:var(--primary); margin-top:0.2rem; font-style:italic;">💬 "${naturalSentence}"</div>
                </div>
                <button class="btn btn-icon btn-del-kpi" data-id="${kpi.id}" style="color: var(--danger); font-size: 1rem; padding:0">&times;</button>
            `;
            listEl.appendChild(li);
        });


        document.querySelectorAll('.btn-del-kpi').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                Utils.confirm({
                    title: "Excluir KPI",
                    message: "Deseja excluir este KPI? Os gráficos vinculados voltarão para a contagem sem filtro.",
                    onConfirm: async () => {
                        State.currentEnv.kpis = State.currentEnv.kpis.filter(k => k.id !== id);
                        await StorageService.saveEnvironment(State.currentEnv);
                        this.renderKPIList();
                        Utils.showToast("KPI removido com sucesso.");
                    }
                });
            });
        });
    },

    openEditor: function() {
        if (!State.currentEnv || !State.currentTrelloData) {
            Utils.showToast("Conecte ao Trello e modele os dados primeiro.", "error");
            return;
        }
        document.getElementById('kpi-editor').style.display = 'block';
        document.getElementById('kpi-name').value = '';
        document.getElementById('kpi-filters-container').innerHTML = '';
    },

    closeEditor: function() {
        document.getElementById('kpi-editor').style.display = 'none';
    },

    getAvailableGroups: function() {
        const groups = [
            {name: "Lista Original"},
            {name: "Membro Responsável"},
            {name: "Etiqueta Original"},
            {name: "Data de Criação"},
            {name: "Mês de Criação"},
            {name: "Data de Vencimento"},
            {name: "Mês de Vencimento"},
            {name: "Status de SLA"},
            {name: "Lead Time (Dias)"}
        ];
        
        (State.currentTrelloData?.customFields || []).forEach(cf => {
            groups.push({name: `Campo: ${cf.name}`});
        });

        (State.currentEnv?.dataGroups || []).forEach(g => groups.push({name: g.name}));
        return groups;
    },

    addFilterRow: function() {
        const container = document.getElementById('kpi-filters-container');
        const rowId = Utils.generateId();
        const groups = this.getAvailableGroups();
        
        let optionsHtml = groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('');

        const row = document.createElement('div');
        row.className = 'filter-row mt-1';
        row.id = `filter-${rowId}`;
        row.style.display = 'flex';
        row.style.gap = '0.5rem';
        row.innerHTML = `
            <select class="f-group" style="flex:1.2; padding:0.4rem">${optionsHtml}</select>
            <select class="f-operator" style="flex:1; padding:0.4rem">
                <option value="equals">É igual a</option>
                <option value="not_equals">É diferente de</option>
                <option value="contains">Contém o texto</option>
                <option value="greater_than">Maior que</option>
                <option value="less_than">Menor que</option>
            </select>
            <input type="text" class="f-value" placeholder="Valor" style="flex:1; padding:0.4rem">
            <button class="btn btn-icon btn-del-filter" style="color:var(--danger); padding:0">&times;</button>
        `;

        container.appendChild(row);

        row.querySelector('.btn-del-filter').addEventListener('click', () => row.remove());
    },

    generateNaturalLanguageSentence: function(kpi) {
        if (!kpi) return "Métrica não configurada.";

        const opsMap = {
            count: "Contar a quantidade de cartões",
            sum: "Calcular a soma dos valores",
            avg: "Calcular a média dos valores",
            min: "Identificar o valor mínimo",
            max: "Identificar o valor máximo"
        };

        let sentence = opsMap[kpi.operation] || "Calcular indicador";

        if (kpi.filters && kpi.filters.length > 0) {
            const filterStrings = kpi.filters.map(f => {
                const opNames = {
                    equals: "seja igual a",
                    not_equals: "seja diferente de",
                    contains: "contenha o texto",
                    greater_than: "seja maior que",
                    less_than: "seja menor que"
                };
                return `onde "${f.groupName}" ${opNames[f.operator] || f.operator} "${f.value}"`;
            });
            sentence += " " + filterStrings.join(" E ");
        } else {
            sentence += " para todos os cartões do quadro.";
        }

        return sentence;
    },

    saveKPI: async function() {
        const name = document.getElementById('kpi-name').value.trim();
        const operation = document.getElementById('kpi-operation').value;

        if (!name) {
            Utils.showToast("Dê um nome ao indicador", "error");
            return;
        }

        const filters = [];
        document.querySelectorAll('.filter-row').forEach(row => {
            filters.push({
                groupName: row.querySelector('.f-group').value,
                operator: row.querySelector('.f-operator').value,
                value: row.querySelector('.f-value').value.trim()
            });
        });

        const newKpi = {
            id: Utils.generateId(),
            name,
            operation,
            filters
        };

        if (!State.currentEnv.kpis) State.currentEnv.kpis = [];
        State.currentEnv.kpis.push(newKpi);

        await StorageService.saveEnvironment(State.currentEnv);
        Utils.showToast("Métrica de Negócio salva com sucesso!", "success");
        
        this.closeEditor();
        this.renderKPIList();
    }
};

document.addEventListener('view:kpi:loaded', () => {
    KPIEngine.initView();
});

