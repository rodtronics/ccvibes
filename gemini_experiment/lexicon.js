const Lexicon = {
    data: {},
    loaded: false,

    async init() {
        try {
            const response = await fetch('./data/lexicon.json');
            if (!response.ok) throw new Error('Network response was not ok');
            this.data = await response.json();
            this.loaded = true;
            console.log("Lexicon loaded.");
        } catch (error) {
            console.warn("Lexicon failed to load, using fallbacks.", error);
            this.data = {};
        }
    },

    get(path) {
        if (!this.loaded && Object.keys(this.data).length === 0) return path.split('.').pop().toUpperCase();
        
        const keys = path.split('.');
        let current = this.data;
        
        for (const key of keys) {
            if (current[key] === undefined) {
                return path; // Fallback to path
            }
            current = current[key];
        }
        
        return current;
    },

    template(path, variables) {
        let templateString = this.get(path);
        if (templateString === path) return path; // Return path if not found

        for (const [key, value] of Object.entries(variables)) {
            templateString = templateString.replace(`{${key}}`, value);
        }
        return templateString;
    }
};

window.Lexicon = Lexicon;