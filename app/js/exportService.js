// exportService.js - Serviço para PDF Executivo, CSV e Backup JSON

const ExportService = {
    initView: function() {
        const viewEl = document.getElementById('view-config');
        if (!viewEl) return;

        viewEl.innerHTML = `
            <div class="card">
                <h2>Exportação e Backup do Ambiente</h2>
                <p>Gere relatórios executivos ou exporte seus dados para backup e análise externa.</p>
                
                <div class="mt-3" style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <div style="flex:1; min-width: 250px; background: var(--bg-main); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">📄 Relatório em PDF Executivo</h3>
                        <p style="font-size: 0.825rem; color: var(--text-muted); margin-bottom: 1rem;">Exporta o dashboard visual formatado em PDF A4 com cabeçalho gerencial do núcleo.</p>
                        <button class="btn btn-primary" id="btn-export-pdf">Gerar PDF do Dashboard</button>
                    </div>

                    <div style="flex:1; min-width: 250px; background: var(--bg-main); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">📊 Dados em Planilha (CSV)</h3>
                        <p style="font-size: 0.825rem; color: var(--text-muted); margin-bottom: 1rem;">Baixe todos os cartões com seus grupos modelados e SLA para análise no Excel.</p>
                        <button class="btn btn-secondary" id="btn-export-csv">Exportar Dados para CSV</button>
                    </div>

                    <div style="flex:1; min-width: 250px; background: var(--bg-main); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">💾 Backup Completo (JSON)</h3>
                        <p style="font-size: 0.825rem; color: var(--text-muted); margin-bottom: 1rem;">Salve todas as configurações de agrupamentos, KPIs e visualizações deste ambiente.</p>
                        <button class="btn btn-outline" id="btn-export-json">Baixar Backup JSON</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-export-json').addEventListener('click', () => {
            this.exportEnvironmentJSON();
        });

        document.getElementById('btn-export-pdf').addEventListener('click', () => {
            this.exportDashboardPDF();
        });

        document.getElementById('btn-export-csv').addEventListener('click', () => {
            this.exportCardsCSV();
        });
    },

    exportEnvironmentJSON: function() {
        if (!State.currentEnv) {
            Utils.showToast("Nenhum ambiente carregado.", "error");
            return;
        }
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(State.currentEnv, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `Backup_${State.currentEnv.acronym}_${new Date().getTime()}.json`);
        dlAnchorElem.click();
        dlAnchorElem.remove();
        Utils.showToast("Backup baixado com sucesso!", "success");
    },

    exportCardsCSV: function() {
        if (!State.currentTrelloData?.cards) {
            Utils.showToast("Sincronize os dados do Trello primeiro.", "error");
            return;
        }

        const groups = State.currentEnv?.dataGroups || [];
        const processed = KPIEngine.processCards(State.currentTrelloData.cards, groups);

        const rows = processed.map(c => {
            const row = {
                "ID": c.id,
                "Nome do Cartão": c.name,
                "Lista": c._groups["Lista Original"],
                "Membro": c._groups["Membro Responsável"],
                "Etiqueta": c._groups["Etiqueta Original"],
                "Data Criação": c._groups["Data de Criação"],
                "Data Vencimento": c._groups["Data de Vencimento"],
                "Status SLA": c._groups["Status de SLA"],
                "Lead Time (Dias)": c._numericFields["Lead Time (Dias)"] || 0
            };

            // Adiciona grupos modelados
            groups.forEach(g => {
                row[g.name] = c._groups[g.name] || 'Não Categorizado';
            });

            return row;
        });

        if (typeof Papa !== 'undefined') {
            const csv = Papa.unparse(rows);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Dados_${State.currentEnv.acronym}_${new Date().getTime()}.csv`);
            link.click();
            Utils.showToast("Planilha CSV gerada com sucesso!", "success");
        } else {
            Utils.showToast("Biblioteca PapaParse não disponível.", "error");
        }
    },

    exportDashboardPDF: function() {
        const grid = document.getElementById('dash-grid');
        if (!grid || grid.children.length === 0) {
            Utils.showToast("O dashboard está vazio.", "warning");
            return;
        }

        Utils.showToast("Gerando PDF Executivo...", "info");

        if (typeof html2pdf !== 'undefined') {
            const tempContainer = document.createElement('div');
            tempContainer.style.padding = '20px';
            tempContainer.style.background = '#ffffff';
            tempContainer.style.color = '#0f172a';

            tempContainer.innerHTML = `
                <div style="border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h1 style="font-size: 20pt; margin: 0; color: #0284c7;">Relatório Executivo de BI</h1>
                        <h2 style="font-size: 13pt; margin: 5px 0 0 0; color: #475569;">${State.currentEnv.acronym} - ${State.currentEnv.name}</h2>
                    </div>
                    <div style="text-align: right; font-size: 9pt; color: #64748b;">
                        <div>Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
                        <div>Origem: DashBuilder BI Trello</div>
                    </div>
                </div>
            `;

            const clonedGrid = grid.cloneNode(true);
            tempContainer.appendChild(clonedGrid);
            document.body.appendChild(tempContainer);

            const opt = {
                margin:       [0.4, 0.4, 0.4, 0.4],
                filename:     `Relatorio_BI_${State.currentEnv.acronym}_${new Date().toISOString().substring(0,10)}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
            };

            html2pdf().set(opt).from(tempContainer).save().then(() => {
                tempContainer.remove();
                Utils.showToast("PDF gerado e baixado!", "success");
            }).catch(err => {
                tempContainer.remove();
                Utils.showToast("Erro ao gerar PDF: " + err.message, "error");
            });
        } else {
            Utils.showToast("Biblioteca html2pdf não carregada.", "error");
        }
    }
};

document.addEventListener('view:config:loaded', () => {
    ExportService.initView();
});

