document.addEventListener('DOMContentLoaded', async () => {
    console.log("Booting system...");
    
    // 1. Load Lexicon
    if (window.Lexicon) {
        await window.Lexicon.init();
    }

    // 2. Initialize Engine (loads data)
    if (window.Engine) {
        await window.Engine.init();
    }

    // 3. Initialize UI
    if (window.UI) {
        window.UI.init();
    }
});