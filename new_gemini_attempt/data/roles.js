export const roles = [
    {
        id: "runner",
        name: "runner",
        description: "fast on their feet.",
        xpToStars: [
            { stars: 0, minXp: 0 },
            { stars: 1, minXp: 100 },
            { stars: 2, minXp: 500 }
        ]
    },
    {
        id: "thief",
        name: "thief",
        description: "good with hands.",
        xpToStars: [
            { stars: 0, minXp: 0 },
            { stars: 1, minXp: 200 }
        ]
    }
];

export const initialStaff = [
    {
        id: "s_001",
        name: "Fast Eddie",
        roleId: "runner",
        xp: 0,
        status: "available",
        unavailableUntil: 0
    },
    {
        id: "s_002",
        name: "Slippery Pete",
        roleId: "thief",
        xp: 0,
        status: "available",
        unavailableUntil: 0
    }
];
