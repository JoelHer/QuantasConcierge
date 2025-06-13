class StarCitizenLocation {
    constructor() {
        // Hierarchical data: systems > planets > moons
        this.systems = [
            {
                name: 'Stanton',
                planets: [
                    {
                        name: 'MicroTech',
                        moons: ['Calliope', 'Clio', 'Euterpe']
                    },
                    {
                        name: 'ArcCorp',
                        moons: ['Lyria', 'Wala']
                    },
                    {
                        name: 'Hurston',
                        moons: ['Aberdeen', 'Magda', 'Ita', 'Arial']
                    },
                    {
                        name: 'Crusader',
                        moons: ['Cellin', 'Daymar', 'Yela']
                    }
                ]
            },
            {
                name: 'Pyro',
                planets: [
                    {
                        name: 'Pyro II',
                        moons: []
                    },
                    {
                        name: 'Pyro III',
                        moons: []
                    },
                    {
                        name: 'Pyro IV',
                        moons: []
                    },
                    {
                        name: 'Pyro V',
                        moons: []
                    },
                    {
                        name: 'Pyro VI',
                        moons: []
                    }
                ]
            }
        ];
    }

    getSystems() {
        return this.systems.map(system => system.name);
    }

    getPlanets(systemName) {
        const system = this.systems.find(s => s.name.toLowerCase() === systemName.toLowerCase());
        return system ? system.planets.map(p => p.name) : [];
    }

    getMoons(systemName, planetName) {
        const system = this.systems.find(s => s.name.toLowerCase() === systemName.toLowerCase());
        if (!system) return [];
        const planet = system.planets.find(p => p.name.toLowerCase() === planetName.toLowerCase());
        return planet ? planet.moons : [];
    }

    getBodies() {
        // Returns: System > Planet, System > Planet > Moon
        const bodies = [];
        for (const system of this.systems) {
            for (const planet of system.planets) {
                bodies.push(`${system.name} > ${planet.name}`);
                for (const moon of planet.moons) {
                    bodies.push(`${system.name} > ${planet.name} > ${moon}`);
                }
            }
        }
        return bodies;
    }
}

module.exports = StarCitizenLocation;