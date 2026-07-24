// chartRenderer.js - Adaptador para o Apache ECharts e Suporte a Novas Visualizações

const ChartRenderer = {
    instances: {},
    clickHandlers: {},

    // Inicializa ou atualiza um gráfico em um container DOM
    renderChart: function(containerId, type, title, data, options = {}) {
        const dom = document.getElementById(containerId);
        if (!dom) return;

        if (this.instances[containerId]) {
            this.instances[containerId].dispose();
        }

        const isDark = document.body.classList.contains('theme-dark');
        const chart = echarts.init(dom, isDark ? 'dark' : null);
        this.instances[containerId] = chart;

        let option = {};
        const primaryColor = State.currentEnv?.theme?.primary || '#0284c7';
        const colors = ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

        if (type === 'pie' || type === 'doughnut') {
            option = {
                title: { text: title, left: 'center', textStyle: { fontSize: 13, fontWeight: '600' }, top: 5 },
                tooltip: { trigger: 'item', formatter: '{b}: <b>{c}</b> ({d}%)' },
                color: colors,
                legend: { bottom: 0, textStyle: { fontSize: 11 }, type: 'scroll' },
                series: [{
                    name: title,
                    type: 'pie',
                    radius: type === 'doughnut' ? ['40%', '65%'] : '55%',
                    center: ['50%', '45%'],
                    data: data,
                    label: { show: true, formatter: '{b}: {c}' },
                    emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.3)' } }
                }]
            };
        } else if (type === 'bar' || type === 'column') {
            const isHorizontal = type === 'bar';
            option = {
                title: { text: title, left: 'center', textStyle: { fontSize: 13, fontWeight: '600' } },
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
                xAxis: isHorizontal ? { type: 'value' } : { type: 'category', data: data.map(d => d.name), axisLabel: { interval: 0, rotate: data.length > 6 ? 25 : 0 } },
                yAxis: isHorizontal ? { type: 'category', data: data.map(d => d.name) } : { type: 'value' },
                series: [{
                    name: 'Total',
                    type: 'bar',
                    data: data.map(d => d.value),
                    itemStyle: { color: primaryColor, borderRadius: [4, 4, 0, 0] }
                }]
            };
        } else if (type === 'line' || type === 'area') {
            option = {
                title: { text: title, left: 'center', textStyle: { fontSize: 13, fontWeight: '600' } },
                tooltip: { trigger: 'axis' },
                grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
                xAxis: { type: 'category', data: data.map(d => d.name) },
                yAxis: { type: 'value' },
                series: [{
                    name: 'Total',
                    type: 'line',
                    smooth: true,
                    data: data.map(d => d.value),
                    itemStyle: { color: primaryColor },
                    areaStyle: type === 'area' ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: primaryColor }, { offset: 1, color: 'transparent' }]) } : undefined
                }]
            };
        } else if (type === 'funnel') {
            option = {
                title: { text: title, left: 'center', textStyle: { fontSize: 13, fontWeight: '600' } },
                tooltip: { trigger: 'item', formatter: '{b}: <b>{c}</b>' },
                color: colors,
                series: [{
                    name: title,
                    type: 'funnel',
                    left: '10%', top: 40, bottom: 20, width: '80%',
                    min: 0, max: Math.max(...data.map(d => d.value), 1),
                    minSize: '0%', maxSize: '100%',
                    sort: 'descending', gap: 2,
                    label: { show: true, position: 'inside' },
                    data: data
                }]
            };
        } else if (type === 'gauge') {
            const totalVal = data.reduce((acc, d) => acc + d.value, 0);
            const targetVal = options.targetGoal || 100;
            const percent = Math.min(100, Math.round((totalVal / targetVal) * 100));

            option = {
                title: { text: title, left: 'center', textStyle: { fontSize: 13, fontWeight: '600' } },
                series: [{
                    type: 'gauge',
                    startAngle: 180, endAngle: 0,
                    min: 0, max: targetVal,
                    splitNumber: 5,
                    itemStyle: { color: primaryColor },
                    progress: { show: true, width: 18 },
                    pointer: { show: true },
                    axisLine: { lineStyle: { width: 18 } },
                    axisTick: { show: false },
                    splitLine: { length: 8, lineStyle: { width: 2, color: '#999' } },
                    axisLabel: { distance: 12, color: '#999', fontSize: 10 },
                    detail: { valueAnimation: true, formatter: '{value}', fontSize: 20, offsetCenter: [0, '20%'] },
                    data: [{ value: totalVal, name: 'Progresso' }]
                }]
            };
        }

        chart.setOption(option);

        // Suporte ao evento de Drill-Down ao clicar em qualquer item do gráfico
        chart.off('click');
        chart.on('click', function(params) {
            if (options.onItemClick) {
                const categoryName = params.name || (params.data && params.data.name);
                options.onItemClick(categoryName, params);
            }
        });

        return chart;
    },

    resizeAll: function() {
        Object.values(this.instances).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }
};

