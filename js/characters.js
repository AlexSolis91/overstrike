// ==================== DATOS DE PERSONAJES ====================
        const characterData = {

            // ═══ TEAM HUNTERS ═══════════════════════════════════════

            'Madara Uchiha': {
                hp: 20, maxHp: 20, speed: 90, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                rikudoMode: false,
                portrait: 'https://i.postimg.cc/KzWJPy5j/Captura_de_pantalla_2026_02_26_134301.png',
                transformPortrait: 'https://i.postimg.cc/vBbG3V57/Captura_de_pantalla_2026_03_16_172658.png',
                transformationPortrait: 'https://i.postimg.cc/vBbG3V57/Captura_de_pantalla_2026_03_16_172658.png',
                passive: { name: 'Limbo', description: 'Efectos pasivos de Divinidad y Cuerpo Perfecto.' },
                abilities: [
                    { name: 'Gakidō: Fūjutsu Kyūin', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'lifesteal_basic', description: 'Causa 2 de daño. Roba HP al enemigo golpeado equivalente al daño causado por este ataque.' },
                    { name: 'Mangekyō Sharingan', type: 'special', cost: 2, chargeGain: 0, damage: 3, target: 'single', effect: 'sharingan_aoe', description: 'Causa 3 de daño sobre el objetivo. Madara se aplica Buff Contraataque y Buff Concentración.' },
                    { name: 'Susanoo', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'double_on_burn', description: 'Causa 3 de daño en área con 50% de probabilidad de golpe crítico. Aplica Buff Escudo con +3 HP por cada golpe crítico acertado en el enemigo.' },
                    { name: 'Modo Rikudō', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'rikudo_transformation', description: 'TRANSFORMACIÓN permanente. Todos los ataques cuestan la mitad de cargas, causan el doble de daño y generan el doble de cargas. Activa la pasiva Limbo: recibe 50% menos de daño y regenera 1 HP cada turno.' }
                ]
            },

            'Sun Jin Woo': {
                hp: 20, maxHp: 20, speed: 96, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/3rSZSvdF/Captura_de_pantalla_2026_03_11_105214.png',
                passive: { name: 'Arise!', description: 'Al inicio de su turno realiza una Invocacion aleatoria. Cada vez que una Invocacion es eliminada o sacrificada genera 2 cargas.' },
                abilities: [
                    { name: 'Sigilo de la Sombras', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'sjw_sigilo', description: 'Se aplica Buff Sigilo por 1 turno.' },
                    { name: 'Daga de Kamish', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'single', effect: 'daga_kamish', description: 'Causa 2 de daño +1 adicional por cada Sombra Invocada en tu equipo. Roba 1 carga por cada sombra invocada en tu equipo.' },
                    { name: 'Extracción de Sombras', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'sacrifice_shadow', description: 'Sacrificando una Sombra (Aleatoria excepto Kamish) puedes eliminar todos los debuffs activos en todos los aliados y limpiar todos los buffs activos en todos los enemigos.' },
                    { name: 'Purgatorio de las Sombras', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'aoe', effect: 'summon_kamish', description: 'Sacrifica todas sus sombras (excepto Kamish), causa 3 de daño por cada sombra sacrificada.' }
                ]
            },

            'Aldebaran': {
                hp: 30, maxHp: 30, speed: 83, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/PJr0LB6N/Captura_de_pantalla_2026_02_21_230603.png',
                passive: { name: 'Fortaleza de Tauro', description: 'Efecto pasivo Provocacion. Cada vez que un buff escudo es destruido por un golpe del enemigo, genera 1 carga.' },
                abilities: [
                    { name: 'Great Horn', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'great_horn', heal: 3, shieldAmount: 2, description: 'Causa 1 de daño. Recupera 3 HP. Se aplica Buff Escudo 2 HP.' },
                    { name: 'Golden Shield', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'golden_shield', shieldAmount: 3, description: 'Limpia los debuffs activos en Aldebaran. Se aplica un Buff Escudo de 3 HP.' },
                    { name: 'Double Great Horn', type: 'special', cost: 7, chargeGain: 0, damage: 3, target: 'multi', effect: 'double_great_horn', description: 'Ataca 2 objetivos causando 3 de daño. 60% de probabilidad de causar daño doble. 40% de probabilidad de causar daño triple. Se aplica Buff Escudo con HP equivalente a la suma del daño total causado en los enemigos.' },
                    { name: 'Great Supernova', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'great_supernova', description: 'Causa 10 de daño. Causa daño doble si Aldebaran tiene 20% o menos de HP.' }
                ]
            },

            'Leonidas': {
                hp: 20, maxHp: 20, speed: 79, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/TYJdgC3L/Captura_de_pantalla_2026_03_06_001254.png',
                passive: { name: 'Phalanx', description: 'Al inicio de cada ronda Limpia 1 debuff aleatorio de un aliado. Cada vez que un debuff es limpiado de un aliado, el ataque basico gana +1 de daño y +1 generacion de cargas permanente.' },
                abilities: [
                    { name: 'Precepto', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'precepto', description: 'Causa 1 de daño. 50% de probabilidad de aplicar debuff Aturdimiento.' },
                    { name: 'Grito de Esparta', type: 'special', cost: 2, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'grito_de_esparta', description: 'Aplica Buff Frenesí en todos los Aliados.' },
                    { name: 'Sangre de Esparta', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'sangre_esparta', description: 'Sacrifica 10 HP y genera 10 cargas.' },
                    { name: 'Gloria de los 300', type: 'over', cost: 10, chargeGain: 0, damage: 4, target: 'aoe', effect: 'gloria_300', description: 'Causa 4 AOE. Aplica Buff Regeneración 25% 2 turnos en todos los aliados. Limpia 1 debuff en todos los aliados.' }
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
                    { name: 'Milagro de la vida', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'revive_ally', description: 'Revive a un aliado caído con 100% de su HP y 10 cargas.' }
                ]
            },

            'Rengoku': {
                hp: 25, maxHp: 25, speed: 84, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/wTWCgJY2/Captura_de_pantalla_2026_03_15_021343.png',
                passive: { name: 'Corazon Ardiente', description: 'Cuando Rengoku muere, aplica aturdimiento a todos los enemigos. Rengoku genera 1 punto de carga cada vez que un debuff quemadura inflige daño.' },
                abilities: [
                    { name: 'Sol Ascendente', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'sol_ascendente', burnAmount: 1, description: 'Causa 2 de daño. Se aplica Debuff Quemadura 1 HP.' },
                    { name: 'Mar de Fuego', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'corazon_llamas', description: 'Causa 3 AOE. 100% de golpe crítico a los enemigos con debuff Quemadura activo.' },
                    { name: 'Tigre de Fuego', type: 'special', cost: 5, chargeGain: 0, damage: 3, target: 'aoe', effect: 'tigre_fuego_v2', burnAmount: 1, description: 'Causa 3 AOE. Aplica Debuff Quemadura de 1 HP. Si el enemigo ya tenía Debuff Quemadura activo antes de ejecutar este ataque, Genera 1 punto de carga a todo el equipo aliado.' },
                    { name: 'Purgatorio', type: 'over', cost: 12, chargeGain: 0, damage: 7, target: 'single', effect: 'purgatorio_v2', description: 'Causa 7 de daño. Aplica debuff Mega Aturdimiento. 100% de golpe crítico si el objetivo tiene activo debuff Quemadura.' }
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
                hp: 20, maxHp: 20, speed: 87, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                darkSideAwakened: false,
                portrait: 'https://i.postimg.cc/7hYjCpBh/Captura_de_pantalla_2026_02_21_231859.png',
                transformationPortrait: 'https://i.postimg.cc/Vk6t5wFQ/Whats_App_Image_2026_03_03_at_12_16_07_PM.jpg',
                passive: { name: 'El Elegido', description: 'Efecto pasivo Asistir.' },
                abilities: [
                    { name: 'Djem So', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'single', effect: 'djem_so', description: 'Causa 1 de daño. Sin efecto adicional.' },
                    { name: 'Estrangular', type: 'special', cost: 5, chargeGain: 0, damage: 5, target: 'single', effect: 'estrangular', description: 'Causa 5 de daño. Aplica Buff Concentración. Cada vez que Anakin usa esta habilidad, aumenta +1 el daño de Djem So permanentemente.' },
                    { name: 'Onda de Fuerza', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'onda_fuerza', description: 'Causa 3 AOE. Elimina 3 puntos de carga de los enemigos golpeados.' },
                    { name: 'Despertar del lado Oscuro', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'despertar_lado_oscuro', description: 'TRANSFORMACIÓN: Aumenta el daño de sus ataques 2 puntos y todas las habilidades de Anakin tienen 50% de probabilidad de crítico.' }
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
                hp: 25, maxHp: 25, speed: 83, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/9XqFNYqW/Captura_de_pantalla_2026_03_11_234717.png',
                passive: { name: 'Hijo de Odin', description: 'Cada vez que Ragnar recibe daño por golpe, genera 1 carga.' },
                abilities: [
                    { name: 'Furia Vikinga', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'apply_bleed', description: 'Causa 2 de daño. Aplica debuff Sangrado.' },
                    { name: 'Tormenta del Norte', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'aoe', effect: 'tormenta_norte_v2', description: 'Causa 2 AOE. 50% de probabilidad de aplicar Sangrado. Genera 2 puntos de carga por cada enemigo golpeado con debuff Sangrado.' },
                    { name: 'Rey Pagano', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'aoe', effect: 'rey_pagano', description: 'Causa 4 AOE. Aplica debuff Sangrado. Si el enemigo ya tenía Debuff Sangrado activo antes de ejecutar este ataque, aplica Debuff Miedo en el enemigo golpeado.' },
                    { name: 'Águila de Sangre', type: 'over', cost: 15, chargeGain: 0, damage: 10, target: 'single', effect: 'blood_eagle', description: 'Causa 10 de daño. Si el objetivo tiene menos del 50% de vida, esta habilidad Elimina al objetivo. Si esta habilidad mata al objetivo, aplica debuff Miedo a 2 enemigos aleatorios.' }
                ]
            },

            'Saitama': {
                hp: 20, maxHp: 20, speed: 97, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/Qtz0QrqV/Captura_de_pantalla_2026_02_26_132109.png',
                passive: { name: 'Espíritu del Héroe', description: 'Inmunidad a debuffs.' },
                abilities: [
                    { name: 'Golpe Normal', type: 'basic', cost: 0, chargeGain: 1, damage: 4, target: 'single', effect: 'apply_weaken_basic', description: 'Causa 4 de daño. Aplica debuff Debilitar.' },
                    { name: 'Golpes Normales Consecutivos', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'single', effect: 'multi_hit', description: 'Golpea de 1 a 3 veces al enemigo. Si golpea a un enemigo con debuff Debilitar o Escudo activo, causa daño crítico.' },
                    { name: 'Golpe Serio', type: 'special', cost: 7, chargeGain: 0, damage: 7, target: 'single', effect: 'crit_50_serious', critChance: 0.50, description: 'Causa 7 de daño. 50% de probabilidad de golpe Crítico.' },
                    { name: 'Golpe Grave', type: 'over', cost: 15, chargeGain: 0, damage: 20, target: 'single', effect: 'golpe_grave', description: 'Causa 20 de daño. Si el enemigo es derrotado tras este golpe, genera un turno adicional para atacar.' }
                ]
            },

            'Ozymandias': {
                hp: 20, maxHp: 20, speed: 88, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                ozyBonusChargeGain: 0,
                portrait: 'https://i.postimg.cc/6qGzz1Hp/Captura_de_pantalla_2026_02_26_131502.png',
                passive: { name: 'Privilegio Imperial', description: 'Si es golpeado por un enemigo aplica Quemadura Solar sobre ese enemigo.' },
                abilities: [
                    { name: 'Animación', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'ozy_basic', description: 'Causa 1 de daño. Si este ataque golpea a un enemigo con debuff Quemadura Solar, incrementa en +1 (permanente) la cantidad de cargas que genera este ataque.' },
                    { name: 'Sentencia del Sol', type: 'special', cost: 2, chargeGain: 0, damage: 2, target: 'single', effect: 'sentencia_sol', description: 'Causa 2 de daño. Si el enemigo golpeado tiene debuff Quemadura Solar, causa de 1-3 de daño adicional.' },
                    { name: 'Noble Phantasm Abu el-Hol Sphinx', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_sphinx', description: 'INVOCACIÓN: Invoca a Abu el-Hol Sphinx.' },
                    { name: 'Noble Phantasm Ramesseum Tentyris', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_ramesseum', description: 'INVOCACIÓN: Invoca a Ramesseum Tentyris.' }
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
                hp: 20, maxHp: 20, speed: 95, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/SsGwxyGp/Captura_de_pantalla_2026_02_22_014009.png',
                passive: { name: 'Cuerpo Divino', description: 'Cada vez que Goku Black recibe daño, tiene un 50% de robar 1 carga del atacante. Cada vez que Goku Black inflige daño tiene un 50% de aplicar debuff debilidad.' },
                abilities: [
                    { name: 'Espada de Ki', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'espada_ki', description: 'Causa 2 de daño. 50% de probabilidad de aplicar Buff Aura Oscura sobre Goku Black.' },
                    { name: 'Teletransportación', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'single', effect: 'teleportacion_confusion', description: 'Aplica Debuff Confusión. Roba 2 puntos de carga del objetivo.' },
                    { name: 'Lazo Divino', type: 'special', cost: 6, chargeGain: 0, damage: 5, target: 'single', effect: 'lazo_divino', poisonDuration: 4, description: 'Causa 5 de daño. Aplica debuff Veneno durante 4 turnos. Cada tick de Veneno tiene 50% de probabilidad de eliminar 2 cargas.' },
                    { name: 'Guadaña Divina', type: 'over', cost: 10, chargeGain: 0, damage: 7, target: 'aoe', effect: 'guadana_divina', description: 'Causa 7 AOE. Reduce a 0 todas las cargas de los enemigos golpeados.' }
                ]
            },

            'Saga de Geminis': {
                hp: 20, maxHp: 20, speed: 91, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/wBvTDG7f/Captura_de_pantalla_2026_02_24_103109.png',
                passive: { name: 'Maboroshi no Shinkiro', description: 'Cada vez que se aplica un debuff Posesion o Mega Posesion sobre un enemigo, genera 3 cargas.' },
                abilities: [
                    { name: 'Shingun Ken', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'speed_up_self', description: 'Causa 1 de daño. Aumenta 1 punto la Velocidad de Saga de Géminis. 50% de probabilidad de aplicar Posesión sobre el enemigo golpeado.' },
                    { name: 'Genrō Maō Ken', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'apply_possession', description: 'Causa 3 AOE. 50% de aplicar debuff Posesión sobre el enemigo golpeado.' },
                    { name: 'Kōsoku Ken', type: 'special', cost: 7, chargeGain: 0, damage: 1, target: 'single', effect: 'speed_bonus_damage', description: 'Causa 1 de daño +1 adicional por cada punto de diferencia de velocidad superior sobre el enemigo. Aplica Mega Posesión sobre el enemigo golpeado.' },
                    { name: 'Explosión de Galaxias', type: 'over', cost: 15, chargeGain: 0, damage: 10, target: 'aoe', effect: 'aoe_drain_charges_1', critChance: 0.30, description: 'Causa 10 AOE. 30% probabilidad de crítico.' }
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
                hp: 20, maxHp: 20, speed: 86, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                muzanTransformed: false,
                portrait: 'https://i.postimg.cc/fL41fCgH/Captura_de_pantalla_2026_02_28_020016.png',
                transformationPortrait: 'https://i.postimg.cc/nM8HxvTD/Whats_App_Image_2026_03_03_at_3_29_34_PM.jpg',
                passive: { name: 'Progenitor Demoniaco', description: 'Al pricipio de cada ronda, Muzan aplica Curacion de 2 HP a Muzan y 1 HP a un aliado aleatorio. Cada vez que un debuff Veneno haga daño, Muzan genera 1 punto de carga.' },
                abilities: [
                    { name: 'Espinas de Sangre', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'apply_poison', poisonDuration: 2, description: 'Causa 2 de daño. Se aplica Debuff Veneno al objetivo por 2 turnos.' },
                    { name: 'Sangre Demoniaca', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'single', effect: 'sangre_demoniaca', poisonDuration: 3, heal: 3, description: 'Causa 3 de daño. Aplica Debuff Veneno en el objetivo por 3 turnos. Aplica Curación a Muzan por 3 HP.' },
                    { name: 'Sombra de la Noche', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'sombra_noche', poisonDuration: 3, description: 'Causa 3 AOE. Aplica Buff Sigilo por 2 turnos. Aplica Debuff Veneno por 3 turnos.' },
                    { name: 'Rey de los Demonios Definitivo', type: 'over', cost: 12, chargeGain: 0, damage: 1, target: 'aoe', effect: 'muzan_transformation', description: 'TRANSFORMACIÓN: Causa 1 AOE. Aplica Debuff Veneno por 5 turnos. Aplica Buff Regeneración de 30% por 5 turnos. Aumenta su celeridad 20%. Aumenta su probabilidad de crítico 70%.' }
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
                hp: 30, maxHp: 30, speed: 80, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                hpLost: 0,
                portrait: 'https://i.postimg.cc/63sFfc1F/Captura_de_pantalla_2026_02_28_015421.png',
                passive: { name: 'Presencia Oscura', description: 'Darth Vader es inmune a debuffs Miedo y Confusion. Cada vez que un debuff Miedo expire por Limpiar, Disipar o termine, Darth Vader genera 1 punto de Carga.' },
                abilities: [
                    { name: 'Intimidación del Imperio', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'single', effect: 'apply_fear', description: 'Aplica Debuff Miedo al objetivo.' },
                    { name: 'Puño del Imperio', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'apply_megaprovocation_buff', description: 'Aplica Buff Megaprovocación.' },
                    { name: 'Lado Oscuro de la Fuerza', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'self', effect: 'apply_aura_oscura', description: 'Aplica Buff Aura Oscura.' },
                    { name: 'Ira del Elegido Caído', type: 'over', cost: 10, chargeGain: 0, damage: 2, target: 'aoe', effect: 'ira_elegido', description: 'Causa 2 AOE. Inflige 1 punto de daño adicional por cada punto de HP que Darth Vader ha perdido en el combate.' }
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
                    { name: 'Solución Diplomática', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'single', effect: 'dispel_target_padme_charges', description: 'Disipar los debuffs en el objetivo. Padme genera 2 puntos de Carga por cada debuff eliminado.' },
                    { name: 'Señuelo', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_señuelo', description: 'INVOCACIÓN: Invoca un Señuelo. Padme aplica Buff Sigilo por 2 turnos.' },
                    { name: 'Reina de Naboo', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'reina_de_naboo', description: 'Aplica Buff Escudo de 6 HP a los 4 aliados del equipo. Genera 4 puntos de Carga a todos los aliados (excepto Padme Amidala).' }
                ]
            },

            'Daenerys Targaryen': {
                hp: 15, maxHp: 15, speed: 77, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/Gm8k90V5/Whats_App_Image_2026_03_15_at_1_59_17_AM.jpg',
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
                passive: { name: 'Istari', description: 'Inmune a Posesión, Confusión y Miedo. Cada vez que un Escudo en un aliado se rompe, genera 3 cargas al portador.' },
                abilities: [
                    { name: 'Resplandor', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'ally_team', effect: 'team_regen', description: 'Aplica Buff Regeneración del 10% por 1 turno a todo el equipo aliado.' },
                    { name: 'Rayo de Luz', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'heal_shield_prov', heal: 5, shieldAmount: 5, description: 'El objetivo aliado recupera 5 HP. Aplica Buff Escudo de 5 HP. Aplica Buff Provocación al objetivo aliado.' },
                    { name: 'El Mago Blanco', type: 'special', cost: 7, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'heal_aura_luz', heal: 3, description: 'Cura 3 HP a todo el equipo aliado. Aplica Buff Aura de Luz a todos los aliados.' },
                    { name: 'No Puedes Pasar', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'no_puedes_pasar', description: 'Aplica Buff Armadura al equipo aliado. Aplica Buff Regeneración del 20% por 2 turnos.' }
                ]
            },

            'Doomsday': {
                hp: 30, maxHp: 30, speed: 84, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/hjJDWnn6/Captura_de_pantalla_2026_03_06_003242.png',
                passive: { name: 'Adaptacion Reactiva', description: 'Cada vez que recibe un golpe, recupera 2 HP.' },
                abilities: [
                    { name: 'Rugido del Devastador', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'rugido_devastador', description: 'Se aplica Buff Provocación. Se aplica Buff Cuerpo Perfecto.' },
                    { name: 'Smashing Strike', type: 'special', cost: 3, chargeGain: 0, damage: 3, target: 'single', effect: 'aoe_stun_chance', description: 'Causa 3 de daño. Aplica debuff Aturdimiento.' },
                    { name: 'Skill Drain', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'aoe', effect: 'skill_drain', description: 'Causa de 1 a 3 de daño a cada enemigo y recupera la misma cantidad de HP equivalente al daño total inflingido.' },
                    { name: 'Devastator Punish', type: 'over', cost: 12, chargeGain: 0, damage: 10, target: 'single', effect: 'doomsday_punish', critChance: 0.30, description: 'Causa 10 de daño. 30% probabilidad de crítico.' }
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

        };
