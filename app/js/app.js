// app.js - Ponto de Entrada da Aplicação

document.addEventListener('DOMContentLoaded', () => {
    // Escuta resize da janela para ajustar gráficos do ECharts globalmente
    window.addEventListener('resize', Utils.debounce(() => {
        if (typeof ChartRenderer !== 'undefined') {
            ChartRenderer.resizeAll();
        }
    }, 250));

    // Eventos globais do Topbar
    const btnPresentation = document.getElementById('btn-presentation');
    if(btnPresentation) {
        btnPresentation.addEventListener('click', () => {
            const mainContent = document.querySelector('.main-content');
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                mainContent.requestFullscreen().catch(err => {
                    Utils.showToast(`Erro ao ativar tela cheia: ${err.message}`, "error");
                });
            }
        });
    }

    // Configura listeners de fullScreen
    document.addEventListener('fullscreenchange', () => {
        const isFull = !!document.fullscreenElement;
        const sidebar = document.querySelector('.sidebar');
        const topbar = document.querySelector('.topbar');
        
        if(isFull) {
            sidebar.classList.add('hidden');
            topbar.classList.add('hidden');
            State.navigate('dashboard'); // Força a tela de apresentação
            // Espera a animação e reajusta os gráficos
            setTimeout(() => ChartRenderer.resizeAll(), 300);
        } else {
            sidebar.classList.remove('hidden');
            topbar.classList.remove('hidden');
            setTimeout(() => ChartRenderer.resizeAll(), 300);
        }
    });

    console.log("DashBuilder inicializado com sucesso.");
});
