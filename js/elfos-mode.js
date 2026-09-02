// ══════════════════════════════════════════════════════════════════════════════
// MODO HORDA — VARIANTE "ELFOS OSCUROS"
// ──────────────────────────────────────────────────────────────────────────────
// Espejo de js/horda-mode.js pero con el bestiario de Elfos Oscuros. Toda la
// maquinaria de combate (horda-battle.js) es común a ambas variantes: lo único
// que cambia es la tabla de personajes y los tipos por rango, que se seleccionan
// según window._hordaVariant ('orcos' | 'elfos').
//
// Rangos: C, B, A, S como enemigos normales; SSS (Rey Supremo Kael) es el jefe
// que puede aparecer a partir de la oleada 41, igual que Kargalgan en Orcos.
// Los Elfos Oscuros no tienen rango SS.
//
// La lógica real de cada habilidad vive en js/elfos-abilities.js (dispatcher por
// ability.effect con prefijo 'elfos_').
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    const ELFOS_RANKS = ['C', 'B', 'A', 'S', 'SSS'];

    const ELFOS_RANK_TYPES = {
        'C':   ['Elfo Oscuro', 'Arquero del Bosque de la Muerte'],
        'B':   ['Necrobruja', 'Guardians'],
        'A':   ['Necromancer de Elite', 'Elfo Enloquecido'],
        'S':   ['Klaord - Alto Mando', 'Malys'],
        'SSS': ['Rey Supremo Kael']
    };

    // ══════════════════════════════════════════════════════════════════════════
    // FICHAS DE PERSONAJE — Elfos Oscuros
    // Misma convención que characterData y HORDA_CHARACTER_DATA.
    // ══════════════════════════════════════════════════════════════════════════
    const ELFOS_CHARACTER_DATA = {

        'Elfo Oscuro': {
            name: 'Elfo Oscuro', rank: 'C', hp: 20, maxHp: 20, speed: 87,
            portrait: 'https://i.ibb.co/XxkjcwrF/image-e8c16081.png',
            passive: {
                name: 'Corrupcion',
                description: 'Cuando un Elfo Oscuro es eliminado, genera 5 cargas. Cada vez que un Elfo Oscuro recibe daño gana +5 de velocidad. Inmune a debuff Miedo y Posesión.'
            },
            abilities: [
                { name: 'Daga de Energia Oscura', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'elfos_eo_basic',
                  description: 'Roba 3 de HP del objetivo y roba 3 cargas del objetivo.' },
                { name: 'Ocultacion', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'self', effect: 'elfos_eo_special1',
                  description: 'Se aplica Sigilo 2 turnos y Protección Sagrada 2 turnos. Aumenta +1 el daño base permanente de su ataque básico.' },
                { name: 'Secretos del Bosque de la Muerte', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'elfos_eo_special2',
                  description: 'Aplica Miedo 2 turnos. +1 de daño adicional por cada debuff en el objetivo.' },
                { name: 'Terror de la noche', type: 'over', cost: 10, chargeGain: 0, damage: 3, target: 'mt', effect: 'elfos_eo_over',
                  description: '5 ataques a enemigos aleatorios. Si el golpeado tiene un buff, le limpia 1 buff y causa +5 de daño. Aplica Confusión 3 turnos.' }
            ]
        },

        'Arquero del Bosque de la Muerte': {
            name: 'Arquero del Bosque de la Muerte', rank: 'C', hp: 20, maxHp: 20, speed: 86,
            portrait: 'https://i.ibb.co/jkWzcKW0/image-713f49.png',
            passive: {
                name: 'Destreza Elfica de las sombras',
                description: 'Efecto pasivo Esquivar. Cada vez que esquiva un ataque ejecuta Flecha Necrótica sobre un enemigo aleatorio. Todos sus ataques aplican Debilitar 1 turno.'
            },
            abilities: [
                { name: 'Flecha Necrotica', type: 'basic', cost: 0, chargeGain: 1, damage: 3, target: 'single', effect: 'elfos_arq_basic',
                  description: '50% de aplicar Miedo 2 turnos. 20% de causar daño triple por cada debuff activo en el objetivo.' },
                { name: 'Rafaga de Flechas Negras', type: 'special', cost: 3, chargeGain: 0, damage: 1, target: 'mt', effect: 'elfos_arq_special1',
                  description: 'De 3 a 10 ataques a enemigos aleatorios. Cada ataque tiene 50% de probabilidad de golpe crítico.' },
                { name: 'Capucha de Energia Oscura', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'elfos_arq_special2',
                  description: 'Regeneración 30% por 3 turnos y Armadura 3 turnos. Aliados generan 3 cargas. +1 al daño base de todos sus ataques.' },
                { name: 'Lluvia de FLechas del Caos', type: 'over', cost: 15, chargeGain: 0, damage: 4, target: 'aoe', effect: 'elfos_arq_over',
                  description: 'Roba todas las cargas de los golpeados. Crítico contra enemigos con debuffs. Daño triple contra enemigos con buffs.' }
            ]
        },

        'Necrobruja': {
            name: 'Necrobruja', rank: 'B', hp: 25, maxHp: 25, speed: 80,
            portrait: 'https://i.ibb.co/j9HWRPyr/image-275c8786.png',
            passive: {
                name: 'Canto de la Oscuridad',
                description: 'Cuando recibe un golpe, causa 2 de daño al atacante. Cada buff aplicado en cualquier equipo la cura 5 HP. Cada debuff aplicado en cualquier equipo le da +5 HP máx.'
            },
            abilities: [
                { name: 'Drenaje de Vitalidad', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'mt', effect: 'elfos_nb_basic',
                  description: '3 ataques a enemigos aleatorios. Cada golpe roba de 1 a 3 HP del objetivo.' },
                { name: 'Plaga del Mortifago', type: 'special', cost: 5, chargeGain: 0, damage: 2, target: 'aoe', effect: 'elfos_nb_special1',
                  description: 'Aplica de 1 a 4 stacks de Veneno a cada golpeado. Si el golpeado tiene un buff, le roba 5 cargas.' },
                { name: 'Necromantis', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'single', effect: 'elfos_nb_special2',
                  description: 'Daño adicional igual al 10% del HP máx del enemigo con más HP. Cada uso incrementa ese porcentaje en 10%.' },
                { name: 'Vida Eterna', type: 'over', cost: 13, chargeGain: 0, damage: 0, target: 'self', effect: 'elfos_nb_over',
                  description: 'Escudo de 20 HP. Roba 30 HP repartidos entre enemigos y cura lo mismo en aliados. Con 2 aliados muertos: se sacrifica y revive a 2 aliados al 100% con 20 cargas.' }
            ]
        },

        'Guardians': {
            name: 'Guardians', rank: 'B', hp: 25, maxHp: 25, speed: 88,
            portrait: 'https://i.ibb.co/whtxzhLJ/image-4335300.png',
            passive: {
                name: 'Venganza de la Noche',
                description: 'Si sobrevive al Over de un enemigo, realiza 5 Cortes Dimensionales sobre él. Todos sus ataques tienen 50% de crítico. Cada crítico acertado le da +1 al daño base.'
            },
            abilities: [
                { name: 'Cortes Dimensionales', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'elfos_gd_basic',
                  description: 'Genera Escudo de 3 HP. Aplica Debilitar 2 turnos o Sangrado 2 turnos sobre un enemigo aleatorio.' },
                { name: 'Orden de la Oscuridad', type: 'special', cost: 5, chargeGain: 1, damage: 4, target: 'single', effect: 'elfos_gd_special1',
                  description: 'Roba 1 HP y 1 carga por cada buff y debuff activo en ambos equipos. Si el objetivo tiene más de 50 HP, +15% de su HP máx como daño.' },
                { name: 'Legion de la Oscuridad', type: 'special', cost: 7, chargeGain: 1, damage: 7, target: 'single', effect: 'elfos_gd_special2',
                  description: 'El daño se multiplica por la cantidad de Guardians aliados, +5% del HP máx del objetivo por cada uno. Si hay un aliado eliminado, lo sustituye por un Guardians nuevo.' },
                { name: 'Torbellino de las Sombras', type: 'over', cost: 15, chargeGain: 1, damage: 5, target: 'aoe', effect: 'elfos_gd_over',
                  description: '10% de crítico en cada enemigo golpeado. Si acierta un crítico, Guardians gana 1 turno adicional y 15 cargas.' }
            ]
        },

        'Necromancer de Elite': {
            name: 'Necromancer de Elite', rank: 'A', hp: 25, maxHp: 25, speed: 91,
            portrait: 'https://i.ibb.co/BVHd0fpm/image-2033cf27.jpg',
            passive: {
                name: 'Artes Elficas Oscuras',
                description: 'Cuando un aliado recibe daño, se cura la misma cantidad. Cada vez que se cura aplica Quemadura 2 HP a un enemigo aleatorio. Los enemigos dañados por Quemadura tienen 50% de recibir Congelación.'
            },
            abilities: [
                { name: 'Fuego Oscuro de Nash', type: 'basic', cost: 0, chargeGain: 1, damage: 3, target: 'single', effect: 'elfos_nec_basic',
                  description: 'Si el objetivo tiene Quemadura, daño adicional igual a las quemaduras activas. Si tiene Congelación, +5% del HP máx de todos los enemigos congelados.' },
                { name: 'Energia Gelida', type: 'special', cost: 3, chargeGain: 0, damage: 1, target: 'aoe', effect: 'elfos_nec_special1',
                  description: 'Aplica Congelación a todos los golpeados. Si el golpeado tenía Quemadura, se cura el 10% del HP máx de ese objetivo.' },
                { name: 'Conjuro Necronicus', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'elfos_nec_special2',
                  description: 'Duplica su HP máx, se aplica Regeneración 20% por 2 turnos y Aura Oscura 3 turnos.' },
                { name: 'Rey de la Muerte', type: 'over', cost: 16, chargeGain: 0, damage: 0, target: 'self', effect: 'elfos_nec_over',
                  description: 'Cura el 50% del HP de todos los aliados. Por cada 10 puntos de HP recuperados causa 10 de daño a un enemigo aleatorio.' }
            ]
        },

        'Elfo Enloquecido': {
            name: 'Elfo Enloquecido', rank: 'A', hp: 30, maxHp: 30, speed: 79,
            portrait: 'https://i.ibb.co/7x5mw4mP/image-7cecfa5c-1.png',
            passive: {
                name: 'Furia de Rey Loco',
                description: 'Cuando un enemigo ejecuta un Over, aplica Mega Aturdimiento a todos los enemigos. Al morir causa 30 de daño repartido entre los enemigos. Genera 1 carga cada vez que un enemigo usa un ataque básico.'
            },
            abilities: [
                { name: 'Rugido del Rey Loco', type: 'basic', cost: 0, chargeGain: 1, damage: 4, target: 'single', effect: 'elfos_ee_basic',
                  description: 'Se aplica Mega Provocación 2 turnos y Aura Oscura 2 turnos.' },
                { name: 'Conjuro de Fortaleza Oscura', type: 'special', cost: 5, chargeGain: 0, damage: 1, target: 'single', effect: 'elfos_ee_special1',
                  description: 'Daño de 1 a 6. Crítico garantizado si el objetivo tiene más cargas que él. Aplica Escudo a cada aliado igual al daño total causado.' },
                { name: 'Megadestruccion', type: 'special', cost: 8, chargeGain: 0, damage: 5, target: 'aoe', effect: 'elfos_ee_special2',
                  description: 'Si el enemigo tiene Mega Aturdimiento, daño adicional igual al 50% de la suma del HP total de todos los enemigos.' },
                { name: 'Explosion de Oscuridad Concentrada', type: 'over', cost: 9, chargeGain: 0, damage: 8, target: 'aoe', effect: 'elfos_ee_over',
                  description: 'Aplica Mega Aturdimiento a 3 enemigos aleatorios. Genera 2 cargas por cada enemigo que sobreviva a este ataque.' }
            ]
        },

        'Klaord - Alto Mando': {
            name: 'Klaord - Alto Mando', rank: 'S', hp: 25, maxHp: 25, speed: 95,
            portrait: 'https://i.ibb.co/pBW262yV/image-d945cece.png',
            passive: {
                name: 'Redentor de la Oscuridad',
                description: 'Cuando un enemigo usa especial u Over, roba 3 cargas de cada enemigo. Al inicio de ronda aplica Posesión a un enemigo y revive a un aliado (causando 50 de daño a un enemigo). Si muere y hay aliados vivos, sacrifica a uno y revive con HP máx duplicado, 20 cargas y turno adicional. Al final de ronda roba 1 HP por cada Marca de la Oscuridad de cada enemigo.'
            },
            abilities: [
                { name: 'Dominio de la Oscuridad', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'mt', effect: 'elfos_kl_basic',
                  description: '5 ataques a enemigos aleatorios. Cada ataque tiene 50% de generar una Marca de la Oscuridad.' },
                { name: 'Tajo Umbrio', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'single', effect: 'elfos_kl_special1',
                  description: 'Si el objetivo tiene Marcas de la Oscuridad, daño adicional del 5% de su HP por cada marca.' },
                { name: 'Ola de Destruccion y Muerte', type: 'special', cost: 7, chargeGain: 0, damage: 7, target: 'aoe', effect: 'elfos_kl_special2',
                  description: 'Genera 3 cargas a cada aliado por cada enemigo golpeado por este ataque.' },
                { name: 'Resureccion de las Almas perdidas', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'self', effect: 'elfos_kl_over',
                  description: 'Revive hasta 2 aliados con 10%-100% de su HP máx. Causa daño igual a la suma de su HP a un enemigo. 2 Marcas de la Oscuridad a cada enemigo por aliado revivido. Reduce a la mitad la velocidad enemiga y reparte el 50% robado entre aliados. Se cura 25% y gana +10% HP máx.' }
            ]
        },

        'Malys': {
            name: 'Malys', rank: 'S', hp: 30, maxHp: 30, speed: 93,
            portrait: 'https://i.ibb.co/S4ZwhrQy/image-7629024f.png',
            passive: {
                name: 'Danza nocturna',
                description: 'Solo puede tener un debuff activo a la vez. Cuando el enemigo revive a un aliado caído en su bando, Malys ejecuta Explosión del Caos con daño triple. Cuando golpea a un enemigo le reduce 10% de velocidad y Malys gana esa misma cantidad.'
            },
            abilities: [
                { name: 'Flecha Aurora', type: 'basic', cost: 0, chargeGain: 1, damage: 3, target: 'single', effect: 'elfos_ml_basic',
                  description: 'Aplica Megacongelación al objetivo. Si ya la tenía, causa daño igual al HP total del objetivo sobre un enemigo aleatorio.' },
                { name: 'Carga de Viento Nocturno', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'elfos_ml_special1',
                  description: 'Disipa los debuffs de 3 aliados aleatorios. Por cada debuff disipado esos aliados generan 5 cargas y ganan +10 HP máx.' },
                { name: 'Disparo de Oscuridad Concentrada', type: 'special', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'elfos_ml_special2',
                  description: 'Multiplica el daño por la cantidad de buffs y debuffs de Malys y del objetivo. Si causa 40 o más de daño, elimina a un enemigo aleatorio.' },
                { name: 'Explosion del Caos', type: 'over', cost: 12, chargeGain: 0, damage: 5, target: 'aoe', effect: 'elfos_ml_over',
                  description: 'Daño adicional igual al 10% de la suma del HP actual de todos los enemigos vivos.' }
            ]
        },

        'Rey Supremo Kael': {
            name: 'Rey Supremo Kael', rank: 'SSS', hp: 40, maxHp: 40, speed: 98,
            portrait: 'https://i.ibb.co/wZQrSZ1r/Warlock-Affliction-Secktus.jpg',
            passive: {
                name: 'Reino de la Oscuridad',
                description: 'Inmune a debuffs. No recibe daño mientras haya al menos 1 aliado vivo. Todos sus ataques reducen 10% el HP máx del objetivo. Si golpea a un enemigo con HP igual o menor al 50% de su HP actual, lo elimina.'
            },
            abilities: [
                { name: 'Decreto del Rey Supremo', type: 'basic', cost: 0, chargeGain: 3, damage: 5, target: 'single', effect: 'elfos_rk_basic',
                  description: 'Incrementa su HP máx en un 10% del HP actual del enemigo golpeado.' },
                { name: 'Esfera de Caos', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'elfos_rk_special1',
                  description: 'Roba el 10% del HP actual de cada enemigo. Incrementa su HP máx por lo robado. Se aplica Armadura 2 turnos.' },
                { name: 'Lanzas de energia Oscura', type: 'special', cost: 10, chargeGain: 0, damage: 1, target: 'aoe', effect: 'elfos_rk_special2',
                  description: 'Daño adicional igual al 80% de su HP actual. 50% de aplicar Mega Posesión a los golpeados.' },
                { name: 'Devorador de Almas', type: 'over', cost: 20, chargeGain: 0, damage: 50, target: 'single', effect: 'elfos_rk_over',
                  description: 'Se cura el 100% de su HP y causa daño adicional igual a lo curado sobre un enemigo aleatorio. Si elimina a alguien, duplica el HP máx y actual de todos los aliados.' }
            ]
        }
    };

    // ══════════════════════════════════════════════════════════════════════════
    // CURVA DE RANGOS POR OLEADA (Elfos Oscuros)
    // Mismo modelo que Orcos, pero sin rango SS: C → B → A → S.
    // ══════════════════════════════════════════════════════════════════════════
    const ELFOS_NORMAL_RANKS = ['C', 'B', 'A', 'S'];
    const ELFOS_RANK_CURVE = {
        'C': { gate: 1,  peak: 1,    rise: 1, decay: 9    },
        'B': { gate: 2,  peak: 12,   rise: 6, decay: 9    },
        'A': { gate: 13, peak: 26,   rise: 6, decay: 9    },
        'S': { gate: 27, peak: 9999, rise: 6, decay: 9999 } // nunca decae — techo natural
    };

    function _elfosRankWeight(rankKey, wave) {
        const c = ELFOS_RANK_CURVE[rankKey];
        if (!c || wave < c.gate) return 0;
        let up;
        if (rankKey === 'C' && wave === c.gate) up = 1.0;
        else up = 1 - Math.exp(-(wave - c.gate) / c.rise);
        const down = Math.exp(-Math.max(0, wave - c.peak) / c.decay);
        return Math.max(up, 0.02) * down;
    }

    function elfosGetRankForWave(wave) {
        const weights = ELFOS_NORMAL_RANKS.map(function (r) { return { rank: r, w: _elfosRankWeight(r, wave) }; });
        const total = weights.reduce(function (s, x) { return s + x.w; }, 0);
        if (total <= 0) return 'C';
        let roll = Math.random() * total;
        for (let i = 0; i < weights.length; i++) {
            roll -= weights[i].w;
            if (roll <= 0) return weights[i].rank;
        }
        return 'C';
    }

    function elfosPickType(rankKey) {
        const types = ELFOS_RANK_TYPES[rankKey] || ['Elfo Oscuro'];
        return types[Math.floor(Math.random() * types.length)];
    }

    // Genera los 5 enemigos de una oleada de Elfos Oscuros.
    // A partir de la oleada 41, 25% de probabilidad de que UNO sea el jefe SSS
    // (Rey Supremo Kael) — nunca más de uno, nunca antes de la 41.
    function elfosGenerateWaveEnemies(wave) {
        const enemies = [];
        let sssSlot = -1;
        if (wave >= 41 && Math.random() < 0.25) {
            sssSlot = Math.floor(Math.random() * 5);
        }
        for (let i = 0; i < 5; i++) {
            const isVanguard = (i === 0);
            const rank = (i === sssSlot) ? 'SSS' : elfosGetRankForWave(wave);
            enemies.push({
                rank: rank,
                orcType: elfosPickType(rank), // se conserva la clave 'orcType' por compatibilidad
                isVanguard: isVanguard,
                relics: (typeof window.hordaGenerateEquip === 'function') ? window.hordaGenerateEquip(wave) : []
            });
        }
        return enemies;
    }

    if (typeof window !== 'undefined') {
        window.ELFOS_RANKS           = ELFOS_RANKS;
        window.ELFOS_RANK_TYPES      = ELFOS_RANK_TYPES;
        window.ELFOS_CHARACTER_DATA  = ELFOS_CHARACTER_DATA;
        window.elfosGetRankForWave   = elfosGetRankForWave;
        window.elfosPickType         = elfosPickType;
        window.elfosGenerateWaveEnemies = elfosGenerateWaveEnemies;
    }
})();
