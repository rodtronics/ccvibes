export const Lexicon = {
    data: {
        actions: {
            start: "START",
            stop: "STOP",
            cancel: "CANCEL",
            repeat: "REPEAT",
            stop_repeat: "STOP REPEAT"
        },
        status: {
            available: "AVAILABLE",
            busy: "BUSY",
            unavailable: "UNAVAILABLE",
            active: "ACTIVE",
            completed: "COMPLETED"
        },
        labels: {
            cash: "CASH",
            heat: "HEAT",
            crew: "CREW",
            active_runs: "ACTIVE RUNS"
        },
        tabs: {
            jobs: "JOBS",
            active: "ACTIVE",
            crew: "CREW",
            settings: "SETTINGS"
        }
    },

    get(path) {
        const parts = path.split('.');
        let current = this.data;
        for (const part of parts) {
            if (current[part] === undefined) return path;
            current = current[part];
        }
        return current;
    },

    template(path, vars) {
        let text = this.get(path);
        for (const [key, value] of Object.entries(vars)) {
            text = text.replace(`{${key}}`, value);
        }
        return text;
    }
};
