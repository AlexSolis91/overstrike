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
            'A':   ['Orco de Élite', 'Orco Arcano'],
            'S':   ['General'],
            'SS':  ['Warmaster'],
            'SSS': ['Titán']
        };

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
