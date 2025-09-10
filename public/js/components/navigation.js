// Navigation Component
class Navigation {
    constructor() {
        this.hamburger = document.querySelector('.hamburger-menu');
        this.navMenu = document.getElementById('navMenu');
        this.init();
    }

    init() {
        // Add click event to hamburger menu
        if (this.hamburger) {
            this.hamburger.addEventListener('click', () => this.toggleMenu());
        }

        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            if (!this.hamburger.contains(event.target) && !this.navMenu.contains(event.target)) {
                this.closeMenu();
            }
        });

        // Close menu when pressing escape
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeMenu();
            }
        });
    }

    toggleMenu() {
        this.hamburger.classList.toggle('active');
        this.navMenu.classList.toggle('active');
    }

    closeMenu() {
        this.hamburger.classList.remove('active');
        this.navMenu.classList.remove('active');
    }

    // Method to highlight current page
    setActivePage(page) {
        const links = this.navMenu.querySelectorAll('a');
        links.forEach(link => {
            link.classList.remove('active');
            if (link.textContent.toLowerCase().includes(page.toLowerCase())) {
                link.classList.add('active');
            }
        });
    }
}

// Export for use in main.js
window.Navigation = Navigation;