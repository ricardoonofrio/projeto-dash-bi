// dashboardBuilder.js - Construtor visual de Dashboards com Drill-Down e Filtros Globais

const DashboardBuilder = {
    globalFilters: {
        searchQuery: '',
        period: 'all',
        member: 'all'
    },

    initView: function() {
        this.initGlobalFilters();
        this.renderDashboard();

        const btnModal = document.getElementById('btn-open-widget-modal');
        if (btnModal) {
            const newBtn = btnModal.cloneNode(true);
            btnModal.parentNode.replaceChild(newBtn, btnModal);
            newBtn.addEventListener('click', () => this.openWidgetModal());
        }

        const btnAutoDash = document.getElementById('btn-auto-dash');
        if (btnAutoDash) {
            const newAutoBtn = btnAutoDash.cloneNode(true);
            btnAutoDash.parentNode.replaceChild(newAutoBtn, btnAutoDash);
            newAutoBtn.addEventListener('click', () => this.generateAutoDashboard());
        }
    },

    generateAutoDashboard: async function() {
        if (!State.currentEnv || !State.currentTrelloData) {
            Utils.showToast("Sincronize os dados do Trello primeiro.", "error");
            return;
        }

        const hasGroups = (State.currentEnv.dataGroups || []).length > 0;
        const statusGroupBy = hasGroups ? (State.currentEnv.dataGroups.find(g=>g.type==='list')?.name || 'Lista Original') : 'Lista Original';

        const autoWidgets = [
            {
                id: Utils.generateId(),
                title: "Total de Cartões no Quadro",
                kpiId: "",
                groupBy: statusGroupBy,
                operation: "count",
                type: "card"
            },
            {
                id: Utils.generateId(),
                title: "Distribuição por Status",
                kpiId: "",
                groupBy: statusGroupBy,
                operation: "count",
                type: "doughnut"
            },
            {
                id: Utils.generateId(),
                title: "Demandas por Membro Responsável",
                kpiId: "",
                groupBy: "Membro Responsável",
                operation: "count",
                type: "column"
            },
            {
                id: Utils.generateId(),
                title: "Evolução Mensal de Criados",
                kpiId: "",
                groupBy: "Mês de Criação",
                operation: "count",
                type: "line"
            }
        ];

        if (!State.currentEnv.dashboards) State.currentEnv.dashboards = [{ id: 'default', name: 'Principal', widgets: [] }];
        State.currentEnv.dashboards[0].widgets = autoWidgets;

        await StorageService.saveEnvironment(State.currentEnv);
        Utils.showToast("🚀 Dashboard Executivo gerado com sucesso!", "success");
        this.renderDashboard();
    },


    initGlobalFilters: function() {
        const filterContainer = document.getElementById('global-filter-bar');
        if (!filterContainer) return;

        const members = State.currentTrelloData?.members || [];
        const periodsSet = new Set();

        // Extrai períodos de criação/vencimento disponíveis
        if (State.currentTrelloData?.cards) {
            const groups = State.currentEnv?.dataGroups || [];
            const processed = KPIEngine.processCards(State.currentTrelloData.cards, groups);
            processed.forEach(c => {
                if (c._groups["Mês de Criação"] && c._groups["Mês de Criação"] !== 'Sem Data') periodsSet.add(c._groups["Mês de Criação"]);
                if (c._groups["Mês de Vencimento"] && c._groups["Mês de Vencimento"] !== 'Sem Data') periodsSet.add(c._groups["Mês de Vencimento"]);
            });
        }

        const periods = Array.from(periodsSet).sort();

        filterContainer.innerHTML = `
            <div class="filter-chip-group">
                <label>🔍 Buscar Cartão:</label>
                <input type="text" id="gf-search" placeholder="Digite para filtrar..." value="${this.globalFilters.searchQuery}">
            </div>
            <div class="filter-chip-group">
                <label>📅 Período:</label>
                <select id="gf-period">
                    <option value="all">Todos os Períodos</option>
                    ${periods.map(p => `<option value="${p}" ${this.globalFilters.period === p ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
            </div>
            <div class="filter-chip-group">
                <label>👤 Responsável:</label>
                <select id="gf-member">
                    <option value="all">Todos os Membros</option>
                    ${members.map(m => `<option value="${m.fullName}" ${this.globalFilters.member === m.fullName ? 'selected' : ''}>${m.fullName}</option>`).join('')}
                </select>
            </div>
            <button class="btn btn-outline btn-sm" id="gf-reset" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">Limpar Filtros</button>
        `;

        document.getElementById('gf-search').addEventListener('input', Utils.debounce((e) => {
            this.globalFilters.searchQuery = e.target.value.trim();
            this.renderDashboard();
        }, 200));

        document.getElementById('gf-period').addEventListener('change', (e) => {
            this.globalFilters.period = e.target.value;
            this.renderDashboard();
        });

        document.getElementById('gf-member').addEventListener('change', (e) => {
            this.globalFilters.member = e.target.value;
            this.renderDashboard();
        });

        document.getElementById('gf-reset').addEventListener('click', () => {
            this.globalFilters = { searchQuery: '', period: 'all', member: 'all' };
            this.initGlobalFilters();
            this.renderDashboard();
        });
    },

    renderDashboard: function() {
        const grid = document.getElementById('dash-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const widgets = State.currentEnv?.dashboards?.[0]?.widgets || [];

        if (widgets.length === 0) {
            grid.innerHTML = `
                <div class="card" style="width: 100%; text-align: center; padding: 3rem 1.5rem;">
                    <h3>Seu Dashboard está vazio</h3>
                    <p class="mt-1">Clique no botão abaixo para adicionar seu primeiro gráfico ou indicador visual.</p>
                    <button class="btn btn-primary mt-2" onclick="DashboardBuilder.openWidgetModal()">+ Adicionar Widget</button>
                </div>
            `;
            return;
        }

        // Processa cartões base
        const groups = State.currentEnv?.dataGroups || [];
        let baseCards = KPIEngine.processCards(State.currentTrelloData?.cards || [], groups);
        baseCards = KPIEngine.applyGlobalFilters(baseCards, this.globalFilters);

        widgets.forEach(w => {
            const widgetEl = document.createElement('div');
            widgetEl.className = 'card widget-card';
            widgetEl.dataset.id = w.id;
            
            widgetEl.style.flex = "1 1 450px";
            widgetEl.style.minWidth = "350px";
            widgetEl.style.minHeight = "420px";
            widgetEl.style.display = "flex";
            widgetEl.style.flexDirection = "column";
            widgetEl.style.paddingBottom = "1.5rem";

            widgetEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                    <h3 style="font-size: 1rem; color: var(--text-color); font-weight: 600;">${w.title}</h3>
                    <div style="display:flex; gap:0.25rem;">
                        <button class="btn btn-icon btn-del-widget" data-id="${w.id}" style="color:var(--danger); font-size: 1.1rem; padding: 2px 6px;">&times;</button>
                    </div>
                </div>
                <div id="widget-${w.id}" style="width: 100%; flex: 1; min-height: 320px;"></div>
            `;
            grid.appendChild(widgetEl);

            const resizeObserver = new ResizeObserver(() => {
                const chartInst = ChartRenderer.instances['widget-' + w.id];
                if (chartInst) chartInst.resize();
            });
            resizeObserver.observe(widgetEl);

            // Filtra e calcula para o widget específico
            setTimeout(() => {
                const kpi = State.currentEnv.kpis?.find(k => k.id === w.kpiId);
                let cards = baseCards;
                
                if (kpi && kpi.filters) {
                    cards = KPIEngine.filterCards(cards, kpi.filters);
                }

                if (w.type === 'card') {
                    const dom = document.getElementById(`widget-${w.id}`);
                    let val = cards.length;
                    
                    if (w.operation === 'sum' && w.targetField) {
                        val = cards.reduce((acc, c) => acc + (c._numericFields[w.targetField] || 0), 0);
                        val = Math.round(val * 100) / 100;
                    }

                    dom.innerHTML = `
                        <div style="display:flex; flex-direction:column; height:100%; align-items:center; justify-content:center; cursor:pointer;" onclick="DashboardBuilder.openDrillDown('${w.groupBy || 'Lista Original'}', 'Todos os Cartões', ${JSON.stringify(cards.map(c=>c.id)).replace(/"/g, '&quot;')})">
                            <div style="font-size:3.5rem; font-weight:800; color:var(--primary); line-height:1;">${val}</div>
                            <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.5rem;">Cartões Filtrados (Clique p/ ver)</div>
                        </div>
                    `;
                } else if (w.type === 'table') {
                    const dom = document.getElementById(`widget-${w.id}`);
                    const chartData = KPIEngine.groupBy(cards, w.groupBy, w.operation, w.targetField);
                    
                    let tableRows = chartData.map(d => `
                        <tr style="cursor:pointer;" onclick="DashboardBuilder.openDrillDown('${w.groupBy}', '${d.name.replace(/'/g, "\\'")}', ${JSON.stringify(cards.filter(c => (c._groups[w.groupBy] || 'Desconhecido') === d.name).map(c=>c.id)).replace(/"/g, '&quot;')})">
                            <td style="font-weight:600">${d.name}</td>
                            <td><span class="tag-badge tag-info">${d.count} cartões</span></td>
                            <td style="font-weight:700; color:var(--primary)">${d.value}</td>
                        </tr>
                    `).join('');

                    dom.innerHTML = `
                        <div class="data-table-container" style="max-height: 320px; overflow-y: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>${w.groupBy}</th>
                                        <th>Qtd</th>
                                        <th>Valor (${w.operation || 'Count'})</th>
                                    </tr>
                                </thead>
                                <tbody>${tableRows || '<tr><td colspan="3" class="text-muted">Sem dados</td></tr>'}</tbody>
                            </table>
                        </div>
                    `;
                } else {
                    const chartData = KPIEngine.groupBy(cards, w.groupBy, w.operation, w.targetField);
                    
                    ChartRenderer.renderChart(`widget-${w.id}`, w.type, '', chartData, {
                        onItemClick: (categoryName) => {
                            const filtered = cards.filter(c => (c._groups[w.groupBy] || 'Desconhecido') === categoryName);
                            this.openDrillDown(w.groupBy, categoryName, filtered.map(c => c.id));
                        }
                    });
                }
            }, 50);
        });

        // Deletar widget
        grid.querySelectorAll('.btn-del-widget').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                Utils.confirm({
                    title: "Remover Widget",
                    message: "Deseja remover este gráfico do seu dashboard?",
                    onConfirm: async () => {
                        State.currentEnv.dashboards[0].widgets = State.currentEnv.dashboards[0].widgets.filter(w => w.id !== id);
                        await StorageService.saveEnvironment(State.currentEnv);
                        this.renderDashboard();
                        Utils.showToast("Widget removido.");
                    }
                });
            });
        });

        // Drag and drop reordering
        if (typeof Sortable !== 'undefined') {
            new Sortable(grid, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: async () => {
                    const items = Array.from(grid.children).map(c => c.dataset.id);
                    const oldWidgets = State.currentEnv.dashboards[0].widgets;
                    const newWidgets = items.map(id => oldWidgets.find(w => w.id === id)).filter(Boolean);
                    State.currentEnv.dashboards[0].widgets = newWidgets;
                    await StorageService.saveEnvironment(State.currentEnv);
                }
            });
        }
    },

    // Modal de Drill-Down (Exibe tarefas detalhadas)
    openDrillDown: function(groupByDimension, categoryValue, cardIds = []) {
        if (!State.currentTrelloData?.cards) return;

        const groups = State.currentEnv?.dataGroups || [];
        const allProcessed = KPIEngine.processCards(State.currentTrelloData.cards, groups);
        
        let matchingCards = [];
        if (Array.isArray(cardIds) && cardIds.length > 0) {
            matchingCards = allProcessed.filter(c => cardIds.includes(c.id));
        } else {
            matchingCards = allProcessed.filter(c => (c._groups[groupByDimension] || 'Desconhecido') === categoryValue);
        }

        const cardsHtml = matchingCards.map(c => {
            const trelloUrl = c.shortLink ? `https://trello.com/c/${c.shortLink}` : (c.url || '#');
            
            let badgeClass = 'tag-info';
            if (c._groups["Status de SLA"] === 'Atrasado') badgeClass = 'tag-danger';
            if (c._groups["Status de SLA"] === 'Concluído no Prazo') badgeClass = 'tag-success';

            return `
                <div class="drill-card-item">
                    <div style="flex:1">
                        <strong style="font-size: 0.95rem; color: var(--text-main);">${c.name}</strong>
                        <div style="display:flex; gap:0.5rem; margin-top:0.4rem; font-size:0.75rem; color:var(--text-muted); flex-wrap:wrap;">
                            <span>📌 ${c._groups["Lista Original"]}</span>
                            <span>👤 ${c._groups["Membro Responsável"]}</span>
                            <span>📅 Criado: ${c._groups["Data de Criação"]}</span>
                            <span>⏱️ ${c._groups["Lead Time (Dias)"]}</span>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
                        <span class="tag-badge ${badgeClass}">${c._groups["Status de SLA"]}</span>
                        <a href="${trelloUrl}" target="_blank" class="btn btn-outline btn-sm" style="font-size:0.75rem; padding:0.2rem 0.5rem;">Abrir no Trello ↗</a>
                    </div>
                </div>
            `;
        }).join('');

        Utils.showModal({
            title: `Detalhamento: ${categoryValue} (${matchingCards.length} tarefas)`,
            content: `
                <div style="margin-bottom: 1rem;">
                    <p style="font-size:0.85rem; color:var(--text-muted)">Visualizando cartões correspondentes ao agrupamento <strong>${groupByDimension}</strong>.</p>
                </div>
                <div style="max-height: 60vh; overflow-y: auto; padding-right:0.25rem;">
                    ${cardsHtml || '<p class="text-muted">Nenhum cartão encontrado neste segmento.</p>'}
                </div>
            `,
            buttons: [
                { text: "Fechar", class: "btn-primary" }
            ]
        });
    },

    openWidgetModal: function() {
        if (!State.currentEnv || !State.currentTrelloData) {
            Utils.showToast("Sincronize os dados primeiro.", "error");
            return;
        }

        const kpis = State.currentEnv.kpis || [];
        const groups = KPIEngine.getAvailableGroups();

        const formContent = `
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
                <div>
                    <label style="font-size:0.8rem; font-weight:600;">Título do Widget</label>
                    <input type="text" id="w-title" style="width:100%; margin-top:0.25rem;" placeholder="Ex: Tarefas por Status">
                </div>
                <div>
                    <label style="font-size:0.8rem; font-weight:600;">Filtro / KPI Base</label>
                    <select id="w-kpi" style="width:100%; margin-top:0.25rem;">
                        <option value="">(Todos os Cartões)</option>
                        ${kpis.map(k => `<option value="${k.id}">${k.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.8rem; font-weight:600;">Agrupar Por (Dimensão)</label>
                    <select id="w-group" style="width:100%; margin-top:0.25rem;">
                        ${groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.8rem; font-weight:600;">Operação de Cálculo</label>
                    <select id="w-op" style="width:100%; margin-top:0.25rem;">
                        <option value="count">Contagem de Cartões (COUNT)</option>
                        <option value="sum">Somatório de Valores (SUM)</option>
                        <option value="avg">Média de Valores (AVG)</option>
                        <option value="min">Valor Mínimo (MIN)</option>
                        <option value="max">Valor Máximo (MAX)</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:0.8rem; font-weight:600;">Tipo de Visualização</label>
                    <select id="w-type" style="width:100%; margin-top:0.25rem;">
                        <option value="pie">Gráfico de Pizza</option>
                        <option value="doughnut">Gráfico de Rosca</option>
                        <option value="bar">Barras Horizontais</option>
                        <option value="column">Colunas Verticais</option>
                        <option value="line">Gráfico de Linha (Tendência)</option>
                        <option value="area">Gráfico de Área</option>
                        <option value="funnel">Gráfico de Funil</option>
                        <option value="table">Tabela Dinâmica</option>
                        <option value="card">Card numérico (Big Number)</option>
                    </select>
                </div>
            </div>
        `;

        Utils.showModal({
            title: "Adicionar Widget ao Dashboard",
            content: formContent,
            buttons: [
                { text: "Cancelar", class: "btn-outline" },
                {
                    text: "Adicionar Widget",
                    class: "btn-primary",
                    onClick: async () => {
                        const title = document.getElementById('w-title').value.trim() || 'Novo Gráfico';
                        const kpiId = document.getElementById('w-kpi').value;
                        const groupBy = document.getElementById('w-group').value;
                        const operation = document.getElementById('w-op').value;
                        const type = document.getElementById('w-type').value;

                        if (!State.currentEnv.dashboards) State.currentEnv.dashboards = [{ id: 'default', name: 'Principal', widgets: [] }];
                        if (!State.currentEnv.dashboards[0]) State.currentEnv.dashboards[0] = { id: 'default', name: 'Principal', widgets: [] };

                        State.currentEnv.dashboards[0].widgets.push({
                            id: Utils.generateId(),
                            title, kpiId, groupBy, operation, type
                        });

                        await StorageService.saveEnvironment(State.currentEnv);
                        Utils.showToast("Widget adicionado!", "success");
                        this.renderDashboard();
                    }
                }
            ]
        });
    }
};

document.addEventListener('view:dashboard:loaded', () => {
    DashboardBuilder.initView();
});

