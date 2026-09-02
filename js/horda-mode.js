        // ══════════════════════════════════════════════════════════════════
        // MODO HORDA — Motor de generación de oleadas
        // Genera la composición de los 5 orcos de cada oleada: rango + reliquias
        // equipadas (tier y cantidad), siguiendo el modelo "Vanguardia + Escuadra"
        // acordado. Es infraestructura pura (no toca UI ni Firebase) — se conecta
        // al resto del modo cuando esté lista la lista de Orcos.
        //
        // MODELO:
        //  - 1 orco "Vanguardia" (índice 0 del array de enemigos): sube de rango
        //    más rápido, alcanza el rango máximo (SSS) alrededor de la oleada 20.
        //  - 4 orcos "Escuadra" (índices 1-4): suben más lento, alcanzan SSS
        //    alrededor de la oleada 50.
        //  - Reliquias: tier progresa Raro -> Especial -> Epico -> Legendario
        //    conforme avanzan las oleadas; cantidad de slots equipados sube de
        //    0 a 6 (el máximo) hacia la oleada 40.
        //  - Oleada 50+: todo al máximo (rango SSS + 6 slots Legendario).
        // ══════════════════════════════════════════════════════════════════

        // Escalera de rangos, de menor a mayor. Cada rango puede tener más de un
        // "tipo" de orco asociado (ej. B = Alto Orco o Orco Gigante) — cuando se
        // incorpore la lista real de Orcos, HORDA_RANK_TYPES se llena con los
        // nombres exactos de personaje para cada rango.
        const HORDA_RANKS = ['C', 'B', 'A', 'S', 'SS', 'SSS'];

        // Placeholder — se reemplaza con los nombres reales de los Orcos cuando
        // se incorpore la lista. Cada rango puede tener 1 o más tipos; si tiene
        // más de uno, se elige uno al azar cada vez que se genera ese rango.
        const HORDA_RANK_TYPES = {
            'C':   ['Orco'],
            'B':   ['Alto Orco', 'Orco Gigante'],
            'A':   ['Orco de Elite', 'Orco Arcano'],
            'S':   ['General de la Horda'],
            'SS':  ['Warmaster', 'Orco Titan', 'Huargos'],
            'SSS': ['Kargalgan']
        };

        // ══════════════════════════════════════════════════════════════════
        // FICHAS DE PERSONAJE — Orcos del Modo Horda
        // Misma convención que characterData (js/characters.js): passive
        // {name, description}, abilities [{name, type, cost, chargeGain,
        // damage, target, effect, description}]. La lógica real de cada
        // efecto vive en js/horda-abilities.js (dispatcher: ability.effect
        // que empiece con 'horda_').
        // ══════════════════════════════════════════════════════════════════
        const HORDA_CHARACTER_DATA = {
            'Orco': {
                name: 'Orco', rank: 'C', hp: 20, maxHp: 20, speed: 82,
                portrait: 'https://i.ibb.co/n5JLSh3/Gurrash-Earseeker.jpg',
                passive: { name: 'Hordas', description: 'Cada vez que un personaje aliado que lleve "Orco" en su nombre realiza un ataque, genera 1 carga.' },
                abilities: [
                    { name: 'Tajo Sucio', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'horda_orco_basic', description: 'Aplica debuff Sangrado 1 turno sobre el objetivo.' },
                    { name: 'Pisotón Tembloroso', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'single', effect: 'horda_orco_special1', description: 'Aplica debuff Aturdimiento sobre el objetivo.' },
                    { name: 'Lanzamiento de Peñasco', type: 'special', cost: 6, chargeGain: 0, damage: 4, target: 'aoe', effect: 'horda_orco_special2', description: '+1 daño adicional por cada debuff activo en el equipo enemigo.' },
                    { name: 'Furia de la Horda', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'horda_orco_over', description: 'Sacrifica 50% de su HP actual. Todos los Orcos ejecutan aleatoriamente Tajo Sucio o Pisotón Tembloroso sobre enemigos aleatorios.' }
                ]
            },
            'Alto Orco': {
                name: 'Alto Orco', rank: 'B', hp: 20, maxHp: 20, speed: 85,
                portrait: 'https://i.ibb.co/VpQ2vJ8v/descarga-27.jpg',
                passive: { name: 'Agresion', description: 'Cada vez que un personaje aliado que lleve "Orco" en su nombre recibe daño, genera 2 cargas.' },
                abilities: [
                    { name: 'Mandoble de Hierro', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'horda_altoorco_basic', description: '+1 daño adicional por cada Orco derrotado en tu equipo. Aplica debuff Sangrado 1 turno.' },
                    { name: 'Grito de Mandato', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'horda_altoorco_special1', description: 'Aplica Buff Armadura 2 turnos y Buff Frenesí 2 turnos a todos los aliados.' },
                    { name: 'Torbellino de Sangre', type: 'special', cost: 7, chargeGain: 0, damage: 4, target: 'aoe', effect: 'horda_altoorco_special2', description: 'Aplica debuff Debilitar 3 turnos sobre los golpeados. Golpe crítico en enemigos con Sangrado o Hemorragia.' },
                    { name: 'Guillotina de Hierro', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'horda_altoorco_over', description: '50% de probabilidad de crítico. Si es crítico, aliados generan 10 cargas. Aplica debuff Sangrado 2 turnos.' }
                ]
            },
            'Orco Gigante': {
                name: 'Orco Gigante', rank: 'B', hp: 25, maxHp: 25, speed: 77,
                portrait: 'https://i.ibb.co/TDbWSGg9/Subscribe-for-daily-fantasy-inspiration.jpg',
                passive: { name: 'Rugido Provocador', description: 'Efecto pasivo Provocación. Cada vez que recibe daño aplica Buff Escudo 5 HP sobre 3 aliados aleatorios (incluyéndolo).' },
                abilities: [
                    { name: 'Manotazo Aplastante', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'aoe', effect: 'horda_gigante_basic', description: '50% de probabilidad de daño triple a cada enemigo golpeado. Orco Gigante gana Buff Escudo por el total de daño causado con este ataque.' },
                    { name: 'Ondas sísmicas', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'aoe', effect: 'horda_gigante_special1', description: 'Roba 2 HP de cada enemigo golpeado por este ataque.' },
                    { name: 'Pisotón de Demolición', type: 'special', cost: 6, chargeGain: 0, damage: 4, target: 'single', effect: 'horda_gigante_special2', description: 'Disipa todos los buffs activos del objetivo y genera 3 cargas a cada aliado por cada buff disipado.' },
                    { name: 'Brutalidad', type: 'over', cost: 8, chargeGain: 4, damage: 0, target: 'single', effect: 'horda_gigante_over', description: 'Causa de 3 a 10 de daño. Los aliados se curan la misma cantidad de daño causado.' }
                ]
            },
            'Orco de Elite': {
                name: 'Orco de Elite', rank: 'A', hp: 25, maxHp: 25, speed: 91,
                portrait: 'https://i.ibb.co/MT7sdnK/image-40bc2564.png',
                passive: { name: 'Sed de Sangre', description: 'Cada vez que un Orco es eliminado, gana 1 turno adicional y genera 8 cargas. Cada vez que un enemigo realiza un ataque especial, gana 1 turno adicional y se aplica Buff Frenesí 2 turnos. Cada vez que aplica un debuff sobre un enemigo atacado, genera 1 carga.' },
                abilities: [
                    { name: 'Estocada Brutal', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'multi', effect: 'horda_elite_basic', description: 'Realiza 3 golpes sobre enemigos aleatorios. Cada golpe tiene 50% de aplicar Sangrado 1T, 50% de aplicar Debilitar 1T y 50% de aplicar Aturdimiento.' },
                    { name: 'Rompeguardias', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'single', effect: 'horda_elite_special1', description: 'ST 3 daño. Causa daño equivalente al 25% del HP actual del enemigo con mayor HP.' },
                    { name: 'Carga de la Horda', type: 'special', cost: 8, chargeGain: 0, damage: 0, target: 'self', effect: 'horda_elite_special2', description: '50% de probabilidad c/u de aplicarse Armadura, Escudo 10HP, Infectar, Aura Oscura, Aura de Fuego, Frenesí y Esquivar (2 turnos c/u). Por cada buff aplicado, ejecuta Estocada Brutal.' },
                    { name: 'Aniquilacion Sangrienta', type: 'over', cost: 10, chargeGain: 0, damage: 5, target: 'single', effect: 'horda_elite_over', description: '50% de golpe crítico. 50% de probabilidad de daño triple.' }
                ]
            },
            'Orco Arcano': {
                name: 'Orco Arcano', rank: 'A', hp: 20, maxHp: 20, speed: 86,
                portrait: 'https://i.ibb.co/gbH6M5yk/image-b5967684.png',
                passive: { name: 'Artes de la Sangre Oscura', description: 'Cada vez que un Orco realiza un ataque básico, cura 2 HP a todos los Orcos aliados. Cada vez que un Buff expira en el equipo enemigo, genera 3 cargas.' },
                abilities: [
                    { name: 'Runa de Sangre Oscura', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'self', effect: 'horda_arcano_basic', description: 'Limpia 3 debuffs aleatorios en el equipo aliado. Cura 2 HP al aliado con menos HP. Aplica Debilitar 2 turnos en un enemigo aleatorio.' },
                    { name: 'Maldición de la Sangre', type: 'special', cost: 4, chargeGain: 0, damage: 1, target: 'aoe', effect: 'horda_arcano_special1', description: 'Elimina 3 cargas de los enemigos golpeados. Un aliado aleatorio genera la misma cantidad de cargas eliminadas.' },
                    { name: 'Hechizo de Sangre Arcana', type: 'special', cost: 6, chargeGain: 0, damage: 4, target: 'single', effect: 'horda_arcano_special2', description: 'Aplica Debilitar 2 turnos y Confusión 2 turnos sobre el objetivo. Un Orco aliado gana 1 turno adicional.' },
                    { name: 'Magia de Muerte', type: 'over', cost: 8, chargeGain: 0, damage: 0, target: 'self', effect: 'horda_arcano_over', description: 'Genera 5 cargas a todos los aliados (excepto a sí mismo). Revive a un aliado aleatorio con 50% de su HP y 5 cargas, y le otorga 1 turno adicional.' }
                ]
            },
            'General de la Horda': {
                name: 'General de la Horda', rank: 'S', hp: 25, maxHp: 25, speed: 93,
                portrait: 'https://i.ibb.co/hxTv1Nm3/image-8097f440.png',
                passive: { name: 'Aniquilacion', description: 'Cada vez que un aliado es eliminado, hay 50% de probabilidad de sustituir su tarjeta por la de un Orco aleatorio vivo (100% HP, 0 cargas). El General tiene 50% de probabilidad de limpiar cualquier debuff que reciba; cada vez que lo hace, genera 3 cargas y se cura 3 HP.' },
                abilities: [
                    { name: 'Rugido de Reagrupación', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'horda_general_basic', description: 'Aplica Buff Protección Sagrada 2 turnos sobre cada aliado. Genera 1 carga para cada aliado.' },
                    { name: 'Ejecución de la Horda', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'single', effect: 'horda_general_special1', description: 'Todos los aliados realizan su ataque básico sobre el objetivo. Si el objetivo tiene Provocación, reduce 50% de su HP actual.' },
                    { name: 'Carga del Estandarte', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'horda_general_special2', description: 'Disipa todos los Buffs de los enemigos golpeados y genera 2 cargas por cada buff disipado.' },
                    { name: 'Marcha de la Victoria', type: 'over', cost: 12, chargeGain: 0, damage: 5, target: 'aoe', effect: 'horda_general_over', description: 'Elimina a un aliado y todos los aliados (excepto el General) ejecutan su Over.' }
                ]
            },
            'Warmaster': {
                name: 'Warmaster', rank: 'SS', hp: 30, maxHp: 30, speed: 96,
                portrait: 'https://i.ibb.co/M5MD17Wz/image-bb1fa3b9.png',
                passive: { name: 'Warmasters', description: 'Al final de cada ronda disipa sus debuffs activos y recupera 5 HP. Cada vez que un enemigo genera cargas por un efecto de pasiva o movimiento (excepto la generación normal de cargas de sus ataques), Warmaster obtiene 1 turno adicional.' },
                abilities: [
                    { name: 'Danza de Sangre y Muerte', type: 'basic', cost: 0, chargeGain: 1, damage: 3, target: 'multi', effect: 'horda_warmaster_basic', description: 'Golpea a 3 enemigos aleatorios. Cada golpe tiene 50% de crítico. Cada crítico incrementa +1 el daño base de este ataque.' },
                    { name: 'Furia de la Horda', type: 'special', cost: 5, chargeGain: 0, damage: 4, target: 'aoe', effect: 'horda_warmaster_special1', description: 'Elimina todas las invocaciones de ambos equipos. +5 daño por cada invocación eliminada a los enemigos golpeados.' },
                    { name: 'Lanza de Oscuridad perforadora', type: 'special', cost: 7, chargeGain: 0, damage: 5, target: 'single', effect: 'horda_warmaster_special2', description: 'Ignora Escudo, Reflejar y Escudo Sagrado. Daño triple si el enemigo tiene 50% o más de su HP máximo. Si tiene debuff activo, duplica permanentemente el daño base de este movimiento.' },
                    { name: 'Rugido de los Titanes', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'horda_warmaster_over', description: 'Aplica Mega Aturdimiento en todos los enemigos. Aliados generan 3 cargas por cada enemigo con Mega Aturdimiento.' }
                ]
            },
            'Orco Titan': {
                name: 'Orco Titan', rank: 'SS', hp: 40, maxHp: 40, speed: 84,
                portrait: 'https://i.ibb.co/84cdjjz2/image-d4718b71.png',
                passive: { name: 'Fuerza descomunal', description: 'Al final de cada ronda incrementa +2 el daño de ataque básico de todos los aliados. La primera vez por ronda que recibe daño, se aplica Buff Mega Provocación 1 turno y Armadura 1 turno. Los movimientos AOE enemigos causan 50% menos daño mientras esté en batalla.' },
                abilities: [
                    { name: 'Impacto Colosal', type: 'basic', cost: 0, chargeGain: 2, damage: 4, target: 'single', effect: 'horda_titan_basic', description: 'Aplica Buff Mega Aturdimiento sobre el objetivo.' },
                    { name: 'Choque Sismico', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'horda_titan_special1', description: 'Aplica Aturdimiento sobre los golpeados. Si el enemigo ya tenía Aturdimiento, causa +7 daño adicional.' },
                    { name: 'Furia de Titanes', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'multi', effect: 'horda_titan_special2', description: 'Golpea 1 vez a cada enemigo por cada debuff activo que tenga, con Impacto Colosal.' },
                    { name: 'Devastacion planetaria', type: 'over', cost: 8, chargeGain: 0, damage: 0, target: 'aoe', effect: 'horda_titan_over', description: 'AOE entre 5 y 20 de daño base. Causa entre un 10% y 50% de daño adicional sobre el HP actual de cada enemigo golpeado.' }
                ]
            },
            'Huargos': {
                name: 'Huargos', rank: 'SS', hp: 25, maxHp: 25, speed: 97,
                portrait: 'https://i.ibb.co/1G2PqQp9/image-1723868f.png',
                passive: { name: 'Destreza de los Huargos', description: 'Al inicio de la ronda su velocidad se incrementa en la misma cantidad de la velocidad del enemigo con mayor velocidad. Al morir elimina todos los buffs activos del equipo enemigo. Todos sus ataques ignoran buff Escudo.' },
                abilities: [
                    { name: 'Rabia del Huargo', type: 'basic', cost: 0, chargeGain: 2, damage: 5, target: 'single', effect: 'horda_huargos_basic', description: 'Cada vez que se realiza este movimiento duplica el daño causado en el enemigo. Aplica debuff Debilitar 2 turnos en el objetivo.' },
                    { name: 'Ojos del Terror', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'horda_huargos_special1', description: 'Duplica el HP actual de todos los aliados. Incrementa un 50% la velocidad de todos los aliados.' },
                    { name: 'Hacha Oscura del Verdugo', type: 'special', cost: 10, chargeGain: 0, damage: 5, target: 'multi', effect: 'horda_huargos_special2', description: 'Golpea de 2 a 5 veces sobre objetivos aleatorios. Cada golpe tiene 20% de probabilidad de causar daño adicional equivalente al 50% del HP actual del objetivo.' },
                    { name: 'Aullido de la Horda', type: 'over', cost: 10, chargeGain: 0, damage: 5, target: 'aoe', effect: 'horda_huargos_over', description: 'Causa 1 de daño adicional a un enemigo aleatorio por cada 2 puntos de HP Escudo que esté activo en el equipo enemigo. Si el enemigo tiene más de 100 HP este ataque tiene un 10% de probabilidad de eliminarlo.' }
                ]
            },
            'Kargalgan': {
                name: 'Kargalgan', rank: 'SSS', hp: 40, maxHp: 40, speed: 100,
                portrait: 'https://i.ibb.co/QBHP63n/image-e5e3c9ab.png',
                passive: { name: 'Himno de la Horda', description: 'Al final de cada Ronda revive a un aliado con 100% de HP y 20 cargas. Kargalgan no puede ser revivido. Cada vez que un enemigo ejecuta un Over Kargalgan ejecuta su Over. Cada vez que un enemigo ejecuta un ataque especial aplica (sobre un enemigo aleatorio) debuff quemaduras de HP equivalente al 10% del HP total de todos los HP actuales de los personajes vivos del equipo enemigo.' },
                abilities: [
                    { name: 'Himno de Proteccion', type: 'basic', cost: 0, chargeGain: 3, damage: 0, target: 'self', effect: 'horda_kargalgan_basic', description: 'Incrementa un 20% los HP Máximos y actuales de todos los aliados y aplica un Escudo con HP equivalente al HP actual de Kargalgan en todos los aliados.' },
                    { name: 'Himno de los Gigantes', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'horda_kargalgan_special1', description: 'Incrementa en +5 el daño base de todos los ataques (básico, especial y over) del equipo aliado. El equipo aliado genera 5 cargas.' },
                    { name: 'Himno de Hielo', type: 'special', cost: 5, chargeGain: 0, damage: 5, target: 'single', effect: 'horda_kargalgan_special2', description: 'Aplica debuff Megacongelación sobre el objetivo y Congelación sobre dos enemigos aleatorios. Si el objetivo ya tenía Megacongelación, lo elimina. Si ya tenía Congelación, 50% de probabilidad de eliminarlo. Si ya tenía Quemaduras, roba 50% de su HP actual.' },
                    { name: 'Himno del Dragón de Fuego', type: 'over', cost: 15, chargeGain: 0, damage: 100, target: 'aoe', effect: 'horda_kargalgan_over', description: 'Si el enemigo golpeado sobrevive, reduce 50% su HP Máx y actual. 50% de probabilidad de daño triple en enemigos con debuffs activos.' }
                ]
            }
        };
        if (typeof window !== 'undefined') window.HORDA_CHARACTER_DATA = HORDA_CHARACTER_DATA;

        // ══════════════════════════════════════════════════════════════════
        // CURVA DE PROBABILIDAD DE RANGO (por oleada)
        // Cada rango normal (C/B/A/S/SS) tiene una oleada de "apertura" (gate,
        // antes de eso 0% de probabilidad), sube suave tras abrirse, y decae
        // suave una vez que el SIGUIENTE rango empieza a tomar protagonismo —
        // pero nunca llega exactamente a 0% (residual). SS es el techo natural
        // del pool normal: no decae, crece sin límite conforme avanzan las
        // oleadas (se vuelve casi garantizado a oleadas muy altas).
        //
        // SSS (Kargalgan) NO forma parte de este pool ponderado: es un "jefe"
        // aparte, ver hordaGenerateWaveEnemies — solo puede haber 1 por oleada,
        // con 25% de probabilidad, y solo a partir de la oleada 41.
        // ══════════════════════════════════════════════════════════════════
        const HORDA_NORMAL_RANKS = ['C', 'B', 'A', 'S', 'SS'];
        const HORDA_RANK_CURVE = {
            'C':  { gate: 1,  peak: 1,   rise: 1, decay: 9    },
            'B':  { gate: 2,  peak: 10,  rise: 6, decay: 9    },
            'A':  { gate: 11, peak: 20,  rise: 6, decay: 9    },
            'S':  { gate: 21, peak: 30,  rise: 6, decay: 9    },
            'SS': { gate: 31, peak: 9999, rise: 6, decay: 9999 } // nunca decae — techo natural
        };

        function _hordaRankWeight(rankKey, wave) {
            const c = HORDA_RANK_CURVE[rankKey];
            if (!c || wave < c.gate) return 0;
            let up;
            if (rankKey === 'C' && wave === c.gate) up = 1.0;
            else up = 1 - Math.exp(-(wave - c.gate) / c.rise);
            const down = Math.exp(-Math.max(0, wave - c.peak) / c.decay);
            return Math.max(up, 0.02) * down; // mínimo 2% de "piso" tras abrirse (nunca 0% exacto)
        }

        // Elige un rango NORMAL (C a SS) para una oleada dada, según la curva de arriba.
        // El parámetro isVanguard se conserva por compatibilidad con quien llame a esta
        // función, pero ya no diferencia velocidad de subida — la curva es la misma para
        // los 5 orcos de la oleada (así lo especificó el diseño de esta actualización).
        function hordaGetRankForWave(wave, isVanguard) {
            const weights = HORDA_NORMAL_RANKS.map(function (r) { return { rank: r, w: _hordaRankWeight(r, wave) }; });
            const total = weights.reduce(function (s, x) { return s + x.w; }, 0);
            if (total <= 0) return 'C';
            let roll = Math.random() * total;
            for (let i = 0; i < weights.length; i++) {
                roll -= weights[i].w;
                if (roll <= 0) return weights[i].rank;
            }
            return weights[weights.length - 1].rank;
        }

        // Elige un tipo de orco concreto (nombre de personaje) para un rango dado.
        function hordaPickOrcType(rankKey) {
            const types = HORDA_RANK_TYPES[rankKey] || ['Orco'];
            return types[Math.floor(Math.random() * types.length)];
        }

        // ── PROGRESIÓN DE TIER DE RELIQUIA ──
        // Pesos por tramo de oleadas; se interpola linealmente entre tramos vecinos
        // para que la transición sea gradual y no un salto brusco.
        // Esta tabla controla el tier de reliquias que EQUIPAN LOS ORCOS enemigos en
        // cada oleada — NO las recompensas del jugador (eso es CHEST_TABLE en horda-battle.js).
        const HORDA_TIER_STAGES = [
            { wave: 1,  weights: { Raro: 1,    Especial: 0,    Epico: 0,    Legendario: 0 } },
            { wave: 8,  weights: { Raro: 1,    Especial: 0,    Epico: 0,    Legendario: 0 } },
            { wave: 15, weights: { Raro: 0.35, Especial: 0.65, Epico: 0,    Legendario: 0 } },
            { wave: 22, weights: { Raro: 0.05, Especial: 0.55, Epico: 0.40, Legendario: 0 } },
            { wave: 29, weights: { Raro: 0,    Especial: 0.15, Epico: 0.85, Legendario: 0 } },
            { wave: 40, weights: { Raro: 0,    Especial: 0,    Epico: 0.55, Legendario: 0.45 } },
            { wave: 50, weights: { Raro: 0,    Especial: 0,    Epico: 0,    Legendario: 1 } }
        ];
        const HORDA_TIER_ORDER = ['Raro', 'Especial', 'Epico', 'Legendario'];

        function _hordaInterpWeights(wave) {
            const stages = HORDA_TIER_STAGES;
            if (wave <= stages[0].wave) return stages[0].weights;
            if (wave >= stages[stages.length - 1].wave) return stages[stages.length - 1].weights;
            for (let i = 0; i < stages.length - 1; i++) {
                const a = stages[i], b = stages[i + 1];
                if (wave >= a.wave && wave <= b.wave) {
                    const t = (wave - a.wave) / (b.wave - a.wave);
                    const out = {};
                    HORDA_TIER_ORDER.forEach(function(k) {
                        out[k] = a.weights[k] + (b.weights[k] - a.weights[k]) * t;
                    });
                    return out;
                }
            }
            return stages[stages.length - 1].weights;
        }

        function hordaPickRelicTier(wave) {
            const w = _hordaInterpWeights(wave);
            const total = HORDA_TIER_ORDER.reduce(function(s, k) { return s + (w[k] || 0); }, 0);
            if (total <= 0) return 'Raro';
            let r = Math.random() * total;
            for (let i = 0; i < HORDA_TIER_ORDER.length; i++) {
                const k = HORDA_TIER_ORDER[i];
                r -= (w[k] || 0);
                if (r <= 0) return k;
            }
            return HORDA_TIER_ORDER[HORDA_TIER_ORDER.length - 1];
        }

        // ── PROGRESIÓN DE CANTIDAD DE SLOTS EQUIPADOS (0 a 6) ──
        function hordaGetSlotCountForWave(wave) {
            if (wave >= 40) return 6;
            const f = Math.max(0, (wave - 1)) * 6 / 39; // 0 en oleada 1 -> 6 en oleada 40
            const floor = Math.floor(f);
            const frac = f - floor;
            let count = floor;
            if (frac > 0 && Math.random() < frac) count += 1;
            return Math.min(6, Math.max(0, count));
        }

        // ── GENERADOR DE EQUIPO — respeta las mismas reglas de slots que ya usa
        // el juego para jugadores (arma1/arma2, equip1/equip2, joya1/joya2;
        // Arco y Escudo son excluyentes con cualquier otra Arma en el 2do slot).
        const HORDA_SLOT_ORDER = ['arma1', 'equip1', 'joya1', 'arma2', 'equip2', 'joya2'];
        const HORDA_SLOT_CATEGORY = { arma1: 'Arma', arma2: 'Arma', equip1: 'Equipacion', equip2: 'Equipacion', joya1: 'Joya', joya2: 'Joya' };

        function _hordaRelicPool(category) {
            if (typeof RELICS_DATA === 'undefined') return [];
            // Pool de EQUIPAMIENTO de los enemigos (no de recompensas): tanto Orcos
            // como Elfos Oscuros pueden llevar CUALQUIER reliquia del juego. Lo que
            // limita qué les toca es la progresión por oleada (hordaPickRelicTier /
            // hordaGetSlotCountForWave), no la variante.
            return Object.keys(RELICS_DATA).filter(function(name) {
                return RELICS_DATA[name].slotCategory === category;
            });
        }

        function hordaGenerateEquip(wave) {
            const slotCount = hordaGetSlotCountForWave(wave);
            const equipped = {}; // slotKey -> relicName
            let hasArco = false, armaSlotsUsed = 0;

            for (let i = 0; i < HORDA_SLOT_ORDER.length && Object.keys(equipped).length < slotCount; i++) {
                const slotKey = HORDA_SLOT_ORDER[i];
                const category = HORDA_SLOT_CATEGORY[slotKey];

                // Regla Arco/Escudo: si ya hay un Arco equipado, no se puede usar el 2do slot de Arma.
                if (category === 'Arma' && slotKey === 'arma2' && hasArco) continue;

                const tier = hordaPickRelicTier(wave);
                const armaFilter = function(name) {
                    if (category !== 'Arma') return true;
                    const r = RELICS_DATA[name];
                    if (r.subtype === 'Arco' && armaSlotsUsed > 0) return false;
                    if (r.subtype !== 'Arco' && hasArco) return false;
                    return true;
                };
                let pool = _hordaRelicPool(category).filter(function(name) {
                    return RELICS_DATA[name].tier === tier && armaFilter(name);
                });
                // Los Orcos no tienen inventario real (se generan al vuelo cada oleada), así que
                // SÍ pueden repetir una reliquia si ese tier/categoría tiene poca variedad (ej. solo
                // hay 1 Joya Legendaria) — por eso NO se excluyen nombres ya equipados aquí, a
                // diferencia del equipo de un jugador real.
                if (pool.length === 0) {
                    // Sin candidatos de ese tier exacto en esta categoría (rarísimo, pero por si acaso):
                    // usar el tier disponible más cercano dentro de la misma categoría.
                    pool = _hordaRelicPool(category).filter(armaFilter);
                }
                if (pool.length === 0) continue; // la categoría no tiene ningún candidato válido, se salta

                const chosen = pool[Math.floor(Math.random() * pool.length)];
                equipped[slotKey] = chosen;
                if (category === 'Arma') {
                    armaSlotsUsed++;
                    if (RELICS_DATA[chosen].subtype === 'Arco') hasArco = true;
                }
            }
            return equipped; // { arma1: 'Nombre', joya1: 'Otro nombre', ... } — puede repetir nombres
        }

        // ── FUNCIÓN PRINCIPAL: genera los 5 orcos de una oleada ──
        // Devuelve: [{ rank, orcType, relics: {slotKey: relicName, ...} }, ...5]
        // El índice 0 siempre es el orco "Vanguardia".
        //
        // REGLA SSS (Kargalgan): a partir de la oleada 41, cada oleada tiene 25% de
        // probabilidad de que EXACTAMENTE UNO de los 5 orcos (elegido al azar) sea SSS
        // en vez de su rango normal — nunca puede haber más de 1 SSS por oleada, y nunca
        // aparece antes de la oleada 41 ("después de la oleada 40").
        function hordaGenerateWaveEnemies(wave) {
            // Variante Elfos Oscuros: delega en su propio generador (rangos C-S + jefe SSS)
            if (window._hordaVariant === 'elfos' && typeof window.elfosGenerateWaveEnemies === 'function') {
                return window.elfosGenerateWaveEnemies(wave);
            }
            const enemies = [];
            let sssSlot = -1;
            if (wave >= 41 && Math.random() < 0.25) {
                sssSlot = Math.floor(Math.random() * 5);
            }
            for (let i = 0; i < 5; i++) {
                const isVanguard = (i === 0);
                const rank = (i === sssSlot) ? 'SSS' : hordaGetRankForWave(wave, isVanguard);
                enemies.push({
                    rank: rank,
                    orcType: hordaPickOrcType(rank),
                    isVanguard: isVanguard,
                    relics: hordaGenerateEquip(wave)
                });
            }
            return enemies;
        }

        if (typeof window !== 'undefined') {
            window.HORDA_RANKS = HORDA_RANKS;
            window.HORDA_RANK_TYPES = HORDA_RANK_TYPES;
            window.hordaGetRankForWave = hordaGetRankForWave;
            window.hordaPickRelicTier = hordaPickRelicTier;
            window.hordaGetSlotCountForWave = hordaGetSlotCountForWave;
            window.hordaGenerateEquip = hordaGenerateEquip;
            window.hordaGenerateWaveEnemies = hordaGenerateWaveEnemies;
        }
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = { HORDA_RANKS, HORDA_RANK_TYPES, hordaGetRankForWave, hordaPickRelicTier, hordaGetSlotCountForWave, hordaGenerateEquip, hordaGenerateWaveEnemies };
        }
