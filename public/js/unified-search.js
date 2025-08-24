/* ================================
   FILE: /js/unified-search.js
   ================================ */

class UnifiedSearch {
    constructor(config) {
        this.config = {
            searchFunction: config.searchFunction || null,
            clearFunction: config.clearFunction || null,
            autoSearch: config.autoSearch || false,
            debounceDelay: config.debounceDelay || 300,
            minSearchLength: config.minSearchLength || 2
        };
        
        this.searchTimeout = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupEnterKeySearch();
        
        if (this.config.autoSearch) {
            this.setupAutoSearch();
        }
    }
    
    setupEventListeners() {
        // Search icon click
        const searchIcons = document.querySelectorAll('.search-icon');
        searchIcons.forEach(icon => {
            icon.addEventListener('click', () => this.search());
        });
        
        // Clear button
        const clearBtn = document.querySelector('.btn-search-secondary');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearFilters());
        }
        
        // Search button
        const searchBtn = document.querySelector('.btn-search-primary');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.search());
        }
    }
    
    setupEnterKeySearch() {
        const inputs = document.querySelectorAll('.unified-search-card input[type="text"]');
        inputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.search();
                }
            });
        });
    }
    
    setupAutoSearch() {
        // Auto-search on filter change
        const selects = document.querySelectorAll('.unified-search-card select');
        selects.forEach(select => {
            select.addEventListener('change', () => this.debouncedSearch());
        });
        
        // Auto-search on input with debounce
        const inputs = document.querySelectorAll('.unified-search-card input[type="text"]');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.debouncedSearch());
        });
    }
    
    debouncedSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.search();
        }, this.config.debounceDelay);
    }
    
    search() {
        const filters = this.getFilters();
        
        // Check minimum search length for text inputs
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.length > 0 && 
            searchInput.value.length < this.config.minSearchLength) {
            return;
        }
        
        if (this.config.searchFunction) {
            this.config.searchFunction(filters);
        }
    }
    
    clearFilters() {
        // Clear all text and date inputs
        const inputs = document.querySelectorAll('.unified-search-card input');
        inputs.forEach(input => {
            input.value = '';
        });
        
        // Reset all selects
        const selects = document.querySelectorAll('.unified-search-card select');
        selects.forEach(select => {
            select.selectedIndex = 0;
        });
        
        // Call the page-specific clear function
        if (this.config.clearFunction) {
            this.config.clearFunction();
        }
    }
    
    getFilters() {
        const filters = {};
        
        // Get all input values
        const inputs = document.querySelectorAll('.unified-search-card input');
        inputs.forEach(input => {
            if (input.value) {
                filters[input.id] = input.value;
            }
        });
        
        // Get all select values
        const selects = document.querySelectorAll('.unified-search-card select');
        selects.forEach(select => {
            if (select.value) {
                filters[select.id] = select.value;
            }
        });
        
        return filters;
    }
    
    setFilter(filterId, value) {
        const element = document.getElementById(filterId);
        if (element) {
            element.value = value;
        }
    }
}