export const activities = [
    {
        id: "shoplifting",
        branchId: "street",
        name: "shoplifting",
        description: "borrowing without asking.",
        visibleIf: [], // Always visible for now
        options: [
            {
                id: "shoplifting_grab_and_go",
                name: "grab and go",
                description: "quick and dirty.",
                repeatable: true,
                durationMs: 5000,
                requirements: {
                    staff: [
                        { roleId: "runner", count: 1, starsMin: 0, required: true }
                    ]
                },
                resolution: {
                    type: "weighted_outcomes",
                    outcomes: [
                        { 
                            id: "success", 
                            weight: 80, 
                            outputs: { resources: { cash: 15, heat: 2 } },
                            effects: []
                        },
                        { 
                            id: "caught", 
                            weight: 20, 
                            outputs: { resources: { heat: 10 } },
                            jail: { durationMs: 10000 },
                            effects: []
                        }
                    ]
                }
            },
            {
                id: "shoplifting_distraction",
                name: "distraction team",
                description: "one talks, one walks.",
                repeatable: false,
                durationMs: 12000,
                requirements: {
                    staff: [
                        { roleId: "runner", count: 1, starsMin: 0, required: true },
                        { roleId: "thief", count: 1, starsMin: 0, required: true }
                    ]
                },
                resolution: {
                    type: "weighted_outcomes",
                    outcomes: [
                        { 
                            id: "big_score", 
                            weight: 70, 
                            outputs: { resources: { cash: 50, heat: 5 } },
                            effects: []
                        },
                        { 
                            id: "failure", 
                            weight: 30, 
                            outputs: { resources: { heat: 15 } },
                            effects: []
                        }
                    ]
                }
            }
        ]
    }
];
