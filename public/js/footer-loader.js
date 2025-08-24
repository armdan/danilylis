<!-- ================================
     FILE: /js/footer-loader.js
     JavaScript to load footer dynamically
     ================================ -->
<script>
class FooterLoader {
    static async load() {
        try {
            // Create a container for the footer if it doesn't exist
            let footerContainer = document.getElementById('footer-container');
            if (!footerContainer) {
                footerContainer = document.createElement('div');
                footerContainer.id = 'footer-container';
                document.body.appendChild(footerContainer);
            }

            // Fetch the footer HTML
            const response = await fetch('/components/footer.html');
            if (!response.ok) {
                throw new Error(`Failed to load footer: ${response.status}`);
            }

            const footerHTML = await response.text();
            footerContainer.innerHTML = footerHTML;

            // Optional: Mark current page as active in footer
            this.markCurrentPage();

        } catch (error) {
            console.error('Error loading footer:', error);
            // Optionally show a fallback footer
            this.showFallbackFooter();
        }
    }

    static markCurrentPage() {
        // Get current page path
        const currentPath = window.location.pathname;
        
        // Find and mark the current link as active
        const footerLinks = document.querySelectorAll('.footer-links a');
        footerLinks.forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.style.color = '#3498db';
                link.style.fontWeight = '600';
            }
        });
    }

    static showFallbackFooter() {
        const footerContainer = document.getElementById('footer-container');
        if (footerContainer) {
            footerContainer.innerHTML = `
                <footer class="unified-footer" style="text-align: center; padding: 1rem;">
                    <p>&copy; 2025 Danilylis Laboratory. All rights reserved.</p>
                </footer>
            `;
        }
    }
}

// Auto-load footer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FooterLoader.load());
} else {
    FooterLoader.load();
}
</script>