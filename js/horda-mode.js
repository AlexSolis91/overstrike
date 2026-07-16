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
            'SS':  ['Warmaster'],
            'SSS': ['Orco Titan']
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
                    { name: 'Guillotina de Hierro', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'horda_altoorco_over', description: '50% de probabilidad de crítico. Si es crítico, aliados generan 10 cargas.' }
                ]
            },
            'Orco Gigante': {
                name: 'Orco Gigante', rank: 'B', hp: 25, maxHp: 25, speed: 77,
                portrait: 'https://i.ibb.co/TDbWSGg9/Subscribe-for-daily-fantasy-inspiration.jpg',
                passive: { name: 'Rugido Provocador', description: 'Efecto pasivo Provocación. Cada vez que recibe daño aplica Buff Escudo 5 HP sobre 3 aliados aleatorios (incluyéndolo).' },
                abilities: [
                    { name: 'Manotazo Aplastante', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'aoe', effect: 'horda_gigante_basic', description: '50% de probabilidad de daño triple a cada enemigo golpeado. Aplica Buff Escudo por la misma cantidad de daño causado a los enemigos golpeados.' },
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
                    { name: 'Rompeguardias', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'single', effect: 'horda_elite_special1', description: 'Si el objetivo no tiene cargas, causa daño crítico y aplica Mega Aturdimiento sobre 2 enemigos aleatorios.' },
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
                name: 'Orco Titan', rank: 'SSS', hp: 40, maxHp: 40, speed: 84,
                portrait: 'https://i.ibb.co/84cdjjz2/image-d4718b71.png',
                passive: { name: 'Fuerza descomunal', description: 'Al final de cada ronda incrementa +2 el daño de ataque básico de todos los aliados. La primera vez por ronda que recibe daño, se aplica Buff Mega Provocación 1 turno y Armadura 1 turno. Los movimientos AOE enemigos causan 50% menos daño mientras esté en batalla.' },
                abilities: [
                    { name: 'Impacto Colosal', type: 'basic', cost: 0, chargeGain: 2, damage: 4, target: 'single', effect: 'horda_titan_basic', description: 'Aplica Buff Mega Aturdimiento sobre el objetivo.' },
                    { name: 'Choque Sismico', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'horda_titan_special1', description: 'Aplica Aturdimiento sobre los golpeados. Si el enemigo ya tenía Aturdimiento, causa +7 daño adicional.' },
                    { name: 'Furia de Titanes', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'multi', effect: 'horda_titan_special2', description: 'Golpea 1 vez a cada enemigo por cada debuff activo que tenga, con Impacto Colosal.' },
                    { name: 'Devastacion planetaria', type: 'over', cost: 8, chargeGain: 0, damage: 0, target: 'aoe', effect: 'horda_titan_over', description: 'Causa de 5 a 20 de daño. Cada golpe tiene 10% de probabilidad de eliminar al enemigo golpeado.' }
                ]
            }
        };
        if (typeof window !== 'undefined') window.HORDA_CHARACTER_DATA = HORDA_CHARACTER_DATA;

        // Curvas de progresión de rango (ver documentación arriba). Devuelve un
        // número decimal donde la parte entera es el rango garantizado y la
        // parte fraccionaria es la probabilidad de estar UN rango más arriba.
        function _hordaRankFloat(wave, startWave, maxWave) {
            if (wave < startWave) return 0;
            if (wave >= maxWave) return HORDA_RANKS.length - 1;
            const span = maxWave - startWave; // oleadas entre el primer indicio y el máximo
            // En startWave arranca en 0.5 (50% de probabilidad del primer rango superior),
            // sube linealmente hasta tocar el rango máximo exactamente en maxWave.
            return 0.5 + (wave - startWave) * ((HORDA_RANKS.length - 1) - 0.5) / span;
        }

        const HORDA_VANGUARD_START_WAVE = 3;
        const HORDA_VANGUARD_MAX_WAVE   = 20;
        const HORDA_SQUAD_START_WAVE    = 10;
        const HORDA_SQUAD_MAX_WAVE      = 50;

        function hordaGetRankIndexForWave(wave, isVanguard) {
            const f = isVanguard
                ? _hordaRankFloat(wave, HORDA_VANGUARD_START_WAVE, HORDA_VANGUARD_MAX_WAVE)
                : _hordaRankFloat(wave, HORDA_SQUAD_START_WAVE, HORDA_SQUAD_MAX_WAVE);
            const floor = Math.min(HORDA_RANKS.length - 1, Math.max(0, Math.floor(f)));
            const frac = f - floor;
            // A partir de oleada 50, todo queda garantizado al máximo.
            if (wave >= 50) return HORDA_RANKS.length - 1;
            if (frac > 0 && Math.random() < frac && floor < HORDA_RANKS.length - 1) return floor + 1;
            return floor;
        }

        function hordaGetRankForWave(wave, isVanguard) {
            return HORDA_RANKS[hordaGetRankIndexForWave(wave, isVanguard)];
        }

        // Elige un tipo de orco concreto (nombre de personaje) para un rango dado.
        function hordaPickOrcType(rankKey) {
            const types = HORDA_RANK_TYPES[rankKey] || ['Orco'];
            return types[Math.floor(Math.random() * types.length)];
        }

        // ── PROGRESIÓN DE TIER DE RELIQUIA ──
        // Pesos por tramo de oleadas; se interpola linealmente entre tramos vecinos
        // para que la transición sea gradual y no un salto brusco.
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
        function hordaGenerateWaveEnemies(wave) {
            const enemies = [];
            for (let i = 0; i < 5; i++) {
                const isVanguard = (i === 0);
                const rank = hordaGetRankForWave(wave, isVanguard);
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
