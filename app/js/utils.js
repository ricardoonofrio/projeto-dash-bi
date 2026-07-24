// utils.js - Funções Utilitárias e Componentes de Interface

const Utils = {
    generateId: function() {
        return Math.random().toString(36).substr(2, 9);
    },
    
    // Infere a data exata de criação do cartão a partir do ID do Trello (24 caracteres hex)
    getTrelloCreationDate: function(id) {
        if (!id || typeof id !== 'string' || id.length < 8) return null;
        try {
            const timestamp = parseInt(id.substring(0, 8), 16);
            return new Date(timestamp * 1000);
        } catch (e) {
            return null;
        }
    },

    formatDate: function(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' };
        return d.toLocaleDateString('pt-BR', options);
    },

    formatShortDate: function(dateString) {
        if (!dateString) return 'Sem Data';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return 'Sem Data';
        return d.toLocaleDateString('pt-BR');
    },

    formatMonthYear: function(dateString) {
        if (!dateString) return 'Sem Data';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return 'Sem Data';
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${months[d.getMonth()]}/${d.getFullYear()}`;
    },

    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    showToast: function(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `<span style="font-weight:bold">${icons[type] || ''}</span> <span>${message}</span>`;
        
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 20px',
            background: type === 'error' ? 'var(--danger)' : (type === 'success' ? 'var(--success)' : (type === 'warning' ? 'var(--warning)' : 'var(--primary)')),
            color: 'white',
            fontFamily: 'var(--font-family)',
            fontSize: '0.875rem',
            fontWeight: '500',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: 'translateY(10px)',
            opacity: '0'
        });

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });

        setTimeout(() => {
            toast.style.transform = 'translateY(10px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // Modal Elegante Customizado
    showModal: function({ title, content, buttons = [], onClose = null }) {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';

        const box = document.createElement('div');
        box.className = 'custom-modal-box';

        const header = document.createElement('div');
        header.className = 'custom-modal-header';
        header.innerHTML = `
            <h3>${title}</h3>
            <button class="btn btn-icon btn-close-modal">&times;</button>
        `;

        const body = document.createElement('div');
        body.className = 'custom-modal-body';
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }

        const footer = document.createElement('div');
        footer.className = 'custom-modal-footer';

        buttons.forEach(b => {
            const btn = document.createElement('button');
            btn.className = `btn ${b.class || 'btn-secondary'}`;
            btn.innerText = b.text;
            btn.addEventListener('click', () => {
                if (b.onClick) {
                    const shouldClose = b.onClick(box, overlay);
                    if (shouldClose !== false) overlay.remove();
                } else {
                    overlay.remove();
                }
            });
            footer.appendChild(btn);
        });

        box.appendChild(header);
        box.appendChild(body);
        box.appendChild(footer);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const closeBtn = header.querySelector('.btn-close-modal');
        closeBtn.addEventListener('click', () => {
            if (onClose) onClose();
            overlay.remove();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (onClose) onClose();
                overlay.remove();
            }
        });

        return { overlay, box, body };
    },

    confirm: function({ title = "Confirmação", message, onConfirm }) {
        this.showModal({
            title: title,
            content: `<p style="font-size:0.95rem; color:var(--text-main); line-height:1.5;">${message}</p>`,
            buttons: [
                { text: "Cancelar", class: "btn-outline" },
                { text: "Confirmar", class: "btn-danger", onClick: () => { onConfirm(); } }
            ]
        });
    }
};

