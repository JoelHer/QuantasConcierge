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
                        name: 'MicroTech Lagrange',
                        moons: ['L1', 'L2', 'L3', 'L4', 'L5'],
                        disablePlanetSelection: true
                    },
                    {
                        name: 'ArcCorp',
                        moons: ['Lyria', 'Wala']
                    },
                    {
                        name: 'ArcCorp Lagrange',
                        moons: ['L1', 'L2', 'L3', 'L4', 'L5'],
                        disablePlanetSelection: true
                        
                    },
                    {
                        name: 'Hurston',
                        moons: ['Aberdeen', 'Magda', 'Ita', 'Arial']
                    },
                    {
                        name: 'Hurston Lagrange',
                        moons: ['L1', 'L2', 'L3', 'L4', 'L5'],
                        disablePlanetSelection: true
                    },
                    {
                        name: 'Crusader',
                        moons: ['Cellin', 'Daymar', 'Yela']
                    },
                    {
                        name: 'Crusader Lagrange',
                        moons: ['L1', 'L2', 'L3', 'L4', 'L5'],
                        disablePlanetSelection: true
                    },
                    {
                        name: 'Jump Points',
                        moons: ['Pyro Gateway', 'Magnus Gateway', 'Terra Gateway'],
                        disablePlanetSelection: true
                    }
                ]
            },
            {
                name: 'Pyro',
                planets: [
                    {
                        name: 'Pyro I',
                        moons: []
                    },
                    {
                        name: 'Pyro I Lagrange',
                        moons: ['L1', 'L2', 'L3', 'L4', 'L5'],
                        disablePlanetSelection: true
                    },
                    {
                        name: 'Monox',
                        moons: []
                    },
                    {
                        name: 'Monox Lagrange',
                        moons: ['L1', 'L2', 'L3', 'L4', 'L5'],
                        disablePlanetSelection: true
                    },
                    {
                        name: 'Bloom',
                        moons: []
                    },
                    {
                        name: 'Bloom Lagrange',
                        moons: ['L1', 'L2', 'L3', 'L4', 'L5'],
                        disablePlanetSelection: true
                    },
                    {
                        name: 'Pyro V',
                        moons: ['Ignis', 'Vatra', 'Adir', 'Fairo', 'Fuego', 'Vuur','Pyro IV']
                    },
                    {
                        name: 'Pyro V Lagrange',
                        moons: ['L1', 'L2', 'L3', 'L4', 'L5'],
                        disablePlanetSelection: true
                    },
                    {
                        name: 'Terminus',
                        moons: []
                    },
                    {
                        name: 'Terminus Lagrange',
                        moons: ['L1', 'L2', 'L3', 'L4', 'L5'],
                        disablePlanetSelection: true
                    },
                    {
                        name: 'Jump Points',
                        moons: ['Stanton Gateway'],
                        disablePlanetSelection: true
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

    getDisablePlanetSelection(systemName, planetName) {
        // if the planet has the disablePlanetSelection property set to true, return true, if it does not exist, return false
        const system = this.systems.find(s => s.name.toLowerCase() === systemName.toLowerCase());
        if (!system) return false;
        const planet = system.planets.find(p => p.name.toLowerCase() === planetName.toLowerCase());
        return planet ? planet.disablePlanetSelection || false : false;
        
    }
}

module.exports = StarCitizenLocation;