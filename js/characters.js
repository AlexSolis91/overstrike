// ==================== DATOS DE PERSONAJES ====================
        const characterData = {

            // ═══ TEAM HUNTERS ═══════════════════════════════════════

            'Madara Uchiha': {
                hp: 20, maxHp: 20, speed: 90, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/spKxL75H/descarga.jpg',
                transformPortrait: 'https://i.ibb.co/nMJG3RBJ/descarga-1.jpg',
                passive: { name: 'Gakido', description: 'Absorbe daño directo de aliados (gana cargas en lugar de HP). Inmune a debuffs con Escudo activo. Cada golpe crítico otorga 1 turno adicional.' },
                abilities: [
                    { name: 'Rinbo: Hengoku', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'rinbo_hengoku_madara', description: 'Causa 2 daño. 50% de probabilidad de golpe crítico.' },
                    { name: 'Susanoo', type: 'special', cost: 6, chargeGain: 0, damage: 4, target: 'single', effect: 'susanoo_madara', description: 'Causa 4 daño. Aplica Escudo equivalente al daño causado. 50% de crítico.' },
                    { name: 'Modo Rikudō', type: 'special', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'rikudo_mode_madara', description: 'Transformación: todos sus ataques cuestan la mitad y causan daño doble. Cada turno adicional genera 3 cargas.' },
                    { name: 'Chibaku Tensei', type: 'over', cost: 12, chargeGain: 0, damage: 6, target: 'aoe', effect: 'chibaku_tensei_madara', description: 'Causa 6 AOE. Roba todas las cargas del equipo enemigo. 50% de crítico.' }
                ]
            },

            'Sun Jin Woo': {
                hp: 20, maxHp: 20, speed: 96, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/3rSZSvdF/Captura_de_pantalla_2026_03_11_105214.png',
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
                    { name: 'Double Great Horn', type: 'special', cost: 7, chargeGain: 0, damage: 3, target: 'multi', effect: 'double_great_horn', description: 'Ataca 2 objetivos causando 3 de daño. 60% de probabilidad de causar daño doble. 40% de probabilidad de causar daño triple. Se aplica Buff Escudo con HP equivalente a la suma del daño total causado en los enemigos.' },
                    { name: 'Great Supernova', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'great_supernova', description: 'Causa 10 de daño. Causa daño doble si Aldebaran tiene 20% o menos de HP.' }
                ]
            },

            'Leonidas': {
                hp: 20, maxHp: 20, speed: 79, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/TYJdgC3L/Captura_de_pantalla_2026_03_06_001254.png',
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
                    { name: 'Protección Celestial', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'dispel_ally_charges', description: 'Limpia 1 debuff activo de cada aliado. Por cada debuff limpiado: +1 HP y +1 carga a todo el equipo aliado.' },
                    { name: 'Sanación Heroica', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'heal_all_allies', heal: 4, description: 'Sacrifica el 50% de su HP actual. Cura esa cantidad de HP a todos los aliados del equipo (excepto Min Byung). Min Byung recibe Regeneración 25% por 3 turnos.' },
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
                hp: 20, maxHp: 20, speed: 86, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                darkSideAwakened: false,
                portrait: 'https://i.postimg.cc/7hYjCpBh/Captura_de_pantalla_2026_02_21_231859.png',
                transformPortrait: 'https://i.postimg.cc/Vk6t5wFQ/Whats_App_Image_2026_03_03_at_12_16_07_PM.jpg',
                passive: { name: 'El Elegido', description: 'Efecto pasivo Asistir. 50% de probabilidad de que Anakin se aplique Buff Frenesi y Furia 2 turnos cuando un aliado recibe un ataque especial.' },
                abilities: [
                    { name: 'Djem So', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'djem_so', description: 'Causa 2 daño. 50% de probabilidad de crítico.' },
                    { name: 'Estrangular', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'estrangular', description: 'Causa 3 AOE. Elimina 1 carga del equipo enemigo. 50% de Aturdimiento por enemigo.' },
                    { name: 'General de la 501', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'multi', effect: 'general_501', description: 'Ataca 4 veces con su básico a objetivos aleatorios. 50% de Miedo por golpe.' },
                    { name: 'Despertar del Lado Oscuro', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'dark_side_anakin', lockedWhenTransformed: true, description: 'TRANSFORMACIÓN: +10 velocidad. Efecto pasivo Concentración permanente. Al inicio de cada ronda 50% de buff Reflejar 2 turnos.' }
                ]
            },
            // ═══ TEAM REAPERS ══════════════════════════════════════

            'Goku': {
                hp: 20, maxHp: 20, speed: 96, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                ultraInstinto: false,
                gokuForm: null, // null | 'ss1' | 'ss3' | 'ssblue' | 'ui'
                portrait: 'https://i.ibb.co/fzSb6PzW/Whats-App-Image-2026-03-31-at-11-17-10-AM.jpg',
                transformPortrait: 'https://i.ibb.co/nsjHhRk9/Whats-App-Image-2026-03-31-at-11-17-12-AM-1.jpg',
                portraitSS1:   'https://i.ibb.co/F4W59Rsr/Whats-App-Image-2026-03-31-at-11-17-12-AM.jpg',
                portraitSS3:   'https://i.ibb.co/tPFjc1L1/Captura-de-pantalla-2026-03-31-232531.png',
                portraitSSBlue:'https://i.ibb.co/Y7VFy7tG/Captura-de-pantalla-2026-03-31-111625.png',
                portraitUI:    'https://i.ibb.co/nsjHhRk9/Whats-App-Image-2026-03-31-at-11-17-12-AM-1.jpg',
                passive: { name: 'Superacion de Limites', description: 'Cada vez que Goku se transforma, recupera 5 HP. Transformado en SS1: cada golpe genera 3 cargas. SS3: todos los ataques causan daño crítico. SS Blue: contraataca con 3 básicos al recibir un golpe. Ultra Instinto: Esquiva Área + Esquivar + +5 daño en todos los ataques.' },
                abilities: [
                    { name: 'Kame Hame Ha', type: 'basic', cost: 0, chargeGain: 2, damage: 3, target: 'single', effect: 'kame_hame_ha_goku', description: 'Causa 3 daño.' },
                    { name: 'Kaio Ken', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'self', effect: 'kaio_ken_goku', description: 'Se aplica Buff Contraataque 3 turnos. Se aplica Buff Furia 3 turnos.' },
                    { name: 'Transformacion', type: 'special', cost: 8, chargeGain: 7, damage: 0, target: 'self', effect: 'transformacion_goku', description: 'TRANSFORMACION: 35% Super Sayajin, 30% Super Sayajin 3, 25% Super Sayajin Blue, 10% Ultra Instinto. Recupera 5 HP. Gana un turno adicional.' },
                    { name: 'Genkidama', type: 'over', cost: 12, chargeGain: 0, damage: 8, target: 'aoe', effect: 'genkidama_goku', description: 'Causa 8 AOE. SS1: roba 5 cargas de cada enemigo. SS3: ignora Esquivar y Esquiva Área. SS Blue: reduce a 0 las cargas de cada enemigo. Ultra Instinto: 50% de eliminar a cada enemigo golpeado.' }
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
                saitamaBasicChargeBonus: 0,
                portrait: 'https://i.postimg.cc/Qtz0QrqV/Captura_de_pantalla_2026_02_26_132109.png',
                passive: { name: 'Espíritu del Héroe', description: 'Inmunidad a debuffs. Cada vez que se realiza un ataque básico, el ataque básico aumentará en +2 las cargas generadas en su próximo uso.' },
                abilities: [
                    { name: 'Golpe Normal', type: 'basic', cost: 0, chargeGain: 1, damage: 4, target: 'single', effect: 'golpe_normal_saitama', description: 'Causa 4 daño. Aplica Buff Furia 2 turnos.' },
                    { name: 'Golpes Normales Consecutivos', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'single', effect: 'multi_hit', description: 'Causa 3 daño + 3 adicional por cada Buff activo en el objetivo.' },
                    { name: 'Golpe Serio', type: 'special', cost: 8, chargeGain: 0, damage: 6, target: 'single', effect: 'golpe_serio_saitama', description: 'Causa 6 daño. Daño triple si el objetivo tiene Provocación o Mega Provocación.' },
                    { name: 'Golpe Grave', type: 'over', cost: 20, chargeGain: 0, damage: 0, target: 'single', effect: 'golpe_grave', description: 'Elimina al enemigo golpeado.' }
                ]
            },

            'Ozymandias': {
                hp: 20, maxHp: 20, speed: 88, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/6qGzz1Hp/Captura_de_pantalla_2026_02_26_131502.png',
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
                passive: { name: 'Regla de Oro', description: 'Aumenta 25% la probabilidad de golpe crítico. Cada golpe crítico genera 1 carga (100% de probabilidad).' },
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
                portrait: 'https://i.ibb.co/Sw26gc9V/Whats-App-Image-2026-03-31-at-1-24-06-PM.jpg',
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
                    { name: 'Legado del Cuarto Hokage', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'legado_hokage_v2', description: 'Genera 8 cargas para el resto de tu equipo (excepto Minato Namikaze). Requiere 10 cargas.' }
                ]
            },

            'Muzan Kibutsuji': {
                hp: 20, maxHp: 20, speed: 86, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                muzanTransformed: false,
                portrait: 'https://i.postimg.cc/fL41fCgH/Captura_de_pantalla_2026_02_28_020016.png',
                transformPortrait: 'https://i.ibb.co/RTtv2Ytc/descarga-9.jpg',
                transformationPortrait: 'https://i.ibb.co/RTtv2Ytc/descarga-9.jpg',
                passive: { name: 'Progenitor Demoniaco', description: 'Al pricipio de cada ronda, Muzan aplica Curacion de 2 HP a Muzan y 1 HP a un aliado aleatorio. Cada vez que un debuff Veneno haga daño, Muzan genera 1 punto de carga.' },
                abilities: [
                    { name: 'Espinas de Sangre', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'apply_poison', poisonDuration: 2, description: 'Causa 2 de daño. Se aplica Debuff Veneno al objetivo por 2 turnos.' },
                    { name: 'Sangre Demoniaca', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'single', effect: 'sangre_demoniaca', poisonDuration: 3, heal: 3, description: 'Causa 3 de daño. Aplica Debuff Veneno en el objetivo por 3 turnos. Aplica Curación a Muzan por 3 HP.' },
                    { name: 'Sombra de la Noche', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'sombra_noche', poisonDuration: 3, description: 'Causa 3 AOE. Aplica Buff Sigilo por 2 turnos. Aplica Debuff Veneno por 3 turnos.' },
                    { name: 'Rey de los Demonios Definitivo', type: 'over', cost: 12, chargeGain: 0, damage: 1, target: 'aoe', effect: 'muzan_transform', description: 'TRANSFORMACIÓN: Causa 1 AOE. Aplica Debuff Veneno por 5 turnos. Aumenta la velocidad de Muzan Kibutsuji en 10 puntos. Los ataques de Muzan activan los ticks de veneno causando el daño correspondiente.' }
                ]
            },

            'Nakime': {
                hp: 15, maxHp: 15, speed: 80, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/858xm4nX/Captura_de_pantalla_2026_02_28_020047.png',
                passive: { name: 'Castillo Infinito', description: 'Inmune a daño Single Target. Al inicio de cada ronda, el primer ataque enemigo impacta sobre un personaje del equipo enemigo.' },
                abilities: [
                    { name: 'Nota del Biwa', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'single', effect: 'apply_confusion', description: 'Se aplica Debuff Confusión al objetivo.' },
                    { name: 'Cambio de Sangre', type: 'special', cost: 8, chargeGain: 0, damage: 0, target: 'single', effect: 'cambio_sangre', description: 'Selecciona un enemigo e intercambia los HP con un aliado.' },
                    { name: 'Cambio Demoniaco', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'single', effect: 'cambio_demoniaco', description: 'Selecciona un enemigo e intercambia los puntos de carga con un aliado.' },
                    { name: 'Colapso', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'self', effect: 'cambio_vida_v2', description: 'Elimina el 50% de los puntos de carga actuales del equipo enemigo. Genera un 50% de puntos de carga actuales del equipo aliado.' }
                ]
            },

            'Sauron': {
                hp: 25, maxHp: 25, speed: 78, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/858xm4n0/Captura-de-pantalla-2026-02-28-020119.png',
                passive: { name: 'El Ojo que Todo lo Ve', description: 'Ignora Provocación, MegaProvocación y Sigilo. Si es atacado con MegaProvocación activa, aplica Aturdimiento al atacante. Con MegaProvocación o Protección Sagrada activa, reduce 50% el daño recibido.' },
                abilities: [
                    { name: 'Voluntad de Mordor', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'voluntad_mordor_sauron', description: 'Causa 2 daño. Si el objetivo tenía un Buff activo antes del ataque: limpia 1 buff, aplica Silencio y genera 2 cargas adicionales.' },
                    { name: 'Mano Negra', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'mano_negra_sauron', description: 'Causa 3 AOE. Por cada enemigo con Buff golpeado: Sauron genera 2 cargas. Por cada enemigo que esquiva: el equipo aliado genera 3 cargas.' },
                    { name: 'Señor Oscuro', type: 'special', cost: 6, chargeGain: 0, damage: 6, target: 'single', effect: 'senor_oscuro_sauron', description: 'Causa 6 daño. Si el objetivo tiene Provocación o MegaProvocación: causa 50% del HP actual de Sauron a 2 enemigos aleatorios. Recupera 50% de su HP máximo por enemigo eliminado.' },
                    { name: 'Poder del Anillo', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'poder_anillo_sauron', description: 'Recupera 50% del HP actual. Aumenta HP máximo en 10. Aplica Protección Sagrada 3T y MegaProvocación 3T.' }
                ]
            },

            'Darth Vader': {
                hp: 25, maxHp: 25, speed: 80, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                hpLost: 0,
                portrait: 'https://i.postimg.cc/63sFfc1F/Captura_de_pantalla_2026_02_28_015421.png',
                passive: { name: 'Presencia Oscura', description: 'Aura Oscura permanente. Al inicio de cada ronda, 50% de aplicar Miedo a cada enemigo.' },
                abilities: [
                    { name: 'Corte Oscuro', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'corte_oscuro_vader', description: 'Causa 2 daño. Si el objetivo tenía Miedo activo antes del ataque, Darth Vader se aplica Buff Reflejar.' },
                    { name: 'Explosión de la Fuerza', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'aoe', effect: 'explosion_fuerza_dv', description: 'Causa 2 AOE. 50% de Aturdimiento. 50% de Debilitar a los objetivos.' },
                    { name: 'Intimidación Sith', type: 'special', cost: 7, chargeGain: 0, damage: 6, target: 'single', effect: 'intimidacion_sith', description: 'Causa 6 daño + 3 daño directo adicional por cada buff activo en el objetivo al ejecutar este ataque.' },
                    { name: 'Ira del Elegido Caído', type: 'over', cost: 10, chargeGain: 0, damage: 2, target: 'aoe', effect: 'ira_elegido', description: 'Causa 2 AOE + 1 daño adicional por cada punto de HP que Darth Vader ha perdido en el combate.' }
                ]
            },

            'Lich King': {
                hp: 30, maxHp: 30, speed: 82, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/63JHLp7S/Whats-App-Image-2026-04-16-at-9-36-07-AM.jpg',
                passive: { name: 'Aura de Hielo', description: 'Efecto pasivo de Aura Gélida. Lich King es inmune a debuffs de Miedo, Posesión y Congelación.' },
                abilities: [
                    { name: 'Agonía de Escarcha', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'agonia_escarcha', description: 'Causa 1 daño. Roba 1 HP del objetivo. Aplica Buff Provocación en Lich King.' },
                    { name: 'Cadenas de Hielo', type: 'special', cost: 2, chargeGain: 0, damage: 1, target: 'aoe', effect: 'cadenas_hielo', description: 'Causa 1 AOE. 50% de probabilidad de aplicar debuff Congelación a cada enemigo golpeado.' },
                    { name: 'El Rey Caído', type: 'special', cost: 5, chargeGain: 5, damage: 0, target: 'self', effect: 'el_rey_caido', description: 'INVOCACIÓN: Realiza 1 invocación aleatoria.' },
                    { name: 'Segador de Almas', type: 'over', cost: 8, chargeGain: 0, damage: 10, target: 'single', effect: 'segador_almas', description: 'Causa 10 daño. Si el enemigo muere con este ataque, es revivido como aliado con 50% de vida y 0 cargas.' }
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
                hp: 20, maxHp: 20, speed: 90, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/DfMRtYcj/Whats-App-Image-2026-03-05-at-9-50-54-AM.jpg',
                passive: { name: 'Emperador de la Galaxia', description: 'Cada vez que un debuff enemigo se disipa o termina, 50% de aplicar Aturdimiento a ese enemigo. Cada vez que un enemigo se aplica un buff, un aliado aleatorio genera 2 cargas.' },
                abilities: [
                    { name: 'Relámpago Sith', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'relampago_sith_palpatine', description: 'Causa 2 daño. Aplica 1 debuff aleatorio al objetivo.' },
                    { name: 'Corrupción', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'aoe', effect: 'corrupcion_palpatine', description: 'Disipa todos los debuffs del equipo enemigo y elimina 1 carga por cada debuff disipado. (Activa pasiva: 50% Aturdimiento por cada debuff disipado).' },
                    { name: 'Orden Sith', type: 'special', cost: 8, chargeGain: 0, damage: 0, target: 'aoe', effect: 'orden_sith_palpatine', description: 'Disipa todos los buffs del equipo enemigo. Por cada buff disipado, el equipo aliado genera 1 carga.' },
                    { name: 'Poder Ilimitado', type: 'over', cost: 9, chargeGain: 0, damage: 5, target: 'aoe', effect: 'poder_ilimitado_palpatine', description: 'Causa 5 AOE. 50% de aplicar Mega Aturdimiento a cada objetivo. Si un objetivo no recibe Mega Aturdimiento, causa daño triple sobre ese objetivo.' }
                ]
            },

            'Gandalf': {
                hp: 20, maxHp: 20, speed: 74, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.postimg.cc/1RjbLYHx/Whats-App-Image-2026-03-05-at-9-53-24-AM.jpg',
                passive: { name: 'Istari', description: 'Inmune a Posesión, Confusión y Miedo. Cada vez que un Buff Escudo en un aliado se rompe, el portador genera 3 cargas y cura 3 HP.' },
                abilities: [
                    { name: 'Resplandor', type: 'basic', cost: 0, chargeGain: 2, damage: 0, target: 'ally_team', effect: 'resplandor_gandalf', description: 'Aplica Buff Escudo de 2 HP a todo el equipo aliado.' },
                    { name: 'Rayo de Luz', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'rayo_luz_gandalf', description: 'El aliado objetivo recupera 5 HP. Aplica Buff Escudo de 5 HP y Buff Provocación sobre el objetivo aliado.' },
                    { name: 'El Mago Blanco', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'mago_blanco_gandalf', description: 'Aplica Buff Aura de Luz a todos los aliados. Cura 2 HP al equipo aliado. Si un aliado está por debajo del 50% de HP, cura 5 HP en lugar de 2 HP.' },
                    { name: 'No Puedes Pasar', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'ally_team', effect: 'no_puedes_pasar_gandalf', description: 'Aplica Buff Escudo de 8 HP y Buff Regeneración 30% por 3 turnos a todo el equipo aliado.' }
                ]
            },

            'Doomsday': {
                hp: 30, maxHp: 30, speed: 84, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/m55KhhZd/descarga-2.jpg',
                passive: { name: 'Adaptación Reactiva', description: 'Cada vez que recibe un golpe, recupera 2 HP. Cada vez que Doomsday recupera HP, elimina 2 cargas de un enemigo aleatorio.' },
                abilities: [
                    { name: 'Rugido del Devastador', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'rugido_devastador', description: 'Se aplica Buff Provocación. Se aplica Buff Cuerpo Perfecto.' },
                    { name: 'Smashing Strike', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'multi', effect: 'smashing_strike', description: 'Ataca 2 veces a enemigos aleatorios. Cada golpe tiene 50% de Aturdimiento.' },
                    { name: 'Skill Drain', type: 'special', cost: 7, chargeGain: 0, damage: 3, target: 'aoe', effect: 'skill_drain', description: 'Causa 3 AOE. Roba de 1 a 5 HP del enemigo golpeado por este ataque.' },
                    { name: 'Devastator Punish', type: 'over', cost: 8, chargeGain: 0, damage: 5, target: 'single', effect: 'devastator_punish', description: 'Causa 5 daño. 10% de probabilidad de eliminar al objetivo. Si lo elimina: disipa todos los Buffs del equipo enemigo y aplica Mega Aturdimiento a todos los enemigos.' }
                ]
            },
            'Ikki de Fenix': {
                hp: 15, maxHp: 15, speed: 83, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/pvhstP12/Captura-de-pantalla-2026-04-22-111740.png',
                transformPortrait: 'https://i.ibb.co/pvhstP12/Captura-de-pantalla-2026-04-22-111740.png',
                passive: { name: 'Cenizas del Fenix', description: 'Revive la ronda siguiente con 100% HP y 10 cargas (genera +5 cargas al equipo aliado al revivir). Enemigos con Quemaduras activas solo pueden atacar a Ikki.' },
                abilities: [
                    { name: 'Phoenix Genma Ken', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'phoenix_genma_ken_ikki', description: 'Causa 1 daño. Aplica Quemadura 2HP. 50%: si el objetivo ya tenía Quemadura, roba todas sus cargas.' },
                    { name: 'Hou Yoku Tenshou', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'aoe', effect: 'hou_yoku_tenshou_ikki', description: 'Causa 2 AOE. Aplica Quemadura 5HP a los enemigos NO golpeados. Elimina 3 cargas a los enemigos CON Quemadura golpeados.' },
                    { name: 'Ilusión Diabólica del Fénix', type: 'special', cost: 8, chargeGain: 0, damage: 5, target: 'single', effect: 'ilusion_diabolica_ikki', description: 'Causa 5 daño. Disipa todos los Buffs del objetivo. Por cada Buff disipado, genera 3 cargas al equipo aliado.' },
                    { name: 'El Despertar del Fénix Inmortal', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'despertar_fenix_ikki', description: 'Causa 10 daño. Ignora Provocacion y Mega Provocacion. Si elimina al objetivo, el equipo aliado genera 10 cargas.' }
                ]
            },
            'Linterna Verde': {
                hp: 20, maxHp: 20, speed: 96, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/bRMTVQVr/Captura-de-pantalla-2026-03-18-131918.png',
                passive: { name: 'Visión Esmeralda', description: 'Cada vez que recibe un golpe, genera 2 cargas.' },
                abilities: [
                    { name: 'Campo de Atracción', type: 'basic', cost: 0, chargeGain: 1, damage: 0, target: 'self', effect: 'campo_atraccion', description: 'Se aplica Buff Provocación. Se aplica Buff Esquivar.' },
                    { name: 'Sincronía Esmeralda', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'sincronia_esmeralda', description: 'Limpia 1 debuff sobre el aliado objetivo y el aliado genera 3 cargas.' },
                    { name: 'Soporte Vital Autónomo', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'soporte_vital', description: 'Selecciona un aliado: ambos (Linterna Verde y el aliado) recuperan 5 HP y disipan todos los debuffs.' },
                    { name: 'La Lanza de Oa', type: 'over', cost: 10, chargeGain: 0, damage: 2, target: 'single', effect: 'lanza_de_oa', description: 'Causa 2 + 5 a 10 daño adicional aleatorio. Aplica debuff Mega Aturdimiento. Linterna Verde recupera HP equivalente al daño total causado.' }
                ]
            },
            'Vegeta': {
                hp: 20, maxHp: 20, speed: 96, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                vegetaForm: null, // null | 'ssblue_evo' | 'ultra_ego'
                portrait: 'https://i.ibb.co/G301wx8Z/Captura-de-pantalla-2026-03-19-113940.png',
                portraitSSBlueEvo: 'https://i.ibb.co/PZGp5fKN/Whats-App-Image-2026-04-07-at-2-42-40-PM-1.jpg',
                portraitUltraEgo: 'https://i.ibb.co/hJBTVdHL/Whats-App-Image-2026-04-07-at-2-42-40-PM.jpg',
                passive: { name: 'Principe de los Sayajins', description: 'Si un enemigo tiene Buffs activos al ser golpeado, elimina sus buffs antes del daño. Por cada buff eliminado/disipado en enemigos, Vegeta genera 2 cargas. Al 40-70% HP: Super Sayajin Blue Evolution (cargas = cargas del objetivo al golpear). Al 1-39% HP: Ultra Ego (50% menos daño por golpe e inmune a daño directo).' },
                abilities: [
                    { name: 'Rafagas de Ki', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'aoe', effect: 'rafagas_ki_vegeta', description: 'Causa 1 AOE. 50% de probabilidad de daño triple.' },
                    { name: 'Big Bang Attack', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'single', effect: 'big_bang_attack_vegeta', description: 'Causa 4 daño. Aplica Debilitar y Sangrado 3 turnos al objetivo.' },
                    { name: 'Resplandor Final', type: 'special', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'resplandor_final_vegeta', description: 'Causa 10 daño. Si elimina al objetivo, causa 4 de daño directo a todos los enemigos.' },
                    { name: 'Explosion Final', type: 'over', cost: 15, chargeGain: 0, damage: 5, target: 'aoe', effect: 'explosion_final_vegeta', description: 'AOE. Vegeta muere al usarlo y revive en 3 rondas (50% HP, 10 cargas). Daño: 5 base + bonus según HP actual: 90-100%→+1, 60-89%→+3, 30-59%→+5, 10-29%→+8, 1-9%→+15. Elimina Esquiva Área enemiga antes de impactar.' }
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
                portrait: 'https://i.ibb.co/JRPVCpGp/Captura-de-pantalla-2026-03-26-230228.png',
                passive: { name: 'Izanami', description: 'La primera vez por ronda que Itachi fuera a recibir un golpe de 3+ daño, esquiva y roba hasta 2 cargas del atacante. Cada vez que un debuff (Posesion, Veneno, Quemaduras, Confusion) es aplicado sobre un aliado, limpia hasta 1 debuff activo del equipo aliado y genera 2 cargas por debuff limpiado.' },
                abilities: [
                    { name: 'Genjutsu', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'genjutsu_itachi', description: 'Causa 1 daño. Aplica Posesión al objetivo. Genera 1 carga por cada Buff activo del objetivo golpeado.' },
                    { name: 'Tsukuyomi', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'single', effect: 'tsukuyomi_itachi', description: 'Disipa todos los debuffs de ambos equipos. Causa +1 daño adicional por cada debuff disipado.' },
                    { name: 'Amaterasu', type: 'special', cost: 7, chargeGain: 0, damage: 4, target: 'single', effect: 'amaterasu_itachi', description: 'Causa 4 daño. Aplica Quemadura 4HP. Si el objetivo es invocación, la elimina y aplica Quemadura 6HP AOE.' },
                    { name: 'Susanoo, Espada de Totsuka', type: 'over', cost: 9, chargeGain: 2, damage: 8, target: 'single', effect: 'susanoo_totsuka', description: 'Causa 8 daño. Roba todas las cargas del objetivo. Aplica Mega Aturdimiento. Aplica Debilitar.' }
                ]
            },
            'Garou': {
                hp: 20, maxHp: 20, speed: 95, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                garouSaitamaMode: false,
                portrait: 'https://i.ibb.co/1YPdwxPw/Captura-de-pantalla-2026-03-20-160048.png',
                transformPortrait: 'https://i.ibb.co/S4vdmL4s/Captura-de-pantalla-2026-03-20-172015.png',
                passive: { name: 'Cazador de Héroes', description: 'Cualquier daño directo al HP que fuera a recibir Garou se convierte en cargas para Garou, en lugar de causar el daño. Al inicio de cada Turno de Garou, se aplica Buff Armadura por 2 turnos. Si Garou tiene debuff (veneno, quemaduras, sangrado) activo, Garou causa daño doble con todos sus ataques.' },
                abilities: [
                    { name: 'Ryusui Gansai-ken', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'ryusui_garou', description: 'Garou se aplica debuff Veneno 2 turnos. Garou se aplica Buff Infectar por 2 turnos.' },
                    { name: 'Cross Fang Dragon Slayer Fist', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'single', effect: 'cross_fang_garou', description: 'Causa +2 de daño adicional por cada aliado y enemigo derrotado.' },
                    { name: 'Gamma Ray Burst', type: 'special', cost: 7, chargeGain: 0, damage: 2, target: 'aoe', effect: 'gamma_ray_garou', description: 'Causa +1 de daño adicional por cada punto de carga que tenga del objetivo golpeado.' },
                    { name: 'Saitama Mode', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'self', effect: 'saitama_mode_garou', description: 'Reduce -2 puntos el daño por golpe recibido por los enemigos. Todos los Ataques de Garou causan +2 de daño adicional.' }
                ]
            },
            'Tanjiro Kamado': {
                hp: 20, maxHp: 20, speed: 88, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/x8qLNcDN/Whats-App-Image-2026-03-20-at-3-35-02-PM.jpg',
                passive: { name: 'Olor de la Brecha', description: 'Cada vez que Tanjiro acierta un ataque básico, tiene 50% de probabilidad de generar 1 carga al equipo aliado.' },
                abilities: [
                    { name: 'Vals', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'vals_tanjiro', description: 'Causa 1 daño. El equipo aliado genera 1 carga.' },
                    { name: 'Cascada de Agua', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'aoe', effect: 'cascada_agua_tanjiro', description: 'Causa 2 AOE. 50% de probabilidad de robar 1 carga de cada objetivo golpeado.' },
                    { name: 'Danza del Dios del Fuego', type: 'special', cost: 7, chargeGain: 0, damage: 0, target: 'single', effect: 'danza_fuego_tanjiro', description: 'Realiza 5 ataques básicos sobre enemigos aleatorios. Cada golpe aplica el daño y efectos del básico. Cada golpe acertado activa Olor de la Brecha (50% de generar 1 carga al equipo aliado).' },
                    { name: 'Decimotercera Postura', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'single', effect: 'decimotercera_tanjiro', description: 'Realiza 13 ataques básicos aleatorios. Cada golpe aplica el daño y efectos del básico. 50% de eliminar 1 carga al objetivo. Cada golpe acertado activa Olor de la Brecha (50% de generar 1 carga al equipo aliado).' }
                ]
            },
            'The Joker': {
                hp: 20, maxHp: 20, speed: 85, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/gZQDP5Cm/Captura-de-pantalla-2026-03-20-230645.png',
                passive: { name: 'Anarquía', description: 'Cada vez que un enemigo recibe daño de Veneno, 50% de probabilidad de aplicar debuff Aturdimiento en ese enemigo.' },
                abilities: [
                    { name: 'Naipes Impregnados', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'naipes_joker', description: 'Causa 1 daño. Aplica debuff Veneno 2 turnos sobre el objetivo.' },
                    { name: 'Granada de Humo Púrpura', type: 'special', cost: 2, chargeGain: 0, damage: 1, target: 'aoe', effect: 'granada_joker', description: 'Causa 1 AOE. Aplica debuff Veneno 3 turnos sobre los enemigos.' },
                    { name: 'Detonador del Caos', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'aoe', effect: 'detonador_joker', description: 'Causa 3 AOE. Si el enemigo tiene Veneno o Aturdimiento, 50% de eliminar todas sus cargas.' },
                    { name: '¿Por qué tan serio?', type: 'over', cost: 8, chargeGain: 0, damage: 2, target: 'single', effect: 'por_que_serio_joker', description: 'Causa 2 daño. Si el objetivo tiene Veneno activo, reduce un 60% su HP actual.' }
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
                    { name: 'Octavo Sentido', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'ally_aoe', effect: 'octavo_sentido_shaka', description: 'El equipo aliado genera 1 carga por cada 2 debuffs activos en ambos equipos (total debuffs / 2).' },
                    { name: 'Ohm', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'ohm_shaka', description: 'El equipo aliado recupera 1 HP por cada debuff activo en ambos equipos.' },
                    { name: 'Tenmaku Hōrin', type: 'over', cost: 10, chargeGain: 0, damage: 8, target: 'single', effect: 'tenmaku_horin_shaka', description: 'Causa 8 daño. Aplica Mega Posesión 3 turnos. Aplica Agotamiento 3 turnos al objetivo.' }
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
                portrait: 'https://i.ibb.co/WWWHbctz/Captura-de-pantalla-2026-03-23-135145.png',
                passive: { name: 'Doncella Escudera', description: 'Cada vez que un enemigo con Sangrado recibe un golpe, Lagertha genera Buff Escudo de 1 HP. Lagertha tiene 50% de probabilidad de esquivar debuff Quemadura y Veneno.' },
                abilities: [
                    { name: 'Hacha y Escudo', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'single', effect: 'hacha_escudo_lagertha', description: 'Causa 1 daño. Lagertha se aplica Buff Provocación. 50% de que Lagertha se aplica Buff Reflejar.' },
                    { name: 'Muro de Escudo', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'ally_aoe', effect: 'muro_escudo_lagertha', description: 'Aplica Buff Escudo de 5 HP al equipo aliado. Aplica Buff Protección Sagrada al equipo aliado por 2 turnos.' },
                    { name: 'Furia de Freya', type: 'special', cost: 7, chargeGain: 0, damage: 2, target: 'single', effect: 'furia_freya_lagertha', description: 'Causa daño directo: 2 + 1 adicional por cada punto de escudo que tenga el objetivo.' },
                    { name: 'Valquiria', type: 'over', cost: 12, chargeGain: 0, damage: 0, target: 'single', effect: 'valquiria_lagertha', description: 'El equipo aliado ataca con su básico al objetivo (generando cargas y efectos). Aplica Buff Asistir al equipo aliado por 3 turnos.' }
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
                passive: { name: 'Señor de los Nazgul', description: 'Inmune a Miedo y Confusión. Provocación pasiva. Infectar pasivo. Cada vez que se aplica Veneno en un enemigo, se cura 2 HP.' },
                abilities: [
                    { name: 'Espada Morgul', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'espada_morgul_rey', description: 'Causa 2 daño. Aplica Veneno 1T. Si el objetivo ya tenía Veneno, propaga Veneno a todo el equipo enemigo.' },
                    { name: 'Grito de Mordor', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'aoe', effect: 'grito_mordor_rey', description: 'Elimina 3 cargas a todos los enemigos. 50% de Aturdimiento en enemigos con Veneno activo.' },
                    { name: 'Corona de Hierro', type: 'special', cost: 9, chargeGain: 0, damage: 0, target: 'self', effect: 'corona_hierro_rey', description: '5 ataques básicos en enemigos aleatorios con todos sus efectos. Aplica 1 buff aleatorio a cada aliado por golpe.' },
                    { name: 'Mano de Sauron', type: 'over', cost: 17, chargeGain: 0, damage: 0, target: 'aoe', effect: 'mano_sauron_rey', description: 'Limpia todos los Venenos del equipo enemigo y causa daño equivalente a los turnos restantes de cada Veneno.' }
                ]
            },

            'Flash': {
                hp: 20, maxHp: 20, speed: 100, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/JRMKVsj5/Captura-de-pantalla-2026-03-26-174229.png',
                passive: { name: 'Aceleración Constante', description: 'Efecto pasivo Esquiva Área. Cada vez que Flash esquiva un ataque, genera 2 cargas. Flash recupera 2 HP cada vez que acierta un golpe crítico.' },
                abilities: [
                    { name: 'Patada Relámpago', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'patada_relampago', description: 'Causa 2 daño. Se aplica Buff Esquivar 2 turnos. 50% de probabilidad de golpe crítico.' },
                    { name: 'Electroquinesis', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'electroquinesis_flash', description: 'Causa 3 AOE. 50% de probabilidad de robar 2 cargas del enemigo golpeado. 50% de probabilidad de golpe crítico.' },
                    { name: 'Golpe de Masa Infinita', type: 'special', cost: 4, chargeGain: 0, damage: 2, target: 'single', effect: 'golpe_masa_infinita', description: 'Causa 2 daño. Gana un turno adicional. 50% de probabilidad de golpe crítico.' },
                    { name: 'Singularidad Escarlata', type: 'over', cost: 15, chargeGain: 20, damage: 10, target: 'single', effect: 'singularidad_escarlata', description: 'Causa 10 daño. Gana un turno adicional. Genera 20 cargas. Esta habilidad tiene cooldown de 3 turnos.' }
                ]
            },

            'Naruto': {
                hp: 20, maxHp: 20, speed: 87, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                narutoForm: null, // null | 'sabio' | 'kyubi' | 'baryon'
                portrait: 'https://i.ibb.co/Zz12M6bp/Naruto-Uzumaki.jpg',
                portraitSabio:  'https://i.ibb.co/FqfDcN61/Captura-de-pantalla-2026-04-01-001846.png',
                portraitKyubi:  'https://i.ibb.co/tTJZ2gKH/descarga-29.jpg',
                portraitBaryon: 'https://i.ibb.co/zTDfzbwN/Captura-de-pantalla-2026-04-01-001421.png',
                passive: { name: 'Camino Ninja', description: 'Al inicio de cada ronda: 20% Modo Baryon (vel+10, daño doble, cargas=daño causado), 40% Modo Kyubi (50% esquivar, al esquivar gana prioridad), 60% Modo Sabio (cargas=daño recibido). Solo una transformacion activa a la vez.' },
                abilities: [
                    { name: 'Kage Bunshin no Jutsu', type: 'basic', cost: 0, chargeGain: 0, damage: 1, target: 'single', effect: 'kage_bunshin_naruto', description: 'Realiza de 1 a 4 golpes. Genera 1 carga por cada golpe acertado.' },
                    { name: 'Rasengan', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'single', effect: 'rasengan_naruto', description: 'Causa 3 daño. Si el objetivo tiene Buffs activos, aplica Mega Aturdimiento 2T.' },
                    { name: 'Futon Rasenshuriken', type: 'special', cost: 6, chargeGain: 0, damage: 5, target: 'aoe', effect: 'rasenshuriken_naruto', description: 'Causa 5 AOE. Aplica Debilitar y Sangrado a los objetivos. Naruto gana un turno adicional.' },
                    { name: 'Voluntad de la Hoja', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'single', effect: 'voluntad_hoja_naruto', description: 'Elimina el 50% del HP del objetivo y aplica Quemadura de 5 HP por 2 turnos.' }
                ]
            },

            'Jon Snow': {
                hp: 20, maxHp: 20, speed: 83, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                jonSnowReviveUsed: false,
                portrait: 'https://i.ibb.co/NgZhjQd7/Whats-App-Image-2026-03-31-at-1-17-09-PM.jpg',
                passive: { name: 'El Rey Prometido', description: 'Cada vez que un enemigo usa AOE, el equipo aliado gana Esquiva Área 2T y 1 carga. Al morir, 50% de revivir (solo una vez) con 15 HP y 18 cargas en la siguiente ronda.' },
                abilities: [
                    { name: 'Garra Bastarda', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'garra_bastarda_jon', description: 'Causa 2 daño + 1 adicional por cada buff activo en el objetivo.' },
                    { name: 'Ghost', type: 'special', cost: 5, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_ghost', description: 'Invoca a Ghost.' },
                    { name: 'Carga del Lobo', type: 'special', cost: 6, chargeGain: 0, damage: 5, target: 'single', effect: 'carga_lobo_jon', description: 'Causa 5 daño. 30% de aplicar Mega Aturdimiento al objetivo.' },
                    { name: 'El Rey del Norte', type: 'over', cost: 18, chargeGain: 0, damage: 0, target: 'self', effect: 'rey_del_norte_jon', description: 'Todos los aliados ejecutan su Over sin costo. Daños ST se aplican a objetivos aleatorios.' }
                ]
            },

            'Antares': {
                hp: 25, maxHp: 25, speed: 95, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                antaresTransformed: false, antaresTransformTurns: 0,
                portrait: 'https://i.ibb.co/Fprz6Sh/Captura-de-pantalla-2026-04-06-101230.png',
                transformPortrait: 'https://i.ibb.co/t1CXkkY/Captura-de-pantalla-2026-04-06-101549.png',
                passive: { name: 'Monarca de la Destruccion', description: 'Por cada Buff aplicado sobre un enemigo, aplica 2 daño directo sobre ese enemigo (Antares genera 1 carga por ese daño). Inmune a Quemaduras y Quemadura Solar. Cada vez que un enemigo recibe daño directo (quemaduras, veneno, efectos), Antares genera 1 carga. El daño por golpe no cuenta.' },
                abilities: [
                    { name: "Dragon's Fear", type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'aoe', effect: 'dragons_fear_antares', description: "Causa 1 AOE. 50% de aplicar Miedo 2T a los objetivos. 30% de daño triple sobre enemigos con Miedo o Quemaduras." },
                    { name: 'Tormenta de Fuego', type: 'special', cost: 5, chargeGain: 0, damage: 3, target: 'single', effect: 'tormenta_fuego_antares', description: 'Causa 3 daño al objetivo. Aplica Quemadura 2HP a todos los enemigos. Si el enemigo tiene Buff activo, la Quemadura es de 5HP en lugar de 2HP.' },
                    { name: 'Dragon de la Destruccion', type: 'special', cost: 8, chargeGain: 0, damage: 4, target: 'self', effect: 'dragon_destruccion_antares', description: 'Causa 4 AOE y se transforma 3 turnos. Transformado: recupera 5 HP por turno. El daño directo (por efectos, quemaduras, veneno, etc.) que reciben los enemigos se duplica.' },
                    { name: 'Aliento de la Destruccion', type: 'over', cost: 12, chargeGain: 0, damage: 5, target: 'aoe', effect: 'aliento_destruccion_antares', description: 'Causa 5 AOE. Ignora Esquiva Área (buff y pasiva). Transformado en Dragon de la Destruccion: aplica Quemadura 5HP a los objetivos.' }
                ]
            },

            'Sasuke Uchiha': {
                hp: 20, maxHp: 20, speed: 87, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                sasukeEvasionUsedThisRound: false,
                portrait: 'https://i.ibb.co/nNQ9Q0MB/Captura-de-pantalla-2026-04-06-105515.png',
                passive: { name: 'Venganza Eterna', description: 'Cada vez que un aliado es derrotado, Sasuke genera 20 cargas y gana 1 turno adicional. La primera vez por ronda que vaya a recibir un Special u OVER, esquiva ese ataque y el atacante recibe 5 daño directo.' },
                abilities: [
                    { name: 'Corte: Espada Kusanagi', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'single', effect: 'kusanagi_sasuke', description: 'Causa 1 daño. Aplica Agotamiento 3 turnos al objetivo.' },
                    { name: 'Chidori', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'single', effect: 'chidori_sasuke', description: 'Causa 4 daño. Roba hasta 4 cargas del objetivo. Si tras el robo el objetivo queda en 0 cargas, causa daño crítico.' },
                    { name: 'Kirin', type: 'special', cost: 6, chargeGain: 0, damage: 6, target: 'single', effect: 'kirin_sasuke', description: 'Causa 6 daño. Ignora Provocación y Mega Provocación. Si elimina al objetivo, reduce 10 cargas a todos los enemigos. 50% de crítico si el objetivo tiene menos de 5 cargas.' },
                    { name: 'Flecha de Indra', type: 'over', cost: 10, chargeGain: 0, damage: 10, target: 'single', effect: 'flecha_indra_sasuke', description: 'Causa 10 daño. 50% de dividirse y golpear a un enemigo aleatorio adicional. Sasuke gana 1 turno adicional.' }
                ]
            },

            'Douma': {
                hp: 25, maxHp: 25, speed: 88, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/BXDJNW7/Whats-App-Image-2026-04-07-at-2-47-47-PM.jpg',
                passive: { name: 'Luna Superior Dos', description: 'Al aplicar Congelacion: cura 2 HP a aliado aleatorio. Al aplicar Megacongelacion: cura 4 HP. Al expirar/limpiar Congelacion: equipo aliado +1 carga. Al expirar/limpiar Megacongelacion: equipo aliado +3 cargas.' },
                abilities: [
                    { name: 'Abanicos de Hielo', type: 'basic', cost: 0, chargeGain: 1, damage: 3, target: 'single', effect: 'abanicos_hielo_douma', description: 'Causa 3 daño. 10% de aplicar Megacongelacion al objetivo.' },
                    { name: 'Estatua de Hielo', type: 'special', cost: 3, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_douma_hielo', description: 'Invoca 1 Douma de Hielo.' },
                    { name: 'Niebla Congelante', type: 'special', cost: 8, chargeGain: 0, damage: 5, target: 'aoe', effect: 'niebla_congelante_douma', description: 'Causa 5 AOE. Critico garantizado en objetivos con Congelacion o Megacongelacion. 50% de aturdir a los objetivos.' },
                    { name: 'Loto de Hielo Celestial', type: 'over', cost: 14, chargeGain: 0, damage: 0, target: 'self', effect: 'summon_gigante_hielo', description: 'Invoca al Gigante de Hielo.' }
                ]
            },

            'Jaina Proudmoore': {
                hp: 20, maxHp: 20, speed: 79, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/PGkg0qnK/Whats-App-Image-2026-04-07-at-2-46-11-PM.jpg',
                passive: { name: 'Archimaga del Kirin Tor', description: 'Cada vez que se aplica un debuff a un enemigo, también aplica Congelacion en ese enemigo. 100% de crítico sobre enemigos con Congelacion activa.' },
                abilities: [
                    { name: 'Descarga de Hielo', type: 'basic', cost: 0, chargeGain: 2, damage: 2, target: 'single', effect: 'descarga_hielo_jaina', description: 'Causa 2 daño + aplica Congelacion. Si el objetivo ya tenía Congelacion, 50% de daño triple.' },
                    { name: 'Anillo de Escarcha', type: 'special', cost: 5, chargeGain: 0, damage: 2, target: 'aoe', effect: 'anillo_escarcha_jaina', description: 'Causa 2 AOE + aplica Congelacion. Si ya tenían Congelacion: reemplaza por Megacongelacion. Si ya tenían Megacongelacion: daño triple.' },
                    { name: 'Bloque de Hielo', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'bloque_hielo_jaina', description: 'Disipar debuffs del equipo aliado. Aplica Proteccion Sagrada 2T al equipo aliado.' },
                    { name: 'Invierno sin Remordimientos', type: 'over', cost: 12, chargeGain: 0, damage: 2, target: 'aoe', effect: 'invierno_jaina', description: 'Causa 2 AOE + aplica Megacongelacion. Si tenía Congelacion: reduce cargas a 0. Si tenía Megacongelacion: daño triple y -20 velocidad permanente.' }
                ]
            },

                'Gaara': {
                hp: 25, maxHp: 25, speed: 85, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/dJ5TWsF0/Captura-de-pantalla-2026-04-08-103556.png',
                passive: { name: 'Defensa Absoluta', description: 'Al recibir daño, Gaara consume cargas equivalentes al daño (solo si tiene cargas). Al inicio de ronda aplica Buff Escudo Sagrado al aliado con menos HP. Al final de cada ronda genera 5 cargas.' },
                abilities: [
                    { name: 'Garra de Arena', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'garra_arena_gaara', description: 'Causa 2 daño. 50% de aplicar Debuff Aturdimiento. Genera 1 carga adicional por cada debuff activo en el objetivo.' },
                    { name: 'Arenas Movedizas', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'aoe', effect: 'arenas_movedizas_gaara', description: 'Causa 2 AOE. Enemigos golpeados pierden 10% velocidad por 3 rondas. Si el objetivo tiene 80 vel o menos, roba 2 cargas de ese objetivo.' },
                    { name: 'Granizo de Arena Imperial', type: 'special', cost: 6, chargeGain: 0, damage: 3, target: 'aoe', effect: 'granizo_arena_gaara', description: 'Causa 3 AOE. Ignora Esquiva Área y Mega Provocación. Triple daño si vel ≤ 70. Invocaciones golpeadas tienen 50% de ser eliminadas sin activar su pasiva.' },
                    { name: 'Sabaku Taisō', type: 'over', cost: 10, chargeGain: 0, damage: 0, target: 'single', effect: 'sabaku_taiso_gaara', description: 'Elimina al objetivo. Revive con 50% HP y 0 cargas en 2 rondas.' }
                ]
            },
 
            'Rey de la Noche': {
                hp: 15, maxHp: 15, speed: 82, charges: 0, team: 'team2',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                immuneToMiedo: true,
                ignoresProvocacion: true,
                portrait: 'https://i.ibb.co/fBN5rMW/Captura-de-pantalla-2026-04-08-105928.png',
                passive: { name: 'Invierno Eterno', description: 'Inmune a Miedo, Quemaduras y Sangrado. Al aplicar Congelacion/Megacongelacion en enemigo: 2 daño directo. Ignora Provocacion, Megaprovocacion y Sigilo.' },
                abilities: [
                    { name: 'Lanza de Hielo', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'lanza_hielo_rdn', description: 'Causa 1 daño. Si objetivo tiene Prov/MegaProv/Sigilo: -5 vel. Si tenía Congelacion/Megacongelacion: -2 cargas. Si es invocacion: el equipo aliado toma el control.' },
                    { name: 'Tormenta Invernal', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'aoe', effect: 'tormenta_invernal_rdn', description: 'Causa 2 AOE. Aplica Congelacion. 50% de aplicar Posesion.' },
                    { name: 'Toque de la Muerte', type: 'special', cost: 10, chargeGain: 0, damage: 8, target: 'single', effect: 'toque_muerte_rdn', description: 'Causa 8 daño. Aplica Megacongelacion. Si el enemigo muere, revive como aliado con 50% HP y 0 cargas.' },
                    { name: 'Frío Eterno', type: 'over', cost: 16, chargeGain: 0, damage: 5, target: 'aoe', effect: 'frio_eterno_rdn', description: 'Causa 5 AOE. Critico sobre objetivos con Congelacion. Triple daño sobre objetivos con Megacongelacion. Si el enemigo muere, revive como aliado con 50% HP y 0 cargas.' }
                ]
            },

            'Darkseid': {
                hp: 30, maxHp: 30, speed: 92, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/spKV3tyN/Captura-de-pantalla-2026-04-14-165843.png',
                passive: { name: 'Efecto Omega', description: 'Mega Provocación permanente. Daño AOE recibido reducido 50%. Cada vez que Darkseid recibe daño por ataque enemigo, roba 1 HP del atacante.' },
                abilities: [
                    { name: 'Toque de la Antivida', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'toque_antivida_darkseid', description: 'Roba 0-4 HP del objetivo. Genera 0-4 cargas adicionales.' },
                    { name: 'Rayo de la Desintegración', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'single', effect: 'rayo_desintegracion_darkseid', description: 'Causa 3 daño. 50% golpe crítico. Si es crítico genera 2 cargas por cada enemigo (personaje e invocación).' },
                    { name: 'Sanción Omega', type: 'special', cost: 6, chargeGain: 0, damage: 0, target: 'self', effect: 'sancion_omega_darkseid', description: 'Elimina hasta 3 invocaciones enemigas. Causa 3 daño directo por cada invocación eliminada sobre 1 enemigo aleatorio.' },
                    { name: 'Ecuación de la Antivida', type: 'over', cost: 14, chargeGain: 0, damage: 0, target: 'single', effect: 'ecuacion_antivida_darkseid', description: 'Reduce 50%-90% el HP del objetivo. Darkseid recupera el mismo HP que el objetivo perdió.' }
                ]
            },

            'Escanor': {
                hp: 30, maxHp: 30, speed: 82, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                escanorTheOneActive: false,
                escanorTheOneRoundsLeft: 0,
                portrait: 'https://i.ibb.co/rTzCsFQ/Captura-de-pantalla-2026-04-14-173602.png',
                transformPortrait: 'https://i.ibb.co/h1Y44qfp/Captura-de-pantalla-2026-04-14-173813.png',
                passive: { name: 'Orgullo del León', description: 'Enemigos con Quemadura Solar solo pueden atacar ST a Escanor. Fin de ronda: +1 HP máximo por enemigo con QS activa. Inicio de turno: +1 HP por enemigo con QS activa. 50% de ganar 1 carga al aplicar QS a un enemigo.' },
                abilities: [
                    { name: 'Cruel Sun', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'cruel_sun_escanor', description: 'Causa 2 daño. Aplica Quemadura Solar 2T. Si el objetivo ya tenía QS, aplica QS 2T a otros 2 enemigos aleatorios.' },
                    { name: 'Pride Flare', type: 'special', cost: 4, chargeGain: 0, damage: 3, target: 'single', effect: 'pride_flare_escanor', description: 'Causa 3 daño. +1 daño directo a 3 enemigos aleatorios por cada QS activa. +3 cargas por cada QS activa.' },
                    { name: 'The One', type: 'special', cost: 10, chargeGain: 15, damage: 0, target: 'self', effect: 'the_one_escanor', description: 'Transformación 2 rondas. Recupera 50% HP máximo. Mientras dure: -50% daño recibido y absorbe daño dirigido a aliados.' },
                    { name: 'Final Prominence', type: 'over', cost: 15, chargeGain: 0, damage: 5, target: 'single', effect: 'final_prominence_escanor', description: 'Escanor recupera 5 HP. Causa 5 + HP actual de Escanor de daño. 50% del daño total sobre 2 enemigos aleatorios.' }
                ]
            },

            'Yorichi': {
                hp: 25, maxHp: 25, speed: 90, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/szT2tjJ/Captura-de-pantalla-2026-04-14-174630.png',
                passive: { name: 'Mundo Transparente', description: 'Si Yorichi golpea un objetivo con QS activa, aplica debuff Silenciar. Yorichi tiene 100% de probabilidad de golpe crítico en objetivos con QS activa. Cuando un enemigo con QS recibe daño, Yorichi genera 2 cargas y cura 2 HP a un aliado aleatorio.' },
                abilities: [
                    { name: 'Corte Solar', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'corte_solar_yorichi', description: 'Causa 2 daño. 50% de aplicar QS. Si el objetivo ya tenía QS, genera 1 carga al equipo aliado.' },
                    { name: 'Respiración Solar Pura', type: 'special', cost: 3, chargeGain: 0, damage: 2, target: 'aoe', effect: 'respiracion_solar_yorichi', description: 'Antes de golpear, disipa todos los buffs de los enemigos. Causa 2 AOE. Aplica debuff Quemadura de 2 HP.' },
                    { name: 'Diosa del Sol', type: 'special', cost: 12, chargeGain: 0, damage: 0, target: 'self', effect: 'diosa_sol_yorichi', description: 'Realiza 6 ataques básicos sobre enemigos de manera aleatoria, generando y aplicando los efectos correspondientes de cada golpe.' },
                    { name: 'Las Trece Formas del Sol', type: 'over', cost: 13, chargeGain: 0, damage: 13, target: 'single', effect: 'trece_formas_sol_yorichi', description: 'Causa 13 daño. Si el objetivo tenía QS activa antes de ejecutar este ataque: Yorichi gana 6 cargas y un turno adicional.' }
                ]
            },

            'Marik Ishtar': {
                hp: 20, maxHp: 20, speed: 80, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/Lbm8MJ1/Captura-de-pantalla-2026-04-14-174220.png',
                passive: { name: 'Reino de las Sombras', description: 'Inicio de ronda: 50% de aplicar Aura Oscura a cada aliado. Cada vez que una invocación de ambos equipos es eliminada, Marik genera 3 cargas. Mientras el Dragón Alado de Ra o Ra Modo Fénix estén activos, Marik no puede recibir daño por golpes.' },
                abilities: [
                    { name: 'Orden de los Cuidatumba', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'single', effect: 'orden_cuidatumba_marik', description: 'Causa 1 daño. Inflige +7 de daño adicional a invocaciones.' },
                    { name: 'Canto del Sol', type: 'special', cost: 0, chargeGain: 0, damage: 0, target: 'self', effect: 'canto_sol_marik', description: 'Invoca el Huevo del Sol en el equipo enemigo. Se bloquea si el Huevo del Sol ya está activo en el campo.' },
                    { name: 'Profecia del Faraon', type: 'special', cost: 10, chargeGain: 0, damage: 4, target: 'aoe', effect: 'profecia_faraon_marik', description: 'Causa 4 AOE. Aplica debuff Quemadura Solar a todos los enemigos. Causa +1 daño adicional por cada invocación activa en ambos equipos.' },
                    { name: 'Inmortal Fénix', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'self', effect: 'inmortal_fenix_marik', description: 'Solo usable si hay un Dragón Alado de Ra en campo. Elimina al Dragón Alado de Ra e invoca al Dragón Alado de Ra Modo Fénix.' }
                ]
            },

            'Daemon Targaryen': {
                hp: 20, maxHp: 20, speed: 82, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/nqrW6Wr7/Daemon-Targaryen.jpg',
                transformPortrait: 'https://i.ibb.co/wrpFp6y8/Whats-App-Image-2026-04-20-at-12-03-43-PM.jpg',
                passive: { name: 'Principe Rebelde', description: 'Al llegar a 0 HP, elimina un enemigo aleatorio. Si golpea a un enemigo con Provocacion o Mega Provocacion activa, aplica transformación Jinete de Dragones 2T (daño triple, ignora Provocacion/MegaProvocacion).' },
                abilities: [
                    { name: 'Hermana Oscura', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'hermana_oscura_daemon', description: 'Causa 2 daño. Aplica debuff Debilitar al objetivo. Si el objetivo tiene Provocacion o Mega Provocacion activa antes de atacar, este ataque tiene 100% de probabilidad de crítico.' },
                    { name: 'Furia de Caraxes', type: 'special', cost: 4, chargeGain: 0, damage: 4, target: 'single', effect: 'furia_caraxes_daemon', description: 'Causa 4 daño. Si el objetivo tiene Provocacion o Mega Provocacion activa antes de atacar, aplica Quemaduras de 3 HP a todo el equipo enemigo.' },
                    { name: 'Provocacion del Principe', type: 'special', cost: 7, chargeGain: 0, damage: 2, target: 'single', effect: 'provocacion_principe_daemon', description: 'Disipa todos los buffs del equipo enemigo. Causa 2 daño al objetivo.' },
                    { name: 'Ojo de Dioses', type: 'over', cost: 12, chargeGain: 0, damage: 5, target: 'single', effect: 'ojo_dioses_daemon', description: 'Causa 5 daño. Si el objetivo tiene Provocacion o Mega Provocacion activa, este ataque tiene 100% de probabilidad de crítico.' }
                ]
            },

            'Manigoldo': {
                hp: 20, maxHp: 20, speed: 86, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/1Y1x4HC6/descarga-4.jpg',
                passive: { name: 'Réquiem de los Caídos', description: 'Manigoldo no puede recibir daño directo (por efectos y/o debuffs), solo puede recibir daño por golpes. Al final de cada ronda genera 3 cargas por cada aliado y/o enemigo eliminado en la partida.' },
                abilities: [
                    { name: 'Fuego Fatuo', type: 'basic', cost: 0, chargeGain: 1, damage: 2, target: 'single', effect: 'fuego_fatuo_manigoldo', description: 'Causa 2 daño. 25% de robar 2 HP. 25% de robar 2 cargas. Si Manigoldo tiene 50% HP o menos, ambos efectos ocurren con 100% de probabilidad.' },
                    { name: 'Explosión de Almas', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'self', effect: 'explosion_almas_manigoldo', description: 'Causa 1 daño directo a todos los enemigos por cada Buff activo en ambos equipos. Genera 1 carga por cada debuff activo en ambos equipos.' },
                    { name: 'Prisión del Yomotsu', type: 'special', cost: 7, chargeGain: 4, damage: 5, target: 'single', effect: 'prision_yomotsu_manigoldo', description: 'Causa 5 daño. 50% de aplicar entre 1 y 3 debuffs aleatorios al objetivo.' },
                    { name: 'Ondas Infernales', type: 'over', cost: 12, chargeGain: 0, damage: 10, target: 'single', effect: 'ondas_infernales_manigoldo', description: 'Causa 10 daño. Si el objetivo sobrevive, aplica Mega Aturdimiento y roba todas sus cargas.' }
                ]
            },

            'Kyo Kusanagi': {
                hp: 20, maxHp: 20, speed: 82, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/rfqFGmRg/The-King-of-Fighters-Team-Sacred-Treasures-Ai-Image-Leader-Kagura-Chizru-Member-kusanagi.jpg',
                passive: { name: 'Llamarada Kusanagi', description: 'Cuando un enemigo ejecuta un ataque AOE, aplica Quemaduras de 2 HP por cada aliado golpeado sobre el atacante. Aliados con Aura de Fuego reciben 50% menos daño por golpe de ataques enemigos. Al inicio de cada ronda aplica Aura de Fuego a 2 aliados aleatorios.' },
                abilities: [
                    { name: 'Yami Barai', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'single', effect: 'yami_barai_kyo', description: 'Causa 1 daño. Bloquea los movimientos de categoria AOE del objetivo durante 1 turno.' },
                    { name: 'Oniyaki', type: 'special', cost: 3, chargeGain: 0, damage: 1, target: 'single', effect: 'oniyaki_kyo', description: 'Causa 1 daño al objetivo. Roba 2 HP y 2 cargas de todos los enemigos con debuff Quemaduras activo.' },
                    { name: 'Aragami', type: 'special', cost: 7, chargeGain: 0, damage: 4, target: 'self', effect: 'aragami_kyo', description: 'Causa 4 daño a todos los objetivos con debuff Quemaduras activo.' },
                    { name: 'Dokugami', type: 'over', cost: 10, chargeGain: 0, damage: 3, target: 'self', effect: 'dokugami_kyo', description: 'Causa 3 daño a todos los objetivos con Quemaduras activo. Causa +3 daño directo adicional a cada enemigo golpeado por cada debuff Quemaduras activo en el equipo enemigo.' }
                ]
            },

            'Iori Yagami': {
                hp: 20, maxHp: 20, speed: 83, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                portrait: 'https://i.ibb.co/v6TPGkVH/descarga-7.jpg',
                passive: { name: 'Sangre Maldita', description: 'Al inicio de cada ronda, 25% de probabilidad de aumentar VEL 20% y generar 10 cargas (solo dura esa ronda).' },
                abilities: [
                    { name: 'Llamas Purpuras', type: 'basic', cost: 0, chargeGain: 1, damage: 1, target: 'single', effect: 'llamas_purpuras_iori', description: 'Causa 1 daño. Cada aliado tiene 50% de probabilidad de robar 1 carga del objetivo.' },
                    { name: 'Yuri Ori', type: 'special', cost: 5, chargeGain: 0, damage: 5, target: 'single', effect: 'yuri_ori_iori', description: 'Causa 5 daño. Daño doble si el objetivo tiene Provocacion o Mega Provocacion. El equipo aliado genera 3 cargas.' },
                    { name: 'Aoi Hana', type: 'special', cost: 5, chargeGain: 0, damage: 5, target: 'single', effect: 'aoi_hana_iori', description: 'Causa 5 daño. Elimina 1 carga del equipo enemigo por cada buff o debuff activo sobre el objetivo. El equipo aliado genera 3 cargas.' },
                    { name: 'Ya Otome', type: 'over', cost: 10, chargeGain: 0, damage: 5, target: 'single', effect: 'ya_otome_iori', description: 'Causa 5 daño. Ejecuta Yuri Ori sobre el objetivo y luego ejecuta Aoi Hana sobre el objetivo con cinematica de Over.' }
                ]
            },

            'Tirion Fordring': {
                hp: 25, maxHp: 25, speed: 83, charges: 0, team: 'team1',
                statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
                tirionLowHpTriggered: false,
                portrait: 'https://i.ibb.co/mrcVTbh7/Whats-App-Image-2026-04-16-at-3-22-08-PM.jpg',
                passive: { name: 'Paladín de la Mano de Plata', description: 'Si llega a 10 HP: Protección Sagrada + Escudo Sagrado + 20 cargas (solo una vez). Cada vez que un enemigo usa Over: +3 HP y +3 cargas al equipo aliado.' },
                abilities: [
                    { name: 'Luz del Alba', type: 'basic', cost: 0, chargeGain: 2, damage: 1, target: 'aoe', effect: 'luz_del_alba_tirion', description: 'Causa 1 AOE. Cura 1 HP al equipo aliado. Aplica Aura de Luz al equipo aliado.' },
                    { name: 'Protección de la Luz', type: 'special', cost: 4, chargeGain: 0, damage: 0, target: 'ally_single', effect: 'proteccion_luz_tirion', description: 'Cura 3 HP al objetivo aliado. Disipa sus debuffs. Por cada debuff disipado, el objetivo genera 2 cargas.' },
                    { name: 'Portador de Cenizas', type: 'special', cost: 10, chargeGain: 0, damage: 1, target: 'aoe', effect: 'portador_cenizas_tirion', description: 'Causa 2 AOE. Cura al equipo aliado el 50% del HP actual de Tirion. Toma control de todos los personajes revividos por pasiva o habilidad.' },
                    { name: 'Una Luz en la Oscuridad', type: 'over', cost: 15, chargeGain: 0, damage: 0, target: 'self', effect: 'luz_oscuridad_tirion', description: 'Solo usable si Tirion es el único aliado vivo. Revive a todos los aliados con 20 HP y 10 cargas.' }
                ]
            },
        };
