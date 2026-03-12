// ==================== DATOS DE PERSONAJES ====================
        const characterData = {

            // ═══ TEAM HUNTERS ═══════════════════════════════════════

            'Madara Uchiha': {
                hp: 20, maxHp: 20, speed: 90, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                rikudoMode: false,
                portrait: 'https://i.postimg.cc/KzWJPy5j/Captura_de_pantalla_2026_02_26_134301.png',
                transformationPortrait: 'https://i.postimg.cc/kGtwwhj9/Captura_de_pantalla_2026_02_26_135949.png',
                passive: { name: 'Limbo', description: '(Activa con Modo Rikudō) Recibe 50% menos de daño. Recupera 3 HP cada vez que recibe daño por golpe.' },
                abilities: [
                    { name: 'Katon: Gōka Mekkyaku', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'burn', burnPercent: 10, burnDuration: 2, description: 'Causa 2 de daño. Aplica Quemaduras 10% 1 turno.' },
                    { name: 'Susanoo', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'double_on_burn', description: 'Causa 3 AOE. Duplica el daño contra enemigos con Quemaduras.' },
                    { name: 'Modo Rikudō', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'rikudo_transformation', description: 'Transformación permanente: ataques cuestan mitad, causan doble daño, generan doble cargas. Activa Limbo.' },
                    { name: 'Gudōdama', type: 'over', cost: 10, chargeGain: 0, damage: 4, target: 'single', effect: 'multi_hit', hits: 5, hitChance: 50, chargePerHit: 1, description: 'Golpea 1-5 veces (50% cada golpe). Genera 1 carga por golpe acertado.' },
                ]
            },

            'Sun Jin Woo': {
                hp: 20, maxHp: 20, speed: 96, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/2y8gqPH1/Captura_de_pantalla_2026_02_21_225927.png',
                passive: { name: 'Autoridad del Gobernante', description: 'Al inicio de su turno se aplica Buff Sigilo 1 turno. Cuando una Sombra desaparece (sea eliminada o sacrificada), genera 2 cargas.' },
                abilities: [
                    { name: 'Arise!', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'arise_summon', description: 'Invoca una Sombra aleatoria (Igris, Iron, Tusk, Beru, Bellion).' },
                    { name: 'Daga de Kamish', type: 'special', cost: 2, chargeGain: 0, damage: 2, target: 'single', effect: 'daga_kamish', description: 'Causa +1 de daño adicional por cada Sombra Invocada en tu equipo. Roba 1 carga por cada sombra invocada en tu equipo.' },
                    { name: 'Purgatorio de las Sombras', type: 'special', cost: 9, chargeGain: 0, damage: 0, target: 'aoe', effect: 'purgatorio_sombras', description: 'Sacrifica todas sus sombras (excepto Kamish), causa 2 de daño por cada sombra sacrificada (AOE).' },
                    { name: 'Kamish Arise!', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_kamish', description: 'Invocación: Invoca a Kamish.' },
                ]
            },

            'Aldebaran': {
                hp: 30, maxHp: 30, speed: 83, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/PJr0LB6N/Captura_de_pantalla_2026_02_21_230603.png',
                passive: { name: 'Fortaleza de Tauro', description: 'Provocación permanente. Mientras tenga Escudo activo, genera 1 carga por cada golpe recibido.' },
                abilities: [
                    { name: 'Great Horn', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'damage_and_heal', heal: 3, description: 'Causa 1 de daño. Recupera 3 HP.' },
                    { name: 'Golden Shield', type: 'special', cost: 2, chargeGain: 0, damage: 0, target: 'self', effect: 'golden_shield', shieldAmount: 5, description: 'Aplica Escudo 5 HP sobre sí mismo.' },
                    { name: 'Double Great Horn', type: 'special', cost: 7, chargeGain: 0, damage: 3, target: 'single', effect: 'double_great_horn', description: 'MT (2 objetivos). 60% daño doble, 40% daño triple. Gana Escudo = daño total causado.' },
                    { name: 'Great Supernova', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'double_if_low_hp', description: 'Causa 10 ST. Daño doble si Aldebaran tiene 20% o menos de HP.' },
                ]
            },

            'Leonidas': {
                hp: 20, maxHp: 20, speed: 79, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/TYJdgC3L/Captura_de_pantalla_2026_03_06_001254.png',
                passive: { name: 'Phalanx', description: 'Cada vez que un enemigo activa un movimiento especial, genera 2 cargas en un aliado aleatorio.' },
                abilities: [
                    { name: 'Precepto', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'precepto', description: 'Causa 1 de daño. Genera 1 carga a un aliado aleatorio.' },
                    { name: 'Grito de Esparta', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'grito_de_esparta', description: 'Elimina todos los Debuffs aliados. Aplica Escudo Sagrado 2 turnos a todos los aliados.' },
                    { name: 'Sangre de Esparta', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'sangre_de_esparta', description: 'Sacrifica 10 HP y genera 10 cargas.' },
                    { name: 'Gloria de los 300', type: 'over', cost: 10, chargeGain: 0, damage: 3, target: 'aoe', effect: 'gloria_300', description: 'Causa 3 AOE. Aplica Regeneración 25% 2 turnos y Escudo 5 HP a todos los aliados.' },
                ]
            },

            'Min Byung': {
                hp: 15, maxHp: 15, speed: 81, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/Y9xJCpxr/Captura_de_pantalla_2026_02_22_002441.png',
                passive: { name: 'Bendición Sagrada', description: 'Cada vez que un aliado recupera HP, Min Byung genera 1 carga.' },
                abilities: [
                    { name: 'Curación Mágica', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'ally_single', effect: 'heal_ally', heal: 2, description: 'Recupera 2 HP a un aliado.' },
                    { name: 'Escudo Celestial', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'escudo_celestial', shieldAmount: 4, description: 'Otorga Escudo 4 HP a un aliado y le da +2 cargas.' },
                    { name: 'Sanación Heroica', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'regen_team', description: 'Aplica Regeneración 2 HP a todo el equipo durante 2 rondas.' },
                    { name: 'Milagro de la Vida', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'ally_dead', effect: 'revive_ally', description: 'Revive a un aliado caído con 100% de HP y 10 cargas.' },
                ]
            },

            'Rengoku': {
                hp: 25, maxHp: 25, speed: 84, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/5N8k49N4/Captura_de_pantalla_2026_02_24_094704.png',
                passive: { name: 'Corazón Ardiente', description: 'Cuando Rengoku muere, aplica Aturdimiento a todos los enemigos.' },
                abilities: [
                    { name: 'Sol Ascendente', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'sol_ascendente', description: 'Causa 2 de daño. Aplica Quemadura 10% 2 turnos.' },
                    { name: 'Mar de Fuego', type: 'special', cost: 2, chargeGain: 0, damage: 0, target: 'self', effect: 'fire_shield', shieldAmount: 3, description: 'Aplica Escudo 3 HP a Rengoku y un aliado. Genera 1 carga al portador por cada HP de Escudo perdido.' },
                    { name: 'Tigre de Fuego', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'tigre_fuego_v2', description: 'Causa 3 AOE. Aplica Quemadura 10% 2 turnos. Si ya tenía Quemadura, genera 1 carga al equipo aliado.' },
                    { name: 'Purgatorio', type: 'over', cost: 10, chargeGain: 0, damage: 9, target: 'single', effect: 'purgatorio_v2', description: 'Causa 9 ST + Megaaturdimiento. Si el objetivo muere, Quemadura 30% x5 turnos a todos los enemigos.' },
                ]
            },

            'Aspros de Gemini': {
                hp: 20, maxHp: 20, speed: 92, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                anotherDimensionCooldown: 0,
                portrait: 'https://i.postimg.cc/NMZcBh8m/Captura_de_pantalla_2026_02_27_201323.png',
                passive: { name: 'Esquiva Área', description: 'No es afectado ni dañado por movimientos AOE del enemigo.' },
                abilities: [
                    { name: 'Genma Ken', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'genma_ken_v2', description: 'Causa 2 de daño. Aplica Confusión 1 turno. Elimina los Buffs del enemigo.' },
                    { name: 'Colapso Dimensional', type: 'special', cost: 3, chargeGain: 1, damage: 4, target: 'single', effect: 'colapso_dimensional', description: 'Causa 4 ST. Aplica 2 Debuffs aleatorios al enemigo.' },
                    { name: 'Another Dimension', type: 'special', cost: 3, chargeGain: 1, damage: 2, target: 'single', effect: 'another_dimension', description: 'Causa 2 ST. Roba la mitad de las cargas del enemigo. Cooldown: 2 turnos.' },
                    { name: 'Arc Geminga', type: 'over', cost: 10, chargeGain: 0, damage: 8, target: 'single', effect: 'arc_geminga', description: 'Causa 8 ST. Daño doble si el enemigo tiene Debuffs activos.' },
                ]
            },

            'Ymir': {
                hp: 30, maxHp: 30, speed: 72, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/D0PFfyFL/Captura_de_pantalla_2026_03_03_125024.png',
                passive: { name: 'Sangre de Ymir', description: 'Cada vez que un enemigo recibe daño de Espinas, aplica Sangrado 1 turno y 50% de Megacongelación.' },
                abilities: [
                    { name: 'Espinas de Hielo', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'self', effect: 'espinas_hielo', description: 'Aplica Buff Espinas 1 turno. Aplica Buff Provocación 1 turno.' },
                    { name: 'Hacha del Caos Primigenio', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'aoe', effect: 'hacha_caos', description: '50% crítico si el enemigo tiene Sangrado. Si tiene Sangrado, genera 3 cargas.' },
                    { name: 'Aliento de Ginnungagap', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'aliento_ginnungagap', description: '50% de Megacongelación. Reduce 2 cargas a enemigos con Sangrado.' },
                    { name: 'Niebla de Niflheim', type: 'over', cost: 10, chargeGain: 3, damage: 3, target: 'aoe', effect: 'niebla_niflheim', description: 'Causa 3 AOE. Elimina debuffs aliados. Aplica Esquivar 3 turnos aliados. Aplica Congelación a todos los enemigos.' },
                ]
            },

            'Thestalos': {
                hp: 25, maxHp: 25, speed: 86, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/9f6kNBpV/Gemini_Generated_Image_ac4u14ac4u14ac4u.png',
                passive: { name: 'Provocación. Contraataque.', description: 'Thestalos tiene Provocación y Contraataque permanentes.' },
                abilities: [
                    { name: 'Purificación Solar', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'damage_and_heal', description: 'Causa 1 de daño. Recupera 2 HP. Aplica Quemadura 10% 1 turno al objetivo.' },
                    { name: 'Expiación Incandescente', type: 'special', cost: 2, chargeGain: 0, damage: 3, target: 'aoe', effect: 'expiacion_incandescente', description: 'Causa 3 AOE. Si el enemigo tiene Quemaduras, roba 1 carga.' },
                    { name: 'Magma Strength', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'magma_strength', description: 'Recupera 8 HP. Aplica Escudo Sagrado 1 turno.' },
                    { name: 'Corazón en Llamas', type: 'over', cost: 10, chargeGain: 0, damage: 6, target: 'single', effect: 'corazon_llamas', description: 'Causa 6 ST +2 por cada enemigo con Quemaduras. Recupera 50% del daño causado como HP.' },
                ]
            },

            'Alexstrasza': {
                hp: 25, maxHp: 25, speed: 82, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/V6F3kYFw/Captura_de_pantalla_2026_02_21_233329.png',
                transformationPortrait: 'https://i.postimg.cc/k4dLFV5p/Captura_de_pantalla_2026_02_24_101308.png',
                passive: { name: 'Aspecto de la Vida', description: 'Al final de cada ronda, cura 3 HP al aliado con menos HP.' },
                abilities: [
                    { name: 'Fuego Vital', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'ally_single', effect: 'fuego_vital', shieldAmount: 2, description: 'Aplica Escudo 2 HP al aliado. Cada daño al aliado aplica Quemadura 10% al atacante 1 turno.' },
                    { name: 'Don de la Vida', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'don_de_la_vida', heal: 4, description: 'Cura 4 HP al objetivo aliado.' },
                    { name: 'Llama Preservadora', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'llama_preservadora', shieldAmount: 5, description: 'Escudo 5 HP al aliado. Cada HP perdido: Quemadura 10% al atacante + 1 carga para Alexstrasza.' },
                    { name: 'Dragón de la Vida', type: 'over', cost: 9, chargeGain: 0, damage: 0, target: 'self', effect: 'dragon_of_life', description: 'Quemadura 30% 2 turnos a todos los enemigos. Regeneración 30% 2 turnos aliados. Escudo Sagrado 2 turnos a Alexstrasza.' },
                ]
            },

            'Anakin Skywalker': {
                hp: 20, maxHp: 20, speed: 87, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                darkSideAwakened: false,
                portrait: 'https://i.postimg.cc/7hYjCpBh/Captura_de_pantalla_2026_02_21_231859.png',
                transformationPortrait: 'https://i.postimg.cc/Vk6t5wFQ/Whats_App_Image_2026_03_03_at_12_16_07_PM.jpg',
                passive: { name: 'El Elegido', description: 'Contraataque permanente.' },
                abilities: [
                    { name: 'Djem So', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'djem_so', description: 'Causa 2 de daño.' },
                    { name: 'Estrangular', type: 'special', cost: 5, chargeGain: 0, damage: 5, target: 'single', effect: 'estrangular', description: 'Causa 5 de daño. Aplica Debilitar 1 turno.' },
                    { name: 'Onda de Fuerza', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'onda_fuerza', description: 'Causa 3 AOE. Elimina 3 cargas de los enemigos golpeados.' },
                    { name: 'Despertar del Lado Oscuro', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'despertar_lado_oscuro', description: 'TRANSFORMACIÓN: +2 de daño en todos los ataques y 50% de crítico en todas las habilidades.' },
                ]
            },

            // ═══ TEAM REAPERS ══════════════════════════════════════

            'Goku': {
                hp: 20, maxHp: 20, speed: 97, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                ultraInstinto: false,
                portrait: 'https://i.postimg.cc/wMsFFbWT/Captura_de_pantalla_2026_02_26_132013.png',
                transformationPortrait: 'https://i.postimg.cc/ZK704HT2/Captura_de_pantalla_2026_03_02_112236.png',
                passive: { name: 'Entrenamiento de los Dioses', description: 'Con Furia + Frenesí activos, sus ataques generan +2 cargas adicionales. Por cada crítico genera +2 cargas adicionales.' },
                abilities: [
                    { name: 'Kamehameha', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'crit_chance_basic', critChance: 0.1, description: 'Causa 2 de daño. 10% de probabilidad de golpe crítico.' },
                    { name: 'Kaio Ken', type: 'special', cost: 2, chargeGain: 0, damage: 0, target: 'self', effect: 'kaio_ken', description: 'Aplica Buff Furia 2 turnos. Aplica Buff Frenesí 2 turnos.' },
                    { name: 'Genkidama', type: 'special', cost: 8, chargeGain: 0, damage: 4, target: 'aoe', effect: 'genkidama', description: 'Causa 4 AOE. Si el golpe es crítico, reduce a 0 las cargas del enemigo.' },
                    { name: 'Ultra Instinto', type: 'over', cost: 20, chargeGain: 0, damage: 0, target: 'self', effect: 'ultra_instinto', description: 'TRANSFORMACIÓN: 50% de esquivar ataques (pasiva, no visible como buff). Al esquivar, ejecuta Kamehameha sobre el atacante.' },
                ]
            },

            'Ragnar Lothbrok': {
                hp: 25, maxHp: 25, speed: 83, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/JnQ9z1QB/Captura_de_pantalla_2026_02_21_232050.png',
                passive: { name: 'Hijo de Odin', description: 'Cada vez que Ragnar recibe daño por golpe, genera 1 carga.' },
                abilities: [
                    { name: 'Furia Vikinga', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'furia_vikinga', description: 'Causa 2 de daño. Aplica Sangrado 2 turnos.' },
                    { name: 'Tormenta del Norte', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'aoe', effect: 'tormenta_norte', description: '50% de aplicar Sangrado 1 turno. Genera 2 cargas por cada enemigo golpeado con Sangrado.' },
                    { name: 'Rey Pagano', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'aoe', effect: 'rey_pagano', description: 'Causa 4 AOE + Sangrado 2 turnos. Si ya tenía Sangrado, aplica Miedo al enemigo golpeado.' },
                    { name: 'Águila de Sangre', type: 'over', cost: 15, chargeGain: 0, damage: 10, target: 'single', effect: 'blood_eagle', description: 'Causa 10 ST. Si el objetivo tiene <50% HP, lo elimina. Si mata, aplica Miedo 2t a 2 enemigos aleatorios.' },
                ]
            },

            'Saitama': {
                hp: 20, maxHp: 20, speed: 97, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/Qtz0QrqV/Captura_de_pantalla_2026_02_26_132109.png',
                passive: { name: 'Espíritu del Héroe', description: 'Con 50% o menos de HP, genera 3 cargas al final de su turno. Por cada crítico, genera cargas = mitad del daño infligido.' },
                abilities: [
                    { name: 'Golpe Normal', type: 'basic', cost: 0, chargeGain: 1, damage: 4, target: 'single', effect: 'apply_weaken', description: 'Causa 4 de daño. Aplica Debilitar 2 turnos.' },
                    { name: 'Golpes Normales Consecutivos', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'single', effect: 'consecutive_hits', description: 'Golpea 1-3 veces. Daño crítico si el objetivo tiene Debilitar o Escudo activo.' },
                    { name: 'Golpe Serio', type: 'special', cost: 6, chargeGain: 0, damage: 6, target: 'single', effect: 'crit_chance', critChance: 0.5, description: 'Causa 6 de daño. 50% de probabilidad de golpe crítico.' },
                    { name: 'Golpe Grave', type: 'over', cost: 15, chargeGain: 0, damage: 20, target: 'single', effect: 'golpe_grave', description: 'Causa 20 de daño. Si el enemigo es derrotado, genera un turno adicional.' },
                ]
            },

            'Ozymandias': {
                hp: 20, maxHp: 20, speed: 88, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                ozyBonusChargeGain: 0,
                portrait: 'https://i.postimg.cc/6qGzz1Hp/Captura_de_pantalla_2026_02_26_131502.png',
                passive: { name: 'Privilegio Imperial', description: 'Si es golpeado por un enemigo, aplica Quemadura Solar 5% 1 turno al atacante.' },
                abilities: [
                    { name: 'Animación', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'animacion', description: 'Causa 1 de daño. Si el enemigo tiene Quemadura Solar, este ataque genera +1 carga permanentemente.' },
                    { name: 'Sentencia del Sol', type: 'special', cost: 2, chargeGain: 0, damage: 2, target: 'single', effect: 'sentencia_del_sol', description: 'Causa 2 de daño. Si tiene Quemadura Solar, causa 1-3 de daño adicional.' },
                    { name: 'The Sphinx Wehem-Mesut', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_sphinx', description: 'Invoca a Sphinx Wehem-Mesut (8 HP).' },
                    { name: 'Ramesseum Tentyris', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_ramesseum', description: 'Invoca a Ramesseum Tentyris (20 HP).' },
                ]
            },

            'Gilgamesh': {
                hp: 20, maxHp: 20, speed: 89, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/nzNJp8K7/Captura_de_pantalla_2026_02_27_201309.png',
                passive: { name: 'Regla de Oro', description: '+10% de probabilidad de crítico en todos los ataques. Por cada crítico, genera 1 carga.' },
                abilities: [
                    { name: 'Gate of Babylon', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'aoe', effect: 'crit_chance_basic', critChance: 0.25, description: 'Causa 1 AOE. 25% de probabilidad de golpe crítico.' },
                    { name: 'Espada Merodach', type: 'special', cost: 5, chargeGain: 1, damage: 3, target: 'aoe', effect: 'espada_merodach', description: 'Causa 3 AOE. Elimina 3 cargas del enemigo golpeado.' },
                    { name: 'Enkidu: Cadenas del Cielo', type: 'special', cost: 7, chargeGain: 0, damage: 0, target: 'self', effect: 'enkidu', description: 'Cancela todas las invocaciones enemigas. Aplica Megaaturdimiento a enemigos con más de 5 cargas.' },
                    { name: 'Enuma Elish', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'enuma_elish', description: 'Causa 10 ST. Daño doble si el enemigo tiene Escudo activo.' },
                ]
            },

            'Goku Black': {
                hp: 20, maxHp: 20, speed: 95, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/SsGwxyGp/Captura_de_pantalla_2026_02_22_014009.png',
                passive: { name: 'Cuerpo Divino', description: 'Cada vez que Goku Black recibe daño, 50% de robar 1 carga del atacante.' },
                abilities: [
                    { name: 'Espada de Ki', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'espada_ki', description: 'Causa 2 de daño.' },
                    { name: 'Teletransportación', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'single', effect: 'teleportacion_confusion', description: 'Aplica Confusión al objetivo. Roba 2 cargas del objetivo.' },
                    { name: 'Lazo Divino', type: 'special', cost: 6, chargeGain: 0, damage: 5, target: 'single', effect: 'lazo_divino', description: 'Causa 5 de daño. Aplica Veneno 4 turnos. Cada tick de veneno: 50% de eliminar 2 cargas.' },
                    { name: 'Guadaña Divina', type: 'over', cost: 10, chargeGain: 0, damage: 7, target: 'aoe', effect: 'guadana_divina', description: 'Causa 7 AOE. Reduce a 0 todas las cargas de los enemigos golpeados.' },
                ]
            },

            'Saga de Geminis': {
                hp: 20, maxHp: 20, speed: 91, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/wBvTDG7f/Captura_de_pantalla_2026_02_24_103109.png',
                passive: { name: 'Maboroshi no Shinkirō', description: 'Cada vez que se aplica un debuff en un enemigo, genera 1 carga.' },
                abilities: [
                    { name: 'Shingun Ken', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'speed_up_self', description: 'Causa 1 de daño. Aumenta 1 punto la velocidad de Saga de Geminis.' },
                    { name: 'Genrō Maō Ken', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'single', effect: 'apply_possession', description: 'Causa 2 de daño. Aplica Posesión 2 turnos al enemigo.' },
                    { name: 'Kōsoku Ken', type: 'special', cost: 6, chargeGain: 0, damage: 1, target: 'single', effect: 'speed_bonus_damage', description: 'Causa 1 de daño +1 adicional por cada punto de velocidad superior al enemigo.' },
                    { name: 'Explosión de Galaxias', type: 'over', cost: 15, chargeGain: 0, damage: 10, target: 'aoe', effect: 'aoe_drain_charges_1', critChance: 0.1, description: 'Causa 10 AOE. 10% de probabilidad de crítico.' },
                ]
            },

            'Minato Namikaze': {
                hp: 20, maxHp: 20, speed: 89, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/SKsNcvJt/Captura_de_pantalla_2026_02_24_103359.png',
                passive: { name: 'Hiraishin no Jutsu', description: 'Esquiva Área (inmune a AOE enemigo). Genera +1 carga adicional por cada enemigo golpeado con menos velocidad que Minato.' },
                abilities: [
                    { name: 'Kiiroi Senkō', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'kiiroi_senko_v2', description: 'Causa 1 de daño. Aplica Celeridad 10% 2 turnos. Aplica Buff aleatorio 2 turnos.' },
                    { name: 'Destello de la Danza Aullante', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'aoe', effect: 'destello_danza', description: 'Causa 2 AOE. Si el enemigo tiene menos velocidad que Minato: aplica debuff aleatorio 2 turnos. Si tiene más: roba 2 cargas.' },
                    { name: 'Rasen Senkō Chō Rinbu Kō Sanshiki', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'aoe', effect: 'rasen_senko_v2', description: 'Causa 2 AOE. Cada golpe tiene 50% de robar 3 cargas del enemigo.' },
                    { name: 'Legado del Cuarto Hokage', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'legado_hokage_v2', description: 'Genera 8 cargas a los 4 aliados del equipo (excepto Minato).' },
                ]
            },

            'Muzan Kibutsuji': {
                hp: 20, maxHp: 20, speed: 86, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                muzanTransformed: false,
                portrait: 'https://i.postimg.cc/fL41fCgH/Captura_de_pantalla_2026_02_28_020016.png',
                transformationPortrait: 'https://i.postimg.cc/nM8HxvTD/Whats_App_Image_2026_03_03_at_3_29_34_PM.jpg',
                passive: { name: 'Progenitor Demoniaco', description: 'Al inicio de cada ronda, cura 1 HP a Muzan y a un aliado aleatorio. Cada vez que Veneno hace daño, Muzan genera 1 carga.' },
                abilities: [
                    { name: 'Espinas de Sangre', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'apply_poison', poisonDuration: 2, description: 'Causa 2 de daño. Aplica Veneno 2 turnos.' },
                    { name: 'Sangre Demoniaca', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'single', effect: 'sangre_demoniaca', description: 'Causa 3 de daño. Aplica Veneno 3 turnos. Cura 3 HP a Muzan.' },
                    { name: 'Sombra de la Noche', type: 'special', cost: 5, chargeGain: 0, damage: 3, target: 'aoe', effect: 'sombra_noche', description: 'Causa 3 AOE. Aplica Sigilo 2 turnos a Muzan. Aplica Veneno 3 turnos a los enemigos.' },
                    { name: 'Rey de los Demonios Definitivo', type: 'over', cost: 12, chargeGain: 0, damage: 1, target: 'aoe', effect: 'muzan_transform', description: 'TRANSFORMACIÓN + 1 AOE: Veneno 5t, Regeneración 30% 5t, +20% Celeridad, +70% crítico.' },
                ]
            },

            'Nakime': {
                hp: 15, maxHp: 15, speed: 80, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/858xm4nX/Captura_de_pantalla_2026_02_28_020047.png',
                passive: { name: 'Castillo Infinito', description: 'Inmune a daño Single Target. Al inicio de cada ronda, el primer ataque enemigo impacta sobre un personaje del equipo enemigo.' },
                abilities: [
                    { name: 'Nota del Biwa', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'single', effect: 'apply_confusion', description: 'Aplica Confusión al objetivo por 2 turnos.' },
                    { name: 'Cambio de Sangre', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'single', effect: 'cambio_sangre', description: 'Intercambia todos los Debuffs de un aliado y los aplica a un objetivo enemigo.' },
                    { name: 'Cambio Demoniaco', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'single', effect: 'cambio_demoniaco', description: 'Selecciona un enemigo e intercambia cargas y Buffs con un aliado.' },
                    { name: 'Colapso', type: 'over', cost: 8, chargeGain: 0, damage: 0, target: 'self', effect: 'cambio_vida_v2', description: 'Intercambia los HP y los puntos de carga de ambos equipos.' },
                ]
            },

            'Sauron': {
                hp: 25, maxHp: 25, speed: 78, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/858xm4n0/Captura_de_pantalla_2026_02_28_020119.png',
                passive: { name: 'El Ojo que Todo lo Ve', description: 'Puede atacar ignorando Provocación, Megaprovocación y Sigilo. 50% de aplicar Silencio 1 turno cada vez que recibe daño.' },
                abilities: [
                    { name: 'Voluntad de Mordor', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'voluntad_mordor', description: 'Causa 2 de daño. Si el objetivo tenía Silencio, genera +2 cargas adicionales.' },
                    { name: 'Mano Negra', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'aoe', effect: 'mano_negra', description: 'Causa 2 AOE. Golpe crítico si el objetivo tiene Provocación, Megaprovocación o Sigilo.' },
                    { name: 'Señor Oscuro', type: 'special', cost: 7, chargeGain: 0, damage: 5, target: 'single', effect: 'senor_oscuro', description: 'Causa 5 ST. Si el objetivo tiene Provocación o Megaprovocación, la elimina y causa crítico.' },
                    { name: 'Poder del Anillo', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'poder_del_anillo', description: 'Aplica Megaprovocación 4 turnos. Aplica Regeneración 20% 4 turnos.' },
                ]
            },

            'Darth Vader': {
                hp: 30, maxHp: 30, speed: 80, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                hpLost: 0,
                portrait: 'https://i.postimg.cc/63sFfc1F/Captura_de_pantalla_2026_02_28_015421.png',
                passive: { name: 'Presencia Oscura', description: 'Inmune a Miedo y Confusión. Cada vez que un Miedo termine, genera 1 carga.' },
                abilities: [
                    { name: 'Intimidación del Imperio', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'single', effect: 'apply_fear_1', description: 'Aplica Miedo al objetivo por 1 turno.' },
                    { name: 'Puño del Imperio', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'apply_counterattack', description: 'Aplica Contraataque a Darth Vader por 4 turnos.' },
                    { name: 'Lado Oscuro de la Fuerza', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'apply_megaprovocation_buff', description: 'Aplica Megaprovocación 4 turnos.' },
                    { name: 'Ira del Elegido Caído', type: 'over', cost: 10, chargeGain: 0, damage: 2, target: 'aoe', effect: 'ira_elegido', description: 'Causa 2 AOE +1 adicional por cada HP que Darth Vader ha perdido.' },
                ]
            },

            'Lich King': {
                hp: 30, maxHp: 30, speed: 82, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/W3Rxw8ff/Captura_de_pantalla_2026_02_28_015847.png',
                passive: { name: 'Aura de Hielo', description: 'Aplica Congelación al atacante cuando recibe daño. Inmune a Miedo, Posesión y Congelación.' },
                abilities: [
                    { name: 'Agonía de Escarcha', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'agonia_escarcha', description: 'Causa 1 de daño. Elimina 1 HP adicional al objetivo. Cura 1 HP a Lich King.' },
                    { name: 'Cadenas de Hielo', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'self', effect: 'cadenas_hielo', description: 'Aplica Provocación 3 turnos. Mientras tenga Provocación, reduce 5% velocidad al atacante.' },
                    { name: 'Segador de Almas', type: 'special', cost: 8, chargeGain: 0, damage: 5, target: 'single', effect: 'segador_almas', description: 'Causa 5 ST. Si el enemigo muere, es revivido como aliado con 50% de vida.' },
                    { name: 'El Rey Caído', type: 'over', cost: 9, chargeGain: 0, damage: 0, target: 'self', effect: 'el_rey_caido', description: 'Realiza 3 invocaciones aleatorias.' },
                ]
            },

            'Padme Amidala': {
                hp: 20, maxHp: 20, speed: 78, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/pV63g1B4/Whats_App_Image_2026_03_05_at_9_39_15_A.jpg',
                passive: { name: 'Negociaciones Hostiles', description: 'Cada vez que un aliado recibe un Debuff, Padme genera 1 carga.' },
                abilities: [
                    { name: 'Orden de Fuego', type: 'basic', cost: 0, chargeGain: 0, damage: 0, target: 'self', effect: 'orden_de_fuego', description: 'Genera 1 carga a los 4 aliados del equipo.' },
                    { name: 'Solución Diplomática', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'solucion_diplomatica', description: 'Elimina todos los Debuffs del objetivo aliado. Padme genera 2 cargas por cada Debuff eliminado.' },
                    { name: 'Señuelo', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'invocar_senuelo', description: 'Invoca un Señuelo (5 HP). Padme gana Sigilo 2 turnos.' },
                    { name: 'Reina de Naboo', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'reina_de_naboo', description: 'Aplica Escudo a los 4 aliados. Genera 4 cargas a los 4 aliados.' },
                ]
            },

            'Daenerys Targaryen': {
                hp: 20, maxHp: 20, speed: 77, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/8k0xqnbx/Whats_App_Image_2026_03_05_at_9_41_48_A.jpg',
                passive: { name: 'Dinastía del Dragón', description: 'Inmune a Quemadura y Quemadura Solar. El equipo aliado aplica Quemadura 10% 1 turno al golpear al enemigo.' },
                abilities: [
                    { name: 'Madre de Dragones', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'self', effect: 'madre_dragones', description: 'Invoca un Dragón aleatorio.' },
                    { name: 'Vuelo del Dragón', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'vuelo_dragon', description: 'Gana Escudo Sagrado 2 turnos.' },
                    { name: 'Locura Targaryen', type: 'special', cost: 8, chargeGain: 0, damage: 6, target: 'aoe', effect: 'locura_targaryen', description: 'Causa 6 AOE. Genera 1 carga al equipo aliado por cada Quemadura activa en los enemigos.' },
                    { name: 'Dracarys', type: 'over', cost: 14, chargeGain: 0, damage: 8, target: 'aoe', effect: 'dracarys', description: 'Causa 8 AOE. Aplica Quemadura 20% 2 turnos. Invoca a los 3 dragones.' },
                ]
            },

            'Tamayo': {
                hp: 20, maxHp: 20, speed: 81, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/9XnsvNBS/Whats_App_Image_2026_03_05_at_9_42_52_A.jpg',
                passive: { name: 'Curandera de las Sombras', description: 'Al inicio de cada ronda, elimina 2 Debuffs de un aliado aleatorio y aplica Escudo 3 HP a un aliado aleatorio.' },
                abilities: [
                    { name: 'Aguja Medicinal', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'ally_single', effect: 'aguja_medicinal', heal: 1, description: 'Cura 1 HP y elimina 1 Debuff del objetivo aliado.' },
                    { name: 'Aroma Curativo', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'aroma_curativo', description: 'Elimina 1 Debuff de todo el equipo aliado.' },
                    { name: 'Medicina Demoniaca', type: 'special', cost: 8, chargeGain: 0, damage: 0, target: 'self', effect: 'medicina_demoniaca', description: 'Elimina todos los Debuffs aliados. Por cada Debuff eliminado, cura 1 HP a todo el equipo.' },
                    { name: 'Hechizo de Sangre', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'hechizo_sangre', description: 'Aplica Regeneración 20% 3 turnos al equipo aliado. 50% de Confusión 1t a un enemigo aleatorio por cada tick de Regeneración.' },
                ]
            },

            'Emperador Palpatine': {
                hp: 20, maxHp: 20, speed: 88, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/DfMRtYcj/Whats_App_Image_2026_03_05_at_9_50_54_A.jpg',
                passive: { name: 'Emperador de la Galaxia', description: '50% de aplicar Aturdimiento cada vez que un Debuff del equipo enemigo se limpia o termina su efecto.' },
                abilities: [
                    { name: 'Relámpago Sith', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'single', effect: 'relampago_sith', description: 'Causa 1 de daño. Limpia 1 Debuff del objetivo enemigo (activa pasiva).' },
                    { name: 'Corrupción', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'single', effect: 'apply_possession_1', description: 'Aplica Posesión 1 turno al objetivo.' },
                    { name: 'Orden Sith', type: 'special', cost: 7, chargeGain: 0, damage: 1, target: 'aoe', effect: 'orden_sith', description: 'Causa 1 AOE. Limpia 3 Debuffs del equipo enemigo (activa pasiva). Cura 3 HP a Palpatine y un aliado.' },
                    { name: 'Poder Ilimitado', type: 'over', cost: 12, chargeGain: 0, damage: 4, target: 'aoe', effect: 'poder_ilimitado', description: 'Causa 4 AOE. 50% de Megaaturdimiento a cada enemigo golpeado.' },
                ]
            },

            'Gandalf': {
                hp: 20, maxHp: 20, speed: 74, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/1RjbLYHx/Whats_App_Image_2026_03_05_at_9_53_24_A.jpg',
                passive: { name: 'Istari', description: 'Inmune a Posesión, Confusión y Miedo. Cada vez que un Escudo en un aliado se rompe, genera 3 cargas al portador.' },
                abilities: [
                    { name: 'Resplandor', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'resplandor', description: 'Aplica Regeneración 10% 1 turno a todo el equipo aliado.' },
                    { name: 'Rayo de Luz', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'rayo_de_luz', shieldAmount: 5, description: 'Cura 5 HP al aliado. Aplica Escudo 5 HP 1 turno. Aplica Provocación 2 turnos al aliado.' },
                    { name: 'El Mago Blanco', type: 'special', cost: 7, chargeGain: 0, damage: 0, target: 'self', effect: 'el_mago_blanco', description: 'Cura 5 HP al equipo aliado. Aplica Protección Sagrada al equipo aliado 1 turno.' },
                    { name: 'No Puedes Pasar', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'no_puedes_pasar', description: 'Los 4 aliados ganan Escudo Sagrado 2 turnos.' },
                ]
            },

            'Doomsday': {
                hp: 30, maxHp: 30, speed: 84, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/hjJDWnn6/Captura_de_pantalla_2026_03_06_003242.png',
                passive: { name: 'Adaptación Reactiva', description: 'Cada vez que recibe un golpe de un ataque básico, genera 1 carga.' },
                abilities: [
                    { name: 'Provocación', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'self_provocation', description: 'Aplica Buff Provocación hasta el final de su siguiente turno.' },
                    { name: 'Smashing Strike', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'aoe', effect: 'aoe_stun_chance', description: 'Causa 2 AOE. 50% de probabilidad de Aturdir al enemigo golpeado.' },
                    { name: 'Skill Drain', type: 'special', cost: 8, chargeGain: 0, damage: 0, target: 'aoe', effect: 'skill_drain', description: 'Causa de 1 a 3 de daño por efecto a cada enemigo. Recupera HP equivalente al daño total infligido.' },
                    { name: 'Devastator Punish', type: 'over', cost: 12, chargeGain: 0, damage: 10, target: 'single', effect: 'devastator_punish', critChance: 0.3, description: 'Causa 10 ST. 30% de probabilidad de crítico.' },
                ]
            },

            'Ikki de Fenix': {
                hp: 20, maxHp: 20, speed: 85, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                ikki_armor: false, ikki_revival_round: null,
                portrait: 'https://i.postimg.cc/LsX6jbnD/Captura_de_pantalla_2026_02_24_103509.png',
                transformationPortrait: 'https://i.postimg.cc/5tMS08yN/Captura_de_pantalla_2026_02_24_104108.png',
                passive: { name: 'Cenizas del Fénix', description: 'Al final de la segunda ronda después de morir, revive con 50% de HP y 5 cargas.' },
                abilities: [
                    { name: 'Garras del Fénix', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'garras_fenix', burnPercent: 5, burnDuration: 3, description: 'Causa 1 de daño. Aplica Quemadura 5% por 2 turnos.' },
                    { name: 'Phoenix Genma Ken', type: 'basic', cost: 0, chargeGain: 0, damage: 1, target: 'aoe', effect: 'phoenix_genma_ken', description: 'Causa 1 AOE. Si el enemigo tiene Quemaduras, genera 2 cargas.' },
                    { name: 'Hō Yoku Ten Shō', type: 'special', cost: 5, chargeGain: 0, damage: 4, target: 'aoe', effect: 'random_burn_aoe', description: 'Causa 4 AOE. Aplica Quemadura 5% 3 turnos.' },
                    { name: 'Armadura Divina del Fénix', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'fenix_armor', description: 'TRANSFORMACIÓN: Regeneración 20% permanente y daño triple contra enemigos con Quemaduras.' },
                ]
            },

        };

