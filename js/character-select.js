// ==================== DATOS DE PERSONAJES ====================
        const characterData = {

            // ═══ TEAM HUNTERS ═══════════════════════════════════════

            'Madara Uchiha': {
                hp: 20, maxHp: 20, speed: 90, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                rikudoMode: false,
                portrait: 'https://i.postimg.cc/KzWJPy5j/Captura_de_pantalla_2026_02_26_134301.png',
                transformPortrait: 'https://i.postimg.cc/kGtwwhj9/Captura_de_pantalla_2026_02_26_135949.png',
                passive: { name: 'Rinnegan', description: 'Cada vez que recibe un debuff, hay 70% de probabilidad de que ese debuff sea limpiado automáticamente. Cada vez que un debuff es limpiado o disipado en Madara, genera 3 cargas.' },
                abilities: [
                    { name: 'Gakidō: Fūjutsu Kyūin', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'single', effect: 'lifesteal_basic', description: 'Causa 1 daño. Roba 2 HP del objetivo.' },
                    { name: 'Mangekyō Sharingan', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'single', effect: 'sharingan_aoe', description: 'Causa 4 daño. Se aplica Buff Contraataque. Se aplica Buff Concentración.' },
                    { name: 'Susanoo', type: 'special', cost: 8, chargeGain: 0, damage: 3, target: 'aoe', effect: 'double_on_burn', critChance: 0.50, description: 'Causa 3 AOE con 50% de probabilidad de golpe crítico. Aplica Buff Escudo con +3 HP por cada golpe crítico acertado.' },
                    { name: 'Modo Rikudō', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'rikudo_transformation', description: 'Transformación permanente. Todos los ataques cuestan la mitad de cargas. Todos los ataques causan daño doble.' }
                ]
            },

            'Sun Jin Woo': {
                hp: 20, maxHp: 20, speed: 96, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/T13zZdKD/Captura_de_pantalla_2026_03_11_145542.png',
                passive: { name: 'Arise!', description: 'Al inicio de su turno invoca una sombra aleatoria. Cada vez que una invocación es eliminada genera 2 cargas.' },
                abilities: [
                    { name: 'Sigilo de las Sombras', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'sigilo_sombras_sjw', description: 'Se aplica Buff Sigilo por 2 turnos.' },
                    { name: 'Daga de Kamish', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'single', effect: 'daga_kamish', description: 'Causa +1 daño adicional por cada sombra invocada. Roba 1 carga por cada sombra invocada.' },
                    { name: 'Autoridad del Gobernante', type: 'special', cost: 8, chargeGain: 0, damage: 0, target: 'self', effect: 'autoridad_gobernante', description: 'Se aplica Buff Esquiva Área 3 turnos. Se aplica Buff Regeneración 20% por 3 turnos.' },
                    { name: 'Purgatorio de las Sombras', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'aoe', effect: 'summon_kamish', description: 'Sacrifica todas sus sombras (excepto Kamish), causa 3 daño AOE por sombra sacrificada.' }
                ]
            },
            'Aldebaran': {
                hp: 30, maxHp: 30, speed: 83, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/PJr0LB6N/Captura_de_pantalla_2026_02_21_230603.png',
                passive: { name: 'Fortaleza de Tauro', description: 'Efecto pasivo Provocación. Cada vez que un Buff Escudo en Aldebaran absorbe un golpe, genera 2 cargas. Al final de su turno con Escudo activo, recupera 2 HP.' },
                abilities: [
                    { name: 'Great Horn', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'great_horn', heal: 3, shieldAmount: 2, description: 'Causa 1 de daño. Recupera 3 HP. Se aplica Buff Escudo 2 HP.' },
                    { name: 'Golden Shield', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'golden_shield', shieldAmount: 3, description: 'Limpia los debuffs activos en Aldebaran. Se aplica un Buff Escudo de 3 HP.' },
                    { name: 'Double Great Horn', type: 'special', cost: 7, chargeGain: 0, damage: 3, target: 'multi', effect: 'double_great_horn', description: 'Ataca 2 objetivos causando 3 de daño. 60% de probabilidad de causar daño doble. 40% de probabilidad de causar daño triple. Se aplica Buff Escudo con HP equivalente a la suma del daño total causado.' },
                    { name: 'Great Supernova', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'great_supernova', description: 'Causa 10 de daño. Causa daño doble si Aldebaran tiene 20% o menos de HP.' }
                ]
            },

            'Leonidas': {
                hp: 20, maxHp: 20, speed: 79, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/RFh0T2JL/Captura_de_pantalla_2026_03_11_145303.png',
                passive: { name: 'Phalanx', description: 'Al inicio de cada ronda limpia 2 debuffs aleatorios del equipo aliado. Cada vez que un enemigo realiza un ataque especial u Over, Leonidas recupera 3 HP.' },
                abilities: [
                    { name: 'Precepto', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'single', effect: 'precepto', description: 'Causa 1 daño. 50% de probabilidad de aplicar Aturdimiento.' },
                    { name: 'Grito de Esparta', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'ally_aoe', effect: 'grito_de_esparta', description: 'Limpia 1 debuff a todos los aliados. Aplica Buff Frenesi a todos los aliados.' },
                    { name: 'Sangre de Esparta', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'sangre_de_esparta', description: 'Sacrifica 10 HP. Todos los aliados generan 6 cargas (excepto Leonidas).' },
                    { name: 'Gloria de los 300', type: 'over', cost: 10, chargeGain: 0, damage: 4, target: 'aoe', effect: 'gloria_300', description: 'Causa 4 AOE. Aplica Buff Regeneración 25% 2 turnos a todos los aliados. Disipa todos los debuffs del equipo aliado.' }
                ]
            },
            'Min Byung': {
                hp: 15, maxHp: 15, speed: 81, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/Y9xJCpxr/Captura_de_pantalla_2026_02_22_002441.png',
                passive: { name: 'Bendicion Sagrada', description: 'Efecto pasivo Esquiva Area. Cada vez que un aliado recupera HP, genera 2 cargas en un aliado aleatorio.' },
                abilities: [
                    { name: 'Curación Mágica', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'ally_single', effect: 'heal_ally', heal: 3, description: 'Recupera 3 HP a un aliado de tu elección.' },
                    { name: 'Protección Celestial', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'dispel_ally_charges', description: 'Disipar los debuffs del aliado objetivo y por cada debuff Disipado genera +1 carga sobre el aliado objetivo.' },
                    { name: 'Sanación Heroica', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'heal_all_allies', heal: 4, description: 'Recupera 4 HP a todos tus aliados.' },
                    { name: 'Milagro de la vida', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'ally_dead', effect: 'revive_ally', description: 'Revive a un aliado caído con 100% de su HP y 10 cargas.' }
                ]
            },

            'Rengoku': {
                hp: 25, maxHp: 25, speed: 84, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/wTWCgJY2/Captura_de_pantalla_2026_03_15_021343.png',
                passive: { name: 'Corazon Ardiente', description: 'Al morir: Aturdimiento a todos los enemigos + 5 cargas al equipo aliado. Genera 1 carga cada vez que un debuff Quemadura inflige daño.' },
                abilities: [
                    { name: 'Sol Ascendente', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'sol_ascendente_rengoku', burnAmount: 1, description: 'Causa 2 daño. Aplica Quemadura 1HP. Si el objetivo ya tenía Quemadura, inflige +1 daño por cada Quemadura activa en el equipo enemigo.' },
                    { name: 'Mar de Fuego', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'aoe', effect: 'mar_fuego_rengoku', description: 'Causa 4 AOE. Ignora Esquiva Área. Disipa buffs activos de los objetivos. Aplica Quemadura 1HP. Si ya tenían Quemadura antes del ataque: 100% de crítico.' },
                    { name: 'Tigre de Fuego', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'tigre_fuego_rengoku', burnAmount: 1, description: 'Causa 3 AOE. Aplica Quemadura 1HP. Si los enemigos golpeados ya tenían Quemadura activa antes del ataque, genera 1 carga al equipo aliado por cada Quemadura activa en el equipo enemigo.' },
                    { name: 'Novena Postura: Purgatorio', type: 'over', cost: 12, chargeGain: 0, damage: 7, target: 'single', effect: 'purgatorio_rengoku', description: 'Causa 7 daño. Aplica Mega Aturdimiento. Si el objetivo tenía Quemadura activa antes del ataque, inflige +2 daño directo por cada Quemadura activa en ambos equipos.' }
                ]
            },

            'Aspros de Gemini': {
                hp: 20, maxHp: 20, speed: 92, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                anotherDimensionCooldown: 0,
                portrait: 'https://i.postimg.cc/NMZcBh8m/Captura_de_pantalla_2026_02_27_201323.png',
                passive: { name: 'Face of Geminga', description: 'Esquiva area. Al inicio de la ronda tiene 50% de probabilidad de generar 1 carga por cada debuff activo en los enemigos.' },
                abilities: [
                    { name: 'Genma Ken', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'genma_ken', description: 'Causa 2 de daño. Aplica debuff Confusión sobre el objetivo. Elimina los buffs del enemigo golpeado.' },
                    { name: 'Colapso Dimensional', type: 'special', cost: 3, chargeGain: 1, damage: 4, target: 'single', effect: 'colapso_dimensional', description: 'Causa 4 de daño. Aplica 2 debuffs aleatorios en el enemigo golpeado.' },
                    { name: 'Another Dimension', type: 'special', cost: 3, chargeGain: 1, damage: 2, target: 'single', effect: 'another_dimension', cooldown: 2, description: 'Causa 2 de daño. Roba la mitad de las cargas actuales del enemigo golpeado. Cooldown 2 turnos.' },
                    { name: 'Arc Geminga', type: 'over', cost: 10, chargeGain: 0, damage: 8, target: 'single', effect: 'arc_geminga', description: 'Causa 8 de daño. Aplica daño doble si el enemigo golpeado tiene debuffs activos.' }
                ]
            },

            'Ymir': {
                hp: 30, maxHp: 30, speed: 72, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/D0PFfyFL/Captura_de_pantalla_2026_03_03_125024.png',
                passive: { name: 'Sangre de Ymir', description: 'Cada vez que un enemigo recibe daño de Espinas, aplica Sangrado 1 turno y 50% de Megacongelación.' },
                abilities: [
                    { name: 'Espinas de Hielo', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'self', effect: 'espinas_hielo', description: 'Se aplica Buff Espinas 1 Turno. Se aplica Buff Provocación por 1 turno.' },
                    { name: 'Hacha del Caos Primigenio', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'aoe', effect: 'hacha_caos', description: 'Causa 2 AOE. 50% de probabilidad de golpe Crítico si el enemigo tiene Debuff Sangrado. Si el enemigo golpeado tiene debuff Sangrado, genera 3 cargas.' },
                    { name: 'Aliento de Ginnungagap', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'aliento_ginnungagap', description: 'Causa 3 AOE. 50% de probabilidad de aplicar debuff Megacongelación en el enemigo golpeado. Reduce en 2 las cargas de los enemigos golpeados que tengan debuff Sangrado.' },
                    { name: 'Niebla de Niflheim', type: 'over', cost: 10, chargeGain: 0, damage: 3, target: 'aoe', effect: 'niebla_niflheim', description: 'Causa 3 AOE. Disipar los debuffs activos en los aliados. Aplica debuff Megacongelación en todos los enemigos.' }
                ]
            },

            'Thestalos': {
                hp: 25, maxHp: 25, speed: 86, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/9f6kNBpV/Gemini_Generated_Image_ac4u14ac4u14ac4u.png',
                passive: { name: 'Primogenito del Sol', description: 'Contraataque.' },
                abilities: [
                    { name: 'Purificación Solar', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'purificacion_solar', heal: 2, burnAmount: 2, description: 'Causa 1 de daño. Recupera 2 de HP. Aplica Quemaduras de 2 HP.' },
                    { name: 'Proteccion del Astro Rey', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'proteccion_astro_rey', shieldAmount: 4, description: 'Se aplica Buff Provocación. Se aplica Buff Escudo 4 HP.' },
                    { name: 'Magma Strength', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'magma_strength', heal: 8, description: 'Recupera 8 HP. Se aplica Buff Escudo Sagrado.' },
                    { name: 'Furia de Thestalos', type: 'over', cost: 8, chargeGain: 0, damage: 2, target: 'aoe', effect: 'furia_thestalos', description: 'Causa 2 AOE. 50% probabilidad de golpe crítico. 50% de probabilidad de causar daño triple.' }
                ]
            },

            'Alexstrasza': {
                hp: 25, maxHp: 25, speed: 82, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/V6F3kYFw/Captura_de_pantalla_2026_02_21_233329.png',
                transformationPortrait: 'https://i.postimg.cc/k4dLFV5p/Captura_de_pantalla_2026_02_24_101308.png',
                passive: { name: 'Aspecto de la Vida', description: 'Al final de cada ronda, cura 3 HP al aliado con menos HP.' },
                abilities: [
                    { name: 'Fuego Vital', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'ally_single', effect: 'fuego_vital', shieldAmount: 2, description: 'Aplica Buff Escudo de 2 HP al objetivo aliado. Aplica Buff Aura de fuego.' },
                    { name: 'Don de la Vida', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'don_de_la_vida', heal: 4, description: 'Recupera 4 HP del objetivo aliado. Aplica Buff Aura de Luz.' },
                    { name: 'Llama Preservadora', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'llama_preservadora', shieldAmount: 5, description: 'Aplica Buff Escudo al objetivo de 5 HP. Cuando el aliado consume un punto de este escudo, genera 1 punto de carga para Alexstrasza. Aplica Buff Aura de fuego. Aplica Buff Aura de Luz.' },
                    { name: 'Dragón de la Vida', type: 'over', cost: 9, chargeGain: 0, damage: 0, target: 'self', effect: 'dragon_of_life', burnAmount: 4, description: 'Aplica debuff Quemadura de 4 HP a todo el equipo enemigo. Aplica Buff Regeneración de 30% a todos los aliados por 2 turnos. Alexstrasza gana Buff Escudo Sagrado.' }
                ]
            },

            'Anakin Skywalker': {
                hp: 25, maxHp: 25, speed: 86, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                darkSideAwakened: false,
                portrait: 'https://i.ibb.co/xSrfM8Sw/Whats-App-Image-2026-06-10-at-5-14-13-PM.jpg',
                transformPortrait: 'https://i.ibb.co/V0qvG1Bw/Whats-App-Image-2026-06-10-at-5-10-21-PM.jpg',
                passive: { name: 'El Elegido', description: 'Efecto pasivo Asistir. Efecto pasivo Contraataque. 50% de probabilidad de que Anakin se aplique Buff Frenesi y Furia por 2 turnos al inicio de cada ronda. Cada vez que un enemigo aplica un debuff sobre un aliado, Anakin ejecuta un ataque básico sobre ese enemigo aplicando los efectos y generando las cargas correspondientes.' },
                abilities: [
                    { name: 'Djem So', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'djem_so', description: 'Causa 2 daño. Elimina 1 punto de carga del objetivo.' },
                    { name: 'Estrangular', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'estrangular', description: 'Causa 3 daño AOE. Elimina 1 punto de carga del equipo enemigo. 50% de probabilidad de aplicar Aturdimiento por enemigo.' },
                    { name: 'General de la 501', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'general_501', description: 'Aplica Buff Provocación 2 turnos sobre Anakin. Aplica Buff Armadura 2 turnos sobre Anakin. Aplica Buff Reflejar sobre Anakin.' },
                    { name: 'Despertar del Lado Oscuro', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'dark_side_anakin', description: 'TRANSFORMACIÓN PERMANENTE: +10 velocidad. Todos los ataques de Anakin causan +3 daño adicional y aplican debuff Miedo. Mientras esté transformado, cada vez que recibe daño se cura 3 HP.' }
                ]
            },
            // ═══ TEAM REAPERS ══════════════════════════════════════

            'Goku': {
                hp: 20, maxHp: 20, speed: 97, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                ultraInstinto: false,
                portrait: 'https://i.postimg.cc/wMsFFbWT/Captura_de_pantalla_2026_02_26_132013.png',
                transformPortrait: 'https://i.postimg.cc/ZK704HT2/Captura_de_pantalla_2026_03_02_112236.png',
                transformationPortrait: 'https://i.postimg.cc/ZK704HT2/Captura_de_pantalla_2026_03_02_112236.png',
                passive: { name: 'Entrenamiento de los Dioses', description: 'Con Furia + Frenesí activos, sus ataques generan +2 cargas adicionales. Por cada crítico genera +2 cargas adicionales.' },
                abilities: [
                    { name: 'Kamehameha', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'crit_chance_50', critChance: 0.50, description: 'Causa 2 de daño. 50% de probabilidad de golpe crítico.' },
                    { name: 'Kaio Ken', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'kaio_ken', description: 'Se aplica Buff Furia de 3 turnos. Se aplica Buff Frenesí de 2 turnos.' },
                    { name: 'Genkidama', type: 'special', cost: 8, chargeGain: 0, damage: 4, target: 'aoe', effect: 'genkidama', description: 'Causa 4 AOE. Si el enemigo recibe un golpe crítico por este ataque, reduce a 0 las cargas del enemigo.' },
                    { name: 'Ultra Instinto', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'ultra_instinto', description: 'TRANSFORMACIÓN: Mientras Goku permanezca transformado gana Esquivar (50% de probabilidad de esquivar el golpe, daño y debuff del ataque del enemigo). Cada vez que Goku esquiva un ataque, ejecuta su ataque básico sobre el enemigo atacante.' }
                ]
            },

            'Ragnar Lothbrok': {
                hp: 25, maxHp: 25, speed: 83, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/TDCS5pvx/Ragnar-from-Vikingard.jpg',
                passive: { name: 'Estratega de Odin', description: 'Al inicio de cada ronda, aplica 5 HP de escudo al equipo aliado. 50% de probabilidad de aplicar Sangrado cada vez que un aliado pierde HP de escudo. Si un aliado muere mientras Ragnar ya está muerto, Ragnar revive con 15 HP y 20 cargas y reduce 50% los HP de un enemigo aleatorio.' },
                abilities: [
                    { name: 'Furia Vikinga',     type: 'basic',   cost: 0,  chargeGain: 2, damage: 2,  target: 'single', effect: 'furia_vikinga_v2',    description: 'Aplica Sangrado. Si el objetivo tenía Hemorragia activa antes del ataque, Ragnar y un aliado aleatorio generan 5 cargas.' },
                    { name: 'Rey Pagano',         type: 'special', cost: 5,  chargeGain: 0, damage: 4,  target: 'aoe',    effect: 'rey_pagano_v2',      description: 'AOE 4 daño + Sangrado. Si el enemigo tenía Sangrado activo antes del ataque, aplica Miedo.' },
                    { name: 'Tormenta del Norte', type: 'special', cost: 6,  chargeGain: 0, damage: 1,  target: 'mt',     effect: 'tormenta_norte_v3',  description: '10 golpes MT + Sangrado. Por cada Sangrado que se convierta en Hemorragia: equipo aliado +3 HP de escudo.' },
                    { name: 'Águila de Sangre',   type: 'over',    cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'aguila_sangre_v2',   description: 'ST 10 daño. Si objetivo tiene menos del 50% HP, lo elimina. Si muere por este ataque, un aliado aleatorio gana 10 cargas.' }
                ]
            },
            'Saitama': {
                hp: 20, maxHp: 20, speed: 97, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                saitamaBasicChargeBonus: 0,
                portrait: 'https://i.postimg.cc/Qtz0QrqV/Captura_de_pantalla_2026_02_26_132109.png',
                passive: { name: 'Espíritu del Héroe', description: 'Inmunidad a debuffs. Cada vez que se realiza un ataque básico, el ataque básico aumentará en +2 las cargas generadas en su próximo uso.' },
                abilities: [
                    { name: 'Golpe Normal', type: 'basic', cost: 0, chargeGain: 1, damage: 4, target: 'single', effect: 'golpe_normal_saitama', description: 'Causa 4 daño. Aplica Buff Furia 2 turnos.' },
                    { name: 'Golpes Normales Consecutivos', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'single', effect: 'golpes_consecutivos_saitama', description: 'Causa 3 daño + 3 adicional por cada Buff activo en el objetivo.' },
                    { name: 'Golpe Serio', type: 'special', cost: 8, chargeGain: 0, damage: 6, target: 'single', effect: 'golpe_serio_saitama', description: 'Causa 6 daño. Daño triple si el objetivo tiene Provocación o Mega Provocación.' },
                    { name: 'Golpe Grave', type: 'over', cost: 20, chargeGain: 0, damage: 0, target: 'single', effect: 'golpe_grave', description: 'Elimina al enemigo golpeado.' }
                ]
            },

            'Ozymandias': {
                hp: 20, maxHp: 20, speed: 88, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/6qw6XwKQ/Captura_de_pantalla_2026_03_15_002404.png',
                passive: { name: 'Privilegio Imperial', description: 'Cada vez que un debuff Quemadura Solar es aplicado sobre un enemigo, Ozymandias genera 1 carga. Si Ozymandias es atacado por un enemigo con Quemadura Solar, reduce 50% el daño recibido.' },
                abilities: [
                    { name: 'Animación', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'animacion_ozymandias', description: 'Causa 2 daño. Aplica Quemadura Solar al objetivo. Si el objetivo ya tenía QS antes de este turno, 50% de Mega Aturdimiento.' },
                    { name: 'Noble Phantasm Abu el-Hol Sphinx', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_sphinx', description: 'Invoca a Abu el-Hol Sphinx.' },
                    { name: 'Sentencia del Sol', type: 'special', cost: 8, chargeGain: 0, damage: 2, target: 'aoe', effect: 'sentencia_del_sol', description: 'Causa 2 AOE + 2 daño adicional por cada enemigo con Quemadura Solar activa.' },
                    { name: 'Noble Phantasm Ramesseum Tentyris', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_ramesseum', description: 'Invoca a Ramesseum Tentyris.' }
                ]
            },
            'Gilgamesh': {
                hp: 20, maxHp: 20, speed: 89, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/nzNJp8K7/Captura_de_pantalla_2026_02_27_201309.png',
                passive: { name: 'Regla de Oro', description: 'Aumenta 25% la probabilidad de golpe critico de todos sus ataques. Cada vez que acierta un golpe critico en un enemigo tiene 50% de probabilidad de genera 1 cargas.' },
                abilities: [
                    { name: 'Gate of Babylon', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'aoe', effect: 'crit_chance_basic', critChance: 0.15, description: 'Causa 1 AOE. 15% de probabilidad de golpe crítico.' },
                    { name: 'Espada Merodach', type: 'special', cost: 5, chargeGain: 0, damage: 3, target: 'aoe', effect: 'espada_merodach', description: 'Causa 3 AOE. Elimina 3 cargas del enemigo golpeado por un golpe crítico.' },
                    { name: 'Enkidu: Cadenas del Cielo', type: 'special', cost: 7, chargeGain: 0, damage: 0, target: 'aoe', effect: 'enkidu_cadenas', description: 'Cancela todas las invocaciones activas del enemigo. Aplica debuff Mega Aturdimiento en todos los enemigos que actualmente tengan más de 5 cargas.' },
                    { name: 'Enuma Elish', type: 'over', cost: 10, chargeGain: 0, damage: 5, target: 'single', effect: 'gilgamesh_enuma', description: 'Causa 5 de daño. Roba todas las cargas del Enemigo golpeado.' }
                ]
            },

            'Goku Black': {
                hp: 20, maxHp: 20, speed: 95, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/T13zZdKD/Captura_de_pantalla_2026_03_11_145542.png',
                passive: { name: 'Cuerpo Divino', description: 'Efecto pasivo Aura Oscura. Cada vez que Goku Black recibe daño genera 2 puntos de carga.' },
                abilities: [
                    { name: 'Espada de Ki', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'espada_ki', description: 'Causa 2 daño. 50% de probabilidad de robar 1 carga del objetivo.' },
                    { name: 'Kamehame Ha Oscuro', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'single', effect: 'kamehame_oscuro', description: 'Causa 2 daño. 50% de crítico. 50% de Aturdimiento.' },
                    { name: 'Lazo Divino', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'single', effect: 'lazo_divino', description: 'Causa 3 daño. Invoca 3 Fake Black.' },
                    { name: 'Guadaña Divina', type: 'over', cost: 12, chargeGain: 0, damage: 7, target: 'aoe', effect: 'guadania_divina', description: 'Causa 7 AOE. Elimina todos los puntos de carga de los enemigos. Si algún objetivo no tenía cargas, 100% de crítico en ese objetivo.' }
                ]
            },
            'Saga de Geminis': {
                hp: 20, maxHp: 20, speed: 91, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/wBvTDG7f/Captura_de_pantalla_2026_02_24_103109.png',
                passive: { name: 'Maboroshi no Shinkiro', description: 'Cada vez que se aplica un debuff Posesion o Mega Posesion sobre un enemigo, genera 3 cargas.' },
                abilities: [
                    { name: 'Shingun Ken', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'speed_up_self', description: 'Causa 1 de daño. Aumenta 1 punto la Velocidad de Saga de Géminis. 50% de probabilidad de aplicar Posesión sobre el enemigo golpeado.' },
                    { name: 'Genrō Maō Ken', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'genro_maoken', description: 'Causa 3 AOE. 50% de aplicar debuff Posesión sobre el enemigo golpeado.' },
                    { name: 'Kōsoku Ken', type: 'special', cost: 7, chargeGain: 0, damage: 1, target: 'single', effect: 'speed_bonus_damage', description: 'Causa 1 de daño +1 adicional por cada punto de diferencia de velocidad superior sobre el enemigo. Aplica Mega Posesión sobre el enemigo golpeado.' },
                    { name: 'Explosión de Galaxias', type: 'over', cost: 15, chargeGain: 0, damage: 10, target: 'aoe', effect: 'explosion_galaxias', critChance: 0.30, description: 'Causa 10 AOE. 30% probabilidad de crítico.' }
                ]
            },

            'Minato Namikaze': {
                hp: 20, maxHp: 20, speed: 89, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/qvNv9NQN/Captura_de_pantalla_2026_03_11_215715.png',
                passive: { name: 'Hiraishin no Jutsu', description: 'Esquiva area (no es afectado por ataques AOE del enemigo). Minato genera +1 cargas adicionales por cada enemigo golpeado que tenga menos velocidad que Minato.' },
                abilities: [
                    { name: 'Kiiroi Senkō', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'kiiroi_senko', description: 'Causa 1 de daño. Se aplica Buff Celeridad 10% por 2 turnos. Se aplica un Buff aleatorio por 2 turnos.' },
                    { name: 'Destello de la Danza Aullante', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'aoe', effect: 'destello_danza', description: 'Causa 2 AOE. Si el enemigo golpeado tiene menos velocidad que Minato, aplica un debuff aleatorio (Aturdimiento, Congelación, Posesión, Quemadura Solar, Sangrado, Miedo, Confusión, Debilitar, Silenciar, Agotamiento) por 1 turno.' },
                    { name: 'Rasen Senkō Chō Rinbu Kō Sanshiki', type: 'special', cost: 6, chargeGain: 0, damage: 4, target: 'aoe', effect: 'rasen_senko_v2', description: 'Causa 4 AOE. 50% de probabilidad de robar 2 cargas del enemigo golpeado.' },
                    { name: 'Legado del Cuarto Hokage', type: 'over', cost: 9, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'legado_hokage_v2', description: 'Genera 5 cargas para el resto de tu equipo (excepto Minato Namikaze).' }
                ]
            },

            'Muzan Kibutsuji': {
                hp: 20, maxHp: 20, speed: 86, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                muzanTransformed: false,
                portrait: 'https://i.ibb.co/v4B63sHw/he-s-so-handsome.jpg',
                transformPortrait: 'https://i.ibb.co/2754TPmc/Insta-Pet-Ai-FULL-VIEW-ZOOM-IN-OUT-Kurozai-new-character-instapetai-Calling.jpg',
                passive: { name: 'Progenitor Demoniaco', description: 'Fin de ronda: equipo aliado se cura HP = daño total por Veneno esa ronda. Cada stack de Veneno aplicado a enemigo = +1 carga para Muzan. Transformado: al recibir golpe aplica 5 stacks Veneno al atacante y se cura 5 HP.' },
                abilities: [
                    { name: 'Espinas de Sangre',             type: 'basic',   cost: 0,  chargeGain: 0, damage: 1, target: 'mt',   effect: 'muzan_espinas',   description: 'MT 3 golpes, 1 stack Veneno. Transformado: 5 golpes, 3 stacks Veneno.' },
                    { name: 'Sangre Demoniaca',               type: 'special', cost: 5,  chargeGain: 0, damage: 3, target: 'aoe',  effect: 'muzan_sangre',    description: 'AOE 3 daño + 1 stack Veneno. Transformado: +3 cargas al equipo aliado por cada stack aplicado.' },
                    { name: 'Sombras de la Noche',            type: 'special', cost: 8,  chargeGain: 0, damage: 2, target: 'mt',   effect: 'muzan_sombras',   description: 'MT 5 golpes, 3 stacks Veneno. Transformado: aplica Posesión a objetivos golpeados.' },
                    { name: 'Rey de los Demonios Definitivo', type: 'over',    cost: 15, chargeGain: 0, damage: 0, target: 'self', effect: 'muzan_transform', description: 'Transformación permanente única. +10 HP max, +10 VEL. Inicio de ronda: -2 cargas al equipo enemigo.' }
                ]
            },
            'Nakime': {
                hp: 15, maxHp: 15, speed: 80, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/858xm4nX/Captura_de_pantalla_2026_02_28_020047.png',
                passive: { name: 'Castillo Infinito', description: 'Inmune a daño Single Target. Al inicio de cada ronda, el primer ataque enemigo impacta sobre un personaje del equipo enemigo.' },
                abilities: [
                    { name: 'Nota del Biwa', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'single', effect: 'apply_confusion', description: 'Se aplica Debuff Confusión al objetivo.' },
                    { name: 'Cambio de Sangre', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'single', effect: 'cambio_sangre', description: 'Selecciona un enemigo e intercambia los HP con un aliado.' },
                    { name: 'Cambio Demoniaco', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'single', effect: 'cambio_demoniaco', description: 'Selecciona un enemigo e intercambia los puntos de carga con un aliado.' },
                    { name: 'Colapso', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'self', effect: 'cambio_vida_v2', description: 'Elimina el 50% de los puntos de carga actuales del equipo enemigo. Genera un 50% de puntos de carga actuales del equipo aliado.' }
                ]
            },

            'Sauron': {
                hp: 25, maxHp: 25, speed: 78, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/858xm4n0/Captura_de_pantalla_2026_02_28_020119.png',
                passive: { name: 'El Ojo que Todo lo Ve', description: 'Sauron puede atacar ignorando buff provocacion, megaprovocacion y Sigilo. Cada vez que Sauron recibe un golpe del enemigo tiene 50% de probabilidad de aplicar debuff Silencio sobre el enemigo atacante.' },
                abilities: [
                    { name: 'Voluntad de Mordor', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'sauron_basic', description: 'Causa 2 de daño. Si Sauron ataca a un enemigo que ya tenía debuff Silencio genera +2 cargas adicionales.' },
                    { name: 'Mano Negra', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'aoe', effect: 'mano_negra', description: 'Causa 2 AOE. Si los objetivos golpeados tienen Buff Provocación, Megaprovocación o Sigilo, este ataque es golpe crítico.' },
                    { name: 'Señor Oscuro', type: 'special', cost: 7, chargeGain: 0, damage: 5, target: 'single', effect: 'senyor_oscuro', description: 'Causa 5 de daño. Si el objetivo tiene activo Buff Provocación o Megaprovocación, Limpiar el Buff y este ataque es golpe crítico.' },
                    { name: 'Poder del Anillo', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'apply_megaprovocation_buff', duration: 4, regenDuration: 4, regenPercent: 20, description: 'Se aplica Buff Megaprovocación por 4 turnos. Se aplica Buff Regeneración de 20% por 4 turnos.' }
                ]
            },

            'Darth Vader': {
                hp: 25, maxHp: 25, speed: 80, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                hpLost: 0,
                portrait: 'https://i.postimg.cc/63sFfc1F/Captura_de_pantalla_2026_02_28_015421.png',
                passive: { name: 'Presencia Oscura', description: 'Darth Vader tiene Buff Aura Oscura permanente. Genera 1 carga cada vez que un enemigo recupera HP.' },
                abilities: [
                    { name: 'Corte Oscuro', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'djem_so', fearChance: 0.50, description: 'Causa 2 daño. 50% de probabilidad de aplicar Debuff Miedo al objetivo.' },
                    { name: 'Explosión de la Fuerza', type: 'special', cost: 5, chargeGain: 0, damage: 2, target: 'aoe', effect: 'explosion_fuerza_dv', description: 'Causa 2 AOE. 50% de probabilidad de aplicar Aturdimiento. 50% de probabilidad de aplicar Debilitar.' },
                    { name: 'Intimidación Sith', type: 'special', cost: 7, chargeGain: 0, damage: 4, target: 'single', effect: 'intimidacion_sith', description: 'Causa 4 daño + 3 daño adicional por cada buff activo en el objetivo.' },
                    { name: 'Ira del Elegido Caído', type: 'over', cost: 10, chargeGain: 0, damage: 2, target: 'aoe', effect: 'ira_elegido', description: 'Causa 2 AOE + 1 daño adicional por cada HP que Darth Vader ha perdido en el combate.' }
                ]
            },

            'Lich King': {
                hp: 30, maxHp: 30, speed: 82, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/W3Rxw8ff/Captura_de_pantalla_2026_02_28_015847.png',
                passive: { name: 'Aura de Hielo', description: 'Efecto pasivo de Aura Gelida. Lich King es inmune a debuffs de Miedo, Posesion y Congelacion.' },
                abilities: [
                    { name: 'Agonía de Escarcha', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'agonia_escarcha', description: 'Causa 1 de daño. Roba 1 HP del objetivo.' },
                    { name: 'Cadenas de Hielo', type: 'special', cost: 2, chargeGain: 0, damage: 0, target: 'self', effect: 'cadenas_hielo', description: 'Aplica Buff Provocación en Lich King. Cada vez que Lich King recibe daño con Buff Provocación activo, genera 1 carga.' },
                    { name: 'Segador de Almas', type: 'special', cost: 8, chargeGain: 0, damage: 5, target: 'single', effect: 'segador_almas', description: 'Causa 5 de daño. Si el enemigo muere con este ataque, es revivido como aliado con un 50% de vida y 0 puntos de carga.' },
                    { name: 'El Rey Caído', type: 'over', cost: 9, chargeGain: 0, damage: 0, target: 'self', effect: 'el_rey_caido', description: 'INVOCACIÓN: Esta habilidad realiza 3 invocaciones aleatorias.' }
                ]
            },

            'Padme Amidala': {
                hp: 20, maxHp: 20, speed: 78, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/pV63g1B4/Whats_App_Image_2026_03_05_at_9_39_15_AM.jpg',
                passive: { name: 'Negociaciones Hostiles', description: 'Cada vez que un aliado recibe un Debuff, Padme genera 1 carga.' },
                abilities: [
                    { name: 'Orden de Fuego', type: 'basic', cost: 0, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'orden_de_fuego', description: 'Genera 1 punto de Carga a los 4 aliados del equipo.' },
                    { name: 'Solución Diplomática', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'dispel_target_padme_charges', description: 'Disipar los debuffs en el objetivo. Padme genera 2 puntos de Carga por cada debuff eliminado.' },
                    { name: 'Señuelo', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_señuelo', description: 'INVOCACIÓN: Invoca un Señuelo. Padme aplica Buff Sigilo por 2 turnos.' },
                    { name: 'Reina de Naboo', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'reina_de_naboo', description: 'Aplica Buff Escudo de 6 HP a los 4 aliados del equipo. Genera 4 puntos de Carga a todos los aliados (excepto Padme Amidala).' }
                ]
            },

            'Daenerys Targaryen': {
                hp: 15, maxHp: 15, speed: 77, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/8k0xqnbx/Whats_App_Image_2026_03_05_at_9_41_48_AM.jpg',
                passive: { name: 'Dinastía del Dragón', description: 'Inmune a Debuffs Quemadura y Quemadura Solar. Aplica curación en Daenerys de 1 HP cada vez que un debuff Quemadura expire, sea Limpiado o Disipado.' },
                abilities: [
                    { name: 'Madre de Dragones', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'self', effect: 'summon_dragon', description: 'INVOCACIÓN: Invoca un Dragón aleatorio.' },
                    { name: 'Vuelo del Dragón', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'escudo_sagrado_self', duration: 2, description: 'Gana Buff Escudo Sagrado por 2 turnos.' },
                    { name: 'Locura Targaryen', type: 'special', cost: 8, chargeGain: 0, damage: 6, target: 'aoe', effect: 'locura_targaryen', description: 'Causa 6 AOE. Genera 1 punto de carga a todo el equipo aliado por cada debuff Quemadura activo en los enemigos.' },
                    { name: 'Dracarys', type: 'over', cost: 14, chargeGain: 0, damage: 8, target: 'aoe', effect: 'dracarys', burnAmount: 2, description: 'INVOCACIÓN: Causa 8 AOE. Aplica Debuff Quemadura de 2 HP. Invoca a los 3 dragones.' }
                ]
            },

            'Tamayo': {
                hp: 20, maxHp: 20, speed: 81, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/9XnsvNBS/Whats_App_Image_2026_03_05_at_9_42_52_AM.jpg',
                passive: { name: 'Curandera de las Sombras', description: 'Al finalizar cada Ronda, Limpiar debuff de un aliado de manera aleatoria. Aplica buff Escudo de 3 HP a un aliado aleatorio.' },
                abilities: [
                    { name: 'Aguja Medicinal', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'ally_single', effect: 'heal_cleanse', heal: 1, description: 'Cura 1 HP al objetivo aliado. Limpia 1 debuff del objetivo.' },
                    { name: 'Aroma Curativo', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'aoe_cleanse_allies', description: 'Limpia 1 debuff de todos los aliados.' },
                    { name: 'Medicina Demoniaca', type: 'special', cost: 8, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'dispel_heal_allies', description: 'Disipar todos los debuffs del equipo aliado. Por cada Debuff eliminado, cura 1 HP a todo el equipo aliado.' },
                    { name: 'Hechizo de Sangre', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'hechizo_sangre', description: 'Aplica Buff Regeneración del 20% por 3 turnos al equipo aliado. Aplica debuff Confusión a 2 enemigos aleatorios.' }
                ]
            },

            'Emperador Palpatine': {
                hp: 20, maxHp: 20, speed: 88, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/DfMRtYcj/Whats_App_Image_2026_03_05_at_9_50_54_AM.jpg',
                passive: { name: 'Emperador de la Galaxia', description: '50% de aplicar Aturdimiento cada vez que un Debuff del equipo enemigo se limpia o termina su efecto.' },
                abilities: [
                    { name: 'Relámpago Sith', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'single', effect: 'cleanse_enemy_debuff', description: 'Causa 1 de daño. Limpia un debuff del objetivo enemigo.' },
                    { name: 'Corrupción', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'single', effect: 'apply_possession', possessionDuration: 1, description: 'Aplica debuff Posesión por 1 turno.' },
                    { name: 'Orden Sith', type: 'special', cost: 7, chargeGain: 0, damage: 1, target: 'aoe', effect: 'orden_sith', description: 'Causa 1 AOE. Limpia 3 Debuffs del equipo enemigo y cura a Palpatine y a un aliado 3 HP.' },
                    { name: 'Poder Ilimitado', type: 'over', cost: 12, chargeGain: 0, damage: 4, target: 'aoe', effect: 'poder_ilimitado', description: 'Causa 4 AOE. 50% de probabilidad de aplicar Mega Aturdimiento.' }
                ]
            },

            'Gandalf': {
                hp: 20, maxHp: 20, speed: 74, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/1RjbLYHx/Whats_App_Image_2026_03_05_at_9_53_24_AM.jpg',
                passive: { name: 'Istari', description: 'Inmune a Posesión, Confusión y Miedo. Cada vez que un Buff Escudo en un aliado se rompe, el portador genera 3 cargas y cura 3 HP.' },
                abilities: [
                    { name: 'Resplandor', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'ally_team', effect: 'resplandor', description: 'Aplica Buff Escudo de 2 HP a todo el equipo aliado.' },
                    { name: 'Rayo de Luz', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'rayo_de_luz', heal: 5, shieldAmount: 5, description: 'El objetivo aliado recupera 5 HP. Aplica Buff Escudo de 5 HP y Buff Provocación.' },
                    { name: 'El Mago Blanco', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'el_mago_blanco', description: 'Aplica Buff Aura de Luz. Cura 2 HP al equipo aliado (5 HP si está por debajo del 50% de HP).' },
                    { name: 'No Puedes Pasar', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'no_puedes_pasar', description: 'Aplica Buff Escudo de 8 HP y Regeneración 30% por 3 turnos a todo el equipo aliado.' }
                ]
            },

            'Doomsday': {
                hp: 30, maxHp: 30, speed: 84, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/LdtjKDm8/Captura-de-pantalla-2026-03-21-235142.png',
                passive: { name: 'Adaptación Reactiva', description: 'Cada vez que recibe un golpe, recupera 2 HP. Cada vez que Doomsday recupera HP, elimina 1 carga de un enemigo aleatorio.' },
                abilities: [
                    { name: 'Rugido del Devastador', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'rugido_devastador', description: 'Se aplica Buff Provocación. Se aplica Buff Cuerpo Perfecto.' },
                    { name: 'Smashing Strike', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'multi', effect: 'smashing_strike', description: 'Ataca 2 veces a enemigos aleatorios. Cada golpe tiene 50% de Aturdimiento.' },
                    { name: 'Skill Drain', type: 'special', cost: 7, chargeGain: 0, damage: 3, target: 'aoe', effect: 'skill_drain', description: 'Causa 3 AOE. 50% de robar 1-3 HP por enemigo golpeado.' },
                    { name: 'Devastator Punish', type: 'over', cost: 10, chargeGain: 0, damage: 5, target: 'single', effect: 'devastator_punish', description: 'Causa 5 daño + 1 adicional por cada punto de HP de diferencia positiva sobre el objetivo.' }
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
                    { name: 'Garras del Fénix', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'garras_fenix', burnAmount: 2, description: 'Causa 1 de daño. Aplica debuff Quemadura de 2 HP.' },
                    { name: 'Phoenix Genma Ken', type: 'basic', cost: 0, chargeGain: 0, damage: 1, target: 'aoe', effect: 'phoenix_genma_ken', description: 'Causa 1 AOE. Si el enemigo golpeado tiene debuff Quemaduras, genera 2 cargas.' },
                    { name: 'Hō Yoku Ten Shō', type: 'special', cost: 5, chargeGain: 0, damage: 4, target: 'aoe', effect: 'ho_yoku_ten_sho', burnAmount: 2, description: 'Causa 4 AOE. Aplica debuff Quemadura de 2 HP.' },
                    { name: 'Armadura Divina del Fénix', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'armadura_fenix', description: 'TRANSFORMACIÓN: Ikki de Fénix es equipado con su Armadura Divina del Fénix. Mientras esté equipado, aplica Buff Regeneración 20% y causa daño triple en enemigos con debuff Quemaduras.' }
                ]
            },
            'Linterna Verde': {
                hp: 20, maxHp: 20, speed: 96, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/bRMTVQVr/Captura-de-pantalla-2026-03-18-131918.png',
                passive: { name: 'Visión Esmeralda', description: 'Cada vez que un personaje del equipo aliado recibe daño directo, realiza una curación de 3 HP a todos los personajes del equipo aliado. Al inicio de cada ronda aplica 1 buff aleatorio (Esquivar, Esquiva Área, Armadura, Regeneración 20%, Sigilo, Escudo Sagrado, Protección Sagrada, Reflejar) por 2 turnos a todo el equipo aliado.' },
                abilities: [
                    { name: 'Energy Fists', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'energy_fists_lv', description: 'Aumenta en +1 el daño de este ataque por cada Buff activo en Linterna Verde. Aumenta en +1 las cargas generadas por este ataque por cada Buff activo en Linterna Verde.' },
                    { name: 'Sincronía Esmeralda', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'sincronia_esmeralda', description: 'Suma todos los Buffs activos en el equipo aliado y después por cada buff reparte 1 carga a un personaje aleatorio del equipo aliado.' },
                    { name: 'Soporte Vital Autónomo', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'soporte_vital', description: 'Selecciona un Aliado y ambos (Linterna Verde y el Aliado seleccionado) recuperan 5 HP y disipan todos los debuffs en ambos.' },
                    { name: 'La Lanza de Oa', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'lanza_de_oa', description: 'Causa 10 daño ST. Bloquea los movimientos ST y AOE del objetivo durante 2 turnos.' }
                ]
            },
            'Vegeta': {
                hp: 20, maxHp: 20, speed: 96, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/DfBgpQLQ/Captura-de-pantalla-2026-03-19-113940.png',
                passive: { name: 'Príncipe de los Sayajins', description: 'Todos sus ataques tienen 20% de probabilidad de causar daño triple. Los debuffs tienen 50% menos precisión contra Vegeta.' },
                abilities: [
                    { name: 'Galick Gun', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'galick_gun', description: 'Causa 2 daño. Aplica Buff Frenesí 1 turno.' },
                    { name: 'Big Bang Attack', type: 'special', cost: 2, chargeGain: 0, damage: 3, target: 'single', effect: 'big_bang_attack', description: 'Causa 3 daño. Genera +2 cargas adicionales por cada Buff y Debuff activo en el objetivo.' },
                    { name: 'Ráfagas de Ki', type: 'special', cost: 5, chargeGain: 0, damage: 2, target: 'aoe', effect: 'rafagas_ki', description: 'Causa 2 AOE. 50% de probabilidad de causar 0-2 daño adicional. El daño se considera daño directo, no golpe.' },
                    { name: 'Final Flash', type: 'over', cost: 12, chargeGain: 0, damage: 12, target: 'single', effect: 'final_flash', description: 'Causa 12 daño. Ignora Provocación, Mega Provocación y Sigilo. Si el objetivo es derrotado, genera 10 cargas.' }
                ]
            },
            'Giyu Tomioka': {
                hp: 30, maxHp: 30, speed: 83, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/0R3wCJSB/Whats-App-Image-2026-03-19-at-11-04-32-AM.jpg',
                passive: { name: 'Pilar del Agua', description: 'Buff Pasivo Armadura permanente. Al inicio de cada ronda aplica Buff Escudo de 1 HP al equipo aliado.' },
                abilities: [
                    { name: 'Corte de Agua', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'single', effect: 'corte_agua', shieldAmount: 2, description: 'Causa 1 daño. Aplica Buff Escudo de 2 HP en Giyu Tomioka.' },
                    { name: 'Onceava Postura: Calma', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'postura_calma', shieldAmount: 3, description: 'Aplica Buff Mega Provocación en Giyu Tomioka. Aplica Buff Escudo de 3 HP en Giyu Tomioka.' },
                    { name: 'Superficie Muerta', type: 'special', cost: 7, chargeGain: 0, damage: 0, target: 'aoe', effect: 'superficie_muerta', description: 'Causa 1-3 daño AOE. Aplica Buff Escudo a Giyu por la cantidad de daño causado.' },
                    { name: 'Marca del Cazador', type: 'over', cost: 16, chargeGain: 0, damage: 0, target: 'aoe', effect: 'marca_cazador', description: 'Causa 1 daño AOE por cada punto de Escudo que Giyu Tomioka tenga al ejecutar este ataque.' }
                ]
            },
            'Itachi Uchiha': {
                hp: 20, maxHp: 20, speed: 88, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/HDhTPLvR/91a611f2e00a9c83e9a8dd1607a2c50a.jpg',
                passive: { name: 'Izanami', description: 'La primera vez por ronda que Itachi fuera a recibir un golpe de 3+ daño, esquiva y roba hasta 2 cargas del atacante. Cada vez que un debuff (Posesion, Veneno, Quemaduras, Confusion) es aplicado sobre un aliado, limpia hasta 1 debuff activo del equipo aliado y genera 2 cargas por debuff limpiado.' },
                abilities: [
                    { name: 'Genjutsu', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'single', effect: 'genjutsu_itachi', description: '50% de Agotamiento. 50% de Posesión. Genera 1 carga por cada debuff aplicado.' },
                    { name: 'Tsukuyomi', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'single', effect: 'tsukuyomi_itachi', description: 'Disipa todos los debuffs de ambos equipos. Causa +1 daño adicional por cada debuff disipado.' },
                    { name: 'Amaterasu', type: 'special', cost: 7, chargeGain: 0, damage: 4, target: 'single', effect: 'amaterasu_itachi', description: 'Causa 4 daño. Aplica Quemadura 4HP. Si el objetivo es invocación, la elimina y aplica Quemadura 6HP AOE.' },
                    { name: 'Susanoo, Espada de Totsuka', type: 'over', cost: 9, chargeGain: 2, damage: 8, target: 'single', effect: 'susanoo_totsuka', description: 'Causa 8 daño. Roba todas las cargas del objetivo. Aplica Mega Aturdimiento. Aplica Debilitar.' }
                ]
            },
            'Garou': {
                hp: 20, maxHp: 20, speed: 95, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                garouKaijuMode: false, garouKaijuRoundsLeft: 0, garouKaijuBonusDmg: 0,
                portrait: 'https://i.ibb.co/1YPdwxPw/Captura-de-pantalla-2026-03-20-160048.png',
                transformPortrait: 'https://i.ibb.co/S4vdmL4s/Captura-de-pantalla-2026-03-20-172015.png',
                passive: { name: 'Cazador de Héroes', description: 'Mientras Garou tenga debuff Quemaduras, Veneno o Sangrado activo, todos sus movimientos causan daño doble. Cada vez que un enemigo genera cargas, Garou genera 1 carga. Cada vez que Garou recibe 2 o menos de daño, contraataca con Ryusui Gansai-ken sobre un enemigo aleatorio (ataque gratuito, no consume turno).' },
                abilities: [
                    { name: 'Ryusui Gansai-ken', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'ryusui_garou', description: '50% de causar daño triple sobre el objetivo. 50% de generar 3 cargas para un aliado aleatorio.' },
                    { name: 'Cross Fang Dragon Slayer Fist', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'single', effect: 'cross_fang_garou', description: 'Causa daño adicional equivalente a la cantidad de debuffs en el equipo enemigo.' },
                    { name: 'Gamma Ray Burst', type: 'special', cost: 5, chargeGain: 0, damage: 2, target: 'aoe', effect: 'gamma_ray_garou', description: 'Aplica debuff Debilitar a todos los enemigos. Causa daño doble a enemigos con debuff activo. +1 de daño base por cada debuff activo en el enemigo golpeado.' },
                    { name: 'Modo Kaiju', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'modo_kaiju_garou', description: 'Solo si Garou no está en Modo Kaiju. Dura 2 rondas. Garou recupera 100% HP. Todos sus ataques +2 daño base. Cada vez que recibe daño transformado, +1 daño base adicional permanente mientras dure.' }
                ]
            },
            'Tanjiro Kamado': {
                hp: 20, maxHp: 20, speed: 88, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/x8qLNcDN/Whats-App-Image-2026-03-20-at-3-35-02-PM.jpg',
                passive: { name: 'Olor de la Brecha', description: '20% probabilidad de crítico en todos sus ataques. Al asestar un crítico, genera 1 carga. Por cada 2 cargas consumidas, genera 1 carga al equipo aliado.' },
                abilities: [
                    { name: 'Vals', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'vals_tanjiro', description: 'Causa 1 daño. El equipo aliado genera 1 carga.' },
                    { name: 'Cascada de Agua', type: 'special', cost: 5, chargeGain: 0, damage: 2, target: 'aoe', effect: 'cascada_agua_tanjiro', description: '2 AOE. Genera 1 carga al equipo aliado por cada golpe crítico.' },
                    { name: 'Danza del Dios del Fuego', type: 'special', cost: 7, chargeGain: 0, damage: 0, target: 'single', effect: 'danza_fuego_tanjiro', description: 'Realiza 5 ataques básicos sobre enemigos aleatorios.' },
                    { name: 'Decimotercera Postura', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'single', effect: 'decimotercera_tanjiro', description: 'Realiza 13 ataques básicos aleatorios. 50% de probabilidad de eliminar 1 carga al objetivo por golpe.' }
                ]
            },
            'The Joker': {
                hp: 20, maxHp: 20, speed: 79, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/KYQp5vZ/Whats-App-Image-2026-07-08-at-5-28-44-PM.jpg',
                passive: { name: 'Anarquía', description: 'Al inicio de cada ronda: 50% Sigilo, 50% Esquivar, 50% Esquiva Área, 50% Intimidación (2T). Cuando un enemigo sufre daño por Quemadura o Veneno, aplica un debuff aleatorio por 1 turno.' },
                abilities: [
                    { name: 'Naipes Impregnados',      type: 'basic',   cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'joker_naipes',    description: 'ST 2 daño. Si Joker tiene buffs activos: Quemadura N HP y N stacks Veneno al objetivo (N = buffs activos).' },
                    { name: 'Granada de Humo Púrpura', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'aoe',    effect: 'joker_granada',   description: 'AOE 3 stacks Veneno. Si objetivo tenía ≥5 stacks, activa el daño instantáneamente.' },
                    { name: 'Detonador del Caos',      type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'aoe',    effect: 'joker_detonador', description: 'AOE Quemadura 3 HP. Si objetivo tenía Quemadura ≥5 HP, activa el daño instantáneamente.' },
                    { name: '¿Por qué tan serio?',     type: 'over',    cost: 8, chargeGain: 0, damage: 5, target: 'mt',     effect: 'joker_serio',    description: 'MT 5 daño. 50% Aura de Fuego, 50% Espinas, 50% Infectar. Por cada buff aplicado, +3 ataques básicos.' }
                ]
            },
            'Androide 17': {
                name: 'Androide 17',
                hp: 20, maxHp: 20, speed: 89, charges: 0,
                portrait: 'https://i.ibb.co/7Jv6kYdg/Android-17.jpg',
                passive: { name: 'Protección de la Naturaleza', description: 'Cuando un enemigo usa un Over: antes de su daño, aplica Escudo a cada aliado con HP = cargas gastadas por ese Over. Cuando Androide 17 recibe un debuff: lo elimina y genera 2 cargas para el equipo aliado.' },
                abilities: [
                    { name: 'Ráfagas de Energía',          type: 'basic',   cost: 0,  chargeGain: 1, damage: 1, target: 'single', effect: 'rafagas_energia_a17',     description: 'Golpea 1-5 veces a enemigos aleatorios (puede repetir). 50% de robar 1 carga del enemigo golpeado.' },
                    { name: 'Barrera de Fotones Dinámica', type: 'special', cost: 3,  chargeGain: 0, damage: 0, target: 'self',   effect: 'barrera_fotones_a17',    description: 'Elimina 1-5 debuffs del equipo aliado. Por cada debuff eliminado el equipo aliado genera 1 carga.' },
                    { name: 'Destello de Fotones',         type: 'special', cost: 8,  chargeGain: 0, damage: 4, target: 'single', effect: 'destello_fotones_a17',   description: 'Causa 4 daño ST. Elimina 1-10 Buffs del equipo enemigo. Por cada Buff eliminado multiplica el daño de este ataque.' },
                    { name: 'Barrera de Impacto Total',    type: 'over',    cost: 8,  chargeGain: 0, damage: 0, target: 'self',   effect: 'barrera_impacto_a17',    description: 'Aplica Escudo 10 HP a todo el equipo aliado (incluido Androide 17). Genera 5 cargas a todos los aliados excepto Androide 17.' },
                ]
            },
            'Batman': {
                hp: 25, maxHp: 25, speed: 84, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/xKm24r5T/Captura-de-pantalla-2026-03-20-235244.png',
                passive: { name: 'Caballero de la Noche', description: 'Batman es inmune a daño y efectos de movimientos especiales del enemigo. Cada vez que un enemigo usa un ataque especial, Batman genera 3 cargas.' },
                abilities: [
                    { name: 'Batarang Táctico', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'batarang_batman', description: 'Causa 2 daño. 50% de aturdir al enemigo. 50% de robar 2 cargas del enemigo.' },
                    { name: 'Bomba de Humo', type: 'special', cost: 3, chargeGain: 1, damage: 0, target: 'self', effect: 'bomba_humo_batman', description: 'Aplica Buff Esquiva Área a todos los aliados por 2 turnos. 50% de aplicar Sigilo a cada aliado.' },
                    { name: 'Análisis de Puntos Débiles', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'analisis_batman', description: 'Causa 3 AOE. Bloquea 1 movimiento de cada enemigo por 2 turnos.' },
                    { name: 'Planes de Contingencia', type: 'over', cost: 10, chargeGain: 0, damage: 5, target: 'single', effect: 'contingencia_batman', description: 'Causa 5 daño + 1 adicional por cada carga eliminada del objetivo. El objetivo no puede generar cargas por 3 turnos.' }
                ]
            },
            'Superman': {
                hp: 25, maxHp: 25, speed: 98, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                supermanPrimeMode: false,
                portrait: 'https://i.ibb.co/KxhjpvTZ/Captura-de-pantalla-2026-03-22-004655.png',
                transformPortrait: 'https://i.ibb.co/gbGRNhmq/Captura-de-pantalla-2026-03-22-011451.png',
                passive: { name: 'Hombre de Acero', description: 'Tiene Provocación y Cuerpo Perfecto permanentes. Reduce 50% el daño por golpe recibido.' },
                abilities: [
                    { name: 'Puño de la Justicia', type: 'basic', cost: 0, chargeGain: 1, damage: 3, target: 'single', effect: 'punio_justicia_superman', description: 'Causa 3 daño. Recupera 2 HP.' },
                    { name: 'Visión de Calor', type: 'special', cost: 6, chargeGain: 0, damage: 6, target: 'single', effect: 'vision_calor_superman', description: 'Causa 6 daño. Disipa todos los Buffs y Escudo del objetivo. Aplica Quemadura Solar 3 turnos.' },
                    { name: 'Aliento Gélido', type: 'special', cost: 8, chargeGain: 0, damage: 3, target: 'aoe', effect: 'aliento_gelido_superman', description: 'Causa 3 AOE. 50% de Congelación por enemigo. 50% de Debilitar por enemigo. Elimina las invocaciones golpeadas.' },
                    { name: 'Forma Prime', type: 'over', cost: 20, chargeGain: 0, damage: 0, target: 'self', effect: 'forma_prime_superman', description: 'Incrementa HP Max a 30 y recupera el 100% de HP. Todos los ataques causan daño doble. Inmunidad a debuffs.' }
                ]
            },
            'Kratos': {
                hp: 25, maxHp: 25, speed: 88, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/LdtjKDm8/Captura-de-pantalla-2026-03-21-235142.png',
                passive: { name: 'Dios de la Guerra', description: 'Cada vez que un debuff es aplicado sobre Kratos, 50% de probabilidad de limpiarlo y aplicar 2 buffs aleatorios. Cada vez que golpea a un enemigo con Sangrado, genera 2 cargas.' },
                abilities: [
                    { name: 'Ciclón del Caos', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'aoe', effect: 'ciclon_caos_kratos', description: 'Causa 1 AOE. 50% de Sangrado por enemigo. 20% de daño triple.' },
                    { name: 'Ira del Tártaro', type: 'special', cost: 3, chargeGain: 0, damage: 3, target: 'single', effect: 'ira_tartaro_kratos', description: 'Causa 3 daño + Sangrado. Si el objetivo ya tenía Sangrado, aplica Mega Aturdimiento.' },
                    { name: 'Tempestad de Jord', type: 'special', cost: 6, chargeGain: 0, damage: 2, target: 'single', effect: 'tempestad_jord_kratos', description: 'Causa 2 daño. Si el objetivo tiene Sangrado, daño triple. 50% de golpe crítico.' },
                    { name: 'Ira de Kratos', type: 'over', cost: 12, chargeGain: 0, damage: 7, target: 'aoe', effect: 'ira_kratos', description: 'Causa 7 AOE. 10% de probabilidad de eliminar al enemigo golpeado.' }
                ]
            },
            'Shaka de Virgo': {
                hp: 30, maxHp: 30, speed: 90, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/5XNLm2Jd/Captura-de-pantalla-2026-03-22-174706.png',
                passive: { name: 'Tesoro del Cielo', description: 'Cada vez que Shaka de Virgo recibe daño, todos los aliados recuperan 1 HP. Cada vez que Shaka de Virgo recupera HP, aplica un debuff aleatorio en un enemigo aleatorio.' },
                abilities: [
                    { name: 'Kān', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'kan_shaka', description: 'Se aplica Buff Provocación por 2 turnos. Se aplica Buff Regeneración 10% por 2 turnos.' },
                    { name: 'Octavo Sentido', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'ally_aoe', effect: 'octavo_sentido_shaka', description: 'El equipo aliado genera 1 carga por cada debuff activo en ambos equipos.' },
                    { name: 'Ohm', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'ohm_shaka', description: 'El equipo aliado recupera 2 HP por cada debuff activo en ambos equipos.' },
                    { name: 'Tenmaku Hōrin', type: 'over', cost: 10, chargeGain: 0, damage: 8, target: 'single', effect: 'tenmaku_horin_shaka', description: 'Causa 8 de daño. Aplica 3 debuffs aleatorios al objetivo.' }
                ]
            },
            'Varian Wrynn': {
                hp: 25, maxHp: 25, speed: 86, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                varianTransformed: false, varianConsecutiveBasic: 0, varianBasicDmgBonus: 0, varianBasicChargeBonus: 0,
                portrait: 'https://i.ibb.co/n8KBNCZw/Whats-App-Image-2026-03-23-at-1-55-56-PM.jpg',
                transformPortrait: 'https://i.ibb.co/V0JBR339/Whats-App-Image-2026-03-23-at-1-56-15-PM.jpg',
                passive: { name: 'Lo\'gosh', description: 'Varian Wrynn tiene 50% de probabilidad de crítico en todas sus habilidades. Al caer por debajo del 30% de HP, aplica Buff Regeneración 10% por 3 turnos al equipo aliado.' },
                abilities: [
                    { name: 'Filotormenta', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'aoe', effect: 'filotormenta_varian', description: 'Causa 1 AOE. Cada vez que se usa consecutivamente, causa +1 daño adicional y genera +1 carga.' },
                    { name: 'Grito de Guerra', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'ally_aoe', effect: 'grito_guerra_varian', description: 'Genera 1 carga al equipo aliado por cada enemigo con debuff Sangrado activo.' },
                    { name: 'Por la Alianza', type: 'special', cost: 7, chargeGain: 0, damage: 4, target: 'single', effect: 'alianza_varian', description: 'Causa 4 daño. Si el objetivo tiene Sangrado, 50% de aplicar Miedo al equipo enemigo.' },
                    { name: 'Alto Rey de la Alianza', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'alto_rey_varian', description: 'TRANSFORMACIÓN: Todos los ataques causan daño doble. Incrementa velocidad +10 al equipo aliado. Filotormenta gana +1 daño adicional y +1 carga.' }
                ]
            },
            'Ivar the Boneless': {
                hp: 15, maxHp: 15, speed: 85, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/sv9w4j9r/Ragnar-Viking-in-2022-Vikings-ragnar-Bjorn-vikings-Vikings.jpg',
                passive: { name: 'Mente Brillante', description: 'Efecto pasivo Esquiva Área. Inmune a debuffs Miedo, Confusión y Posesión. Al inicio de cada Ronda aplica 1 buff aleatorio a cada aliado del equipo. Al inicio de cada Ronda, 50% de probabilidad de aplicar 1 buff aleatorio adicional a cada aliado.' },
                abilities: [
                    { name: 'Subestimación', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'subestimacion_ivar', description: 'Ignora Provocación, Mega Provocación y Sigilo. Si el objetivo tiene Sangrado, daño triple.' },
                    { name: 'Estrategia Despiadada', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'aoe', effect: 'estrategia_ivar', description: '50% de eliminar 2 cargas al equipo enemigo. 50% de reducir 10% velocidad al equipo enemigo. 50% de generar 2 cargas al equipo aliado. 50% de aumentar 10% velocidad al equipo aliado.' },
                    { name: 'Ragnarson', type: 'special', cost: 8, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'ragnarson_ivar', description: 'Otorga 1 carga al objetivo aliado por cada buff y debuff activo en ambos equipos.' },
                    { name: 'Furia de la Serpiente', type: 'over', cost: 12, chargeGain: 0, damage: 5, target: 'aoe', effect: 'furia_serpiente_ivar', description: 'Causa 5 AOE. Aplica 1 buff aleatorio a cada aliado por cada debuff activo en el equipo enemigo. 50% de Megaposesión a cada enemigo.' }
                ]
            },
            'Lagertha': {
                hp: 25, maxHp: 25, speed: 80, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/XxCCTzsj/Whats-App-Image-2026-07-08-at-4-46-04-PM.jpg',
                passive: { name: 'Doncella Escudera', description: 'Cada vez que un enemigo con Sangrado recibe un golpe, el equipo aliado gana 2 HP de escudo. Lagertha es inmune a Veneno y Quemaduras. Cada vez que Lagertha pierde HP de escudo, recupera 2 HP.' },
                abilities: [
                    { name: 'Hacha y Escudo',  type: 'basic',   cost: 0,  chargeGain: 2, damage: 1, target: 'single', effect: 'hacha_escudo_lagertha_v2', description: 'ST 1 daño + Provocación a Lagertha. 50% de probabilidad de aplicar Reflejar.' },
                    { name: 'Muro de Escudo',  type: 'special', cost: 4,  chargeGain: 0, damage: 0, target: 'self',   effect: 'muro_escudo_lagertha_v2',  description: 'Escudo 5 HP + Protección Sagrada 2T al equipo aliado.' },
                    { name: 'Furia de Freya',  type: 'special', cost: 7,  chargeGain: 0, damage: 2, target: 'mt',     effect: 'furia_freya_v2',            description: '5 golpes MT. Por cada debuff activo en el enemigo golpeado, aplica 1 buff aleatorio a un aliado aleatorio.' },
                    { name: 'Valquiria',       type: 'over',    cost: 12, chargeGain: 0, damage: 0, target: 'single', effect: 'valquiria_lagertha_v2',    description: 'Todo el equipo aliado usa su básico sobre el objetivo. Aplica Contraataque al equipo aliado por 3 turnos.' }
                ]
            },
            'Shinobu Kocho': {
                hp: 15, maxHp: 15, speed: 82, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/NgbypqWC/Whats-App-Image-2026-03-23-at-1-48-34-PM.jpg',
                passive: { name: 'Pilar del Insecto', description: 'Al morir aplica Veneno 10T al equipo enemigo. Debuffs Veneno activos en enemigos causan daño doble. Cada vez que Shinobu recibe daño por Veneno, genera 1 carga al equipo aliado.' },
                abilities: [
                    { name: 'Danza de la Mariposa', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'self', effect: 'danza_mariposa_shinobu', description: 'Shinobu se aplica Veneno 2T y Buff Concentración 2T.' },
                    { name: 'Aguijón de Abeja', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'ally_aoe', effect: 'aguijon_abeja_shinobu', description: 'Cura 2 HP al equipo aliado. Cura 2 HP adicionales a cada aliado si el objetivo enemigo tiene Veneno activo.' },
                    { name: 'Ojo Hexagonal Compuesto', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'multi', effect: 'ojo_hexagonal_shinobu', description: 'Golpea 5 veces a enemigos aleatorios. Por cada golpe a objetivo con Veneno: cura 1 HP y genera 1 carga al equipo aliado.' },
                    { name: 'Danza del Ciempiés', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'multi', effect: 'danza_ciempies_shinobu', description: 'Golpea 10 veces a enemigos aleatorios. Al golpear aplica Veneno 3T. Por Veneno aplicado: cura 3 HP y genera 3 cargas a aliado aleatorio.' }
                ]
            },
            'Rey Brujo de Angmar': {
                hp: 30, maxHp: 30, speed: 75, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/VctBXdtg/Whats-App-Image-2026-03-23-at-1-45-05-PM.jpg',
                passive: { name: 'Señor de los Nazgul', description: 'Inmune a debuffs Miedo y Confusión. Buff Megaprovoción permanente. Efecto pasivo Infectar.' },
                abilities: [
                    { name: 'Espada Morgul', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'espada_morgul_rba', description: 'Causa 2 daño. Aplica Veneno 1 turno. Si el objetivo ya tenía Veneno, el Rey Brujo gana Buff Esquiva Área 2 turnos.' },
                    { name: 'Grito de Mordor', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'aoe', effect: 'grito_mordor_rba', description: 'Aplica Silenciar al equipo enemigo. 50% de eliminar 2 cargas a cada enemigo con Veneno activo.' },
                    { name: 'Corona de Hierro', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'corona_hierro_rba', description: 'Cura al Rey Brujo y a un aliado aleatorio 2 HP por cada Veneno activo en ambos equipos.' },
                    { name: 'Mano de Sauron', type: 'over', cost: 17, chargeGain: 0, damage: 0, target: 'aoe', effect: 'mano_sauron_rba', description: 'Limpia todos los debuffs Veneno del equipo enemigo y causa daño equivalente a los turnos restantes de cada Veneno eliminado.' }
                ]
            },

            'Doctor Doom': {
                hp: 25, maxHp: 25, speed: 92, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/dwGgLj5R/Ai-Generated-Marvels-Characters-Wallpapers.jpg',
                passive: { name: 'Aura de Latveria', description: 'Cuando un enemigo recupera HP, el equipo aliado recupera la misma cantidad. Cuando se aplica un debuff sobre Doctor Doom, aplica Protección Sagrada, disipa debuffs aliados y genera 3 cargas por debuff disipado.' },
                abilities: [
                    { name: 'Guantelete de Plasma',      type: 'basic',   cost: 0,  chargeGain: 1, damage: 2, target: 'aoe',    effect: 'doom_gauntlet',         description: 'AOE 2 daño. Si golpea a enemigo con Provocación/MegaProvocación, todos los demás reciben daño adicional. 80% de probabilidad de +1 HP MAX por enemigo golpeado.' },
                    { name: 'Campo de Fuerza del Tirano', type: 'special', cost: 4,  chargeGain: 0, damage: 0, target: 'self',   effect: 'doom_force_field',      description: 'Mega Provocación + Armadura 3T en Doctor Doom. +1 carga al equipo aliado por buff activo en equipo enemigo.' },
                    { name: 'Magia de la Línea de Sangre', type: 'special', cost: 5, chargeGain: 0, damage: 2, target: 'aoe',   effect: 'doom_bloodline',        description: 'AOE 2 daño. Roba HP a cada enemigo: base 2 HP + bonus por rareza de reliquia (Rara+1, Especial+2, Épico+3, Legendario+4). El HP robado cura a Doctor Doom.' },
                    { name: 'Dios Emperador Doom',        type: 'over',    cost: 12, chargeGain: 0, damage: 10, target: 'single', effect: 'doom_god_emperor',    description: 'ST 10 daño. Equipo aliado recupera 100% HP. Por cada HP recuperado, 1 daño a enemigo aleatorio.' }
                ]
            },

            'Rhaenyra Targaryen': {
                hp: 15, maxHp: 15, speed: 75, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/ZR2H9ZHp/Whats-App-Image-2026-06-26-at-11-53-04-AM.jpg',
                passive: { name: 'Heredera Legítima', description: '50% de prob. de aplicar QS a enemigos que reciban curación. Al inicio de ronda invoca Cría de Dragón. Enemigos con debuff activo generan 1 carga al equipo aliado al usar movimiento.' },
                abilities: [
                    { name: 'Derecho de Nacimiento',    type: 'basic',   cost: 0,  chargeGain: 0, damage: 0, target: 'self',   effect: 'rhae_birthright',       description: 'Rhaenyra y un aliado aleatorio por Cría de Dragón activa generan 1 carga cada uno.' },
                    { name: 'Reina Negra',              type: 'special', cost: 0,  chargeGain: 0, damage: 0, target: 'self',   effect: 'rhae_black_queen',      description: 'Cura 2 HP al equipo aliado por cada Cría de Dragón activa.' },
                    { name: 'Fuego de Syrax',           type: 'special', cost: 10, chargeGain: 0, damage: 0, target: 'self',   effect: 'rhae_syrax_summon',     description: 'Invoca a Syrax.' },
                    { name: 'Asedio de la Reina Negra', type: 'over',    cost: 14, chargeGain: 0, damage: 2, target: 'aoe',    effect: 'rhae_black_queen_siege', description: 'AOE 2 daño. Protección Sagrada + Escudo 5 HP al equipo aliado. +2 cargas al equipo por Cría activa. Con Syrax: cura 10 HP aliados + Quemaduras 5 HP a enemigos.' }
                ]
            },

            'Gogeta': {
                hp: 20, maxHp: 20, speed: 98, charges: 10, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/cKYM45R5/gogeta-dokkan-wallpaper.jpg',
                passive: { name: 'Fusión Perfecta', description: 'Efecto pasivo Cuerpo Perfecto. Gogeta inicia con 10 cargas. Cada vez que un enemigo usa una habilidad, Gogeta genera 3 cargas. Al llegar a 0 HP o al finalizar la 5ta ronda, es eliminado y Goku y Vegeta se añaden al equipo.' },
                abilities: [
                    { name: 'Castigador de Almas',   type: 'basic',   cost: 5,  chargeGain: 0, damage: 5, target: 'single', effect: 'gogeta_castigador',  description: 'ST 5 daño. Si el objetivo no tiene debuffs activos, aplica 6 debuffs aleatorios.' },
                    { name: 'Galick Ho',             type: 'special', cost: 7,  chargeGain: 0, damage: 5, target: 'aoe',    effect: 'gogeta_galick_ho',   description: 'AOE 5 daño. Ignora Esquiva Área. Disipa todos los buffs enemigos e inflige +1 daño por buff disipado.' },
                    { name: 'Kame Hame Ha',          type: 'special', cost: 7,  chargeGain: 0, damage: 5, target: 'aoe',    effect: 'gogeta_kamehameha',  description: 'AOE 5 daño. Ignora Esquiva Área. Aplica 5 debuffs aleatorios a los objetivos.' },
                    { name: 'Big Bang Kame Hame Ha', type: 'over',    cost: 18, chargeGain: 0, damage: 5, target: 'aoe',    effect: 'gogeta_big_bang',    description: 'AOE 5 daño. +1 daño por cada buff y debuff activo en ambos equipos.' }
                ],
                _isEventChar: true, _eventBoss: 'Broly'
            },

            'Arthas Menethil': {
                hp: 20, maxHp: 20, speed: 80, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/C5tvthTw/Whats-App-Image-2026-07-06-at-11-21-56-AM.jpg',
                transformPortrait: 'https://i.ibb.co/0y17rdzh/Whats-App-Image-2026-07-06-at-11-25-01-AM.jpg',
                passive: { name: 'Aura Sagrada Distorsionada', description: 'Al inicio de la ronda 6, se transforma en Caballero de la Muerte. Cada vez que un enemigo recibe curación, genera 5 cargas y gana turno adicional. Cada vez que un aliado recibe debuff, cura 3 HP al aliado con menos HP.' },
                abilities: [
                    { name: 'Martillo de la Justicia', type: 'basic',   cost: 0,  chargeGain: 2, damage: 2, target: 'single', effect: 'arthas_hammer',     description: '70% de probabilidad de aplicar Aturdimiento. Si no aplica Aturdimiento, cura 3 HP al aliado con menos vida.' },
                    { name: 'Guerrero de la Luz',      type: 'special', cost: 0,  chargeGain: 4, damage: 1, target: 'aoe',    effect: 'arthas_warrior',    description: 'AOE 1 daño + Ceguera. Si los objetivos tenían buffs activos, elimina 7 cargas.' },
                    { name: 'Escudo Divino',            type: 'special', cost: 7,  chargeGain: 0, damage: 0, target: 'self',   effect: 'arthas_shield',     description: 'Aplica Escudo Sagrado a los 3 aliados con menos HP.' },
                    { name: 'Consagración',             type: 'over',    cost: 15, chargeGain: 0, damage: 5, target: 'single', effect: 'arthas_consecrate', description: 'Si el objetivo tiene Provocación o Mega Provocación, inflige 80% de sus HP totales. +5 daño por cada reliquia del objetivo.' }
                ],
                _isEventChar: true, _eventBoss: 'Lich King'
            },

            'Bolvar Fordragon': {
                hp: 30, maxHp: 30, speed: 80, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/jkysx2NZ/Whats-App-Image-2026-06-22-at-2-25-18-PM.jpg',
                passive: { name: 'El Carcelero de los Malditos', description: 'Cada vez que se realiza una invocación, un personaje se transforma o un personaje revive, Bolvar genera 5 cargas. Cada vez que se aplica Congelación y/o Quemaduras a cualquier personaje, el equipo aliado se cura 3 HP. Cada vez que se aplica Quemadura Solar y/o Megacongelación a cualquier personaje, el equipo aliado aumenta sus HP máximos en +3 (permanente).' },
                abilities: [
                    { name: 'Martillo Bendito',           type: 'basic',   cost: 0,  chargeGain: 1, damage: 1, target: 'single',     effect: 'martillo_bendito_bolvar',         description: 'Causa 1 daño ST. Aplica buff Mega Provocación en Bolvar.' },
                    { name: 'Consagración de Pyroescarcha', type: 'special', cost: 3, chargeGain: 0, damage: 1, target: 'single',   effect: 'consagracion_pyroescarcha_bolvar', description: 'Causa 1 daño ST. Si el objetivo tiene Congelación activa: Bolvar recibe Protección Sagrada. Si tiene Megacongelación: Escudo Sagrado. Si tiene Quemaduras: Armadura. Si tiene Quemadura Solar: Esquiva Área.' },
                    { name: 'Ira del Nuevo Rey',          type: 'special', cost: 8,  chargeGain: 0, damage: 1, target: 'aoe',        effect: 'ira_nuevo_rey_bolvar',            description: 'Elimina (reduce a 0 HP) a todos los personajes del equipo enemigo con transformación activa, que hayan revivido, e invocaciones enemigas. Causa +2 de daño directo por cada personaje e invocación eliminada.' },
                    { name: 'Voluntad del Nuevo Lich King', type: 'over',  cost: 15, chargeGain: 0, damage: 1, target: 'mt',         effect: 'voluntad_nuevo_lich_bolvar',      description: 'Ataca a todos los enemigos con Congelación, Megacongelación, Quemaduras o Quemadura Solar activos (hasta 4 golpes si el objetivo tiene 2+ debuffs de la lista). +1 daño directo a cada enemigo golpeado por cada debuff de la lista activo en el equipo enemigo.' }
                ]
            }
        };
