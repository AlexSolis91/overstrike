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

            selectSfxUrl: 'https://AlejandroSolis.publit.io/file/Menu-Select-Sound-Super.mp3',

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
                hp: 5,
                maxHp: 5,
                summoner: null,
                team: null,
                passive: 'Caballero de las sombras: Cada vez que el invocador genera carga, ataca a un enemigo aleatorio causando 2 de daño',
                statusEffects: []
            },
            'Iron': {
                name: 'Iron',
                hp: 8,
                maxHp: 8,
                summoner: null,
                team: null,
                passive: 'Iron Strength: Absorbe cualquier daño que fuera a recibir el invocador',
                statusEffects: []
            },
            'Tusk': {
                name: 'Tusk',
                hp: 6,
                maxHp: 6,
                summoner: null,
                team: null,
                passive: 'Himno de Fuego: Cuando un enemigo recibe daño por quemadura, duplica ese daño',
                statusEffects: []
            },
            'Beru': {
                name: 'Beru',
                hp: 6,
                maxHp: 6,
                summoner: null,
                team: null,
                passive: 'Al final de cada ronda causa 5 de daño a un enemigo aleatorio',
                statusEffects: []
            },
            'Bellion': {
                name: 'Bellion',
                hp: 10,
                maxHp: 10,
                summoner: null,
                team: null,
                passive: 'Una vez por ronda, la primera vez que un enemigo usa Special u Over, cancela su activación y causa 4 de daño',
                usedThisRound: false,
                statusEffects: []
            },
            'Kamish': {
                name: 'Kamish',
                hp: 30,
                maxHp: 30,
                summoner: null,
                team: null,
                passive: 'Mega Provocación: Absorbe todo el daño ST y AOE que tu equipo fuera a recibir. Enemigos que lo golpean reciben Quemaduras del 25% por 1 turno',
                statusEffects: []
            },
            'Kaisel': {
                name: 'Kaisel',
                hp: 7,
                maxHp: 7,
                summoner: null,
                team: null,
                passive: 'Maldición de Kaisel: Al final de cada ronda, aplica un Debuff aleatorio a 2 enemigos aleatorios.',
                img: 'https://i.postimg.cc/RhZkjSNk/Captura_de_pantalla_2026_03_11_152341.png',
                isDead: false,
                statusEffects: []
            },

            // ── LICH KING INVOCACIONES ──
            'Sindragosa': {
                name: 'Sindragosa',
                hp: 10, maxHp: 10,
                summoner: null, team: null,
                passive: 'Se invoca con buff Mega Provocación. Genera 1 punto de carga para todo el equipo aliado cada vez que recibe daño.',
                spawnChance: 0.24,
                statusEffects: []
            },
            'Kel Thuzad': {
                name: 'Kel Thuzad',
                hp: 8, maxHp: 8,
                summoner: null, team: null,
                passive: 'Aplica buff de Regeneración al equipo aliado por 20% por turno.',
                spawnChance: 0.24,
                statusEffects: []
            },
            'Darion Morgraine': {
                name: 'Darion Morgraine',
                hp: 8, maxHp: 8,
                summoner: null, team: null,
                passive: 'Aumenta la probabilidad de Crítico al equipo Aliado 50%.',
                spawnChance: 0.24,
                statusEffects: []
            },
            'Bolvar Fordragon': {
                name: 'Bolvar Fordragon',
                hp: 8, maxHp: 8,
                summoner: null, team: null,
                passive: 'Aumenta el daño de las habilidades del equipo aliado 100%.',
                spawnChance: 0.24,
                statusEffects: []
            },
            'Tirion Fordring': {
                name: 'Tirion Fordring',
                hp: 30, maxHp: 30,
                summoner: null, team: null,
                passive: 'Se invoca con buff Mega Provocación permanente. Cura 5 HP por turno al equipo aliado. Genera 5 puntos de Carga por turno al equipo aliado.',
                spawnChance: 0.04,
                statusEffects: []
            },
            // ── OZYMANDIAS INVOCACIONES ──
            'Sphinx Wehem-Mesut': {
                name: 'Sphinx Wehem-Mesut',
                hp: 8, maxHp: 8,
                summoner: null, team: null,
                passive: 'Cada vez que un enemigo recibe daño por Quemadura Solar, pierde 2 cargas.',
                statusEffects: []
            },
            'Ramesseum Tentyris': {
                name: 'Ramesseum Tentyris',
                hp: 20, maxHp: 20,
                summoner: null, team: null,
                passive: 'Al final de cada ronda, si hay enemigos sin debuff Quemadura Solar activo, aplica QS 5% 2 turnos a esos enemigos. Cada vez que un enemigo recibe daño por QS, todos los aliados recuperan 1 HP.',
                statusEffects: []
            }
,
            'Señuelo': {
                name: 'Señuelo',
                hp: 5,
                maxHp: 5,
                summoner: null,
                team: null,
                passive: 'Distraccion de emergencia: Al morir genera 2 puntos de carga al equipo aliado',
                img: 'https://i.postimg.cc/qq0BT0rT/Captura_de_pantalla_2026_03_15_003309.png',
                isDead: false,
                statusEffects: []
            },
            'Drogon': {
                name: 'Drogon',
                hp: 15,
                maxHp: 15,
                summoner: null,
                team: null,
                passive: 'Sombra de Fuego: Mega provocacion. Inflige 3 puntos de Daño a todo el equipo enemigo al final de cada ronda',
                img: 'https://i.postimg.cc/Gtr3CrRL/Captura_de_pantalla_2026_03_15_002747.png',
                isDead: false,
                statusEffects: []
            },
            'Rhaegal': {
                name: 'Rhaegal',
                hp: 8,
                maxHp: 8,
                summoner: null,
                team: null,
                passive: 'Furia Esmeralda: Al final de cada ronda aplica debuff Quemadura de 1 hp a todo el equipo enemigo',
                img: 'https://i.postimg.cc/8cDkSDGT/Captura_de_pantalla_2026_03_15_002820.png',
                isDead: false,
                statusEffects: []
            },
            'Viserion': {
                name: 'Viserion',
                hp: 6,
                maxHp: 6,
                summoner: null,
                team: null,
                passive: 'Llama de Oro: Al final de cada ronda cura 2 hp a todo el equipo aliado',
                img: 'https://i.postimg.cc/2ymjDmYz/Captura_de_pantalla_2026_03_15_002923.png',
                isDead: false,
                statusEffects: []
            },
            'Abu el-Hol Sphinx': {
                name: 'Abu el-Hol Sphinx',
                hp: 8,
                maxHp: 8,
                summoner: null,
                team: null,
                passive: 'Al final de cada ronda todos los enemigos con Quemadura Solar pierden 2 cargas.',
                img: 'https://i.postimg.cc/6qw6XwKQ/Captura_de_pantalla_2026_03_15_002404.png',
                isDead: false,
                statusEffects: []
            },


        };

