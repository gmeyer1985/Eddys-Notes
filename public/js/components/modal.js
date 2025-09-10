// Modal Component
class Modal {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.modalContent = this.modal?.querySelector('.modal-content');
        this.closeBtn = this.modal?.querySelector('.close');
        this.init();
    }

    init() {
        if (!this.modal) return;

        // Close button event
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        // Click outside to close
        this.modal.addEventListener('click', (event) => {
            if (event.target === this.modal) {
                this.close();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.modal.style.display === 'block') {
                this.close();
            }
        });
    }

    open() {
        if (this.modal) {
            this.modal.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent background scroll
            
            // Focus trap
            this.trapFocus();
        }
    }

    close() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = ''; // Restore scroll
        }
    }

    trapFocus() {
        const focusableElements = this.modalContent.querySelectorAll(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        );
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        firstElement.focus();

        this.modalContent.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                if (event.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        event.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        event.preventDefault();
                    }
                }
            }
        });
    }

    setContent(title, content) {
        const titleElement = this.modal.querySelector('h2');
        const contentArea = this.modal.querySelector('.modal-body');
        
        if (titleElement) titleElement.textContent = title;
        if (contentArea) contentArea.innerHTML = content;
    }

    setTitle(title) {
        const titleElement = this.modal.querySelector('h2');
        if (titleElement) titleElement.textContent = title;
    }
}

// Factory function to create modals
window.createModal = function(modalId) {
    return new Modal(modalId);
};

// Export the Modal class
window.Modal = Modal;