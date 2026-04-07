// ==================== ESTADO DEL JUEGO ====================
        // ==================== AUDIO MANAGER ====================
        const audioManager = {
            currentTrack: null,
            volume: 0.5,
            muted: false,

            play: function(id) {
                // If same track already playing, do nothing (avoid restart)
                if (this.currentTrack === id) {
                    const cur = document.getElementById(id);
                    if (cur && !cur.paused) return;
                }
                // Stop previous track
                if (this.currentTrack && this.currentTrack !== id) {
                    const prev = document.getElementById(this.currentTrack);
                    if (prev) { try { prev.pause(); prev.currentTime = 0; } catch(e) {} }
                }
                this.currentTrack = id;
                if (this.muted) return;
                const el = document.getElementById(id);
                if (!el) return;
                el.volume = this.volume;
                el.play().catch(function(err) {
                    console.warn('Audio play failed for ' + id + ':', err.message);
                });
            },

            stop: function() {
                if (this.currentTrack) {
                    const el = document.getElementById(this.currentTrack);
                    if (el) { el.pause(); el.currentTime = 0; }
                    this.currentTrack = null;
                }
            },

            playRandomBattle: function() {
                // Stop any current track
                if (this.currentTrack) {
                    const prev = document.getElementById(this.currentTrack);
                    if (prev) { try { prev.pause(); prev.currentTime = 0; } catch(e) {} }
                }
                const trackNum = Math.floor(Math.random() * 5) + 1;
                const trackId = 'audioBattle' + trackNum;
                this.currentTrack = trackId;
                if (this.muted) return;
                const el = document.getElementById(trackId);
                if (!el) return;
                el.volume = this.volume;
                el.play().catch(function(err) {
                    console.warn('Battle audio play failed:', err.message);
                });
            },

            stopBattleMusic: function() {
                for (let i = 1; i <= 5; i++) {
                    const el = document.getElementById('audioBattle' + i);
                    if (el) { try { el.pause(); el.currentTime = 0; } catch(e) {} }
                }
                if (this.currentTrack && this.currentTrack.startsWith('audioBattle')) {
                    this.currentTrack = null;
                }
            },

            selectSfxUrl: 'audio/Menu%20Select%20Sound%20-%20Super.mp3',

            playSelect: function() {
                if (this.muted) return;
                try {
                    const sfx = new Audio(this.selectSfxUrl);
                    sfx.volume = 0.6;
                    sfx.play().catch(function() {});
                } catch(e) {}
            },

            toggleMute: function() {
                this.muted = !this.muted;
                if (this.muted) {
                    ['audioMenu','audioBattle1','audioBattle2','audioBattle3','audioBattle4','audioBattle5','audioSelect'].forEach(function(id) {
                        const e = document.getElementById(id);
                        if (e) e.pause();
                    });
                } else {
                    if (audioManager.currentTrack) audioManager.play(audioManager.currentTrack);
                }
                const btn = document.getElementById('audioToggleBtn');
                if (btn) btn.textContent = this.muted ? '🔇' : '🔊';
            }
        };

        // Start menu music on first user interaction (browser autoplay policy)
        let audioStarted = false;
        function tryStartMenuMusic() {
            if (!audioStarted) {
                audioStarted = true;
                audioManager.play('audioMenu');
            }
        }
        document.addEventListener('click', tryStartMenuMusic, { once: true });
        document.addEventListener('keydown', tryStartMenuMusic, { once: true });
        // ==================== END AUDIO MANAGER ====================

        var gameState = {
            characters: {},
            turnOrder: [],
            gameMode: 'multi',
            aiTeam: null,
            currentTurnIndex: 0,
            battleLog: [],
            selectedCharacter: null,
            selectedAbility: null,
            gameOver: false,
            currentRound: 1,
            turnsInRound: 0,
            aliveCountAtRoundStart: 0, // Snapshot al inicio de ronda para no desincronizar
            summons: {} // Objeto para almacenar invocaciones activas
        };

        // Datos de invocaciones
        const summonData = {
            'Igris': {
                name: 'Igris',
                hp: 5, maxHp: 5, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/T13zZdKD/Captura_de_pantalla_2026_03_11_145542.png',
                passive: 'Comandante Rojo Sangriento: Al final de cada ronda causa 2 de daño AOE a todos los enemigos (incluyendo invocaciones). Al final de cada ronda elimina una invocación enemiga aleatoria del campo.'
            },
            'Iron': {
                name: 'Iron',
                hp: 8, maxHp: 8, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/7hZFpH5G/Captura_de_pantalla_2026_03_11_145721.png',
                passive: 'Voluntad de Acero: absorbe todo el daño por golpe que fuera a recibir su invocador'
            },
            'Tusk': {
                name: 'Tusk',
                hp: 6, maxHp: 6, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/Wz1BQNdz/Captura_de_pantalla_2026_03_11_145950.png',
                passive: 'Hipno de Fuego: Duplica el daño causado por debuff quemaduras sobre los enemigos'
            },
            'Beru': {
                name: 'Beru',
                hp: 6, maxHp: 6, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/zvGs9zyZ/Captura_de_pantalla_2026_03_11_150049.png',
                passive: 'Garras del Abismo: Al final de cada ronda causa 5 de daño en un enemigo aleatorio'
            },
            'Bellion': {
                name: 'Bellion',
                hp: 10, maxHp: 10, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/XqYRTjpm/Captura_de_pantalla_2026_03_11_150350.png',
                passive: 'General de Ashborn: La primera vez por ronda que un ataque especial u Over es activado por un enemigo, cancela ese movimiento.'
            },
            'Kaisel': {
                name: 'Kaisel',
                hp: 7, maxHp: 7, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/GtmWZL41/Captura_de_pantalla_2026_03_11_151735.png',
                passive: 'Maldicion de Kaisel: Al final de cada ronda reduce 3 cargas a todos los enemigos.'
            },
            'Kamish': {
                name: 'Kamish',
                hp: 30, maxHp: 30, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/RhZkjSNk/Captura_de_pantalla_2026_03_11_152341.png',
                passive: 'Terror de las Sombras: Mega provocacion. Cada vez que es golpeado por un enemigo, causa quemaduras de 4 puntos sobre el enemigo atacante, durante 1 turno.'
            },
            'Sindragosa': {
                name: 'Sindragosa',
                hp: 10, maxHp: 10, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/T1G26Gxf/Captura_de_pantalla_2026_03_15_003004.png',
                passive: 'Muerte de la Magia: Mega provocacion. Genera un punto para todo el equipo aliado cada vez que recibe daño.'
            },
            'Kel Thuzad': {
                name: 'Kel Thuzad',
                hp: 8, maxHp: 8, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/J0m7Lm8W/Captura_de_pantalla_2026_03_15_003028.png',
                passive: 'Aliado de la Muerte: Cura 2 hp del equipo aliado al final de la ronda'
            },
            'Darion Morgraine': {
                name: 'Darion Morgraine',
                hp: 8, maxHp: 8, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/26njMysy/Captura_de_pantalla_2026_03_15_003106.png',
                passive: 'Sirviente de la Muerte: Al final de cada ronda, aumenta la velocidad del equipo aliado en 10 puntos.'
            },
            'Bolvar Fordragon': {
                name: 'Bolvar Fordragon',
                hp: 8, maxHp: 8, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/mkRZsR4R/Captura_de_pantalla_2026_03_15_003129.png',
                passive: 'Castigo de la Muerte: Al final de cada ronda, inflige 3 daño a todos los enemigos (personajes e invocaciones).'
            },
            'Tirion Fordring': {
                name: 'Tirion Fordring',
                hp: 30, maxHp: 30, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/qq0BT0rT/Captura_de_pantalla_2026_03_15_003309.png',
                passive: 'Una luz en la Oscuridad: Mega provocacion. Cura 5 HP por turno al equipo aliado, genera 5 puntos de Carga por turno al equipo aliado.'
            },
            'Señuelo': {
                name: 'Señuelo',
                hp: 5, maxHp: 5, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/1tbCn5Xm/Captura_de_pantalla_2026_03_15_004506.png',
                passive: 'Distraccion de emergencia: Al morir genera 2 puntos de carga al equipo aliado'
            },
            'Drogon': {
                name: 'Drogon', effect: 'mega_prov_aoe_dmg', megaProvocation: true,
                hp: 15, maxHp: 15, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/Gtr3CrRL/Captura_de_pantalla_2026_03_15_002747.png',
                passive: 'Sombra de Fuego: Mega provocacion. Inflige 3 puntos de Daño a todo el equipo enemigo al final de cada ronda'
            },
            'Rhaegal': {
                name: 'Rhaegal', effect: 'burn_team',
                hp: 8, maxHp: 8, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/8cDkSDGT/Captura_de_pantalla_2026_03_15_002820.png',
                passive: 'Furia Esmeralda: Al final de cada ronda aplica debuff Quemadura de 1 hp a todo el equipo enemigo'
            },
            'Viserion': {
                name: 'Viserion', effect: 'heal_team',
                hp: 6, maxHp: 6, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/2ymjDmYz/Captura_de_pantalla_2026_03_15_002923.png',
                passive: 'Llama de Oro: Al final de cada ronda cura 2 hp a todo el equipo aliado'
            },
            'Abu el-Hol Sphinx': {
                name: 'Abu el-Hol Sphinx',
                hp: 8, maxHp: 8, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/6qw6XwKQ/Captura_de_pantalla_2026_03_15_002404.png',
                passive: 'Al final de cada ronda todos los enemigos con Quemadura Solar pierden 2 cargas. Mientras permanezca activa Ozymandias es inmune a Debuffs.'
            },
            'Ramesseum Tentyris': {
                name: 'Ramesseum Tentyris',
                hp: 20, maxHp: 20, summoner: null, team: null, statusEffects: [],
                img: 'https://i.postimg.cc/qq0BT0rv/Captura_de_pantalla_2026_03_15_002546.png',
                passive: 'Al final de cada ronda, si hay enemigos sin debuff activo quemadura solar, aplica debuff Quemadura solar sobre esos enemigos. Cada vez que un debuff quemadura solar es aplicado sobre 1 enemigo, todos los aliados de tu equipo recuperan 2 HP por debuff Quemadura Solar aplicado. Mientras permanezca activa Ozymandias es inmune al daño por golpes.'
            },
            'Fake Black': {
                name: 'Fake Black',
                hp: 2, maxHp: 2, summoner: null, team: null, statusEffects: [],
                img: 'https://i.ibb.co/V0N5r6WR/Whats-App-Image-2026-03-31-at-1-22-44-PM.jpg',
                passive: 'Explosion: Al morir causa 3 puntos de daño AOE al equipo enemigo y genera 2 puntos de carga en el equipo aliado.'
            },

            'Ghost': {
                name: 'Ghost',
                hp: 6, maxHp: 6, summoner: null, team: null, statusEffects: [],
                img: 'https://i.ibb.co/QvK9cxfc/Whats-App-Image-2026-03-31-at-1-19-10-PM.jpg',
                passive: 'Huargo Bastardo: Al final de cada ronda inflige 1 daño a cada enemigo y aplica Veneno 1T. Al final de cada ronda elimina una invocacion del equipo enemigo.'
            },

            'Douma de Hielo': {
                name: 'Douma de Hielo',
                hp: 8, maxHp: 8, summoner: null, team: null, statusEffects: [],
                img: 'https://i.ibb.co/Q3Yc2jqv/Whats-App-Image-2026-04-07-at-2-51-14-PM.jpg',
                passive: 'Copia de Hielo: Cada vez que la estatua recibe daño y sobrevive, Douma gana un turno adicional.'
            },
            'Gigante de Hielo': {
                name: 'Gigante de Hielo',
                hp: 30, maxHp: 30, summoner: null, team: null, statusEffects: [],
                img: 'https://i.ibb.co/wF1XvPYT/Whats-App-Image-2026-04-07-at-2-48-51-PM.jpg',
                passive: 'Flores de Hielo: Mega Provocacion. Al inicio de ronda: 50% de Congelacion a enemigos y 50% de Megacongelacion. Al final de ronda: 5 daño a enemigos con Congelacion, 10 daño a enemigos con Megacongelacion.'
            },
        };
